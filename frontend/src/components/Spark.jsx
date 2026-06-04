// 火花线：12 个月的出现节律。data = 月度计数（或频率）数组。
// 纯展示，自动按自身最大值归一化，所以稀疏数据也有形状。
export default function Spark({ data, w = 52, h = 20, hi = false }) {
  if (!data || data.length < 2) return <svg className="spark" width={w} height={h} />;
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / max) * (h - 3) - 1.5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={pts}
        fill="none"
        stroke={hi ? "#d9a92e" : "#6c685f"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
