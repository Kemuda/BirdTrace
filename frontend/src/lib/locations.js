// 地点拆两维：城市（省·市/地区）+ 鸟点（该市里的停留点）。
// 城市 = 主选择；鸟点 = 该城市下的可选停留点，可留空看该城市地区概览。
// 数据源两条：`stops[]`（行程停留点，多为鸟点粒度）+ `regions[]`（有地区概览的市）。

function cityLabelFromStop(s) {
  // stop.region 形如 "云南 · 丽江市" / "西藏 · 拉萨" / "云南·迪庆·香格里拉市"
  // 只取最后一级（市 / 地区），前面省份剥掉；用于城市下拉的显示与聚合。
  if (!s?.region) return s?.province || "未分类";
  const parts = String(s.region).split(/[·・\s]*·[·・\s]*|\s+·\s+|\s+/).filter(Boolean);
  return parts[parts.length - 1] || s.region;
}

// 停留点显示成"鸟点"名：把 label 里的城市前缀去掉，只留点名。
export function pointLabel(s) {
  if (!s?.label) return "";
  const city = cityLabelFromStop(s);
  const short = String(s.label).replace(new RegExp("^" + city + "[·・\\-\\s]*"), "");
  return short || s.label;
}

// 建两级索引：city -> { name, province, regionId?, points: Stop[] }
// - regionId：该市有地区概览（regions manifest 命中）时挂上，供"看整个市（地区概览）"选项。
// - points：该市名下的所有 stops（可能为空，比如只有地区概览、没具体点）。
export function groupByCity(stops = [], regions = []) {
  const byCity = new Map();

  const put = (key, patch) => {
    if (!byCity.has(key)) byCity.set(key, { name: key, province: "", regionId: null, points: [] });
    Object.assign(byCity.get(key), patch);
  };

  for (const s of stops) {
    const key = cityLabelFromStop(s);
    put(key, { province: s.province || byCity.get(key)?.province || "" });
    byCity.get(key).points.push(s);
  }

  for (const r of regions) {
    // regions[] 项形如 { id, name (市名), province, ... }
    const key = r.name || r.id;
    if (!key) continue;
    put(key, { province: r.province || byCity.get(key)?.province || "", regionId: r.id });
  }

  // 排个序：先按省份归拢，再按市名。省份为空的放最后。
  return Array.from(byCity.values()).sort((a, b) => {
    const pa = a.province || "~";
    const pb = b.province || "~";
    if (pa !== pb) return pa.localeCompare(pb, "zh");
    return String(a.name).localeCompare(String(b.name), "zh");
  });
}

// 从当前 stopId 反查它所属的城市（bootstrap 用）。
export function cityOfStop(stopId, cities) {
  for (const c of cities) {
    if (c.regionId === stopId) return c.name;
    if (c.points.some((p) => p.id === stopId)) return c.name;
  }
  return null;
}
