// Sequential-ish human friendly codes: PREFIX-YYYYMMDD-XXXXX
function randomSuffix(len = 5) {
  const chars = "0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function generateCode(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const time = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0");
  return `${prefix}-${y}${m}${d}-${time}${randomSuffix(3)}`;
}
