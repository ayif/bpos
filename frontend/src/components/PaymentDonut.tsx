import { formatCurrency } from "@/lib/format";

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", TRANSFER: "Transfer", QRIS: "QRIS" };
const METHOD_COLOR: Record<string, string> = { CASH: "#5d87ff", TRANSFER: "#c7d7fe", QRIS: "#9bd6f7" };

export default function PaymentDonut({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  const methods = Object.keys(METHOD_LABEL).filter((m) => breakdown[m] > 0);

  if (total === 0 || methods.length === 0) {
    return <div className="text-sm text-gray-400 py-10 text-center">Belum ada data pembayaran</div>;
  }

  const r = 46;
  const cx = 60;
  const cy = 60;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={120} height={120} viewBox="0 0 120 120" className="-rotate-90 shrink-0">
        {methods.map((m) => {
          const pct = breakdown[m] / total;
          const len = pct * circ;
          const dash = `${Math.max(len - 3, 0)} ${circ - len + 3}`;
          const el = (
            <circle
              key={m}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={METHOD_COLOR[m]}
              strokeWidth={14}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            >
              <title>
                {METHOD_LABEL[m]}: {formatCurrency(breakdown[m])} ({Math.round(pct * 100)}%)
              </title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="space-y-2 min-w-0">
        {methods.map((m) => (
          <div key={m} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: METHOD_COLOR[m] }} />
            <span className="text-gray-600">{METHOD_LABEL[m]}</span>
            <span className="ml-auto font-semibold text-gray-900">{Math.round((breakdown[m] / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
