# CLAUDE.md

BirdTrace：给中国观鸟记录中心（birdreport.cn）数据做探索界面，对标 eBird Explore。
架构与目录见 `README.md`；产品/设计 spec 在 `birdtrace_workspace/`。

## Spec 撰写约定（product_spec / design_spec 及一切要出交付版的文档）

1. **内部/对外分层**：标 🔒 的章节是内部追踪内容（版本历史、决策依据、过程记录），
   **制作对外交付版时整节删除**。其余章节按对外可读标准撰写。写新内容时先想清楚
   归哪边：制作过程的 context、"为什么不做 X"的评估记录 → 🔒；功能定义、交互规则、
   验收标准 → 正文。
2. **语言简单直接**：直接说做什么，不重复论证。一个决定写一次，别在多个章节复述。
3. **版本记录放文末 🔒 附录**，每版压缩到 3–4 行；文档开头不放 changelog，开门见山
   进正文（可放一段 5–6 行的「当前基线」给工程速读）。
4. **未来想法进 product spec「未来方向」章节**（for future reference，不排期），
   写清楚：概念一句话、产品位置定没定、依赖什么、为什么值得记。
5. **明确不做的东西要落档带理由**（放 🔒 附录），防止后续重复评估。

## 关键实现约定（改前端时遵守）

- 对外/dev 双版：`IS_PUBLIC`（`frontend/src/lib/mode.js`，构建时 `VITE_PUBLIC=1` 注入）。
  工程细节文案（抓取进度、明细待抓解释、Backlog 提示）只出现在 dev 版。新功能两版都要能跑。
- 地点 = 两维（城市 + 鸟点）。对外版城市白名单在 `lib/locations.js` 的 `PUBLIC_CITIES`。
- 一切展示鸟点名的地方走 `lib/spots.js` 的规范化合并层（`groupSpotsByCanonical`），
  不裸出 point_name；新发现没归拢的写法往 `ALIASES` / `PARENT_ABSORBS` 补。
- 长解释收进 `Info`（ⓘ）组件，页面第一眼保持干净；数字类信息进 chip，不塞下拉 option 文本。
- 金色 `#d9a92e` 只用于"系统的建议/答案"，不做装饰。
- 不破坏 `index.css` 的 ≤640px 响应式断点。
- 构建验证：`cd frontend && ./node_modules/.bin/vite build && VITE_PUBLIC=1 ./node_modules/.bin/vite build`。

## 数据事实

- 数据覆盖是**很小的切片**：云南 + 西藏部分地区，2024–2025 两年，**集中在 5–6 月**
  （行程驱动抓取；云南另有少量 1/2/3/12 月省级样本，西藏基本只有 6 月+一次"最近"扫）。
  静态快照，非实时。
- 推论：12 个月维度的可视化在 5–6 月外基本空。MVP 定位是 demo——真实切片证明界面
  能跑通，全年/全国维度用示例数据补齐并显式标注，所有展示场合明确说明数据局限。
- DB 和 `frontend/public/data/` 都不入 git（后者靠 `.vercelignore` 单独上传 Vercel），
  沙箱里看不到真实数据 —— 判断数据覆盖时以生产 DB / Vercel 部署为准，别只凭 TODO.md 推断。
- 数据诚实性是硬约束（product spec §5）：真实数据标来源+覆盖+年份，filler 标「示例数据」，
  两者绝不混淆。
