import { useState } from "react";

// 名录的 web 行（.wr 布局，定稿自 birdtrace-mockup-v3）：
//   [中文俗名 + 英文俗名(副) · 稀有红点] | [概率% + 条 · 在哪见过] | [🎯目标 📖学习 👁见过 ✎笔记]
//   外链(eBird/懂鸟/鸣声) hover 展开；笔记内联可编辑。标记露出、不藏抽屉。
// 频率分层：几乎必见 / 有机会 / 撞大运·稀有。两处名录（行程停留点 / 鸟点叶子页）共用。
const TIERS = [
  { cls: "tier-must", name: "几乎必见", hint: "频率 >60%", test: (f) => f > 60 },
  { cls: "tier-mid", name: "有机会", hint: "20–60%", test: (f) => f >= 20 && f <= 60 },
  { cls: "tier-rare", name: "撞大运 · 稀有", hint: "<20%", test: (f) => f < 20 },
];

function WRow({ d, mark, onToggle, onNote, onWhere }) {
  const rare = d.frequency_pct < 20; // = 撞大运档 = 局部稀有红点（对齐 Merlin）
  const L = d.links || {};
  const m = mark || {};
  const [noteOpen, setNoteOpen] = useState(!!m.note);
  const hasLinks = L.ebird || L.dongniao || L.xenocanto;

  return (
    <div className="wr">
      <div className="nm">
        <div className="cnl">
          <span className="wcn">{d.name}</span>
          {rare && <span className="wrdot" title="局部稀有（在这里这个月不容易撞到）" />}
        </div>
        <span className="wen">{d.english_name || ""}</span>
      </div>

      <div className="wfreq">
        <span className="wfn">
          {d.frequency_pct}
          <small>%</small>
        </span>
        <span className="wfb">
          <i style={{ width: `${Math.min(100, d.frequency_pct)}%` }} />
        </span>
        {onWhere && (
          <button className="wwhere" onClick={() => onWhere(d.name)}>
            📍 在哪见过 ›
          </button>
        )}
      </div>

      <div className="wmarks">
        <button className={"wmk" + (m.target ? " on" : "")} onClick={() => onToggle(d.name, "target")}>
          🎯 目标
        </button>
        <button className={"wmk" + (m.learned ? " on" : "")} onClick={() => onToggle(d.name, "learned")}>
          📖 学习
        </button>
        <button className={"wmk" + (m.seen ? " on seen" : "")} onClick={() => onToggle(d.name, "seen")}>
          👁 见过
        </button>
        <button className={"wmk" + (m.note || noteOpen ? " on" : "")} onClick={() => setNoteOpen((o) => !o)}>
          ✎ 笔记
        </button>
      </div>

      {hasLinks && (
        <div className="wlinks">
          <span className="lk-lab">外链</span>
          {L.ebird && (
            <a href={L.ebird} target="_blank" rel="noreferrer">
              eBird
            </a>
          )}
          {L.dongniao && (
            <a href={L.dongniao} target="_blank" rel="noreferrer">
              懂鸟
            </a>
          )}
          {L.xenocanto && (
            <a href={L.xenocanto} target="_blank" rel="noreferrer">
              鸣声 ♪
            </a>
          )}
        </div>
      )}

      {noteOpen && (
        <div
          className="wnote"
          contentEditable
          suppressContentEditableWarning
          data-ph="写点笔记…（识别要点、想拍的姿态、栖息地…）"
          onBlur={(e) => onNote(d.name, e.currentTarget.textContent.trim())}
        >
          {m.note || ""}
        </div>
      )}
    </div>
  );
}

export default function SpeciesChecklist({ species, marks, onToggle, onNote, onWhere }) {
  return (
    <>
      <div className="wlist-h">
        <span>鸟种</span>
        <span className="c">概率 · 出处</span>
        <span style={{ textAlign: "right" }}>目标 / 学习 / 见过 / 笔记</span>
      </div>
      {TIERS.map((t) => {
        const rows = species.filter((s) => t.test(s.frequency_pct));
        if (!rows.length) return null;
        return (
          <div key={t.cls} className={"tier " + t.cls}>
            <div className="tier-h">
              <span className="bar3">
                <i />
                <i />
                <i />
              </span>
              {t.name} <span className="ct">{t.hint} · {rows.length} 种</span>
            </div>
            {rows.map((d) => (
              <WRow
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
      })}
    </>
  );
}
