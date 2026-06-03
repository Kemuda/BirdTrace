import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MONTH_LABELS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

export default function BarChart({ data }) {
  const display = data.map((d, i) => ({ ...d, label: MONTH_LABELS[i] }));
  return (
    <div className="w-full h-80">
      <ResponsiveContainer>
        <RBarChart data={display} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            label={{ value: "出现频率", angle: -90, position: "insideLeft", offset: 16 }}
          />
          <Tooltip
            formatter={(value, _name, ctx) => {
              const row = ctx.payload;
              return [
                `${value}% (${row.reports_with_species}/${row.total_reports})`,
                "出现频率",
              ];
            }}
          />
          <Bar dataKey="frequency_pct" fill="#2563eb" />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
