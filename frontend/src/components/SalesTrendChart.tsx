import { formatCurrency } from "@/lib/format";

interface SaleEntry {
  date: string;
  grandTotal: number;
  cogs?: number;
}

export default function SalesTrendChart({ sales }: { sales: SaleEntry[] }) {
  if (sales.length === 0) {
    return <div className="text-sm text-gray-400 py-10 text-center">Belum ada data penjualan</div>;
  }

  const byDay = new Map<string, { sales: number; cogs: number }>();
  for (const s of sales) {
    const key = new Date(s.date).toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { sales: 0, cogs: 0 };
    entry.sales += s.grandTotal;
    entry.cogs += s.cogs ?? 0;
    byDay.set(key, entry);
  }
  const days = Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({ date, ...v }));

  const max = Math.max(...days.flatMap((d) => [d.sales, d.cogs]), 1);
  const width = 600;
  const height = 160;
  const padding = 4;
  const innerWidth = width - padding * 2;
  const groupGap = 6;
  const barGap = 2;
  const groupWidth = Math.min(Math.max((innerWidth - groupGap * (days.length - 1)) / days.length, 4), 26);
  const barWidth = (groupWidth - barGap) / 2;
  const dateLabel = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" preserveAspectRatio="none" role="img" aria-label="Grafik penjualan vs HPP harian">
      <line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke="currentColor" className="text-gray-200" strokeWidth={1} />
      {days.map((d, i) => {
        const gx = padding + i * (groupWidth + groupGap);
        const salesH = d.sales > 0 ? Math.max((d.sales / max) * (height - 14), 2) : 0;
        const cogsH = d.cogs > 0 ? Math.max((d.cogs / max) * (height - 14), 2) : 0;
        return (
          <g key={d.date}>
            <rect x={gx} y={height - salesH - 1} width={barWidth} height={salesH} rx={1.5} className="fill-brand-500 hover:fill-brand-600 transition-colors">
              <title>
                {dateLabel(d.date)} · Penjualan: {formatCurrency(d.sales)}
              </title>
            </rect>
            <rect x={gx + barWidth + barGap} y={height - cogsH - 1} width={barWidth} height={cogsH} rx={1.5} className="fill-sky-300 hover:fill-sky-400 transition-colors">
              <title>
                {dateLabel(d.date)} · HPP: {formatCurrency(d.cogs)}
              </title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
