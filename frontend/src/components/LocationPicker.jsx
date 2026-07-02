import { pointLabel, districtBadge } from "../lib/locations.js";

// 地点两维选择器：城市（主） + 鸟点（次，可选）。
// - 该市有地区概览 → 鸟点下拉多一项"整个市（地区概览）"
// - 鸟点选空 → 落到城市的默认视图（地区概览或第一个鸟点）
// - 选中鸟点后在下方显示区县 chip（如 玉龙县 / 古城区）—— city 是聚合键、
//   区县是丰富信息，做小标签既保留区县字段又不打破两维结构。
export default function LocationPicker({ cities, city, onCity, currentCity, stopId, onStop }) {
  const c = currentCity;
  const pts = c?.points || [];
  const hasRegion = !!c?.regionId;
  const isRegion = hasRegion && stopId === c.regionId;
  const selectedPoint = pts.find((p) => p.id === stopId);
  const district = selectedPoint ? districtBadge(selectedPoint) : "";
  const points = selectedPoint?.points || [];

  return (
    <div className="locpick">
      <label className="locslot">
        <span className="lab">🏙️ 城市</span>
        <select value={city || ""} onChange={(e) => onCity(e.target.value)}>
          {cities.map((x) => (
            <option key={x.name} value={x.name}>
              {x.province ? `${x.province} · ${x.name}` : x.name}
            </option>
          ))}
        </select>
      </label>
      <label className="locslot">
        <span className="lab">🗺️ 鸟点</span>
        <select
          value={stopId || ""}
          onChange={(e) => onStop(e.target.value)}
          disabled={!c || (!hasRegion && pts.length === 0)}
        >
          {hasRegion && (
            <option value={c.regionId}>整个{c.name}（地区概览）</option>
          )}
          {pts.map((p) => (
            <option key={p.id} value={p.id}>
              {pointLabel(p)}
            </option>
          ))}
          {!hasRegion && pts.length === 0 && <option value="">（暂无鸟点）</option>}
        </select>
        {(district || points.length > 0 || isRegion) && (
          <div className="locchips">
            {isRegion && <span className="locchip locchip--region">地区概览</span>}
            {district && <span className="locchip">{district}</span>}
            {points.slice(0, 3).map((p) => (
              <span key={p} className="locchip locchip--point">
                {p}
              </span>
            ))}
          </div>
        )}
      </label>
    </div>
  );
}
