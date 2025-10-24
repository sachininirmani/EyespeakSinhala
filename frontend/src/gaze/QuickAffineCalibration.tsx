import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGaze } from "./useGaze";
type Pt = { x: number; y: number };
const M = 0.08;
const TARGETS: Pt[] = [{ x: M, y: M }, { x: 1 - M, y: M }, { x: M, y: 1 - M }, { x: 1 - M, y: 1 - M }];
const DOT = 18, RING = 76, NEED_SAMPLES = 40, RADIUS_PX = 90;
export default function QuickAffineCalibration({ onDone }: { onDone?: () => void }) {
  const gaze = useGaze();
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(true);
  const [progress, setProgress] = useState(0);
  const samples = useRef<Pt[][]>([[], [], [], []]);
  const toNorm = (xPx: number, yPx: number): Pt => ({ x: xPx / window.innerWidth, y: yPx / window.innerHeight });
  useEffect(() => {
    if (!active) return;
    const g = toNorm(gaze.x, gaze.y);
    const t = TARGETS[step];
    const dx = g.x * window.innerWidth - t.x * window.innerWidth;
    const dy = g.y * window.innerHeight - t.y * window.innerHeight;
    const dist = Math.hypot(dx, dy);
    if (dist < RADIUS_PX) { samples.current[step].push({ x: g.x, y: g.y }) }
    else { const arr = samples.current[step]; if (arr.length > 0) arr.length = Math.max(0, arr.length - 2) }
    const p = Math.min(1, samples.current[step].length / NEED_SAMPLES); setProgress(p);
    if (p >= 1) {
      if (step < 3) { setStep(step + 1); setProgress(0) }
      else {
        const means = samples.current.map(arr => meanPt(arr));
        const A = solveAffine(means, TARGETS);
        if (A) localStorage.setItem("gazeCalibAffine", JSON.stringify(A));
        setActive(false); onDone?.();
      }
    }
  }, [gaze.x, gaze.y, step, active]);
  const marker = useMemo(() => {
    const t = TARGETS[step]; return { x: t.x * window.innerWidth, y: t.y * window.innerHeight };
  }, [step]);
  if (!active) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100000, pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", color: "white", fontSize: 18, textAlign: "center",
                    textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
        {["Look at TOP-LEFT", "Look at TOP-RIGHT", "Look at BOTTOM-LEFT", "Look at BOTTOM-RIGHT"][step]} dot until the ring fills
      </div>
      <div style={{ position: "absolute", left: marker.x - DOT / 2, top: marker.y - DOT / 2, width: DOT, height: DOT, borderRadius: "50%", background: "#fff",
                    boxShadow: "0 0 8px rgba(0,0,0,0.4)" }} />
      <div style={{ position: "absolute", left: marker.x - RING / 2, top: marker.y - RING / 2, width: RING, height: RING, borderRadius: "50%",
                    background: `conic-gradient(rgba(0,150,255,0.95) ${progress * 360}deg, rgba(255,255,255,0.2) 0deg)`,
                    border: "5px solid rgba(255,255,255,0.95)", boxShadow: "0 0 10px rgba(0,0,0,0.4)" }} />
    </div>
  )
}
function meanPt(arr: Pt[]): Pt { if (arr.length === 0) return { x: 0.5, y: 0.5 }; let sx = 0, sy = 0; for (const p of arr) { sx += p.x; sy += p.y } return { x: sx/arr.length, y: sy/arr.length } }
function solveAffine(rawMeans: Pt[], targets: Pt[]) {
  const X = rawMeans.map(p => [p.x, p.y, 1]); const yx = targets.map(t => t.x); const yy = targets.map(t => t.y);
  const c1 = normalEqSolve3(X, yx); const c2 = normalEqSolve3(X, yy); if (!c1 || !c2) return null;
  return { a11: c1[0], a12: c1[1], b1: c1[2], a21: c2[0], a22: c2[1], b2: c2[2] }
}
function normalEqSolve3(X: number[][], y: number[]) {
  const XtX = [[0,0,0],[0,0,0],[0,0,0]], XtY = [0,0,0]
  for (let i=0;i<X.length;i++){const xi=X[i]; for(let r=0;r<3;r++){ XtY[r]+=xi[r]*y[i]; for(let c=0;c<3;c++) XtX[r][c]+=xi[r]*xi[c] }}
  return solve3x3(XtX, XtY)
}
function solve3x3(A:number[][], b:number[]){
  const M=[[A[0][0],A[0][1],A[0][2],b[0]],[A[1][0],A[1][1],A[1][2],b[1]],[A[2][0],A[2][1],A[2][2],b[2]]]
  for(let i=0;i<3;i++){let piv=i; for(let r=i+1;r<3;r++) if (Math.abs(M[r][i])>Math.abs(M[piv][i])) piv=r
    if (Math.abs(M[piv][i])<1e-9) return null; if (piv!==i) [M[i],M[piv]]=[M[piv],M[i]]
    const div=M[i][i]; for(let c=i;c<4;c++) M[i][c]/=div
    for(let r=0;r<3;r++){ if (r===i) continue; const f=M[r][i]; for(let c=i;c<4;c++) M[r][c]-=f*M[i][c] } }
  return [M[0][3],M[1][3],M[2][3]]
}
