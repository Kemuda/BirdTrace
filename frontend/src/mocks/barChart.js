// Synthetic Bar Chart data — used as fallback when the static export for the
// chosen (province, taxon) pair hasn't been generated yet. Shape matches the
// output of data/process/export_json.py:bar_chart().

export const mockBarChart = [
  { month: "01", reports_with_species: 12, total_reports: 80, frequency_pct: 15.0 },
  { month: "02", reports_with_species: 18, total_reports: 75, frequency_pct: 24.0 },
  { month: "03", reports_with_species: 35, total_reports: 90, frequency_pct: 38.9 },
  { month: "04", reports_with_species: 52, total_reports: 110, frequency_pct: 47.3 },
  { month: "05", reports_with_species: 41, total_reports: 120, frequency_pct: 34.2 },
  { month: "06", reports_with_species: 22, total_reports: 130, frequency_pct: 16.9 },
  { month: "07", reports_with_species: 14, total_reports: 125, frequency_pct: 11.2 },
  { month: "08", reports_with_species: 19, total_reports: 115, frequency_pct: 16.5 },
  { month: "09", reports_with_species: 38, total_reports: 100, frequency_pct: 38.0 },
  { month: "10", reports_with_species: 48, total_reports: 95, frequency_pct: 50.5 },
  { month: "11", reports_with_species: 30, total_reports: 88, frequency_pct: 34.1 },
  { month: "12", reports_with_species: 16, total_reports: 82, frequency_pct: 19.5 },
];

// Province list from PRD §数据层. Order roughly north -> south.
export const PROVINCES = [
  "北京", "天津", "河北", "山西", "内蒙古",
  "辽宁", "吉林", "黑龙江",
  "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东",
  "河南", "湖北", "湖南", "广东", "广西", "海南",
  "重庆", "四川", "贵州", "云南", "西藏",
  "陕西", "甘肃", "青海", "宁夏", "新疆",
  "台湾", "香港", "澳门",
];
