import QueryBar from "../components/QueryBar.jsx";

// 占位页：时 + 鸟 → 地。需要报告经纬度才能把点位聚类成地图热点；
// 经纬度接口仍在 Backlog（见 TODO.md / docs），所以这页先放骨架。
export default function PageMap() {
  return (
    <div className="wf">
      <div className="wf-tag">
        <b>去哪看</b>
        <span className="combo">时 + 鸟 → 地</span>
      </div>

      <QueryBar where="" when="12 月" what="黑颈鹤" answer="where" />

      <div className="map-ph">
        <div style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: 14, padding: 20 }}>
          <div style={{ fontSize: 16, color: "var(--ink)", fontWeight: 600, marginBottom: 6 }}>
            地图页待经纬度就位
          </div>
          报告经纬度抓取在 Backlog —— 拿到坐标后，这里把含目标鸟的报告
          <br />
          按 1.5km 半径聚类成点位，按命中率 / 距离 / 稳定度排序。
        </div>
        <div className="cap">底图：高德 · 报告经纬度聚类成点位（非散点）</div>
      </div>

      <div className="callout">
        <b>为什么先放占位：</b>名录（地+时→鸟）和柱图（地+鸟→时）按地名分组即可，不需要坐标；
        只有这页「在地图上找点位」才必须有经纬度。优先级见 <b>TODO.md → Backlog · 经纬度接口</b>。
      </div>

      <div className="take">
        <div className="trust">点位＝聚类半径 1.5km · 命中率＝含该鸟报告 / 总报告</div>
        <button className="btn solid" disabled>
          ⤓ 导出点位 / 生成路线
        </button>
      </div>
    </div>
  );
}
