import { useEffect, useState } from "react";
import QueryBar from "../components/QueryBar.jsx";

// 频率分层：几乎必见 / 有机会 / 撞大运·稀有。
const TIERS = [
  { cls: "tier-must", name: "几乎必见", hint: "频率 >60%", test: (f) => f > 60 },
  { cls: "tier-mid", name: "有机会", hint: "20–60%", test: (f) => f >= 20 && f <= 60 },
  { cls: "tier-rare", name: "撞大运 · 稀有", hint: "<20%", test: (f) => f < 20 },
];

// 居留型 → 配色 class。居留型由后端从省级全年模式推断（见 export_json.py）。
const SEASON_CLS = {
  留鸟: "resident",
  夏候鸟: "summer",
  冬候鸟: "winter",
  旅鸟: "passage",
  不确定: "uncertain",
};

function SpRow({ d }) {
  const rare = d.frequency_pct < 20;
  const eb = d.ebird_code ? `https://ebird.org/species/${d.ebird_code}` : null;
  return (
    <div className="row">
      <div className="sp-name">
        <span className="cn">
          {eb ? (
            <a href={eb} target="_blank" rel="noreferrer" title="在 eBird 上查看">
              {d.name}
            </a>
          ) : (
            d.name
          )}
          {rare && <span className="star">★</span>}
        </span>
        <span className="la">{d.latin_name || ""}</span>
      </div>
      <span className={"season " + (SEASON_CLS[d.seasonal] || "uncertain")}>
        {d.seasonal}
      </span>
      <div className="freq">
        {d.frequency_pct}
        <small>%</small>
      </div>
    </div>
  );
}

function Tier({ cls, name, hint, rows }) {
  if (!rows.length) return null;
  return (
    <div className={"tier " + cls}>
      <div className="tier-h">
        <span className="bar3">
          <i></i>
          <i></i>
          <i></i>
        </span>
        {name} <span className="ct">{hint} · {rows.length} 种</span>
      </div>
      {rows.map((d) => (
        <SpRow key={d.name} d={d} />
      ))}
    </div>
  );
}

export default function PageList({ stops, stopId, onStop }) {
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!stopId) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const resp = await fetch(`/data/trip/${encodeURIComponent(stopId)}.json`);
        const b = resp.ok ? await resp.json() : null;
        if (alive) setBundle(b);
      } catch {
        if (alive) setBundle(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [stopId]);

  const species = bundle?.month_species || [];
  const status = bundle?.data_status;
  const n = bundle?.total_reports_month ?? 0;
  const stop = stops.find((s) => s.id === stopId);

  function exportList() {
    if (!species.length) return;
    const head = `${stop?.label || stopId} · 6月目标鸟单（基于 ${n} 份报告）\n物种\t拉丁名\t频率%\t报告数\n`;
    const body = species
      .map((s) => `${s.name}\t${s.latin_name || ""}\t${s.frequency_pct}\t${s.reports}`)
      .join("\n");
    const blob = new Blob([head + body], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${stopId}-6月鸟单.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="wf">
      <div className="wf-tag">
        <b>看什么</b>
        <span className="combo">地 + 时 → 鸟</span>
      </div>

      <QueryBar
        where={
          <select value={stopId} onChange={(e) => onStop(e.target.value)}>
            {stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        }
        when="6 月（行程月）"
        what=""
        answer="what"
      />

      {/* 季节速读：当前只给事实速读，AI 自然语言摘要在 Backlog */}
      {status !== "none" && species.length > 0 && (
        <div className="concl">
          <span className="k">速读</span>
          <span className="v">
            6 月共报告 {species.length} 种{" "}
            <small>
              · 最常见「{species[0].name}」{species[0].frequency_pct}%
            </small>
          </span>
        </div>
      )}

      <div className="meta">
        <div className={"trust" + (status === "thin" ? " warn" : "")}>
          {status === "none"
            ? "本地暂无该段报告"
            : status === "thin"
            ? `仅 ${n} 份报告 · 样本薄，频率仅供参考`
            : `基于 ${n} 份报告 · 行程月`}
        </div>
      </div>

      {loading ? (
        <div className="empty">加载中…</div>
      ) : status === "none" || !species.length ? (
        <div className="empty">
          <div className="big">这一段暂无物种记录</div>
          {stop?.province === "西藏"
            ? "阿里等偏远段在中国观鸟记录中心本就稀疏；可换拉萨/日喀则段，或等抓取补充。"
            : "该地行程月样本不足；可换相邻停留点。"}
        </div>
      ) : (
        TIERS.map((t) => (
          <Tier
            key={t.cls}
            cls={t.cls}
            name={t.name}
            hint={t.hint}
            rows={species.filter((s) => t.test(s.frequency_pct))}
          />
        ))
      )}

      <div className="take">
        <div className="legend">
          <span><span className="season resident">留鸟</span></span>
          <span><span className="season summer">夏候鸟</span></span>
          <span><span className="season winter">冬候鸟</span></span>
          <span><span className="season passage">旅鸟</span></span>
          <span><span className="season uncertain">不确定</span></span>
          <span><span className="star">★</span>稀有 · 点鸟名→eBird</span>
        </div>
        <button className="btn solid" onClick={exportList} disabled={!species.length}>
          ⤓ 导出当日目标鸟单
        </button>
      </div>
    </div>
  );
}
