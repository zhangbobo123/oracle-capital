export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function extractJson<T>(content: string): T {
  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Model did not return JSON");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

export function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizePercentages<T extends { percentage: number }>(items: T[]) {
  if (!items.length) return items;
  const sanitized = items.map((item) => ({
    ...item,
    percentage: Math.max(0, Math.round(Number(item.percentage) || 0)),
  }));
  const total = sanitized.reduce((sum, item) => sum + item.percentage, 0);
  if (total <= 0) {
    return sanitized.map((item, index) => ({
      ...item,
      percentage: index === 0 ? 100 : 0,
    }));
  }
  let assigned = 0;
  return sanitized.map((item, index) => {
    const percentage = index === sanitized.length - 1
      ? 100 - assigned
      : Math.round((item.percentage / total) * 100);
    assigned += percentage;
    return { ...item, percentage: Math.max(0, percentage) };
  });
}
