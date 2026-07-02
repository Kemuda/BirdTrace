import { useEffect, useMemo, useState } from "react";
import { pointLabel, districtBadge } from "../lib/locations.js";
import { groupSpotsByCanonical } from "../lib/spots.js";
import { IS_PUBLIC } from "../lib/mode.js";

// 城市 + 鸟点 两维选择器。
// - 城市：地级市 / 自治州（对外版锁到丽江+拉萨；dev 版按数据全展开）
// - 鸟点：分两块
//   · 对外版（IS_PUBLIC）：只展示 canonical 化后的 scraped 鸟点，行程停留点不
//     露出 —— 因为 demo 面向对方，不需要"我某天去这里"的框架。
//   · dev 版：保留"行程停留点"optgroup + "鸟点排行"optgroup（后者也 canonical
//     化，减少同名分散）。
// - canonical 合并后同名点若源自多个 point_id，显示"+N" 徽章；选中时导航到该组
//   清单最多的 primary id。
// - 选中鸟点后在下方显示区县 + 子景点小 chip。

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
    regionCache.set(regionId, spots);
    return spots;
  } catch {
    regionCache.set(regionId, []);
    return [];
  }
}

export default function LocationPicker({ cities, city, onCity, currentCity, stopId, onStop }) {
  const [rawSpots, setRawSpots] = useState([]);
  const c = currentCity;
  // 对外版隐藏行程停留点；dev 版仍显示。
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
              // 对外版：不套 optgroup 标签，直接列鸟点
              spotGroups.map((g) => (
                <option key={g.name} value={g.id}>
                  {g.name}
                  {g.raw.length > 1 ? ` (+${g.raw.length - 1})` : ""} · {g.nsp} 种 / {g.nck} 份
                </option>
              ))
            ) : (
              <optgroup label="鸟点排行">
                {spotGroups.map((g) => (
                  <option key={g.name} value={g.id}>
                    {g.name}
                    {g.raw.length > 1 ? ` (+${g.raw.length - 1})` : ""} · {g.nsp} 种 / {g.nck} 份
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
                <span className="locchip locchip--region">
                  {selectedGroup.nsp}+ 种 / {selectedGroup.nck} 份
                </span>
                {selectedGroup.raw.length > 1 && (
                  <span
                    className="locchip"
                    title={selectedGroup.raw.map((r) => r.name).join(" / ")}
                  >
                    合并 {selectedGroup.raw.length} 处同名点
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
