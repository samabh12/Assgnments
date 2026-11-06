const LABEL: Record<string, string> = { draft: "Draft", open: "Taking quotes", hired: "Hired", closed: "Closed" };

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{LABEL[status] ?? status}</span>;
}

export function ClaudeBadge() {
  return <span className="badge badge-claude">Written in Claude</span>;
}
