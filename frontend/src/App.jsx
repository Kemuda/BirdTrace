import { useEffect, useMemo, useState } from "react";
import PageList from "./pages/PageList.jsx";
import PageChart from "./pages/PageChart.jsx";
import PageMap from "./pages/PageMap.jsx";
import ScrapeStatus from "./components/ScrapeStatus.jsx";
import Info from "./components/Info.jsx";
import { IS_PUBLIC } from "./lib/mode.js";
import { groupByCity, cityOfStop, PUBLIC_CITIES } from "./lib/locations.js";

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

  // 共享数据：行程停留点 / 省份名 / 物种名录 / 地区概览
  const [stops, setStops] = useState([]);
  const [provinces, setProvinces] = useState(["云南", "西藏"]);
  const [taxa, setTaxa] = useState([]);
  const [regions, setRegions] = useState([]);

  // 地点：拆成 城市 + 鸟点 两维（对外版关键改动）
  const [city, setCity] = useState("");
  const [stopId, setStopId] = useState(""); // 选中的具体鸟点 or 地区概览 id；空 = 该市概览默认

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/data/trip/manifest.json");
        if (r.ok) {
          const m = await r.json();
          if (Array.isArray(m.stops) && m.stops.length) setStops(m.stops);
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

  const cities = useMemo(
    () => groupByCity(stops, regions, IS_PUBLIC ? PUBLIC_CITIES : null),
    [stops, regions]
  );

  // Bootstrap：数据到手后自动挑一个"有物种明细"的默认组合，避免开屏空白。
  useEffect(() => {
    if (!cities.length || city) return;
    const firstWithSpecies =
      stops.find((s) => s.species_count_month > 0) || stops.find((s) => s.data_status !== "none");
    const defCity = firstWithSpecies ? cityOfStop(firstWithSpecies.id, cities) : cities[0].name;
    setCity(defCity || cities[0].name);
  }, [cities, stops, city]);

  // 城市换了：默认选该市的地区概览（有则用 regionId）或第一个鸟点。
  // NB: deps 里*不*放 stopId —— 否则用户从鸟点排行里选了一个 scraped point_id
  // （不属于 regionId 也不在 c.points 里），会立刻被这里 reset 回 regionId。
  // 只在城市真的换了时重置，其它情况保留用户的选择。
  useEffect(() => {
    if (!city) return;
    const c = cities.find((x) => x.name === city);
    if (!c) return;
    setStopId((cur) => {
      const belongs = c.regionId === cur || c.points.some((p) => p.id === cur);
      return belongs ? cur : (c.regionId || c.points[0]?.id || "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, cities]);

  const currentCity = cities.find((c) => c.name === city);

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
          <div className="sub">鸟迹</div>
        </div>
      </div>

      {/* 顶部抓取进度条：只在本地/调试版显示（对外版 IS_PUBLIC=1 时隐藏） */}
      {!IS_PUBLIC && (
        <>
          <ScrapeStatus src="/data/scrape_status.json" noun="鸟种明细" />
          <ScrapeStatus src="/data/coords_status.json" noun="坐标" manualCaptcha />
        </>
      )}

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
            {/* 对外版把"地+时→鸟"这种口径提示藏进 ⓘ；本地版直接露出 */}
            {!IS_PUBLIC && <span className="combo">{t.combo}</span>}
          </button>
        ))}
        {IS_PUBLIC && (
          <Info label="三页口径">
            <b>看什么</b> 地 + 时 → 鸟<br />
            <b>去哪看</b> 时 + 鸟 → 地<br />
            <b>何时去</b> 地 + 鸟 → 时
          </Info>
        )}
      </div>

      {page === "list" && (
        <PageList
          cities={cities}
          city={city}
          onCity={setCity}
          currentCity={currentCity}
          stopId={stopId}
          onStop={setStopId}
          regions={regions}
        />
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
