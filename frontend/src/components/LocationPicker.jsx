import { useEffect, useState } from "react";
import { pointLabel, districtBadge } from "../lib/locations.js";

// 地点两维选择器：城市（主） + 鸟点（次，可选）。
// - 该市有地区概览 → 鸟点下拉多一项"整个市（地区概览）"
// - 该市的 regions/<id>.json 里的 spots[]（真实抓到的鸟点）也异步塞进下拉，
//   分组显示："行程停留点"（TRIP_STOPS 里的组合景点）与"鸟点排行"（scraped
//   point_id，按鸟种数排）。这样拉萨这种没有细拆行程停留点的城市也能直接从
//   下拉挑一个具体鸟点，不用先进地区概览再点。
// - 选中鸟点后在下方显示区县 chip（如 玉龙县 / 古城区）+ 子景点前几个。

const regionCache = new Map();
async function loadRegionSpots(regionId) {
  if (regionCache.has(regionId)) return regionCache.get(regionId);
  try {
    const r = await fetch(`/data/regions/${encodeURIComponent(regionId)}.json`);
    if (!r.ok) {
      regionCache.set(regionId, []);
      return [];
    }
    const b = await r.json();
    const spots = (b?.spots || []).map((s) => ({
      id: s.id,
      name: s.name,
      nsp: s.nsp || 0,
      nck: s.nck || 0,
    }));
    // 按鸟种数降序：读者最有可能挑的排前面。
    spots.sort((a, b) => b.nsp - a.nsp || b.nck - a.nck);
    regionCache.set(regionId, spots);
    return spots;
  } catch {
    regionCache.set(regionId, []);
    return [];
  }
}

export default function LocationPicker({ cities, city, onCity, currentCity, stopId, onStop }) {
  const [regionSpots, setRegionSpots] = useState([]);
  const c = currentCity;
  const pts = c?.points || [];
  const hasRegion = !!c?.regionId;

  useEffect(() => {
    if (!hasRegion) {
      setRegionSpots([]);
      return;
    }
    let alive = true;
    loadRegionSpots(c.regionId).then((spots) => {
      if (alive) setRegionSpots(spots);
    });
    return () => {
      alive = false;
    };
  }, [c?.regionId, hasRegion]);

  const isRegion = hasRegion && stopId === c?.regionId;
  const selectedTripStop = pts.find((p) => p.id === stopId);
  const selectedRegionSpot = regionSpots.find((s) => s.id === stopId);
  const district = selectedTripStop ? districtBadge(selectedTripStop) : "";
  const childPoints = selectedTripStop?.points || [];
  const anyPointOptions = pts.length > 0 || regionSpots.length > 0;

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
          disabled={!c || (!hasRegion && !anyPointOptions)}
        >
          {hasRegion && (
            <option value={c.regionId}>整个{c.name}（地区概览）</option>
          )}
          {pts.length > 0 && (
            <optgroup label="行程停留点">
              {pts.map((p) => (
                <option key={p.id} value={p.id}>
                  {pointLabel(p)}
                </option>
              ))}
            </optgroup>
          )}
          {regionSpots.length > 0 && (
            <optgroup label="鸟点排行">
              {regionSpots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}（{s.nsp} 种 / {s.nck} 份）
                </option>
              ))}
            </optgroup>
          )}
          {!hasRegion && !anyPointOptions && <option value="">（暂无鸟点）</option>}
        </select>
        {(isRegion || district || childPoints.length > 0 || selectedRegionSpot) && (
          <div className="locchips">
            {isRegion && <span className="locchip locchip--region">地区概览</span>}
            {selectedRegionSpot && (
              <span className="locchip locchip--region">
                {selectedRegionSpot.nsp} 种 / {selectedRegionSpot.nck} 份
              </span>
            )}
            {district && <span className="locchip">{district}</span>}
            {childPoints.slice(0, 3).map((p) => (
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
