// 鸟点名字规范化 + 合并同类项。
//
// 观鸟报告的 point_name 是用户手输的自由文本，同一个地方会有一堆写法：
//   拉市海 / 拉市海湿地 / 拉市海湿地公园 / 拉市海湿地候鸟湾 / 拉市海国际重要湿地
//   老君山 / 老君山自然中心 / 老君山国家级名胜风景区 / 老君山九十九龙潭
//   玉龙雪山 / 玉龙雪山国家级名胜风景区 / 玉龙雪山景区
// 展示前得把它们归到一起，否则一个市能出几十个"鸟点"，大部分是同一地方的写法。
//
// 归口靠三层：
//   1. ALIASES：手工核对过的映射（原名 -> 正式名；null = 不是鸟点，隐藏）
//   2. SUFFIXES：常见修饰后缀，迭代去掉直到不变（老君山自然中心 -> 老君山）
//   3. ADMIN_ONLY：纯行政区名（玉龙纳西族自治县 / 古城区）—— 隐藏
// 新数据出来时先跑 canonicalizeSpot()，看不合理再往 ALIASES 补。

const ALIASES = {
  // —— 丽江 · 拉市海（湿地保护区，同一地）——
  "拉市海": "拉市海",
  "拉市海湿地": "拉市海",
  "拉市海湿地公园": "拉市海",
  "拉市海湿地候鸟湾": "拉市海",
  "拉市海候鸟湾": "拉市海",
  "拉市海国际重要湿地": "拉市海",
  "拉市海高原湿地": "拉市海",
  "拉市海国家级高原湿地自然保护区": "拉市海",
  // —— 丽江 · 老君山（99 龙潭、自然中心等都归到山名）——
  "老君山": "老君山",
  "老君山自然中心": "老君山",
  "老君山国家级名胜风景区": "老君山",
  "老君山国家公园": "老君山",
  "老君山九十九龙潭": "老君山",
  "老君山黎明": "老君山",
  "老君山黎明景区": "老君山",
  "黎明老君山": "老君山",
  // —— 丽江 · 玉龙雪山系（多个景点合并到雪山）——
  "玉龙雪山": "玉龙雪山",
  "玉龙雪山国家级名胜风景区": "玉龙雪山",
  "玉龙雪山景区": "玉龙雪山",
  "玉龙雪山风景区": "玉龙雪山",
  "云杉坪": "玉龙雪山 · 云杉坪",
  "玉龙雪山云杉坪": "玉龙雪山 · 云杉坪",
  "蓝月谷": "玉龙雪山 · 蓝月谷",
  "玉龙雪山蓝月谷": "玉龙雪山 · 蓝月谷",
  // —— 丽江 · 丽江古城系 ——
  "丽江古城": "丽江古城",
  "大研古城": "丽江古城",
  "四方街": "丽江古城",
  "木府": "丽江古城",
  "黑龙潭": "黑龙潭公园",
  "黑龙潭公园": "黑龙潭公园",
  "丽江黑龙潭": "黑龙潭公园",
  // —— 丽江 · 束河 / 白沙 / 玉水寨 ——
  "束河": "束河古镇",
  "束河古镇": "束河古镇",
  "白沙": "白沙古镇",
  "白沙古镇": "白沙古镇",
  "玉水寨": "玉水寨",
  "玉水寨风景区": "玉水寨",
  "玉峰寺": "玉峰寺",
  // —— 拉萨 · 拉鲁湿地 ——
  "拉鲁湿地": "拉鲁湿地",
  "拉鲁湿地国家级自然保护区": "拉鲁湿地",
  "拉鲁湿地公园": "拉鲁湿地",
  // —— 拉萨 · 罗布林卡 / 布达拉宫 / 大昭寺 ——
  "罗布林卡": "罗布林卡",
  "布达拉宫": "布达拉宫",
  "大昭寺": "大昭寺",
  // —— 纯行政区，不算鸟点 ——
  "玉龙纳西族自治县": null,
  "玉龙县": null,
  "古城区": null,
  "丽江市": null,
  "丽江古城区": null,
  "拉萨市": null,
  "城关区": null,
  "堆龙德庆区": null,
  "达孜区": null,
};

// 常见修饰后缀，按长度降序（长的先匹配，避免"国家级" 抢在 "国家级名胜风景区" 前面）。
const SUFFIXES = [
  "国家级自然保护区", "国家级名胜风景区", "国家级风景名胜区",
  "国家自然保护区", "国家湿地公园", "国家森林公园", "国家地质公园",
  "省级自然保护区", "自然保护区", "国际重要湿地",
  "湿地公园", "森林公园", "地质公园", "候鸟湾", "自然中心",
  "名胜风景区", "风景名胜区", "风景区", "景区", "保护区",
  "湿地", "公园",
];

// 只剩"XX县 / XX区 / XX市"这种纯行政字样时 —— 不是鸟点，扔掉。
const ADMIN_ONLY = /^([一-龥]{2,4})(县|区|市|州|地区|镇|村|街道)$/;

// 规范化：返回正式名；空串 = 不算鸟点（隐藏）。
export function canonicalizeSpot(name) {
  if (!name) return "";
  const raw = String(name).trim();
  if (raw in ALIASES) return ALIASES[raw] ?? "";

  let cur = raw;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of SUFFIXES) {
      if (cur.length > suf.length + 1 && cur.endsWith(suf)) {
        cur = cur.slice(0, -suf.length);
        changed = true;
        break;
      }
    }
  }
  cur = cur.trim();
  if (!cur) return raw; // 全被剥没了 → 保底还用原名
  if (ADMIN_ONLY.test(cur)) return ""; // 纯行政区名，隐藏
  return cur;
}

// 把 scraped spots[] 按规范化名字合并成一组一组。
// 每组保留：
//   name       正式名
//   id         代表 primaryId（清单最多的那条），用于导航
//   raw[]      原始点数组，透出让读者能看合并了谁
//   nck        累计清单数（sum）
//   nsp        物种数上界近似 = max(raw.nsp)。严格算应做物种并集，那要拉每个
//              point 的物种列表，这里先用 max 作为**下界**近似 —— 显示写
//              "N+ 种"表示"至少这么多"即可。
//   spc        种/单，nsp / nck 兜底
//   lat/lng    平均坐标（合并的地方大多物理相邻，均值可用）
//   top[]      常见鸟集：raw 里 top 的并集，去重后按频次
// 返回按 (nsp desc, nck desc) 排好序的组数组。
export function groupSpotsByCanonical(spots = []) {
  const groups = new Map();
  for (const s of spots) {
    const canonical = canonicalizeSpot(s?.name);
    if (!canonical) continue;
    let g = groups.get(canonical);
    if (!g) {
      g = { name: canonical, id: s.id, raw: [], nck: 0, nsp: 0,
            lat: null, lng: null, _latAcc: 0, _lngAcc: 0, _coordCount: 0,
            top: [] };
      groups.set(canonical, g);
    }
    g.raw.push(s);
    g.nck += s.nck || 0;
    if ((s.nsp || 0) > g.nsp) g.nsp = s.nsp || 0;
    // primary = 清单最多的原始点，代表这一组做导航
    const primaryRaw = g.raw.find((r) => r.id === g.id);
    if ((s.nck || 0) > (primaryRaw?.nck || 0)) g.id = s.id;
    if (s.lat != null && s.lng != null) {
      g._latAcc += s.lat; g._lngAcc += s.lng; g._coordCount += 1;
    }
    // top 并集：按原始顺序保留，去重，最多 6 个
    for (const t of s.top || []) {
      if (g.top.length < 6 && !g.top.includes(t)) g.top.push(t);
    }
  }
  const out = [];
  for (const g of groups.values()) {
    if (g._coordCount > 0) {
      g.lat = g._latAcc / g._coordCount;
      g.lng = g._lngAcc / g._coordCount;
    }
    delete g._latAcc; delete g._lngAcc; delete g._coordCount;
    g.spc = g.nck ? Math.round((g.nsp / g.nck) * 10) / 10 : 0;
    out.push(g);
  }
  return out.sort(
    (a, b) => b.nsp - a.nsp || b.nck - a.nck || a.name.localeCompare(b.name, "zh")
  );
}
