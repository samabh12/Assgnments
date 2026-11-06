export function inr(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "–";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export function timeAgo(d: Date | string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
