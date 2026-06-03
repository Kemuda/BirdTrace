import { useState } from "react";
import BarChart from "./components/BarChart.jsx";
import { mockBarChart, PROVINCES } from "./mocks/barChart.js";

export default function App() {
  const [province, setProvince] = useState("云南");
  const [taxon, setTaxon] = useState("黑颈鹤");
  const [data, setData] = useState(mockBarChart);
  const [source, setSource] = useState("mock");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
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
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 mb-1">物种（中文名）</span>
              <input
                value={taxon}
                onChange={(e) => setTaxon(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 min-w-48"
              />
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
