import { useEffect, useState } from "react";
import PageList from "./pages/PageList.jsx";
import PageChart from "./pages/PageChart.jsx";
import PageMap from "./pages/PageMap.jsx";
import ScrapeStatus from "./components/ScrapeStatus.jsx";

const TABS = [
  { id: "list", name: "看什么", combo: "地+时→鸟" },
  { id: "map", name: "去哪看", combo: "时+鸟→地" },
  { id: "chart", name: "何时去", combo: "地+鸟→时" },
];

const VALID = new Set(["list", "chart", "map"]);
const initialPage = () => {
  const p = new URLSearchParams(window.location.search).get("p");
  return VALID.has(p) ? p : "list";
};

export default function App() {
  const [page, setPage] = useState(initialPage);

  // 共享数据：行程停留点 / 省份名 / 物种名录
  const [stops, setStops] = useState([]);
  const [stopId, setStopId] = useState("");
  const [provinces, setProvinces] = useState(["云南", "西藏"]);
  const [taxa, setTaxa] = useState([]);
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/data/trip/manifest.json");
        if (r.ok) {
          const m = await r.json();
          if (Array.isArray(m.stops) && m.stops.length) {
            setStops(m.stops);
            // 默认选第一个**有物种明细**的停留点（光有报告数不够，没 observation
            // 就是空清单），避免一进来就是空页。
            const firstWithSpecies =
              m.stops.find((s) => s.species_count_month > 0) ||
              m.stops.find((s) => s.data_status !== "none");
            setStopId((firstWithSpecies || m.stops[0]).id);
          }
        }
      } catch {
        /* 无 manifest 时名录页自会显示空态 */
      }
      try {
        const r = await fetch("/data/provinces_summary.json");
        if (r.ok) {
          const rows = await r.json();
          if (Array.isArray(rows) && rows.length) {
            const names = rows.map((x) => x.name).filter(Boolean);
            if (names.length) setProvinces(names);
          }
        }
      } catch {
        /* keep fallback */
      }
      try {
        const r = await fetch("/data/taxon_list.json");
        if (r.ok) {
          const rows = await r.json();
          if (Array.isArray(rows)) setTaxa(rows);
        }
      } catch {
        /* leave empty */
      }
      try {
        const r = await fetch("/data/regions/manifest.json");
        if (r.ok) {
          const m = await r.json();
          if (Array.isArray(m.regions)) setRegions(m.regions);
        }
      } catch {
        /* 无地区概览数据时，名录页按停留点直出 */
      }
    })();
  }, []);

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <div className="brand">
            {/* 望远镜鸮：望远镜机身 = 鸮的脸，金瞳 = 招牌金 */}
            <svg width="30" height="30" viewBox="0 0 80 80" fill="none" aria-label="BirdTrace">
              <rect x="9" y="15" width="62" height="56" rx="27" fill="#fbf9f4" stroke="#33312c" strokeWidth="3.5" />
              <path d="M21 17 L29 27 M59 17 L51 27" stroke="#33312c" strokeWidth="3.5" strokeLinecap="round" />
              <circle cx="30" cy="42" r="11" fill="none" stroke="#33312c" strokeWidth="3.5" />
              <circle cx="50" cy="42" r="11" fill="none" stroke="#33312c" strokeWidth="3.5" />
              <circle cx="30" cy="42" r="4.2" fill="#d9a92e" />
              <circle cx="50" cy="42" r="4.2" fill="#d9a92e" />
              <path d="M40 49 L36 56 L44 56 Z" fill="#33312c" />
            </svg>
            <h1>
              <span className="b">Bird</span>
              <span className="t">Trace</span>
            </h1>
          </div>
          <div className="sub">中国观鸟记录中心数据 · 探索界面</div>
        </div>
      </div>

      <ScrapeStatus src="/data/scrape_status.json" noun="鸟种明细" />
      <ScrapeStatus src="/data/coords_status.json" noun="坐标" manualCaptcha />

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={"tab" + (page === t.id ? " on" : "")}
            onClick={() => {
              setPage(t.id);
              const u = new URL(window.location);
              u.searchParams.set("p", t.id);
              window.history.replaceState({}, "", u);
            }}
          >
            {t.name}
            <span className="combo">{t.combo}</span>
          </button>
        ))}
      </div>

      {page === "list" && (
        <PageList stops={stops} stopId={stopId} onStop={setStopId} regions={regions} />
      )}
      {page === "chart" && <PageChart provinces={provinces} taxa={taxa} />}
      {page === "map" && <PageMap />}

      <div className="foot">
        数据来源：
        <a href="https://birdreport.cn" target="_blank" rel="noreferrer">
          中国观鸟记录中心
        </a>
        。非官方探索界面。
      </div>
    </div>
  );
}
