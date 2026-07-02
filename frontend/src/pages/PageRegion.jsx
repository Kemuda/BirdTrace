import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import SpeciesChecklist from "../components/SpeciesChecklist.jsx";
import ReportList from "../components/ReportList.jsx";
import Info from "../components/Info.jsx";
import { IS_PUBLIC } from "../lib/mode.js";
import { groupSpotsByCanonical } from "../lib/spots.js";

// 地区概览（面→点收敛中间页）。picker 或用户点击地图/排行选中一个鸟点后 → 叶子页。
// 关键调整（Amber）：**地图永远保留**，叶子页只替换下方的排行块为鸟种名录。
// 排行 / map / 叶子页都用规范化合并后的 spots（拉市海 3 个 raw id 合为 1 点）。

const SORTS = [
  { k: "nsp", lab: "鸟种数", unit: "种" },
  { k: "nck", lab: "清单数", unit: "份" },
  { k: "spc", lab: "种/单", unit: "种/单" },
];
const TOP = 8;

function seasonNote(months) {
  const entries = Object.entries(months || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "";
  const peak = entries.slice(0, 2).map((e) => parseInt(e[0], 10)).sort((a, b) => a - b);
  return peak.length === 2 && peak[1] - peak[0] >= 1
    ? `样本以 ${peak[0]}–${peak[1]} 月为主`
    : `样本以 ${peak[0]} 月为主`;
}

// ===== 地图 =====
function RegionMap({ spots, onPick, highlightedId, compact }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const highlightLayerRef = useRef(null);
  const homeBoundsRef = useRef(null);

  useEffect(() => {
    const pts = spots.filter((s) => s.lat != null && s.lng != null);
    if (!elRef.current || !pts.length) return;

    const map = L.map(elRef.current, { scrollWheelZoom: false, boxZoom: true });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    const maxSp = Math.max(...spots.map((s) => s.nsp), 1);
    pts.forEach((s, i) => {
      const weak = s.nck <= 1;
      const top1 = i === 0;
      const r = 5 + 15 * Math.sqrt(s.nsp / maxSp);
      const m = L.circleMarker([s.lat, s.lng], {
        radius: r,
        weight: 1.5,
        color: weak ? "#b9b3a7" : top1 ? "#b8860b" : "#33312c",
        fillColor: weak ? "#cfc9bd" : top1 ? "#d9a92e" : "#6c685f",
        fillOpacity: 0.55,
      }).addTo(map);
      const birds = (s.top || []).slice(0, 5).join("、");
      const districtLine = s.district ? `<div class="pd">${s.district}</div>` : "";
      const mergedLine = s.raw && s.raw.length > 1
        ? `<div class="pm-merge">合并 ${s.raw.length} 处同名点</div>`
        : "";
      m.bindPopup(
        `<div class="pn">${s.name}</div>` +
          districtLine +
          `<div class="pm">鸟种 ${s.nsp} · 清单 ${s.nck} · 种/单 ${s.spc}</div>` +
          mergedLine +
          `<div class="pb">常见：${birds}</div>` +
          `<div class="pgo">看该点名录 →</div>`
      );
      m.on("popupopen", (e) => {
        const go = e.popup.getElement().querySelector(".pgo");
        if (go) go.onclick = () => onPick(s);
      });
    });

    const homeBounds = L.latLngBounds(pts.map((s) => [s.lat, s.lng])).pad(0.12);
    homeBoundsRef.current = homeBounds;
    map.fitBounds(homeBounds);

    const BoxCtl = L.Control.extend({
      options: { position: "topright" },
      onAdd() {
        const d = L.DomUtil.create("div", "bz-ctl");
        d.innerHTML =
          '<span class="bz-hint">⇧ Shift 框选放大</span>' +
          '<button class="bz-reset" title="复位到全境">复位</button>';
        L.DomEvent.disableClickPropagation(d);
        d.querySelector(".bz-reset").onclick = () => map.fitBounds(homeBounds);
        return d;
      },
    });
    map.addControl(new BoxCtl());

    const el = elRef.current;
    const arm = (e) => e.key === "Shift" && el.classList.add("bz-arm");
    const disarm = (e) => e.key === "Shift" && el.classList.remove("bz-arm");
    window.addEventListener("keydown", arm);
    window.addEventListener("keyup", disarm);
    setTimeout(() => map.invalidateSize(), 30);

    return () => {
      window.removeEventListener("keydown", arm);
      window.removeEventListener("keyup", disarm);
      map.remove();
      mapRef.current = null;
      highlightLayerRef.current = null;
      homeBoundsRef.current = null;
    };
  }, [spots, onPick]);

  // 高亮圈：选中的鸟点画个环 + 视图平移过去；换点或取消时清掉。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (highlightLayerRef.current) {
      map.removeLayer(highlightLayerRef.current);
      highlightLayerRef.current = null;
    }
    if (!highlightedId) {
      if (homeBoundsRef.current) map.fitBounds(homeBoundsRef.current);
      return;
    }
    const s = spots.find((x) => x.id === highlightedId || (x.raw || []).some((r) => r.id === highlightedId));
    if (!s || s.lat == null) return;
    const ring = L.circleMarker([s.lat, s.lng], {
      radius: 22,
      weight: 3,
      color: "#3b5c8a",
      fillOpacity: 0,
      interactive: false,
    }).addTo(map);
    highlightLayerRef.current = ring;
    map.setView([s.lat, s.lng], Math.max(map.getZoom(), 12), { animate: true });
  }, [highlightedId, spots]);

  // compact 状态切换时容器高度变了 → 让 leaflet 重算尺寸，不然只看到左上角一小片。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // 等 CSS 过渡完（如果有）
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [compact]);

  return <div id="map" ref={elRef} />;
}

// ===== 鸟点排行表 =====
function SpotRanking({ spots, onPick, highlightedId }) {
  const [sortK, setSortK] = useState("nsp");
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () => spots.slice().sort((a, b) => b[sortK] - a[sortK]),
    [spots, sortK]
  );
  const list = expanded ? sorted : sorted.slice(0, TOP);
  const mx = Math.max(...spots.map((s) => s[sortK]), 1);

  return (
    <>
      <div className="meta">
        <div className="trust">
          {spots.reduce((n, s) => n + s.nck, 0)} 份清单 · {spots.length} 个鸟点
          <Info label="怎么读排行">
            <p>
              <b>鸟种数</b> 看点的丰富度；<b>清单数</b> 看这个数字有多可靠。两者都高才稳妥。
            </p>
            <p>灰色行 = 仅 1 份清单，只是某一次记录，不代表稳定可见。</p>
          </Info>
        </div>
        <div className="sortbar">
          <span>排序</span>
          {SORTS.map((s) => (
            <button
              key={s.k}
              className={"sortbtn" + (sortK === s.k ? " on" : "")}
              onClick={() => {
                setSortK(s.k);
                setExpanded(false);
              }}
            >
              {s.lab}
            </button>
          ))}
        </div>
      </div>

      <div className="splist">
        <div className="splist-h">
          <span>#</span>
          <span>鸟点 · 常见鸟</span>
          <span className="r">鸟种数</span>
          <span className="r">清单数</span>
          <span />
        </div>
        {list.map((s, i) => {
          const weak = s.nck <= 1;
          const big = s[sortK];
          const unit = SORTS.find((x) => x.k === sortK).unit;
          const second = sortK === "nck" ? `${s.nsp} 种` : `${s.nck} 份`;
          const isTop = i === 0 && sortK === "nsp";
          const on = highlightedId && (s.id === highlightedId || (s.raw || []).some((r) => r.id === highlightedId));
          return (
            <div
              key={s.id}
              className={"sprow" + (weak ? " weak" : "") + (i === 0 ? " top1" : "") + (on ? " on" : "")}
              onClick={() => onPick(s)}
            >
              <span className="rank">{i + 1}</span>
              <div className="spname">
                <span className="nm">
                  <span className="cn">{s.name}</span>
                  {isTop && <span className="star-badge">★ 最优</span>}
                  {s.district && <span className="tag-district">{s.district}</span>}
                  {weak && <span className="tag1">样本仅1</span>}
                  {s.raw && s.raw.length > 1 && (
                    <span
                      className="tag-merged"
                      title={s.raw.map((r) => r.name).join(" / ")}
                    >
                      合并 {s.raw.length}
                    </span>
                  )}
                </span>
                <span className="birds">
                  <b>常见</b> {(s.top || []).slice(0, 4).join("、")}
                </span>
              </div>
              <div className="metricbig">
                <span className="n">
                  {big}
                  <small>{unit}</small>
                </span>
                <span className="b">
                  <i style={{ width: `${Math.round((100 * big) / mx)}%` }} />
                </span>
              </div>
              <span className="metric2">{second}</span>
              <span className="go">→</span>
            </div>
          );
        })}
        {!expanded && sorted.length > TOP && (
          <button className="more" onClick={() => setExpanded(true)}>
            展开其余 {sorted.length - TOP} 个鸟点 ▾
          </button>
        )}
      </div>
    </>
  );
}

// 合并多个 point bundle：拉多份 /data/regions/points/<id>.json 聚成一份。
// 单个 id 也走这条，语义一致。
async function loadMergedPoint(pointIds) {
  const bundles = await Promise.all(
    pointIds.map(async (id) => {
      try {
        const r = await fetch(`/data/regions/points/${encodeURIComponent(id)}.json`);
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      }
    })
  );
  const ok = bundles.filter(Boolean);
  if (!ok.length) return null;
  if (ok.length === 1) return ok[0];

  const total_reports = ok.reduce((s, b) => s + (b.total_reports || 0), 0);
  const bySpecies = new Map();
  for (const b of ok) {
    for (const sp of b.species || []) {
      let e = bySpecies.get(sp.name);
      if (!e) {
        e = { ...sp, reports: 0 };
        bySpecies.set(sp.name, e);
      }
      e.reports += sp.reports || 0;
    }
  }
  const species = Array.from(bySpecies.values()).map((sp) => ({
    ...sp,
    frequency_pct: total_reports ? Math.round((1000 * sp.reports) / total_reports) / 10 : 0,
  }));
  species.sort((a, b) => b.reports - a.reports || a.name.localeCompare(b.name, "zh"));

  const months = {};
  for (const b of ok)
    for (const [m, cnt] of Object.entries(b.months || {}))
      months[m] = (months[m] || 0) + cnt;

  const reports = [];
  const seen = new Set();
  for (const b of ok)
    for (const r of b.reports || []) {
      if (r.report_id && seen.has(r.report_id)) continue;
      if (r.report_id) seen.add(r.report_id);
      reports.push(r);
    }
  reports.sort((a, b) => String(b.time || "").localeCompare(a.time || ""));

  return {
    id: pointIds[0],
    name: ok[0].name,
    region: ok[0].region,
    total_reports,
    species_count: species.length,
    data_status: total_reports === 0 ? "none" : total_reports < 15 ? "thin" : "ok",
    months,
    peak_month: Object.entries(months).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    species,
    reports,
    _mergedFrom: pointIds.length,
  };
}

// ===== 鸟点叶子页名录（不含 picker/crumb/map —— 那些留给父容器共享）=====
function PointChecklistInline({ pointIds, displayName, marks, toggle, setNote, onWhere, onShowTargets, markCount }) {
  const [pb, setPb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReports, setShowReports] = useState(false);
  const key = pointIds.join("|");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadMergedPoint(pointIds).then((b) => {
      if (alive) {
        setPb(b);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const species = pb?.species || [];
  const n = pb?.total_reports ?? 0;
  const reports = pb?.reports || [];
  const pending = reports.filter((r) => !r.has_detail).length;
  const note = seasonNote(pb?.months);

  return (
    <>
      {!loading && species.length > 0 && (
        <div className="concl">
          <span className="k">速读</span>
          <span className="v">
            {displayName || pb?.name} · 共 {species.length} 种
            <small> · 最常见「{species[0].name}」{species[0].frequency_pct}%</small>
          </span>
        </div>
      )}

      <div className="meta">
        <div className={"trust" + (pb?.data_status === "thin" ? " warn" : "")}>
          {n === 0 ? (
            "该点暂无鸟种明细"
          ) : (
            <>
              基于{" "}
              <button type="button" className="rlink" onClick={() => setShowReports(true)}>
                {n} 份清单
              </button>
              {pb?.data_status === "thin" ? "（样本薄）" : ""}
            </>
          )}
          <Info label="频率与样本口径">
            <p>
              <b>频率 = 含该鸟的清单数 ÷ 该点总清单数 × 100。</b>
              和 eBird 的 frequency 同口径。这里合并<b>该鸟点全部记录</b>，不限月份。
            </p>
            {pending > 0 && !IS_PUBLIC && (
              <p className="fi-warn">
                {pending} 份清单"明细待抓"，会拉低频率 —— 补抓后自动上调。
              </p>
            )}
            {note && <p className="fi-year">{note}。跨季频率仅作粗略参考。</p>}
          </Info>
        </div>
        <div className="list-tools">
          <button type="button" className="btn sm" onClick={onShowTargets}>
            ★ 我的鸟种{markCount ? ` (${markCount})` : ""}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty">加载中…</div>
      ) : species.length === 0 ? (
        <div className="empty">
          <div className="big">该点暂无鸟种明细</div>
          可换排行里别的点。
        </div>
      ) : (
        <SpeciesChecklist
          species={species}
          marks={marks}
          onToggle={toggle}
          onNote={setNote}
          onWhere={onWhere}
        />
      )}

      {showReports && (
        <ReportList
          label={displayName || pb?.name || pointIds[0]}
          reports={reports}
          scope="全部"
          onClose={() => setShowReports(false)}
        />
      )}
    </>
  );
}

// ===== 容器：概览 + 叶子页共用 picker/crumb/map，只切换下方内容 =====
export default function PageRegion({ regionId, pickedPointId, onBackToRegion, picker, marks, toggle, setNote, onWhere, onShowTargets, markCount }) {
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  // 用户从地图/排行 click drill 进的点。父组件通过 pickedPointId 传的走 externalPick。
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPicked(null);
    (async () => {
      try {
        const r = await fetch(`/data/regions/${encodeURIComponent(regionId)}.json`);
        const b = r.ok ? await r.json() : null;
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
  }, [regionId]);

  const spots = useMemo(() => groupSpotsByCanonical(bundle?.spots || []), [bundle]);

  if (loading) return <div className="empty">加载中…</div>;
  if (!bundle) return <div className="empty">该地区暂无概览数据</div>;

  const { region, city, overview } = bundle;
  const cityShort = (city || "").replace(/(市|地区|自治州)$/, "");
  const best = spots[0];
  const bestQual = best ? (best.nck <= 1 ? "样本仅 1 份" : "丰富又靠谱") : "";
  const withCoords = spots.filter((s) => s.lat != null).length;

  const externalPick = pickedPointId
    ? spots.find((s) => s.id === pickedPointId || s.raw.some((r) => r.id === pickedPointId)) ||
      { id: pickedPointId, name: pickedPointId, raw: [{ id: pickedPointId }] }
    : null;
  const activePick = picked || externalPick;

  const backToOverview = () => {
    if (externalPick && !picked && onBackToRegion) onBackToRegion();
    else setPicked(null);
  };

  const displayName = activePick?.name;
  const merged = activePick?.raw?.length > 1 ? activePick.raw.length : 0;
  const pointIds = activePick
    ? (activePick.raw || [{ id: activePick.id }]).map((r) => r.id)
    : [];

  return (
    <div className="wf">
      {picker}

      {/* 面包屑 —— 概览时 = 地区名；叶子页时 = 返回链 + 当前鸟点 */}
      <div className="rg-crumb">
        {activePick ? (
          <>
            <a onClick={backToOverview}>↩ {region}</a> ›{" "}
            <span className="cur">{displayName}</span>
            {activePick.district && <span className="tag-district">{activePick.district}</span>}
            {merged > 0 && (
              <span className="crumb-badge" title="来自多个同名 pointId 的记录已合并">
                合并 {merged} 处
              </span>
            )}
          </>
        ) : (
          <>
            <span className="cur">{region}</span>
            <Info label="怎么读地区概览">
              <p>地区级 → 先在地图/排行选一个鸟点，再看该点的鸟种名录。</p>
              <p>
                覆盖 <b>{overview.checklists}</b> 份清单 / <b>{overview.obs}</b> 条记录。
              </p>
            </Info>
          </>
        )}
      </div>

      {/* 速读结论 —— 概览时 = 最优鸟点；叶子页时看 PointChecklistInline 里 */}
      {!activePick && best && (
        <div className="concl">
          <span className="k">速读</span>
          <span className="v">
            {cityShort} {spots.length} 个鸟点 · 最值得去 <b>{best.name}</b>
            <small> （{best.nsp} 种 / {best.nck} 份清单{bestQual ? "，" + bestQual : ""}）</small>
          </span>
        </div>
      )}

      {/* 地图 —— 概览/叶子页都保留，叶子页时收缩成 "you are here" 缩略图 */}
      {withCoords > 0 ? (
        <div className={"map-wrap" + (activePick ? " map-wrap--compact" : "")}>
          <RegionMap
            spots={spots}
            onPick={setPicked}
            highlightedId={activePick?.id}
            compact={!!activePick}
          />
          {!activePick && (
            <div className="map-cap">
              <span>
                <span className="swatch" style={{ background: "#d9a92e" }} /> 最值得去
              </span>
              <span>
                <span className="swatch" style={{ background: "#33312c" }} /> 多份清单
              </span>
              <span>
                <span className="swatch" style={{ background: "#cfc9bd", border: "1px solid #b9b3a7" }} /> 仅 1 份（参考）
              </span>
            </div>
          )}
        </div>
      ) : (
        !IS_PUBLIC && (
          <div className="callout">
            <b>坐标抓取中：</b>坐标补齐后地图会自动出现，排行不受影响。
          </div>
        )
      )}

      {/* 下方内容 —— 概览时是排行；叶子页时换鸟种名录 */}
      {activePick ? (
        <PointChecklistInline
          pointIds={pointIds}
          displayName={displayName}
          marks={marks}
          toggle={toggle}
          setNote={setNote}
          onWhere={onWhere}
          onShowTargets={onShowTargets}
          markCount={markCount}
        />
      ) : (
        <SpotRanking spots={spots} onPick={setPicked} highlightedId={activePick?.id} />
      )}
    </div>
  );
}
