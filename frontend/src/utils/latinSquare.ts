export function latinSquare<T>(items: T[], index: number): T[] {
  const n = items.length
  if (n === 0) return []
  const start = index % n
  return [...items.slice(start), ...items.slice(0, start)]
}
