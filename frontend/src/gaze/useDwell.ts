import { useEffect, useRef, useState } from "react"
interface Opts { stabilizationMs: number; stabilityRadiusPx: number; dwellMs: number; dwellMsPopup?: number; refractoryMs: number }
export function useDwell(x: number, y: number, opts: Opts) {
  const [progress, setProgress] = useState(0)
  const last = useRef<{ x: number, y: number, t: number } | null>(null)
  const start = useRef<number | null>(null)
  const refractoryUntil = useRef(0)
  useEffect(() => {
    const now = performance.now()
    if (now < refractoryUntil.current) { setProgress(0); return }
    if (!last.current) { last.current = { x, y, t: now }; start.current = null; setProgress(0); return }
    const dx = x - last.current.x, dy = y - last.current.y
    const dist = Math.hypot(dx, dy)
    const inside = dist <= opts.stabilityRadiusPx
    if (!inside) { last.current = { x, y, t: now }; start.current = null; setProgress(0); return }
    if (start.current == null) { start.current = now; setProgress(0.02) }
    else {
      const dwellNeeded = currentIsPopup(x, y) ? (opts.dwellMsPopup ?? opts.dwellMs) : opts.dwellMs
      const p = Math.min(1, (now - start.current) / dwellNeeded)
      setProgress(p)
      if (p >= 1) {
        const el = document.elementFromPoint(x, y) as HTMLElement | null
        el?.click()
        refractoryUntil.current = now + opts.refractoryMs
        start.current = null
        setProgress(0)
      }
    }
  }, [x, y, opts])
  function currentIsPopup(x: number, y: number) {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    return !!el?.closest("[data-vowel-popup]")
  }
  return { progress }
}
