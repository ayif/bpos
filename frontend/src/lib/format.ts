export function formatCurrency(n: number | string | undefined | null) {
  return "Rp " + Number(n ?? 0).toLocaleString("id-ID");
}

export function formatDate(d: string | Date | undefined | null) {
  if (!d) return "-";
  return new Date(d).toLocaleString("id-ID");
}
