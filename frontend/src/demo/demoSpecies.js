// ⚠️ 示例(filler)数据 —— 仅供「分布图」explore 页做前端/交互展示，
// **不是真实观测记录**。数字、月份、坐标均为演示用途编造/近似。
//
// 接口就绪后，把 lib/exploreData.js 里的 provider 从这里切到真实数据源即可，
// 本页 UI 一行不用改：
//   · birdreport 导出：/data/species_locations.json（鸟种→地点）+ 各鸟点坐标
//   · 或 eBird API 2.0：obs/geo/recent、ref/hotspot/{region} 等（需 API key）
//
// 坐标为各鸟点的大致位置（WGS-84 量级）。真实数据里 birdreport 坐标推断为
// GCJ-02，切换时记得按 TODO.md「验证坐标系」处理偏移。

export const DEMO_SPECIES = [
  {
    name: "黑颈鹤",
    en: "Black-necked Crane",
    latin: "Grus nigricollis",
    note: "全球唯一高原鹤类：青藏高原繁殖，云贵高原越冬。",
    locations: [
      { point: "大山包", region: "云南 · 昭通 · 昭阳", lat: 27.32, lng: 103.31, reports: 214, months: [11, 12, 1, 2] },
      { point: "会泽念湖", region: "云南 · 曲靖 · 会泽", lat: 26.42, lng: 103.30, reports: 156, months: [11, 12, 1, 2, 3] },
      { point: "纳帕海", region: "云南 · 迪庆 · 香格里拉", lat: 27.90, lng: 99.63, reports: 98, months: [11, 12, 1, 2] },
      { point: "玛旁雍错", region: "西藏 · 阿里 · 普兰", lat: 30.66, lng: 81.47, reports: 41, months: [5, 6, 7, 8] },
      { point: "隆宝滩", region: "青海 · 玉树", lat: 33.20, lng: 96.53, reports: 33, months: [5, 6, 7] },
    ],
  },
  {
    name: "白马鸡",
    en: "White Eared Pheasant",
    latin: "Crossoptilon crossoptilon",
    note: "横断山高海拔针叶林特有雉类，全年留居。",
    locations: [
      { point: "白马雪山", region: "云南 · 迪庆 · 德钦", lat: 28.37, lng: 99.05, reports: 87, months: [1, 3, 4, 5, 6, 9, 11] },
      { point: "普达措国家公园", region: "云南 · 迪庆 · 香格里拉", lat: 27.87, lng: 99.94, reports: 64, months: [4, 5, 6, 7, 10] },
      { point: "玉龙雪山 · 云杉坪", region: "云南 · 丽江 · 玉龙", lat: 27.10, lng: 100.17, reports: 29, months: [5, 6, 7] },
    ],
  },
  {
    name: "血雉",
    en: "Blood Pheasant",
    latin: "Ithaginis cruentus",
    note: "高山针叶林与杜鹃灌丛，随雪线上下垂直迁移。",
    locations: [
      { point: "白马雪山", region: "云南 · 迪庆 · 德钦", lat: 28.36, lng: 99.06, reports: 72, months: [3, 4, 5, 6, 10, 11] },
      { point: "玉龙雪山", region: "云南 · 丽江 · 玉龙", lat: 27.11, lng: 100.18, reports: 45, months: [5, 6, 7, 8] },
      { point: "巴朗山", region: "四川 · 阿坝 · 小金", lat: 30.90, lng: 102.90, reports: 118, months: [4, 5, 6, 7, 8, 9] },
    ],
  },
  {
    name: "绿孔雀",
    en: "Green Peafowl",
    latin: "Pavo muticus",
    note: "国家一级重点保护，云南干热河谷残存种群，极度濒危。",
    locations: [
      { point: "双柏恐龙河", region: "云南 · 楚雄 · 双柏", lat: 24.60, lng: 101.62, reports: 38, months: [2, 3, 4, 5, 6] },
      { point: "新平者干河", region: "云南 · 玉溪 · 新平", lat: 24.07, lng: 101.99, reports: 21, months: [3, 4, 5] },
    ],
  },
  {
    name: "火尾绿鹛",
    en: "Fire-tailed Myzornis",
    latin: "Myzornis pyrrhoura",
    note: "高黎贡与横断山高海拔苔藓林，冬季下移访花。",
    locations: [
      { point: "高黎贡百花岭", region: "云南 · 保山 · 隆阳", lat: 25.30, lng: 98.80, reports: 96, months: [11, 12, 1, 2, 3] },
      { point: "独龙江", region: "云南 · 怒江 · 贡山", lat: 27.70, lng: 98.34, reports: 27, months: [4, 5, 6] },
      { point: "白马雪山垭口", region: "云南 · 迪庆 · 德钦", lat: 28.38, lng: 99.02, reports: 19, months: [6, 7] },
    ],
  },
  {
    name: "黑鹳",
    en: "Black Stork",
    latin: "Ciconia nigra",
    note: "国家一级保护，河谷湿地过境与越冬。",
    locations: [
      { point: "拉萨河", region: "西藏 · 拉萨 · 城关", lat: 29.65, lng: 91.10, reports: 54, months: [10, 11, 12, 1, 2, 3] },
      { point: "年楚河", region: "西藏 · 日喀则 · 桑珠孜", lat: 29.27, lng: 88.88, reports: 31, months: [11, 12, 1, 2] },
      { point: "拿日雍错", region: "西藏 · 山南 · 浪卡子", lat: 28.70, lng: 90.60, reports: 12, months: [9, 10] },
    ],
  },
];
