export function sceneDiagnostics(dataset: Record<string, string | undefined>) {
  let updatedAt = -Infinity;
  return (
    now: number,
    snapshot: () => Record<string, string>,
    force = false,
  ) => {
    if (!force && now - updatedAt < 250) return;
    updatedAt = now;
    for (const [key, value] of Object.entries(snapshot()))
      if (dataset[key] !== value) dataset[key] = value;
  };
}
