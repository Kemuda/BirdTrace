// 地点拆两维：城市（地级市 / 自治州）+ 鸟点（该市里的停留点）。
// - 数据源：`stops[]`（trip 停留点）+ `regions[]`（有地区概览的市）。
// - 归口：所有玉龙县 / 古城区的点算 丽江市；所有阿里 / 札达等县级归到自治州。
//   规则 = 取 stop.region 里 province 之后的**第一段**（地级市/自治州），跨边取左侧。

// 对外展示（polished 版）只放这两个市，dev 版按 stops 里出现的全放。
export const PUBLIC_CITIES = ["丽江市", "拉萨市"];

function cityLabelFromStop(s) {
  // 显式带了 city 字段的停留点（如 lijiang-city 的 "全市汇总"）直接用它。
  if (s?.city) return s.city;
  if (!s?.region) return s?.province || "未分类";
  const parts = String(s.region)
    .split(/[·・]/)
    .map((p) => p.trim())
    .filter(Boolean);
  // 首段是省份就剥掉，剩下的第一段 = 地级市/自治州。虎跳峡这种「丽江市 / 迪庆」
  // 跨边点，取左侧（Amber：算丽江）。
  const rest = parts[0] === s?.province ? parts.slice(1) : parts;
  const first = (rest[0] || parts[0] || "").split("/")[0].trim();
  return first || s?.province || "未分类";
}

// 停留点显示成"鸟点"名：把城市前缀去掉，只留点名（大多数原始 label 里没有前缀，
// 无副作用；有则去掉一层）。
export function pointLabel(s) {
  if (!s?.label) return "";
  const city = cityLabelFromStop(s);
  const short = String(s.label).replace(new RegExp("^" + city + "[·・\\-\\s]*"), "");
  return short || s.label;
}

// 区县名简写：去掉"XX族自治"这种冠饰，用于鸟点旁边的小标签。
//   玉龙纳西族自治县 -> 玉龙县 · 迪庆藏族自治州 -> 迪庆州 · 维西傈僳族自治县 -> 维西县
// 无匹配的（古城区 / 普兰县 / 香格里拉市 等）原样返回。
export function shortDistrict(name) {
  if (!name) return "";
  const ethnic = /(纳西|藏|傈僳|白|彝|哈尼|回|傣|布依|苗|土家|布朗|德昂|阿昌|羌|柯尔克孜|门巴|珞巴|土|东乡|拉祜|佤|水|纳|独龙|怒|普米|景颇|锡伯|京|满|畲|仡佬|毛南|仫佬|基诺|德宏)族/g;
  return String(name).replace(ethnic, "").replace(/自治/g, "");
}

// 鸟点的第一区县标签（可能没有 -> 空串）。
export function districtBadge(s) {
  const first = (s?.districts || [])[0];
  return first ? shortDistrict(first) : "";
}

// 建两级索引：city -> { name, province, regionId?, points: Stop[] }
// - regionId：该市有地区概览（regions manifest 命中）时挂上，供"看整个市（地区概览）"选项。
// - points：该市名下的所有 stops（可能为空，如拉萨只有 city 级 stop 本身）。
// - onlyCities：白名单过滤（对外版只保留 丽江/拉萨）。
export function groupByCity(stops = [], regions = [], onlyCities = null) {
  const byCity = new Map();

  const put = (key, patch) => {
    if (!byCity.has(key)) byCity.set(key, { name: key, province: "", regionId: null, points: [] });
    Object.assign(byCity.get(key), patch);
  };

  for (const s of stops) {
    const key = cityLabelFromStop(s);
    if (onlyCities && !onlyCities.includes(key)) continue;
    put(key, { province: s.province || byCity.get(key)?.province || "" });
    // "整个市（汇总）"级的 stop（如 lijiang-city）当地区概览入口，不塞进 points 列表 ——
    // 避免鸟点下拉里出现「丽江市（全市汇总）」这种非"点"条目。
    if (s.grain === "city") {
      put(key, { regionId: byCity.get(key)?.regionId || s.id });
    } else {
      byCity.get(key).points.push(s);
    }
  }

  for (const r of regions) {
    const key = r.name || r.id;
    if (!key) continue;
    if (onlyCities && !onlyCities.includes(key)) continue;
    put(key, { province: r.province || byCity.get(key)?.province || "" });
    if (!byCity.get(key).regionId) byCity.get(key).regionId = r.id;
  }

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
