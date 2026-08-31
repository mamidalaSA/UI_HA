import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// Categorical palette (light mode), fixed order — from the house dataviz palette.
// Assigned by slot order, never cycled/re-derived per dataset.
export const CATEGORICAL_PALETTE = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
];

export interface DonutDatum {
  label: string;
  value: number;
}

interface DonutChartProps {
  title?: string;
  data: DonutDatum[];
  emptyMessage?: string;
}

/** Donut chart with a side legend that always shows percentages — identity is
 * never color-alone. Caps at the palette's 6 slots; extra categories fold into
 * "Other" so hue never gets cycled/regenerated past the validated palette. */
export function DonutChart({ title, data, emptyMessage = "No data yet" }: DonutChartProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const MAX_SLICES = CATEGORICAL_PALETTE.length;
  let display = sorted;
  if (sorted.length > MAX_SLICES) {
    const head = sorted.slice(0, MAX_SLICES - 1);
    const otherTotal = sorted.slice(MAX_SLICES - 1).reduce((sum, d) => sum + d.value, 0);
    display = [...head, { label: "Other", value: otherTotal }];
  }
  const total = display.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      {title && <h3 className="mb-3 text-base font-semibold text-slate-800">{title}</h3>}
      {total === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={display}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="60%"
                  outerRadius="90%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {display.map((entry, i) => (
                    <Cell key={entry.label} fill={CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} (${((Number(value) / total) * 100).toFixed(0)}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
            {display.map((entry, i) => (
              <li key={entry.label} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-slate-700">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length] }}
                  />
                  <span className="truncate">{entry.label}</span>
                </span>
                <span className="shrink-0 font-medium text-slate-500">
                  {entry.value} ({((entry.value / total) * 100).toFixed(0)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
