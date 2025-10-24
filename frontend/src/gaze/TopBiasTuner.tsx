import React, { useEffect, useState } from "react";
export default function TopBiasTuner({ onClose }: { onClose?: () => void }) {
  const [px, setPx] = useState<number>(() => { try { const raw = localStorage.getItem("gazeManual"); return raw ? (JSON.parse(raw).topBiasPx ?? 0) : 0 } catch { return 0 } })
  useEffect(() => { localStorage.setItem("gazeManual", JSON.stringify({ topBiasPx: px })) }, [px])
  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 100000, background: "rgba(255,255,255,0.95)", border: "1px solid #ddd",
                  borderRadius: 10, padding: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.15)" }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Top Bias (px)</div>
      <input type="range" min="-150" max="300" value={px} onChange={(e) => setPx(parseInt(e.target.value, 10))} style={{ width: 240 }} />
      <div style={{ marginTop: 6, fontSize: 13 }}>{px} px — positive moves the dot <b>up</b> near the top, fades to 0 at bottom.</div>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={() => setPx(0)}>Reset</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
