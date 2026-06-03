import { useEffect, useState } from "react";
import BarChart from "./components/BarChart.jsx";
import { mockBarChart, PROVINCES as FALLBACK_PROVINCES } from "./mocks/barChart.js";

const TAXON_DATALIST_ID = "taxon-options";

export default function App() {
  const [provinces, setProvinces] = useState(FALLBACK_PROVINCES);
  const [taxa, setTaxa] = useState([]);
  const [province, setProvince] = useState("云南");
  const [taxon, setTaxon] = useState("黑颈鹤");
  const [data, setData] = useState(mockBarChart);
  const [source, setSource] = useState("mock");
  const [loading, setLoading] = useState(false);
  const [provincesStats, setProvincesStats] = useState(null);
  const [provinceBundle, setProvinceBundle] = useState(null);

  // Hydrate dropdowns from static exports. Both are optional — if a file
  // hasn't been generated yet (e.g. taxon_list.json before the user runs
  // fetch_taxon_list.py), keep using the mock fallback.
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/data/provinces_summary.json");
        if (resp.ok) {
          const rows = await resp.json();
          if (Array.isArray(rows) && rows.length) {
            setProvincesStats(rows);
            setProvinces(rows.map((r) => r.name).filter(Boolean));
          }
        }
      } catch { /* keep fallback */ }
      try {
        const resp = await fetch("/data/taxon_list.json");
        if (resp.ok) {
          const rows = await resp.json();
          if (Array.isArray(rows)) setTaxa(rows);
        }
      } catch { /* leave taxa empty */ }
    })();
  }, []);

  // Pull in the whole-province bundle whenever the user switches province.
  // One file holds every species' monthly counts, so subsequent species
  // changes are instant and never re-fetch.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await fetch(`/data/province/${encodeURIComponent(province)}.json`);
        if (!resp.ok) {
          if (alive) setProvinceBundle(null);
          return;
        }
        const bundle = await resp.json();
        if (alive) setProvinceBundle(bundle);
      } catch {
        if (alive) setProvinceBundle(null);
      }
    })();
    return () => { alive = false; };
  }, [province]);

  function _barFromBundle(bundle, name) {
    const species = bundle.species.find((s) => s.name === name);
    if (!species) return null;
    return bundle.total_reports.map((total, i) => {
      const m = String(i + 1).padStart(2, "0");
      const withSp = species.monthly[i] || 0;
      return {
        month: m,
        reports_with_species: withSp,
        total_reports: total,
        frequency_pct: total ? Math.round((withSp / total) * 1000) / 10 : 0,
      };
    });
  }

  async function load() {
    setLoading(true);
    try {
      if (provinceBundle) {
        const rows = _barFromBundle(provinceBundle, taxon);
        if (rows) {
          setData(rows);
          setSource("real");
          return;
        }
      }
      const url = `/data/bar_chart/${encodeURIComponent(province)}__${encodeURIComponent(taxon)}.json`;
      const resp = await fetch(url);
      if (resp.ok) {
        setData(await resp.json());
        setSource("real");
      } else {
        setData(mockBarChart);
        setSource("mock");
      }
    } catch {
      setData(mockBarChart);
      setSource("mock");
    } finally {
      setLoading(false);
    }
  }

  const provinceMeta = provincesStats?.find((r) => r.name === province);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">BirdTrace</h1>
          <p className="text-slate-600 text-sm mt-1">
            中国观鸟记录中心数据探索 · 12 个月出现频率柱状图
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 mb-1">省份</span>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 min-w-32"
              >
                {provinces.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 mb-1">物种（中文名）</span>
              <input
                value={taxon}
                onChange={(e) => setTaxon(e.target.value)}
                list={taxa.length ? TAXON_DATALIST_ID : undefined}
                className="border border-slate-300 rounded px-2 py-1 min-w-48"
                placeholder={taxa.length ? "" : "输入鸟名（暂无名录可补全）"}
              />
              {taxa.length ? (
                <datalist id={TAXON_DATALIST_ID}>
                  {taxa.slice(0, 1500).map((t) => (
                    <option key={t.id ?? t.name} value={t.name}>
                      {t.latinname || ""}
                    </option>
                  ))}
                </datalist>
              ) : null}
            </label>
            <button
              onClick={load}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-4 py-1.5 rounded"
            >
              {loading ? "加载中…" : "查看"}
            </button>
            <span className={`text-xs px-2 py-1 rounded ${source === "real" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
              数据源：{source === "real" ? "本地导出" : "示例数据"}
            </span>
          </div>
        </div>

        {provinceMeta ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 px-4 py-2 mb-4 text-sm text-slate-600">
            <span className="font-medium text-slate-900">{provinceMeta.name}</span>
            <span className="ml-3">鸟种 {provinceMeta.value ?? "?"}</span>
            <span className="ml-3">报告 {provinceMeta.report ?? "?"}</span>
            <span className="ml-3">记录 {provinceMeta.record ?? "?"}</span>
          </div>
        ) : null}

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <h2 className="text-base font-medium mb-2">
            {province} · {taxon}
          </h2>
          <BarChart data={data} />
        </div>

        <footer className="text-xs text-slate-500 mt-6">
          数据来源：
          <a href="https://birdreport.cn" className="underline ml-1" target="_blank" rel="noreferrer">
            中国观鸟记录中心
          </a>
          。本项目为非官方探索界面。
        </footer>
      </div>
    </div>
  );
}
