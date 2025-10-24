import React from "react";
export default function GazeIndicator({ x, y, progress }: { x: number, y: number, progress: number }) {
  const dot = 28, ring = 44, border = 5;
  return (
    <div data-gaze-overlay style={{ pointerEvents: "none" }}>
      <div style={{ position: "fixed", left: x - dot / 2, top: y - dot / 2, width: dot, height: dot, borderRadius: "50%",
                    background: "rgba(0,0,0,0.65)", boxShadow: "0 0 8px rgba(0,0,0,0.25)", zIndex: 99998 }} />
      <div style={{ position: "fixed", left: x - ring / 2, top: y - ring / 2, width: ring, height: ring, borderRadius: "50%",
                    background: `conic-gradient(rgba(0,150,255,0.9) ${progress * 360}deg, rgba(0,0,0,0.08) 0deg)`,
                    border: `${border}px solid rgba(255,255,255,0.9)`, boxShadow: "0 0 10px rgba(0,0,0,0.2)", zIndex: 99997 }} />
    </div>
  )
}
