// components/BiasCalibration.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGaze } from "../gaze/useGaze";
import GazeIndicator from "../gaze/GazeIndicator";

type Pt = { x: number; y: number };

// 9 targets (3x3) — gentle margins, avoids corners; all values are normalized [0..1]
const Xs = [0.15, 0.50, 0.85];
const Ys = [0.18, 0.55, 0.88];
const TARGETS: Pt[] = [
    { x: Xs[0], y: Ys[0] }, { x: Xs[1], y: Ys[0] }, { x: Xs[2], y: Ys[0] },
    { x: Xs[0], y: Ys[1] }, { x: Xs[1], y: Ys[1] }, { x: Xs[2], y: Ys[1] },
    { x: Xs[0], y: Ys[2] }, { x: Xs[1], y: Ys[2] }, { x: Xs[2], y: Ys[2] },
];

const DOT = 18;
const RING = 64;

// Sampling params (fast but robust)
const MAX_PER_POINT_MS = 2000;    // cap time at each target (ms)
const STABLE_WINDOW_MS = 900;    // need gaze to hover near target this long
const ALLOWED_RADIUS_PX = 140;   // acceptance circle (px)
const MAX_SAMPLES = 18;          // cap samples per point to keep it quick

export default function BiasCalibration({ onDone }: { onDone: () => void }) {
    // 🧹 Clear old biases before starting a new calibration
    useEffect(() => {
        localStorage.removeItem("gazeBias");
    }, []);

    const gaze = useGaze(); // returns pixel-corrected gaze (but we need RAW normalized too)
    const [idx, setIdx] = useState(0);
    const [running, setRunning] = useState(true);
    const [mouseMode, setMouseMode] = useState(false);
    const [progress, setProgress] = useState(0);

    // We'll collect RAW normalized -> TARGET normalized pairs for an affine fit.
    const rawPairsRef = useRef<{ raw: Pt; tgt: Pt }[]>([]);
    const pointStartTsRef = useRef<number>(performance.now());
    const lastGoodTsRef = useRef<number>(0);
    const perPointCollectedRef = useRef<number>(0);

    // For showing the target marker
    const targetPx = useMemo(() => {
        const t = TARGETS[idx];
        return { x: t.x * window.innerWidth, y: t.y * window.innerHeight };
    }, [idx]);

    // Allow quick mouse fallback during calibration
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === "m") setMouseMode(m => !m);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Rapid sampling loop (rAF) — collects RAW normalized samples near the target
    useEffect(() => {
        if (!running) return;

        let raf = 0;
        const loop = () => {
            raf = requestAnimationFrame(loop);

            // Source: get RAW normalized sample from the hook
            const rawNorm = window.__EYESPEAK_LAST_RAW_GAZE__ as Pt | undefined;
            // As a strong fallback, accept mouse position and normalize to [0..1]
            const rawMouse: Pt | undefined = mouseMode
                ? {
                    x: Math.min(1, Math.max(0, (gaze.x ?? 0) / window.innerWidth)),
                    y: Math.min(1, Math.max(0, (gaze.y ?? 0) / window.innerHeight)),
                }
                : undefined;

            const src = rawMouse ?? rawNorm;
            if (!src) {
                updateProgress();
                return;
            }

            const t = TARGETS[idx];
            const dx = (src.x - t.x) * window.innerWidth;
            const dy = (src.y - t.y) * window.innerHeight;
            const dist = Math.hypot(dx, dy);

            const now = performance.now();
            const elapsedPoint = now - pointStartTsRef.current;

            // Only collect if close enough to the target
            if (dist <= ALLOWED_RADIUS_PX) {
                if (now - lastGoodTsRef.current >= 40) {
                    rawPairsRef.current.push({ raw: { x: src.x, y: src.y }, tgt: { x: t.x, y: t.y } });
                    perPointCollectedRef.current++;
                    lastGoodTsRef.current = now;
                }
            }

            // progress ring for the UI
            updateProgress();

            // Move on if stable long enough OR time capped OR enough samples
            const stableEnough = now - Math.max(pointStartTsRef.current, lastGoodTsRef.current) >= STABLE_WINDOW_MS;
            if (
                elapsedPoint >= MAX_PER_POINT_MS ||
                stableEnough ||
                perPointCollectedRef.current >= MAX_SAMPLES
            ) {
                if (idx < TARGETS.length - 1) {
                    setIdx(i => i + 1);
                    pointStartTsRef.current = performance.now();
                    perPointCollectedRef.current = 0;
                    lastGoodTsRef.current = 0;
                } else {
                    // Fit affine: rawNorm -> tgtNorm
                    const A = solveAffine(rawPairsRef.current.map(p => p.raw), rawPairsRef.current.map(p => p.tgt));
                    if (A) {
                        localStorage.setItem("gazeCalibAffine_v2", JSON.stringify({ ...A, ts: Date.now() }));
                    }
                    setRunning(false);
                    onDone();
                }
            }
        };

        const updateProgress = () => {
            const pPerPoint = Math.min(
                1,
                Math.max(
                    perPointCollectedRef.current / MAX_SAMPLES,
                    (performance.now() - pointStartTsRef.current) / MAX_PER_POINT_MS
                )
            );
            setProgress((idx + pPerPoint) / TARGETS.length);
        };

        pointStartTsRef.current = performance.now();
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, idx, mouseMode]);

    if (!running) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                zIndex: 100000,
                pointerEvents: "none",
            }}
        >
            {/* Instruction */}
            <div
                style={{
                    position: "absolute",
                    top: 18,
                    left: "50%",
                    transform: "translateX(-50%)",
                    color: "white",
                    fontSize: 18,
                    textAlign: "center",
                    textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                    pointerEvents: "none",
                }}
            >
                Quick calibration {idx + 1}/{TARGETS.length} — look at the dot briefly
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                    {mouseMode ? "🖱 Mouse fallback ON (press M to toggle)" : "Press M for mouse fallback"}
                </div>
            </div>

            {/* Target marker */}
            <div
                style={{
                    position: "absolute",
                    left: targetPx.x - DOT / 2,
                    top: targetPx.y - DOT / 2,
                    width: DOT,
                    height: DOT,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 0 8px rgba(0,0,0,0.4)",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    left: targetPx.x - RING / 2,
                    top: targetPx.y - RING / 2,
                    width: RING,
                    height: RING,
                    borderRadius: "50%",
                    background: `conic-gradient(rgba(0,150,255,0.95) ${(progress % (1 / TARGETS.length)) * TARGETS.length * 360}deg, rgba(255,255,255,0.2) 0deg)`,
                    border: "5px solid rgba(255,255,255,0.95)",
                    boxShadow: "0 0 10px rgba(0,0,0,0.4)",
                    transition: "background 0.25s ease",
                }}
            />

            {/* Live gaze dot (Tobii-style) */}
            <GazeIndicator
                x={gaze.x}
                y={gaze.y}
                progress={0.0}
                color="rgba(0,150,255,0.9)"
                layoutId="eyespeak"
            />
        </div>
    );
}

/* ---------- math helpers ---------- */

function solveAffine(raw: Pt[], tgt: Pt[]) {
    if (raw.length !== tgt.length || raw.length < 4) return null;
    // We solve least squares for:
    // x' = a11*x + a12*y + b1
    // y' = a21*x + a22*y + b2
    const X: number[][] = [];
    const yx: number[] = [];
    const yy: number[] = [];

    for (let i = 0; i < raw.length; i++) {
        const r = raw[i], t = tgt[i];
        X.push([r.x, r.y, 1]);
        yx.push(t.x);
        yy.push(t.y);
    }

    const c1 = normalEqSolve3(X, yx);
    const c2 = normalEqSolve3(X, yy);
    if (!c1 || !c2) return null;
    return { a11: c1[0], a12: c1[1], b1: c1[2], a21: c2[0], a22: c2[1], b2: c2[2] };
}

function normalEqSolve3(X: number[][], y: number[]) {
    const XtX = [[0,0,0],[0,0,0],[0,0,0]];
    const XtY = [0,0,0];
    for (let i=0;i<X.length;i++){
        const xi = X[i];
        for (let r=0;r<3;r++){
            XtY[r]+= xi[r]*y[i];
            for (let c=0;c<3;c++) XtX[r][c]+= xi[r]*xi[c];
        }
    }
    return solve3x3(XtX, XtY);
}

function solve3x3(A: number[][], b: number[]) {
    const M = [
        [A[0][0], A[0][1], A[0][2], b[0]],
        [A[1][0], A[1][1], A[1][2], b[1]],
        [A[2][0], A[2][1], A[2][2], b[2]],
    ];
    for (let i=0;i<3;i++){
        let piv=i;
        for (let r=i+1;r<3;r++) if (Math.abs(M[r][i])>Math.abs(M[piv][i])) piv=r;
        if (Math.abs(M[piv][i])<1e-9) return null;
        if (piv!==i) [M[i], M[piv]] = [M[piv], M[i]];
        const div = M[i][i];
        for (let c=i;c<4;c++) M[i][c]/=div;
        for (let r=0;r<3;r++){
            if (r===i) continue;
            const f = M[r][i];
            for (let c=i;c<4;c++) M[r][c]-= f*M[i][c];
        }
    }
    return [M[0][3], M[1][3], M[2][3]];
}
