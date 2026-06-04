import { useEffect, useState } from "react";
import QueryBar from "../components/QueryBar.jsx";
import ReportList from "../components/ReportList.jsx";
import TargetList from "../components/TargetList.jsx";
import SpeciesLocations from "../components/SpeciesLocations.jsx";
import { useMarks } from "../hooks/useMarks.js";

// 频率分层：几乎必见 / 有机会 / 撞大运·稀有。
const TIERS = [
  { cls: "tier-must", name: "几乎必见", hint: "频率 >60%", test: (f) => f > 60 },
  { cls: "tier-mid", name: "有机会", hint: "20–60%", test: (f) => f >= 20 && f <= 60 },
  { cls: "tier-rare", name: "撞大运 · 稀有", hint: "<20%", test: (f) => f < 20 },
];

function SpRow({ d, mark, onToggle, onNote, onWhere }) {
  const rare = d.frequency_pct < 20;
  const L = d.links || {};
  const m = mark || {};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function openNote() {
    setDraft(m.note || "");
    setEditing(true);
  }
  function saveNote() {
    onNote(d.name, draft.trim());
    setEditing(false);
  }

  return (
    <div className="row">
      <div className="sp-name">
        <span className="cn">
          {d.name}
          {rare && <span className="star" title="稀有">★</span>}
          {m.seen && <span className="badge seen" title="已见过">👁</span>}
          {m.target && <span className="badge tgt" title="目标鸟种">🎯</span>}
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
        <span className="chips">
          <button className={"chip" + (m.target ? " on" : "")} onClick={() => onToggle(d.name, "target")}>
            ★目标
          </button>
          <button className={"chip" + (m.learned ? " on" : "")} onClick={() => onToggle(d.name, "learned")}>
            📖已学习
          </button>
          <button className={"chip" + (m.seen ? " on" : "")} onClick={() => onToggle(d.name, "seen")}>
            👁已见过
          </button>
          <button className={"chip" + (m.note ? " on" : "")} onClick={openNote}>
            ✎笔记
          </button>
          <button className="chip" onClick={() => onWhere(d.name)}>
            📍在哪见过
          </button>
        </span>
        {editing ? (
          <div className="note-edit">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="记点备注…（识别要点、想拍的姿态、栖息地…）"
              rows={2}
              autoFocus
            />
            <div className="note-act">
              <button className="btn sm" onClick={saveNote}>保存</button>
              <button className="btn sm ghost" onClick={() => setEditing(false)}>取消</button>
            </div>
          </div>
        ) : (
          m.note && (
            <div className="note-show" onClick={openNote} title="点击编辑">
              ✎ {m.note}
            </div>
          )
        )}
      </div>
      <div className="freq">
        {d.frequency_pct}
        <small>%</small>
      </div>
    </div>
  );
}

function Tier({ cls, name, hint, rows, marks, onToggle, onNote, onWhere }) {
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
        <SpRow
          key={d.name}
          d={d}
          mark={marks[d.name]}
          onToggle={onToggle}
          onNote={onNote}
          onWhere={onWhere}
        />
      ))}
    </div>
  );
}

export default function PageList({ stops, stopId, onStop }) {
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [onlyTarget, setOnlyTarget] = useState(false);
  const [showFreq, setShowFreq] = useState(false);
  const [whereSpecies, setWhereSpecies] = useState(null);
  const { marks, toggle, setNote, importMarks } = useMarks();

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

  const markCount = Object.keys(marks).length;
  const targetCount = Object.values(marks).filter((m) => m.target).length;
  const shownSpecies = onlyTarget ? species.filter((s) => marks[s.name]?.target) : species;

  const years = bundle?.report_years || {};
  const yearStr = Object.keys(years)
    .sort()
    .map((y) => `${y} 年（${years[y]} 份）`)
    .join(" + ");
  const pending = reports.filter((r) => !r.has_detail).length;

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
        <div className="list-tools">
          <button type="button" className="btn sm" onClick={() => setShowTargets(true)}>
            ★ 我的鸟种{markCount ? ` (${markCount})` : ""}
          </button>
          {targetCount > 0 && (
            <label className="chk">
              <input
                type="checkbox"
                checked={onlyTarget}
                onChange={(e) => setOnlyTarget(e.target.checked)}
              />
              只看目标
            </label>
          )}
        </div>
      </div>

      {status !== "none" && species.length > 0 && (
        <div className="freqinfo">
          <button type="button" className="fi-toggle" onClick={() => setShowFreq((v) => !v)}>
            ⓘ 频率怎么算{showFreq ? "（收起）" : ""}
          </button>
          {showFreq && (
            <div className="fi-body">
              <p>
                <b>频率 = 含该鸟的报告数 ÷ 该地 6 月总报告数 × 100。</b>
                和 eBird 的「frequency」同口径：衡量的是<b>遇见率</b>（多少份清单记录到它），不是数量多少。
              </p>
              {pending > 0 && (
                <p className="fi-warn">
                  注意：现在分母里有 {pending} 份报告是「明细待抓」（声明有鸟、但后台还没抓到鸟种清单），
                  所以这些鸟的频率<b>偏低</b> —— 等明细补抓完会自动上调。点上方「{n} 份报告」可逐份核对。
                </p>
              )}
              {yearStr && (
                <p className="fi-year">
                  样本年份：{yearStr} 6 月合并。<small>（已包含往年同期数据；样本越薄、越靠合并历年补足）</small>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="empty">加载中…</div>
      ) : status === "none" || !species.length ? (
        <div className="empty">
          <div className="big">这一段暂无物种记录</div>
          {stop?.province === "西藏"
            ? "阿里等偏远段在中国观鸟记录中心本就稀疏；可换拉萨/日喀则段，或等抓取补充。"
            : "该地行程月样本不足；可换相邻停留点。"}
        </div>
      ) : onlyTarget && shownSpecies.length === 0 ? (
        <div className="empty">
          <div className="big">这一段没有你的目标鸟种</div>
          已收藏 {targetCount} 种目标，但这段 6 月记录里都没出现；可取消「只看目标」看全部。
        </div>
      ) : (
        TIERS.map((t) => (
          <Tier
            key={t.cls}
            cls={t.cls}
            name={t.name}
            hint={t.hint}
            rows={shownSpecies.filter((s) => t.test(s.frequency_pct))}
            marks={marks}
            onToggle={toggle}
            onNote={setNote}
            onWhere={setWhereSpecies}
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

      {showTargets && (
        <TargetList
          marks={marks}
          toggle={toggle}
          importMarks={importMarks}
          onClose={() => setShowTargets(false)}
        />
      )}

      {whereSpecies && (
        <SpeciesLocations name={whereSpecies} onClose={() => setWhereSpecies(null)} />
      )}
    </div>
  );
}
