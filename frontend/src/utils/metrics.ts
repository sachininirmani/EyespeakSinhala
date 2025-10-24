export function estimateWPM(chars: number, durationMs: number) {
  const tMin = Math.max(0.0001, durationMs / 60000)
  return (chars / 5) / tMin
}
