import { useRef } from "react";

// 「我的鸟种」聚合视图（Amber #3.1/#3.3/#3.4）：跨停留点列出目标/已见过/已学习 +
// 笔记，并提供一键备份导出/导入（防 localStorage 被清）。
const SECTIONS = [
  { key: "target", icon: "★", name: "目标鸟种", empty: "还没收藏目标。点列表里鸟种的「★目标」收藏。" },
  { key: "seen", icon: "👁", name: "已见过", empty: "还没标记已见过。" },
  { key: "learned", icon: "📖", name: "已学习", empty: "还没标记已学习。" },
];

export default function TargetList({ marks, toggle, importMarks, onClose }) {
  const fileRef = useRef(null);
  const names = Object.keys(marks).sort((a, b) => a.localeCompare(b, "zh"));

  function exportBackup() {
    const blob = new Blob([JSON.stringify(marks, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `birdtrace-我的鸟种-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onImportFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importMarks(JSON.parse(reader.result), "merge");
      } catch {
        alert("导入失败：不是有效的备份文件");
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <b>我的鸟种</b>
          <button className="x" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="mk-backup">
          <button className="btn sm" onClick={exportBackup} disabled={!names.length}>
            ⤓ 导出备份
          </button>
          <button className="btn sm" onClick={() => fileRef.current?.click()}>
            ⤒ 导入备份
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            hidden
          />
          <span className="mk-hint">
            存在本浏览器。建议偶尔导出备份 —— 清「网站数据」或换设备不会自动同步。
          </span>
        </div>

        <div className="rl-body">
          {names.length === 0 ? (
            <div className="empty" style={{ margin: 16 }}>
              <div className="big">还没有任何标记</div>
              在「看什么」列表里给鸟种加 ★目标 / 👁已见过 / 📖已学习 / ✎笔记。
            </div>
          ) : (
            SECTIONS.map((sec) => {
              const rows = names.filter((n) => marks[n][sec.key]);
              return (
                <div key={sec.key} className="mk-sec">
                  <div className="mk-sec-h">
                    {sec.icon} {sec.name} <span className="ct">{rows.length}</span>
                  </div>
                  {rows.length === 0 ? (
                    <div className="mk-sec-empty">{sec.empty}</div>
                  ) : (
                    rows.map((n) => (
                      <div key={n} className="mk-row">
                        <div className="mk-name">
                          {n}
                          {marks[n].note ? <span className="mk-note">✎ {marks[n].note}</span> : null}
                        </div>
                        <button
                          className="mk-x"
                          title={`取消${sec.name}`}
                          onClick={() => toggle(n, sec.key)}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
