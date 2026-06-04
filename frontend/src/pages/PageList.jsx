import { useEffect, useState } from "react";
import QueryBar from "../components/QueryBar.jsx";
import ReportList from "../components/ReportList.jsx";
import TargetList from "../components/TargetList.jsx";
import SpeciesLocations from "../components/SpeciesLocations.jsx";
import SpeciesChecklist from "../components/SpeciesChecklist.jsx";
import PageRegion from "./PageRegion.jsx";
import { useMarks } from "../hooks/useMarks.js";

export default function PageList({ stops, stopId, onStop, regions = [] }) {
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [onlyTarget, setOnlyTarget] = useState(false);
  const [showFreq, setShowFreq] = useState(false);
  const [whereSpecies, setWhereSpecies] = useState(null);
  const { marks, toggle, setNote, importMarks } = useMarks();

  // 地点停在「地区(市)级」且有概览数据 → 走面→点收敛流程（地图 + 鸟点排行）。
  const region = regions.find((r) => r.id === stopId);

  useEffect(() => {
    if (!stopId || region) return; // 地区模式不用 trip bundle
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
  }, [stopId, region]);

  const markCount = Object.keys(marks).length;
  const targetCount = Object.values(marks).filter((m) => m.target).length;

  // 地点槽：所有停留点下拉（地区模式与名录模式共用）
  const locSelect = (
    <select value={stopId} onChange={(e) => onStop(e.target.value)}>
      {stops.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );

  // 共用弹窗（两种模式都可能打开）：我的鸟种 / 在哪里见过
  const sharedModals = (
    <>
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
    </>
  );

  // ===== 地区概览模式 =====
  if (region) {
    return (
      <>
        <PageRegion
          regionId={stopId}
          locSelect={locSelect}
          marks={marks}
          toggle={toggle}
          setNote={setNote}
          onWhere={setWhereSpecies}
          onShowTargets={() => setShowTargets(true)}
          markCount={markCount}
        />
        {sharedModals}
      </>
    );
  }

  // ===== 名录模式（行程停留点：地点 + 时间 → 鸟种）=====
  const species = bundle?.month_species || [];
  const status = bundle?.data_status;
  const n = bundle?.total_reports_month ?? 0;
  const reports = bundle?.reports || [];
  const stop = stops.find((s) => s.id === stopId);
  const shownSpecies = onlyTarget ? species.filter((s) => marks[s.name]?.target) : species;

  const years = bundle?.report_years || {};
  const yearStr = Object.keys(years)
    .sort()
    .map((y) => `${y} 年（${years[y]} 份）`)
    .join(" + ");
  const pending = reports.filter((r) => !r.has_detail).length;

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

      <QueryBar where={locSelect} when="6 月（行程月）" what="" answer="what" />

      {stop?.region && <div className="region">📍 {stop.region}</div>}

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
        <SpeciesChecklist
          species={shownSpecies}
          marks={marks}
          onToggle={toggle}
          onNote={setNote}
          onWhere={setWhereSpecies}
        />
      )}

      <div className="take">
        <div className="legend">
          <span>
            <span className="rdot" title="局部稀有（在这里这个月不容易撞到）" />
            稀有
          </span>
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

      {sharedModals}
    </div>
  );
}
