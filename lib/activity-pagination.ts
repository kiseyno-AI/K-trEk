export function activityPage<T>(
  activities: readonly T[],
  requestedPage: number,
  pageSize = 15,
) {
  const pageCount = Math.max(1, Math.ceil(activities.length / pageSize));
  const page = Math.max(1, Math.min(pageCount, requestedPage));
  const start = (page - 1) * pageSize;
  return {
    items: activities.slice(start, start + pageSize),
    page,
    pageCount,
    start,
  };
}

export function wholeGridPageSize(
  columns: number,
  height: number,
  rowHeight: number,
  gap: number,
) {
  if (
    ![columns, height, rowHeight, gap].every(Number.isFinite) ||
    columns < 1 ||
    rowHeight <= 0
  )
    return 0;
  const rows = Math.max(0, Math.floor((height + gap) / (rowHeight + gap)));
  return Math.min(15, rows * columns);
}

export function observeGridPageSize(
  node: HTMLElement,
  onSize: (size: number) => void,
) {
  let active = true;
  const measure = () => {
    if (!active) return;
    const style = getComputedStyle(node);
    onSize(
      wholeGridPageSize(
        style.gridTemplateColumns.trim().split(/\s+/).length,
        node.clientHeight -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom),
        parseFloat(style.gridAutoRows),
        parseFloat(style.rowGap),
      ),
    );
  };
  const observer =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
  if (observer) observer.observe(node);
  else window.addEventListener('resize', measure);
  measure();
  return () => {
    active = false;
    observer?.disconnect();
    if (!observer) window.removeEventListener('resize', measure);
  };
}
