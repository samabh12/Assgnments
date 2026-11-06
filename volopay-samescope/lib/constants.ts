export const CATEGORIES = [
  { id: "leaks_plumbing", label: "Leaks & plumbing" },
  { id: "waterproofing", label: "Waterproofing & seepage" },
  { id: "bathroom_tiling", label: "Bathroom & tiling" },
  { id: "painting", label: "Painting & wall repair" },
  { id: "carpentry", label: "Carpentry & modular work" },
  { id: "electrical", label: "Electrical" },
  { id: "renovation", label: "General renovation" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const URGENCY = [
  { id: "urgent", label: "Urgent (within 48 hours)" },
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "flexible", label: "Flexible" },
] as const;

export type UrgencyId = (typeof URGENCY)[number]["id"];
export const URGENCY_IDS = URGENCY.map((u) => u.id) as [UrgencyId, ...UrgencyId[]];

export function urgencyLabel(id: string) {
  return URGENCY.find((u) => u.id === id)?.label ?? id;
}

export const CITIES = ["Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune"];

export const UNITS = ["job", "sq ft", "running ft", "point", "piece", "litre", "day"];

/** One credit is spent when a contractor sends a new quote. Price shown on the pricing card. */
export const CREDIT_PRICE_INR = 79;
