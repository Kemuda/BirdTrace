// 构建时 flag：VITE_PUBLIC=1 → 对外展示版（隐藏抓取进度条 / 顶部详细状态 / 开发调试细节）。
// 默认（dev 或未设）显示所有开发状态，便于本地调试。
// 用法：`VITE_PUBLIC=1 npm run build` 出对外版；`npm run dev` / `npm run build` 出本地版。
export const IS_PUBLIC = import.meta.env.VITE_PUBLIC === "1";
