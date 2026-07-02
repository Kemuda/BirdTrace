// 鸟点名字规范化 + 合并同类项。
//
// 观鸟报告 point_name 是用户手输的自由文本，同一个地方会有一堆写法：
//   拉市海 / 拉市海湿地 / 拉市海湿地公园 / 拉市海湿地候鸟湾 / 拉市海国际重要湿地
//   老君山 / 老君山自然中心 / 老君山九十九龙潭 / 老君山黎明 / 老君山自然中心东南300米
//   玉龙雪山 / 玉龙雪山国家级名胜风景区 / 玉龙雪山景区 / 玉龙雪山云杉坪
//
// 归口靠四层（越靠前优先级越高）：
//   1. ALIASES：手工核对过的映射（原名 -> 正式名；null = 不是鸟点，隐藏）
//   2. JUNK：明显不是鸟点的关键字（"位置"/"未知"/"拉萨市中华文化" 等）
//   3. PARENT_ABSORBS：以已知父点开头的散写法归到父点（老君山* -> 老君山）
//   4. SUFFIXES：常见修饰后缀，迭代去掉直到不变（老君山自然中心 -> 老君山）
//   5. ADMIN_ONLY：纯行政区名（"XX县"/"XX区"）—— 隐藏
// 新数据出来时先跑 canonicalizeSpot()，看不合理再往 ALIASES/PARENT_ABSORBS 补。

// 已知父点前缀 —— 任何以此开头的散写法（包括"XX自然中心东南300米"这种坐标标注）
// 都归为父点本名。云杉坪/蓝月谷/黑龙潭 这种明确的次级景点在 ALIASES 里单列。
const PARENT_ABSORBS = [
  "老君山",
  "拉市海",
  "拉鲁湿地",
  "布达拉宫",
  "罗布林卡",
  "大昭寺",
  "小昭寺",
  "色拉寺",
  "哲蚌寺",
  "扎基寺",
  "南山公园", // 拉萨
  "宗角禄康",
];

// 明确的别名（含次级鸟点的正式命名）。
const ALIASES = {
  // 玉龙雪山系里保留次级景点作为独立鸟点（云杉坪 3100m 林线 / 蓝月谷 河谷）
  "云杉坪": "云杉坪",
  "玉龙雪山云杉坪": "云杉坪",
  "玉龙雪山·云杉坪": "云杉坪",
  "蓝月谷": "蓝月谷",
  "玉龙雪山蓝月谷": "蓝月谷",
  "玉龙雪山·蓝月谷": "蓝月谷",
  "玉龙雪山": "玉龙雪山",
  "玉龙雪山国家级名胜风景区": "玉龙雪山",
  "玉龙雪山景区": "玉龙雪山",
  "玉龙雪山风景区": "玉龙雪山",
  // 老君山散写法（PARENT_ABSORBS 会自动兜住"老君山*"）
  "九龙潭": "老君山",
  "九十九龙潭": "老君山",
  // 丽江古城系
  "丽江古城": "丽江古城",
  "大研古城": "丽江古城",
  "四方街": "丽江古城",
  "木府": "丽江古城",
  "狮子山": "丽江古城",
  "万古楼": "丽江古城",
  // 黑龙潭（与丽江古城相邻但常单独列，保留独立名）
  "黑龙潭": "黑龙潭公园",
  "黑龙潭公园": "黑龙潭公园",
  "丽江黑龙潭": "黑龙潭公园",
  "丽江黑龙潭公园": "黑龙潭公园",
  // 束河 / 白沙 / 玉水寨 / 玉峰寺
  "束河": "束河古镇",
  "束河古镇": "束河古镇",
  "白沙": "白沙古镇",
  "白沙古镇": "白沙古镇",
  "玉水寨": "玉水寨",
  "玉水寨风景区": "玉水寨",
  "玉峰寺": "玉峰寺",
  // 拉萨侧特例
  "布达拉宫广场": "布达拉宫",
  "八廓街": "八廓街",
  "八角街": "八廓街",
  // 明显应过滤 —— 用户手写的通用字段 or 截断的怪名
  "位置": null,
  "地点": null,
  "未知": null,
  "无": null,
  "-": null,
  "拉萨市中华文化": null, // 截断怪名，来源不明
  "云南": null,
  "西藏": null,
  // 纯行政区，不算鸟点
  "玉龙纳西族自治县": null,
  "玉龙县": null,
  "古城区": null,
  "丽江市": null,
  "丽江古城区": null,
  "拉萨市": null,
  "城关区": null,
  "堆龙德庆区": null,
  "达孜区": null,
  "曲水县": null,
  "尼木县": null,
  "当雄县": null,
  "林周县": null,
  "墨竹工卡县": null,
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

// 明显不是鸟点的关键字模式（截断怪名 / 泛地名标签）
const JUNK_PATTERNS = [
  /^[a-zA-Z0-9\-_.\s]+$/, // 纯 ASCII 数字/符号 —— 抓到的多是 GPS 或 ID 残片
  /^[·・、,]+$/,
  /^[一-龥]{1}$/, // 单字符 —— 太泛了不足以定位
];

// 规范化：返回正式名；空串 = 不算鸟点（隐藏）。
export function canonicalizeSpot(name) {
  if (!name) return "";
  const raw = String(name).trim();
  if (!raw) return "";
  if (raw in ALIASES) return ALIASES[raw] ?? "";
  for (const pat of JUNK_PATTERNS) if (pat.test(raw)) return "";
  // 前缀吸收：老君山自然中心东南300米 / 拉市海某某段 / 布达拉宫广场东侧 …
  for (const parent of PARENT_ABSORBS) {
    if (raw.startsWith(parent)) return parent;
  }

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
  if (!cur) return raw;
  if (ADMIN_ONLY.test(cur)) return "";
  if (cur in ALIASES) return ALIASES[cur] ?? "";
  return cur;
}

import { shortDistrict } from "./locations.js";

// 从若干 district 值里挑最能代表的（出现最多次；空/null 忽略）。
function pickDistrict(districts) {
  const counts = new Map();
  for (const d of districts) {
    if (!d) continue;
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  if (!counts.size) return null;
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

// 把 scraped spots[] 按规范化名字合并成一组一组。
// 每组保留：
//   name       正式名
//   id         代表 primaryId（清单最多的那条），用于导航
//   raw[]      原始点数组，透出让读者能看合并了谁
//   nck        累计清单数（sum）
//   nsp        物种数上界近似 = max(raw.nsp)
//   spc        种/单
//   lat/lng    平均坐标
//   top[]      常见鸟并集
//   district   代表区县（raw 里出现最多的一个）
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
            top: [], district: null };
      groups.set(canonical, g);
    }
    g.raw.push(s);
    g.nck += s.nck || 0;
    if ((s.nsp || 0) > g.nsp) g.nsp = s.nsp || 0;
    const primaryRaw = g.raw.find((r) => r.id === g.id);
    if ((s.nck || 0) > (primaryRaw?.nck || 0)) g.id = s.id;
    if (s.lat != null && s.lng != null) {
      g._latAcc += s.lat; g._lngAcc += s.lng; g._coordCount += 1;
    }
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
    g.district = shortDistrict(pickDistrict(g.raw.map((r) => r.district)));
    out.push(g);
  }
  return out.sort(
    (a, b) => b.nsp - a.nsp || b.nck - a.nck || a.name.localeCompare(b.name, "zh")
  );
}
