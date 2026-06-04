import { useState } from "react";

// 报告列表弹窗（Amber #3）：点「N 份报告」打开 → 列出编号/时间/用户/地点/鸟种数，
// 点某条报告展开它的鸟种明细。区分「明细已抓」与「明细待抓」（后者是频率偏低的原因）。
function fmtTime(t) {
  if (!t) return "—";
  // "2025-06-19 21:00" -> "06-19 21:00"
  const m = t.match(/\d{4}-(\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : t;
}

export default function ReportList({ label, reports, onClose }) {
  const [open, setOpen] = useState(null);
  const withDetail = reports.filter((r) => r.has_detail).length;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <b>{label} · 6 月报告（{reports.length}）</b>
          <button className="x" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-note">
          点报告看鸟种明细。{withDetail}/{reports.length} 份已有明细；
          「明细待抓」= 后台还没抓到该报告的鸟种清单，会让频率偏低。
        </div>

        <div className="rl-head">
          <span>时间</span>
          <span>用户</span>
          <span>地点</span>
          <span className="r">鸟种</span>
        </div>
        <div className="rl-body">
          {reports.map((r) => {
            const expanded = open === r.report_id;
            return (
              <div key={r.report_id} className={"rl-item" + (expanded ? " on" : "")}>
                <div className="rl-row" onClick={() => setOpen(expanded ? null : r.report_id)}>
                  <span className="t">{fmtTime(r.time)}</span>
                  <span className="u" title={r.user || ""}>{r.user || "—"}</span>
                  <span className="p" title={r.point_name || ""}>{r.point_name || "—"}</span>
                  <span className="r">
                    {r.has_detail ? `${r.species.length} 种` : <em className="todo">明细待抓</em>}
                  </span>
                </div>
                {expanded && (
                  <div className="rl-sp">
                    {r.has_detail ? (
                      r.species.map((s) => (
                        <div key={s.name} className="rl-spx">
                          <span className="cn">{s.name}</span>
                          <span className="en">{s.english_name || ""}</span>
                          {s.count ? <span className="ct">×{s.count}</span> : null}
                        </div>
                      ))
                    ) : (
                      <div className="rl-todo">
                        观察者声明 {r.declared_count} 种，鸟种明细后台抓取中。
                      </div>
                    )}
                    <div className="rl-meta">报告编号 {r.serial || r.report_id.slice(0, 8)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
