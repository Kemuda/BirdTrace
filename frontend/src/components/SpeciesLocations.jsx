import { useEffect, useState } from "react";

// 「在哪里见过」反查（鸟种 → 地点聚合）。索引文件 521KB，按需加载一次、模块级缓存。
let _cache = null;
function loadIndex() {
  if (!_cache) {
    _cache = fetch("/data/species_locations.json")
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return _cache;
}

export default function SpeciesLocations({ name, onClose }) {
  const [entry, setEntry] = useState(undefined); // undefined=加载中, null=无记录

  useEffect(() => {
    let alive = true;
    setEntry(undefined);
    loadIndex().then((idx) => {
      if (alive) setEntry(idx[name] || null);
    });
    return () => {
      alive = false;
    };
  }, [name]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <b>{name} · 在哪里见过</b>
          <button className="x" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-note">
          范围 = 已抓取的云南 + 西藏数据，按报告数排序。月份是该地点记录到它的月份。
        </div>
        <div className="rl-body">
          {entry === undefined ? (
            <div className="empty" style={{ margin: 16 }}>加载中…</div>
          ) : entry === null ? (
            <div className="empty" style={{ margin: 16 }}>
              <div className="big">本站数据里暂无它的记录</div>
              它可能在云南 / 西藏之外，或对应报告的明细还没抓到。
            </div>
          ) : (
            <>
              <div className="loc-sum">
                共 {entry.locations.length} 个地点 · {entry.total_reports} 份报告记录到
              </div>
              {entry.locations.map((l, i) => (
                <div key={i} className="loc-row">
                  <div className="loc-main">
                    <span className="loc-pt">{l.point}</span>
                    <span className="loc-rg">{l.region}</span>
                  </div>
                  <div className="loc-meta">
                    <span className="loc-n">{l.reports} 报告</span>
                    {l.months.length > 0 && (
                      <span className="loc-mo">{l.months.map((m) => `${m}月`).join(" ")}</span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
