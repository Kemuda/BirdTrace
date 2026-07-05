import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Info from "../components/Info.jsx";
import {
  listDistributionSpecies,
  getSpeciesDistribution,
  seasonOf,
  SEASONS,
} from "../lib/exploreData.js";

// 「分布图」explore 页（鸟种 → 地点，对标 eBird 的 species map）。
// 数据来自 lib/exploreData.js 的 provider —— 当前是 filler 示例数据，页面顶部
// 显式标注「示例数据」。真实接口就绪后 provider 内部切源，本页无需改动。

const M = ["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

// ===== 分布地图 =====
function DistributionMap({ locations, activeKey, onPick }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());

  // 建图 + 画点：locations 变了整体重建（切换鸟种）。
  useEffect(() => {
    const pts = locations.filter((l) => l.lat != null && l.lng != null);
    if (!elRef.current || !pts.length) return;

    const map = L.map(elRef.current, { scrollWheelZoom: false });
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    const maxR = Math.max(...pts.map((l) => l.reports), 1);
    markersRef.current = new Map();
    pts.forEach((l) => {
      const season = seasonOf(l.months);
      const r = 6 + 18 * Math.sqrt(l.reports / maxR);
      const m = L.circleMarker([l.lat, l.lng], {
        radius: r,
        weight: 1.5,
        color: "#33312c",
        fillColor: season.color,
        fillOpacity: 0.6,
      }).addTo(map);
      const mo = (l.months || []).map((x) => `${x}月`).join(" ");
      m.bindPopup(
        `<div class="pn">${l.point}</div>` +
          `<div class="pd">${l.region}</div>` +
          `<div class="pm">${l.reports} 份记录 · ${season.label}</div>` +
          `<div class="pb">${mo}</div>`
      );
      m.on("click", () => onPick(l.point));
      markersRef.current.set(l.point, { marker: m, latlng: [l.lat, l.lng] });
    });

    map.fitBounds(L.latLngBounds(pts.map((l) => [l.lat, l.lng])).pad(0.2));
    setTimeout(() => map.invalidateSize(), 30);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = new Map();
    };
  }, [locations, onPick]);

  // 列表里选中某点 → 地图平移过去并开 popup。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeKey) return;
    const hit = markersRef.current.get(activeKey);
    if (!hit) return;
    map.setView(hit.latlng, Math.max(map.getZoom(), 7), { animate: true });
    hit.marker.openPopup();
  }, [activeKey]);

  return <div id="map" ref={elRef} />;
}

export default function PageSpecies() {
  const species = useMemo(() => listDistributionSpecies(), []);
  const [name, setName] = useState(species[0]?.name || "");
  const [activeKey, setActiveKey] = useState(null);

  const dist = useMemo(() => getSpeciesDistribution(name), [name]);
  useEffect(() => setActiveKey(null), [name]);

  // 图例只列本鸟种实际出现的季节，避免误导。
  const seasonsPresent = useMemo(() => {
    const keys = new Set((dist?.locations || []).map((l) => seasonOf(l.months).key));
    return Object.values(SEASONS).filter((s) => keys.has(s.key));
  }, [dist]);

  return (
    <div className="wf">
      {/* 示例数据横幅 —— 这页是 filler，务必与真实记录区分（数据诚实性） */}
      <div className="demo-banner">
        <b>示例数据</b>
        <span>
          本页为分布图交互演示，坐标/数量为示意，非真实观测。接口就绪后切换为
          真实数据（中国观鸟记录中心 / eBird）。
        </span>
      </div>

      <div className="locpick">
        <label className="locslot">
          <span className="lab">🐦 鸟种</span>
          <select value={name} onChange={(e) => setName(e.target.value)}>
            {species.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!dist ? (
        <div className="empty">
          <div className="big">选择一个鸟种查看分布</div>
        </div>
      ) : (
        <>
          <div className="concl">
            <span className="k">速读</span>
            <span className="v">
              {dist.name}
              <small>
                {" "}
                {dist.en ? `· ${dist.en} ` : ""}· {dist.locations.length} 个地点 ·{" "}
                {dist.total_reports} 份记录
              </small>
            </span>
          </div>
          {dist.note && <div className="sp-note">{dist.note}</div>}

          <div className="map-wrap">
            <DistributionMap
              locations={dist.locations}
              activeKey={activeKey}
              onPick={setActiveKey}
            />
            <div className="map-cap">
              {seasonsPresent.map((s) => (
                <span key={s.key}>
                  <span className="swatch" style={{ background: s.color }} /> {s.label}
                </span>
              ))}
              <span className="cap-hint">· 圆越大 = 记录越多</span>
              <Info label="口径">
                <p>圆大小 = 该地点记录到本鸟种的份数；颜色 = 主要出现季节。</p>
                <p>季节由记录月份归类（越冬 11–2 / 繁殖 5–8 / 其余为过境；跨季且月份多 = 留鸟）。</p>
              </Info>
            </div>
          </div>

          {/* 地点列表 —— 点一行在地图上高亮，和 eBird 的 hotspot 列表一致 */}
          <div className="splist">
            <div className="splist-h">
              <span>#</span>
              <span>地点</span>
              <span className="r">记录数</span>
              <span>季节 / 月份</span>
            </div>
            {dist.locations.map((l, i) => {
              const season = seasonOf(l.months);
              const on = activeKey === l.point;
              return (
                <div
                  key={l.point}
                  className={"sprow" + (on ? " on" : "")}
                  onClick={() => setActiveKey(l.point)}
                >
                  <span className="rank">{i + 1}</span>
                  <div className="spname">
                    <span className="nm">
                      <span className="cn">{l.point}</span>
                    </span>
                    <span className="birds">{l.region}</span>
                  </div>
                  <span className="metric2">{l.reports} 份</span>
                  <span className="sp-season">
                    <span className="swatch" style={{ background: season.color }} />
                    {season.label}
                    <small> · {l.months.map((m) => M[m]).join(" ")} 月</small>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
