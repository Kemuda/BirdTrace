import { useEffect, useMemo, useState } from "react";
import Info from "../components/Info.jsx";
import { IS_PUBLIC } from "../lib/mode.js";

const M = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

// 由省级 bundle 算某物种 12 个月的出现频率 = 报告该种份数 / 当月总报告 * 100。
function monthlyFreq(bundle, name) {
  const sp = bundle?.species?.find((s) => s.name === name);
  if (!sp) return null;
  return sp.monthly.map((c, i) => {
    const total = bundle.total_reports[i] || 0;
    return {
      freq: total ? Math.round((c / total) * 1000) / 10 : 0,
      with: c,
      total,
    };
  });
}

// 最佳窗口：峰值月 ± 频率≥峰值 60% 的连续月份。
function bestWindow(rows) {
  if (!rows) return null;
  const max = Math.max(...rows.map((r) => r.freq), 0);
  if (max <= 0) return null;
  const peak = rows.indexOf(rows.find((r) => r.freq === max));
  let lo = peak,
    hi = peak;
  while (lo > 0 && rows[lo - 1].freq >= max * 0.6) lo--;
  while (hi < 11 && rows[hi + 1].freq >= max * 0.6) hi++;
  return { lo, hi, max, peak };
}

export default function PageChart({ provinces, taxa }) {
  const [province, setProvince] = useState("云南");
  const [taxon, setTaxon] = useState("");
  const [bundle, setBundle] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await fetch(`/data/province/${encodeURIComponent(province)}.json`);
        const b = resp.ok ? await resp.json() : null;
        if (alive) {
          setBundle(b);
          if (b?.species?.length && !b.species.find((s) => s.name === taxon)) {
            const top = [...b.species].sort(
              (a, c) => c.monthly.reduce((x, y) => x + y, 0) - a.monthly.reduce((x, y) => x + y, 0)
            )[0];
            setTaxon(top?.name || "");
          }
        }
      } catch {
        if (alive) setBundle(null);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province]);

  const rows = useMemo(() => monthlyFreq(bundle, taxon), [bundle, taxon]);
  const win = useMemo(() => bestWindow(rows), [rows]);
  const max = rows ? Math.max(...rows.map((r) => r.freq), 1) : 1;
  const totalReports = bundle ? bundle.total_reports.reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="wf">
      <div className="locpick">
        <label className="locslot">
          <span className="lab">🏙️ 省份</span>
          <select value={province} onChange={(e) => setProvince(e.target.value)}>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="locslot">
          <span className="lab">🐦 鸟种</span>
          <input
            value={taxon}
            onChange={(e) => setTaxon(e.target.value)}
            list="taxon-options"
            placeholder="输入鸟名"
          />
        </label>
      </div>
      {taxa.length > 0 && (
        <datalist id="taxon-options">
          {taxa.slice(0, 1500).map((t) => (
            <option key={t.id ?? t.name} value={t.name}>
              {t.latinname || ""}
            </option>
          ))}
        </datalist>
      )}

      {win && (
        <div className="concl">
          <span className="k">最佳窗口</span>
          <span className="v">
            {M[win.lo]} – {M[win.hi]} 月
            <small> · 峰值 {win.max}%</small>
          </span>
        </div>
      )}

      {!rows ? (
        <div className="empty">
          <div className="big">没有这种鸟的本地记录</div>
          换个鸟名试试。
        </div>
      ) : (
        <div className="chart">
          <div className="bars">
            {win && (
              <>
                <div
                  className="window"
                  style={{
                    left: `${(win.lo / 12) * 100}%`,
                    right: `${((11 - win.hi) / 12) * 100}%`,
                  }}
                />
                <span className="win-lab" style={{ left: `${((win.lo + win.hi) / 2 / 11) * 100}%` }}>
                  最佳
                </span>
              </>
            )}
            {rows.map((r, i) => {
              const peak = win && i >= win.lo && i <= win.hi;
              const thin = r.total > 0 && r.total < 15;
              return (
                <div
                  key={i}
                  className={"bcol" + (peak ? " peak" : "") + (thin ? " thin" : "")}
                  title={`${M[i]}月 ${r.freq}% (${r.with}/${r.total})`}
                >
                  <div className="bk" style={{ height: `${(r.freq / max) * 100}%` }} />
                </div>
              );
            })}
          </div>
          <div className="months">
            {M.map((m) => (
              <div key={m} className="m">
                {m}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="take">
        <div className="trust">
          {taxon ? `${province} · ${taxon}` : province} · {totalReports} 份报告
          <Info label="口径">
            <p>
              柱高 = 当月「报告该鸟的份数 / 总报告份数」。
            </p>
            <p>斜纹柱 = 当月样本 &lt; 15 份，仅供参考。</p>
            {!IS_PUBLIC && <p>迁徙"在/走"状态层、多物种叠加窗口交集在 Backlog。</p>}
          </Info>
        </div>
      </div>
    </div>
  );
}
