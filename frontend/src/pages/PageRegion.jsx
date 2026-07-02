import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import SpeciesChecklist from "../components/SpeciesChecklist.jsx";
import ReportList from "../components/ReportList.jsx";
import Info from "../components/Info.jsx";
import { IS_PUBLIC } from "../lib/mode.js";

// 地区概览（面→点收敛中间页）。选中"整个市（地区概览）"时：
// 地图 + 鸟点排行帮用户从面收敛到一个具体鸟点，再点进该点的鸟种名录（叶子页）。
// 排行口径 = 全部记录（对齐 eBird Hotspot）；行程月的过滤留在叶子页里。

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

// ===== 地图（Leaflet）=====
function RegionMap({ spots, onPick }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);

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
      m.bindPopup(
        `<div class="pn">${s.name}${weak ? ' <span style="color:#b06a4a">(仅1清单)</span>' : ""}</div>` +
          `<div class="pm">鸟种 ${s.nsp} · 清单 ${s.nck} · 种/单 ${s.spc}</div>` +
          `<div class="pb">常见：${birds}</div>` +
          `<div class="pgo">看该点名录 →</div>`
      );
      m.on("popupopen", (e) => {
        const go = e.popup.getElement().querySelector(".pgo");
        if (go) go.onclick = () => onPick(s);
      });
    });

    const homeBounds = L.latLngBounds(pts.map((s) => [s.lat, s.lng])).pad(0.12);
    map.fitBounds(homeBounds);

    // Shift 框选放大（仅桌面端有键盘 → 移动端会自动隐藏，CSS 里控制）
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
    };
  }, [spots, onPick]);

  return <div id="map" ref={elRef} />;
}

// ===== 鸟点排行表 =====
function SpotRanking({ spots, onPick }) {
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
          return (
            <div
              key={s.id}
              className={"sprow" + (weak ? " weak" : "") + (i === 0 ? " top1" : "")}
              onClick={() => onPick(s)}
            >
              <span className="rank">{i + 1}</span>
              <div className="spname">
                <span className="nm">
                  <span className="cn">{s.name}</span>
                  {isTop && <span className="star-badge">★ 最优</span>}
                  {weak && <span className="tag1">样本仅1</span>}
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

// ===== 鸟点叶子页名录 =====
function PointChecklist({ pointId, region, picker, marks, toggle, setNote, onWhere, onShowTargets, markCount, onBack }) {
  const [pb, setPb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReports, setShowReports] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`/data/regions/points/${encodeURIComponent(pointId)}.json`);
        const b = r.ok ? await r.json() : null;
        if (alive) setPb(b);
      } catch {
        if (alive) setPb(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pointId]);

  const species = pb?.species || [];
  const n = pb?.total_reports ?? 0;
  const reports = pb?.reports || [];
  const pending = reports.filter((r) => !r.has_detail).length;
  const note = seasonNote(pb?.months);

  return (
    <>
      {picker}

      <div className="rg-crumb">
        <a onClick={onBack}>↩ {region}</a> ›{" "}
        <span className="cur">{pb?.name || pointId}</span>
      </div>

      {!loading && species.length > 0 && (
        <div className="concl">
          <span className="k">速读</span>
          <span className="v">
            该点共 {species.length} 种
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

      <div className="take">
        <div className="legend">
          <span>
            <span className="rdot" title="局部稀有（在这里不容易撞到）" />
            稀有
          </span>
        </div>
      </div>

      {showReports && (
        <ReportList
          label={pb?.name || pointId}
          reports={reports}
          scope="全部"
          onClose={() => setShowReports(false)}
        />
      )}
    </>
  );
}

// ===== 容器：概览 ↔ 鸟点名录 =====
export default function PageRegion({ regionId, pickedPointId, onBackToRegion, picker, marks, toggle, setNote, onWhere, onShowTargets, markCount }) {
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  // pickedPointId 由父组件（picker 从"鸟点排行"里选中）传入 → 直接进叶子页；
  // picked 是本页内点地图/排行 drill 进去的临时选择。
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

  if (loading) return <div className="empty">加载中…</div>;
  if (!bundle) return <div className="empty">该地区暂无概览数据</div>;

  const { region, city, overview, spots } = bundle;
  const cityShort = (city || "").replace(/(市|地区|自治州)$/, "");
  const best = spots[0];
  const bestQual = best
    ? best.nck <= 1
      ? "样本仅 1 份"
      : "丰富又靠谱"
    : "";
  const withCoords = overview.with_coords ?? spots.filter((s) => s.lat != null).length;

  // 父组件预选中的鸟点：从 bundle.spots 里找它，用它的元数据渲染叶子页；
  // 找不到也不阻断 —— PointChecklist 会自己按 pointId 拉 /data/regions/points/<id>.json。
  const externalPick = pickedPointId
    ? spots.find((s) => s.id === pickedPointId) || { id: pickedPointId, name: pickedPointId }
    : null;
  const activePick = picked || externalPick;

  if (activePick) {
    return (
      <div className="wf">
        <PointChecklist
          pointId={activePick.id}
          region={`${region}`}
          picker={picker}
          marks={marks}
          toggle={toggle}
          setNote={setNote}
          onWhere={onWhere}
          onShowTargets={onShowTargets}
          markCount={markCount}
          onBack={externalPick && !picked && onBackToRegion ? onBackToRegion : () => setPicked(null)}
        />
      </div>
    );
  }

  return (
    <div className="wf">
      {picker}

      <div className="rg-crumb">
        <span className="cur">{region}</span>
        <Info label="怎么读地区概览">
          <p>
            地区级 → 先在地图/排行选一个鸟点，再看该点的鸟种名录。
          </p>
          <p>
            覆盖 <b>{overview.checklists}</b> 份清单 / <b>{overview.obs}</b> 条记录。
          </p>
        </Info>
      </div>

      {best && (
        <div className="concl">
          <span className="k">速读</span>
          <span className="v">
            {cityShort} {spots.length} 个鸟点 · 最值得去 <b>{best.name}</b>
            <small> （{best.nsp} 种 / {best.nck} 份清单{bestQual ? "，" + bestQual : ""}）</small>
          </span>
        </div>
      )}

      {withCoords > 0 ? (
        <>
          <RegionMap spots={spots} onPick={setPicked} />
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
        </>
      ) : (
        !IS_PUBLIC && (
          <div className="callout">
            <b>坐标抓取中：</b>坐标补齐后地图会自动出现，排行不受影响。
          </div>
        )
      )}

      <SpotRanking spots={spots} onPick={setPicked} />
    </div>
  );
}
