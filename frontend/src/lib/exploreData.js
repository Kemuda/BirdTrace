// Explore 数据 provider（可切换层）。
// ===========================================================================
// 目的：让「分布图」等 explore 展示页只依赖这里的函数签名，而不直接绑定数据源。
// 现在指向 demo/ 下的 filler 假数据；等真实接口就位，只改本文件内部实现，
// 页面组件（PageSpecies 等）无需改动。
//
// 切换真实数据的两条路（见 TODO.md / 会议文档）：
//   1. birdreport 导出（本项目自有）
//      - 鸟种→地点：/data/species_locations.json（已存在，但当前不带坐标）
//      - 坐标：/data/regions/*.json 里各鸟点 lat/lng（按 point 名归并）
//      → 在 getSpeciesDistribution 里 fetch 这两份并 join。
//   2. eBird API 2.0（需 API key，做 eBird/Merlin 集成时）
//      - ref/hotspot/{regionCode}、data/obs/{regionCode}/recent 等
//      → 换成对 api.ebird.org 的请求，结果映射成下方 shape。
//
// 统一返回 shape（页面只认这个）：
//   { name, en, latin, note, isDemo, total_reports,
//     locations: [{ point, region, lat, lng, reports, months:number[] }] }
// ===========================================================================

import { DEMO_SPECIES } from "../demo/demoSpecies.js";

// 当前数据源标记：true = filler 假数据（页面会显式标注「示例数据」）。
export const EXPLORE_IS_DEMO = true;

// 供选择器用的鸟种清单（真实数据下换成 taxon_list.json 的子集或热门种）。
export function listDistributionSpecies() {
  return DEMO_SPECIES.map((s) => ({
    name: s.name,
    en: s.en,
    latin: s.latin,
  }));
}

// 单个鸟种的分布数据。真实数据下：fetch species_locations.json[name] 并 join 坐标。
export function getSpeciesDistribution(name) {
  const s = DEMO_SPECIES.find((x) => x.name === name);
  if (!s) return null;
  const locations = s.locations
    .filter((l) => l.lat != null && l.lng != null)
    .map((l) => ({ ...l, months: [...l.months].sort((a, b) => a - b) }))
    .sort((a, b) => b.reports - a.reports);
  return {
    name: s.name,
    en: s.en,
    latin: s.latin,
    note: s.note,
    isDemo: EXPLORE_IS_DEMO,
    total_reports: locations.reduce((n, l) => n + l.reports, 0),
    locations,
  };
}

// ---- 季节归类（用于地图点着色 + 图例）-------------------------------------
// 由某地点记录到该鸟的月份集合，判一个主季节。留鸟/全年 = 月份跨度大。
// 真实数据切过来后此逻辑不变（月份口径一致）。
export const SEASONS = {
  winter: { key: "winter", label: "越冬", color: "#3b5c8a" },   // --hand
  breeding: { key: "breeding", label: "繁殖", color: "#3f7d57" }, // --present
  passage: { key: "passage", label: "过境", color: "#d9a92e" },  // --hi-line
  resident: { key: "resident", label: "留鸟/全年", color: "#6c685f" }, // --ink-soft
};

const WINTER = new Set([11, 12, 1, 2]);
const BREEDING = new Set([5, 6, 7, 8]);

export function seasonOf(months) {
  const m = new Set(months || []);
  if (!m.size) return SEASONS.resident;
  const inWinter = [...m].some((x) => WINTER.has(x));
  const inBreeding = [...m].some((x) => BREEDING.has(x));
  // 跨越冬 + 繁殖两季且月份多 → 留鸟。
  if (inWinter && inBreeding && m.size >= 6) return SEASONS.resident;
  if (inWinter && !inBreeding) return SEASONS.winter;
  if (inBreeding && !inWinter) return SEASONS.breeding;
  if (inWinter && inBreeding) return SEASONS.resident;
  return SEASONS.passage;
}
