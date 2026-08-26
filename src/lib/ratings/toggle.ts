export function toggleRating(current: number | null | undefined, selected: number) {
  return current === selected ? null : selected;
}
