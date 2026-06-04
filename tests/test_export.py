"""Offline unit tests for the export pipeline's pure logic.

No network, no real DB — uses an in-memory SQLite. Run with either:
    python3 -m unittest discover -s tests
    pytest tests/test_export.py

(The `probe_*.py` files in this dir are NOT tests — they hit the live
birdreport.cn API and write sample files; run them by hand, not in CI.)
"""
import sqlite3
import sys
import unittest
from pathlib import Path

# export_json lives in data/process and imports its siblings by bare name.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data" / "process"))
import export_json as E  # noqa: E402

SCHEMA = """
CREATE TABLE checklists (
    report_id TEXT PRIMARY KEY, serial_id TEXT, start_time TEXT,
    province TEXT, city TEXT, district TEXT, point_name TEXT,
    lat REAL, lng REAL, taxon_count INTEGER, username TEXT
);
CREATE TABLE observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, report_id TEXT,
    taxon_id INTEGER, taxon_name TEXT, latin_name TEXT, english_name TEXT, taxon_count INTEGER
);
"""


def all_sampled(monthly_present):
    """12-mo total_reports where every month has sampling effort (=1)."""
    return [1] * 12


def month_vec(*idxs):
    """12-length vector with 1 at the given month indexes (0=Jan)."""
    v = [0] * 12
    for i in idxs:
        v[i] = 1
    return v


class TestSeasonal(unittest.TestCase):
    """classify_seasonal is DORMANT (not wired into export) but still tested,
    so if it's ever re-enabled the behavior is pinned."""

    def test_resident_present_summer_and_winter(self):
        # seen in Jun(5) and Dec(11), all months sampled
        self.assertEqual(E.classify_seasonal(month_vec(5, 11), [1] * 12), "留鸟")

    def test_summer_visitor(self):
        self.assertEqual(E.classify_seasonal(month_vec(5), [1] * 12), "夏候鸟")

    def test_winter_visitor(self):
        self.assertEqual(E.classify_seasonal(month_vec(0), [1] * 12), "冬候鸟")

    def test_passage_only(self):
        # seen only in Mar(2), a passage month
        self.assertEqual(E.classify_seasonal(month_vec(2), [1] * 12), "旅鸟")

    def test_uncertain_when_only_one_season_sampled(self):
        # only June sampled (Tibet reality) -> can't tell
        june_only_sampled = month_vec(5)
        self.assertEqual(E.classify_seasonal(month_vec(5), june_only_sampled), "不确定")

    def test_uncertain_when_never_present(self):
        self.assertEqual(E.classify_seasonal([0] * 12, [1] * 12), "不确定")


class TestLinks(unittest.TestCase):
    def test_ebird_code_known_species(self):
        self.assertEqual(E.ebird_code("Acridotheres cristatellus"), "cremyn")

    def test_ebird_code_unknown_returns_none(self):
        self.assertIsNone(E.ebird_code("Notabird madeup"))
        self.assertIsNone(E.ebird_code(None))

    def test_species_links_all_three(self):
        links = E.species_links("八哥", "Acridotheres cristatellus", "cremyn")
        self.assertEqual(links["ebird"], "https://ebird.org/species/cremyn")
        self.assertIn("dongniao.net/nd/", links["dongniao"])
        self.assertEqual(
            links["xenocanto"], "https://xeno-canto.org/species/Acridotheres-cristatellus"
        )

    def test_species_links_degrade_gracefully(self):
        # no ebird code, no dongniao match, but latin present -> only xenocanto
        links = E.species_links("虚构鸟", "Genus species", None)
        self.assertNotIn("ebird", links)
        self.assertEqual(links["xenocanto"], "https://xeno-canto.org/species/Genus-species")


class TestFilters(unittest.TestCase):
    def test_province_only(self):
        self.assertEqual(E._filters("", (), None, ()), "")

    def test_districts(self):
        f = E._filters("", ("玉龙纳西族自治县",), None, ())
        self.assertEqual(f, " AND district IN (:d0)")

    def test_city_only_when_no_districts(self):
        self.assertEqual(E._filters("", (), "拉萨市", ()), " AND city = :city")

    def test_points_with_prefix(self):
        f = E._filters("c.", ("德钦县",), None, ("飞来寺", "梅里"))
        self.assertIn("c.district IN (:d0)", f)
        self.assertIn("c.point_name LIKE :p0 OR c.point_name LIKE :p1", f)


class TestBundle(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(":memory:")
        self.conn.executescript(SCHEMA)
        rows = [
            # report_id, prov, city, district, point, start_time, [(taxon, latin)]
            ("r1", "云南", "丽江市", "玉龙纳西族自治县", "玉龙雪山", "2025-06-10 08:00",
             [("八哥", "Acridotheres cristatellus"), ("大杜鹃", "Cuculus canorus")]),
            ("r2", "云南", "丽江市", "玉龙纳西族自治县", "蓝月谷", "2025-06-12 08:00",
             [("八哥", "Acridotheres cristatellus")]),
            ("r3", "云南", "丽江市", "古城区", "丽江古城", "2025-12-01 08:00",
             [("山斑鸠", "Streptopelia orientalis")]),
        ]
        for rid, prov, city, dist, pt, t, obs in rows:
            self.conn.execute(
                "INSERT INTO checklists(report_id,province,city,district,point_name,start_time)"
                " VALUES(?,?,?,?,?,?)", (rid, prov, city, dist, pt, t))
            for taxon, latin in obs:
                self.conn.execute(
                    "INSERT INTO observations(report_id,taxon_name,latin_name)"
                    " VALUES(?,?,?)", (rid, taxon, latin))
        self.conn.commit()

    def test_province_bundle_counts(self):
        b = E._bundle(self.conn, "云南")
        # June(idx5)=2 checklists, Dec(idx11)=1
        self.assertEqual(b["total_reports"][5], 2)
        self.assertEqual(b["total_reports"][11], 1)
        bage = {s["name"]: s for s in b["species"]}
        self.assertEqual(bage["八哥"]["monthly"][5], 2)   # seen in both June lists
        self.assertEqual(bage["八哥"]["ebird_code"], "cremyn")

    def test_point_filter_isolates_scenic_spot(self):
        # only 蓝月谷 -> just r2 -> 八哥 in June, no 大杜鹃
        b = E._bundle(self.conn, "云南", ("玉龙纳西族自治县",), None, ("蓝月谷",))
        names = {s["name"] for s in b["species"]}
        self.assertEqual(names, {"八哥"})
        self.assertEqual(b["total_reports"][5], 1)

    def test_trip_stop_bundle_month_species_ranked_and_linked(self):
        stop = {"id": "yulong", "label": "玉龙雪山", "dates": "6/10",
                "province": "云南", "districts": ("玉龙纳西族自治县",),
                "points": ("玉龙雪山", "蓝月谷")}
        b = E.trip_stop_bundle(self.conn, stop)
        self.assertEqual(b["data_status"], "thin")          # 2 reports < 15
        self.assertEqual(b["total_reports_month"], 2)
        self.assertNotIn("species", b)                      # slimmed 12-mo array gone
        top = b["month_species"][0]
        self.assertEqual(top["name"], "八哥")               # 2 reports, ranked first
        self.assertEqual(top["frequency_pct"], 100.0)       # 2/2
        self.assertIn("ebird", top["links"])


if __name__ == "__main__":
    unittest.main()
