import Info from "../components/Info.jsx";

// 占位页：时 + 鸟 → 地。需要报告经纬度才能把点位聚类成地图热点。
export default function PageMap() {
  return (
    <div className="wf">
      <div className="map-ph">
        <div className="map-ph-in">
          <div className="map-ph-title">
            地图页建设中
            <Info label="为什么先放占位">
              <p>
                名录（地+时→鸟）和柱图（地+鸟→时）按地名分组即可，不需要坐标。
              </p>
              <p>
                只有这页"在地图上找点位"必须有报告级经纬度 —— 抓取仍在进行中。
              </p>
            </Info>
          </div>
          <div className="map-ph-sub">坐标补齐后自动上线</div>
        </div>
      </div>
    </div>
  );
}
