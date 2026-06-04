import { useEffect, useState } from "react";
import QueryBar from "../components/QueryBar.jsx";
import ReportList from "../components/ReportList.jsx";

// 频率分层：几乎必见 / 有机会 / 撞大运·稀有。
const TIERS = [
  { cls: "tier-must", name: "几乎必见", hint: "频率 >60%", test: (f) => f > 60 },
  { cls: "tier-mid", name: "有机会", hint: "20–60%", test: (f) => f >= 20 && f <= 60 },
  { cls: "tier-rare", name: "撞大运 · 稀有", hint: "<20%", test: (f) => f < 20 },
];

function SpRow({ d }) {
  const rare = d.frequency_pct < 20;
  const L = d.links || {};
  return (
    <div className="row">
      <div className="sp-name">
        <span className="cn">
          {d.name}
          {rare && <span className="star">★</span>}
        </span>
        <span className="la">{d.english_name || ""}</span>
        <span className="links">
          {L.ebird && (
            <a href={L.ebird} target="_blank" rel="noreferrer">eBird</a>
          )}
          {L.dongniao && (
            <a href={L.dongniao} target="_blank" rel="noreferrer">懂鸟</a>
          )}
          {L.xenocanto && (
            <a href={L.xenocanto} target="_blank" rel="noreferrer">鸣声♪</a>
          )}
        </span>
      </div>
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
  const [showReports, setShowReports] = useState(false);

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
  const reports = bundle?.reports || [];
  const stop = stops.find((s) => s.id === stopId);

  // 可点的「N 份报告」→ 打开报告列表弹窗
  const reportLink = reports.length ? (
    <button type="button" className="rlink" onClick={() => setShowReports(true)}>
      {n} 份报告
    </button>
  ) : (
    `${n} 份报告`
  );

  function exportList() {
    if (!species.length) return;
    const head = `${stop?.label || stopId} · 6月目标鸟单（基于 ${n} 份报告）\n物种\t英文名\t频率%\t报告数\n`;
    const body = species
      .map((s) => `${s.name}\t${s.english_name || ""}\t${s.frequency_pct}\t${s.reports}`)
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
      <div className="wf-desc">行程驱动的「时间 + 地点 → 鸟种」</div>

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

      {stop?.region && <div className="region">📍 {stop.region}</div>}

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
          {status === "none" ? (
            "本地暂无该段报告"
          ) : status === "thin" ? (
            <>仅 {reportLink} · 样本薄，频率仅供参考</>
          ) : (
            <>基于 {reportLink} · 行程月</>
          )}
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
          <span><span className="star">★</span>稀有</span>
        </div>
        <button className="btn solid" onClick={exportList} disabled={!species.length}>
          ⤓ 导出目标鸟单
        </button>
      </div>

      {showReports && (
        <ReportList
          label={stop?.label || stopId}
          reports={reports}
          onClose={() => setShowReports(false)}
        />
      )}
    </div>
  );
}
