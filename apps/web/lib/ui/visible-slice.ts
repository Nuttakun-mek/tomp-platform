// Pure list-capping calculation shared by useVisibleSlice. Long control-room
// lists used to render every row; this decides how many to show for a given
// limit and how many are held back.

export interface SliceView<T> {
  visible: T[];
  hidden: number;
  hasMore: boolean;
  expanded: boolean;
}

export function sliceView<T>(items: T[], limit: number, initial: number): SliceView<T> {
  const clamped = Math.max(initial, limit);
  const visible = items.slice(0, clamped);
  const hidden = Math.max(0, items.length - visible.length);
  return {
    visible,
    hidden,
    hasMore: hidden > 0,
    expanded: clamped >= items.length && items.length > initial
  };
}
