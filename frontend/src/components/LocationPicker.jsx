import { pointLabel } from "../lib/locations.js";

// 地点两维选择器：城市（主） + 鸟点（次，可选）。
// - 该市有地区概览 → 鸟点下拉多一项"整个市（地区概览）"
// - 鸟点选空 → 落到城市的默认视图（地区概览或第一个鸟点）
export default function LocationPicker({ cities, city, onCity, currentCity, stopId, onStop }) {
  const c = currentCity;
  const pts = c?.points || [];
  const hasRegion = !!c?.regionId;

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
      </label>
    </div>
  );
}
