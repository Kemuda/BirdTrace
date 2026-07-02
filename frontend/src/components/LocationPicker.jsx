import { useEffect, useMemo, useState } from "react";
import { pointLabel, districtBadge } from "../lib/locations.js";
import { groupSpotsByCanonical } from "../lib/spots.js";
import { IS_PUBLIC } from "../lib/mode.js";

// 城市 + 鸟点 两维选择器。
// - 城市：地级市 / 自治州（对外版锁到丽江+拉萨；dev 版按数据全展开）
// - 鸟点：对外版仅展示规范化合并后的鸟点排行；dev 版另加"行程停留点"optgroup。
// - 下拉里只放 name（+district 括号内），numeric 与 merge 说明放到下方 chip。
//   Amber 反馈原来的 "拉市海 (+2) · 87 种 / 213 份" 太杂，一行信息过载。
//   现在的口径：
//     下拉：拉市海（玉龙县）
//     chip：87 种 · 213 份清单 · 合并 3 处

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
    // district 字段是新加的，老数据可能没有 —— 兜底为 null。
    const spots = (b?.spots || []).map((s) => ({
      id: s.id,
      name: s.name,
      district: s.district || null,
      nsp: s.nsp || 0,
      nck: s.nck || 0,
      lat: s.lat != null ? s.lat : null,
      lng: s.lng != null ? s.lng : null,
      top: s.top || [],
    }));
    regionCache.set(regionId, spots);
    return spots;
  } catch {
    regionCache.set(regionId, []);
    return [];
  }
}

// 下拉 option 里显示的鸟点名 —— 只放 name + 区县，其它去掉。
function optionLabel(g) {
  if (!g.district) return g.name;
  return `${g.name}（${g.district}）`;
}

export default function LocationPicker({ cities, city, onCity, currentCity, stopId, onStop }) {
  const [rawSpots, setRawSpots] = useState([]);
  const c = currentCity;
  const tripPoints = IS_PUBLIC ? [] : c?.points || [];
  const hasRegion = !!c?.regionId;
  const spotGroups = useMemo(() => groupSpotsByCanonical(rawSpots), [rawSpots]);

  useEffect(() => {
    if (!hasRegion) {
      setRawSpots([]);
      return;
    }
    let alive = true;
    loadRegionSpots(c.regionId).then((spots) => {
      if (alive) setRawSpots(spots);
    });
    return () => {
      alive = false;
    };
  }, [c?.regionId, hasRegion]);

  const isRegion = hasRegion && stopId === c?.regionId;
  const selectedTripStop = tripPoints.find((p) => p.id === stopId);
  const selectedGroup = spotGroups.find(
    (g) => g.id === stopId || g.raw.some((r) => r.id === stopId)
  );
  const district = selectedTripStop ? districtBadge(selectedTripStop) : "";
  const childPoints = selectedTripStop?.points || [];
  const anyPointOptions = tripPoints.length > 0 || spotGroups.length > 0;

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
          {tripPoints.length > 0 && (
            <optgroup label="行程停留点">
              {tripPoints.map((p) => (
                <option key={p.id} value={p.id}>
                  {pointLabel(p)}
                </option>
              ))}
            </optgroup>
          )}
          {spotGroups.length > 0 &&
            (IS_PUBLIC ? (
              spotGroups.map((g) => (
                <option key={g.name} value={g.id}>
                  {optionLabel(g)}
                </option>
              ))
            ) : (
              <optgroup label="鸟点排行">
                {spotGroups.map((g) => (
                  <option key={g.name} value={g.id}>
                    {optionLabel(g)}
                  </option>
                ))}
              </optgroup>
            ))}
          {!hasRegion && !anyPointOptions && <option value="">（暂无鸟点）</option>}
        </select>
        {(isRegion || district || childPoints.length > 0 || selectedGroup) && (
          <div className="locchips">
            {isRegion && <span className="locchip locchip--region">地区概览</span>}
            {selectedGroup && (
              <>
                <span className="locchip locchip--stat">
                  {selectedGroup.nsp} 种 · {selectedGroup.nck} 份清单
                </span>
                {selectedGroup.district && (
                  <span className="locchip">{selectedGroup.district}</span>
                )}
                {selectedGroup.raw.length > 1 && (
                  <span
                    className="locchip locchip--merged"
                    title={selectedGroup.raw.map((r) => r.name).join(" / ")}
                  >
                    合并 {selectedGroup.raw.length} 处
                  </span>
                )}
              </>
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
