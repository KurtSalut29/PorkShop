"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPeso } from "@/lib/format";

/** Validated single-series mark color (oxblood, passes contrast vs the card surface). */
const SERIES = "#c02a5e";
const GRID = "oklch(0.912 0.007 70)";
const AXIS_TEXT = "oklch(0.5 0.014 50)";

const compactPeso = (v: number) =>
  v >= 1000 ? `₱${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}K` : `₱${Math.round(v)}`;

const shortDay = (key: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
const longDay = (key: string) =>
  new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${key}T00:00:00Z`),
  );

function TooltipCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{title}</p>
      {rows.map(([k, v]) => (
        <p key={k} className="flex justify-between gap-6 text-muted-foreground">
          <span>{k}</span>
          <span className="num font-medium text-foreground">{v}</span>
        </p>
      ))}
    </div>
  );
}

/** Daily completed-sales revenue. Single series: the card title names it, so no legend. */
export function RevenueChart({
  data,
  height = 260,
}: {
  data: { day: string; revenue: number; orders: number }[];
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.revenue, 0);
  return (
    <div role="img" aria-label={`Daily revenue chart, ${data.length} days, total ${formatPeso(total)}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            dataKey="day"
            tickFormatter={shortDay}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={compactPeso}
            tickLine={false}
            axisLine={false}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "oklch(0.958 0.006 75)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as { day: string; revenue: number; orders: number };
              return (
                <TooltipCard
                  title={longDay(d.day)}
                  rows={[
                    ["Revenue", formatPeso(d.revenue)],
                    ["Orders", String(d.orders)],
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="revenue" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Revenue by product, sorted descending. Horizontal bars so long names stay readable. */
export function ProductRevenueChart({ data }: { data: { name: string; revenue: number; qty: number; unit: string }[] }) {
  const height = Math.max(160, data.length * 36 + 24);
  return (
    <div role="img" aria-label="Revenue by product" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            type="number"
            tickFormatter={compactPeso}
            tickLine={false}
            axisLine={false}
            tick={{ fill: AXIS_TEXT, fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "oklch(0.3 0.016 45)", fontSize: 12 }}
            width={120}
          />
          <Tooltip
            cursor={{ fill: "oklch(0.958 0.006 75)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as { name: string; revenue: number; qty: number; unit: string };
              return (
                <TooltipCard
                  title={d.name}
                  rows={[
                    ["Revenue", formatPeso(d.revenue)],
                    ["Sold", `${Number(d.qty.toFixed(3))} ${d.unit === "KG" ? "kg" : "pcs"}`],
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="revenue" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
