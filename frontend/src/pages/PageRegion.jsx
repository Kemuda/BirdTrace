import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import QueryBar from "../components/QueryBar.jsx";
import SpeciesChecklist from "../components/SpeciesChecklist.jsx";
import ReportList from "../components/ReportList.jsx";

// 地区概览（面→点收敛中间页，定稿自 birdtrace-mockup-v3）。
// 地点停在「地区(市)级」时：先用地图 + 鸟点排行帮用户从面收敛到一个具体鸟点，
// 再点进该点的鸟种名录（叶子页）。排行口径 = 全部记录（这个点丰不丰富、可不可靠
// 看全部证据，对齐 eBird Hotspot）；行程月的过滤留在叶子页里诚实说明。

const SORTS = [
  { k: "nsp", lab: "鸟种数", unit: "种" },
  { k: "nck", lab: "清单数", unit: "份" },
  { k: "spc", lab: "种/单", unit: "种/单" },
];
const TOP = 8;

// 月份直方图 → 「样本以 X 月为主」（取报告最多的 1–2 个月）
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
      const weak = s.nck <= 1; // 单清单点 = 一次记录，灰化
      const top1 = i === 0; // spots 已按 nsp 排序，第一个 = ★最值得去
      const r = 5 + 15 * Math.sqrt(s.nsp / maxSp); // 面积 = √鸟种丰富度
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

    // —— Shift 框选放大 提示 + 复位（对齐 mockup）——
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
          基于 {spots.reduce((n, s) => n + s.nck, 0)} 份清单 · {spots.length} 个鸟点
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
function PointChecklist({ pointId, region, locSelect, marks, toggle, setNote, onWhere, onShowTargets, markCount, onBack }) {
  const [pb, setPb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReports, setShowReports] = useState(false);
  const [showFreq, setShowFreq] = useState(false);

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
      <QueryBar
        where={locSelect}
        when={<>全部记录 {pb?.peak_month && <span className="region">· {note}</span>}</>}
        what=""
        answer="what"
      />

      <div className="rg-crumb">
        <a onClick={onBack}>↩ {region}</a> ›{" "}
        <span className="cur">{pb?.name || pointId}</span>
        <span className="redo" onClick={onBack}>
          ↺ 换鸟点
        </span>
      </div>

      {!loading && species.length > 0 && (
        <div className="concl">
          <span className="k">速读</span>
          <span className="v">
            该点共记录 {species.length} 种{" "}
            <small>
              · 最常见「{species[0].name}」{species[0].frequency_pct}%
            </small>
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
              </button>{" "}
              · 全部记录{pb?.data_status === "thin" ? "（样本薄，仅供参考）" : ""}
            </>
          )}
        </div>
        <div className="list-tools">
          <button type="button" className="btn sm" onClick={onShowTargets}>
            ★ 我的鸟种{markCount ? ` (${markCount})` : ""}
          </button>
        </div>
      </div>

      {!loading && species.length > 0 && (
        <div className="freqinfo">
          <button type="button" className="fi-toggle" onClick={() => setShowFreq((v) => !v)}>
            ⓘ 频率怎么算{showFreq ? "（收起）" : ""}
          </button>
          {showFreq && (
            <div className="fi-body">
              <p>
                <b>频率 = 含该鸟的清单数 ÷ 该点总清单数 × 100。</b>
                和 eBird 的「frequency」同口径：衡量<b>遇见率</b>（多少份清单记到它），不是数量多少。
                这里是<b>该鸟点全部记录</b>合并，不限月份。
              </p>
              {pending > 0 && (
                <p className="fi-warn">
                  注意：{pending} 份清单「明细待抓」（声明有鸟、后台还没抓到清单），会让频率偏低 —— 补抓完自动上调。
                </p>
              )}
              {note && <p className="fi-year">{note}。不同季节物种会有差异，跨季频率仅作粗略参考。</p>}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="empty">加载中…</div>
      ) : species.length === 0 ? (
        <div className="empty">
          <div className="big">该点暂无鸟种明细</div>
          有清单记录但明细还没抓到；可换排行里别的点，或等补抓补充。
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
export default function PageRegion({ regionId, locSelect, marks, toggle, setNote, onWhere, onShowTargets, markCount }) {
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(null); // 选中的鸟点（drill 进名录）

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
  const best = spots[0]; // 已按 nsp 排序
  const bestQual = best
    ? best.nck <= 1
      ? "样本仅 1 份，仅供参考"
      : "丰富又靠谱"
    : "";
  const withCoords = overview.with_coords ?? spots.filter((s) => s.lat != null).length;

  // —— 已 drill 进某个鸟点：显示叶子页名录 ——
  if (picked) {
    return (
      <div className="wf">
        <div className="wf-desc">行程驱动的「时间 + 地点 → 鸟种」· 已收敛到具体鸟点</div>
        <div className="converge">
          <span className="st done">
            <span className="ic">✓</span>选定地区
          </span>
          <span className="arr">→</span>
          <span className="st done">
            <span className="ic">✓</span>选一个鸟点
          </span>
          <span className="arr">→</span>
          <span className="st cur">
            <span className="ic">3</span>看鸟种名录
          </span>
        </div>
        <PointChecklist
          pointId={picked.id}
          region={`${region}`}
          locSelect={locSelect}
          marks={marks}
          toggle={toggle}
          setNote={setNote}
          onWhere={onWhere}
          onShowTargets={onShowTargets}
          markCount={markCount}
          onBack={() => setPicked(null)}
        />
      </div>
    );
  }

  // —— 地区概览：地图 + 鸟点排行 ——
  return (
    <div className="wf">
      <div className="wf-desc">地点停在「地区」级 → 先收敛到一个具体鸟点，再看它能出什么鸟</div>

      <QueryBar where={locSelect} when="6 月（行程月）" what="" answer="what" />
      <div className="region">📍 {region} · 地区级（先收敛到鸟点）</div>

      <div className="converge">
        <span className="st done">
          <span className="ic">✓</span>选定地区
        </span>
        <span className="arr">→</span>
        <span className="st cur">
          <span className="ic">2</span>选一个鸟点
        </span>
        <span className="arr">→</span>
        <span className="st">
          <span className="ic">3</span>看鸟种名录
        </span>
      </div>

      <div className="rg-crumb">
        <span className="cur">{region}</span>
      </div>

      {best && (
        <div className="concl">
          <span className="k">速读</span>
          <span className="v">
            {cityShort}共 {spots.length} 个鸟点 · 最值得去 <b>{best.name}</b>{" "}
            <small>
              （{best.nsp} 种 / {best.nck} 份清单，{bestQual}）
            </small>
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
              <span className="swatch" style={{ background: "#cfc9bd", border: "1px solid #b9b3a7" }} /> 仅 1
              份清单（参考）
            </span>
            <span style={{ marginLeft: "auto", color: "var(--line)" }}>
              圆越大＝鸟种越多 · 位置约略
            </span>
          </div>
        </>
      ) : (
        <div className="callout">
          <b>坐标抓取中：</b>这个地区的鸟点经纬度还没抓到，地图暂不可画 —— 下面的鸟点排行不受影响。
          坐标补齐后地图会自动出现。
        </div>
      )}

      <SpotRanking spots={spots} onPick={setPicked} />

      <div className="rg-foot">
        <b>怎么读：</b>「鸟种数」看一个点有多丰富，「清单数」看这个数字有多可靠 —— 两者都高才稳妥。
        <b>灰色行</b>只有 1 份清单，是某一次记录、不代表稳定可见。点任意一行 → 进入该点的鸟种名录。
        <br />
        概览口径为<b>该地区全部记录</b>（共 {overview.checklists} 份清单 / {overview.obs} 条记录）。
      </div>
    </div>
  );
}
