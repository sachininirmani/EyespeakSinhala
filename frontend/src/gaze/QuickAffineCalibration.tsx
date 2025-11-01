import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGaze } from "./useGaze";

type Pt = { x: number; y: number };

// Margin around edges
const M = 0.08;

// 5 calibration points — four corners + center
const TARGETS: Pt[] = [
    { x: M, y: M },
    { x: 1 - M, y: M },
    { x: M, y: 1 - M },
    { x: 1 - M, y: 1 - M },
    { x: 0.5, y: 0.5 },
];

const DOT = 18;
const RING = 76;
const NEED_SAMPLES = 25;     // ✅ reduced for faster calibration
const RADIUS_PX = 140;       // ✅ more tolerant to small drifts
const STABLE_THRESHOLD = 30; // ms window for dynamic stability detection

export default function QuickAffineCalibration({ onDone }: { onDone?: () => void }) {
    const gaze = useGaze();
    const [step, setStep] = useState(0);
    const [active, setActive] = useState(true);
    const [progress, setProgress] = useState(0);
    const [mouseMode, setMouseMode] = useState(false);

    const samples = useRef<Pt[][]>(TARGETS.map(() => []));
    const lastValidTs = useRef<number>(performance.now());

    // 🔹 Mouse fallback for debugging or when Tobii not connected
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (mouseMode) {
                (gaze as any).x = e.clientX;
                (gaze as any).y = e.clientY;
            }
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [mouseMode, gaze]);

    useEffect(() => {
        if (!active) return;

        const gNorm = {
            x: Math.min(1, Math.max(0, gaze.x / window.innerWidth)),
            y: Math.min(1, Math.max(0, gaze.y / window.innerHeight)),
        };
        const t = TARGETS[step];
        const dx = (gNorm.x - t.x) * window.innerWidth;
        const dy = (gNorm.y - t.y) * window.innerHeight;
        const dist = Math.hypot(dx, dy);

        const allowedRadius = step === 0 ? RADIUS_PX * 1.5 : RADIUS_PX;
        const now = performance.now();

        // Collect only if gaze is reasonably stable
        if (dist < allowedRadius) {
            if (now - lastValidTs.current > STABLE_THRESHOLD) {
                samples.current[step].push({ x: gNorm.x, y: gNorm.y });
                if (samples.current[step].length > NEED_SAMPLES) samples.current[step].shift();
                lastValidTs.current = now;
            }
        }

        const p = Math.min(1, samples.current[step].length / NEED_SAMPLES);
        setProgress(p);

        if (p >= 1) {
            if (step < TARGETS.length - 1) {
                setStep((s) => s + 1);
                setProgress(0);
            } else {
                const means = samples.current.map(arr => medianPt(arr));
                const A = solveAffine(means, TARGETS);
                if (A) localStorage.setItem("gazeCalibAffine", JSON.stringify(A));
                setActive(false);
                onDone?.();
            }
        }
    }, [gaze.x, gaze.y, step, active, onDone]);

    const marker = useMemo(() => {
        const t = TARGETS[step];
        return { x: t.x * window.innerWidth, y: t.y * window.innerHeight };
    }, [step]);

    if (!active) return null;

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
            <div
                style={{
                    position: "absolute",
                    top: 20,
                    left: "50%",
                    transform: "translateX(-50%)",
                    color: "white",
                    fontSize: 18,
                    textAlign: "center",
                    textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                }}
            >
                {["TOP-LEFT", "TOP-RIGHT", "BOTTOM-LEFT", "BOTTOM-RIGHT", "CENTER"][step]} — Hold gaze until ring fills
                <br />
                <span style={{ fontSize: 14, opacity: 0.8 }}>
          {mouseMode ? "🖱 Mouse mode active" : "Press M to toggle mouse mode"}
        </span>
            </div>

            <div
                style={{
                    position: "absolute",
                    left: marker.x - DOT / 2,
                    top: marker.y - DOT / 2,
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
                    left: marker.x - RING / 2,
                    top: marker.y - RING / 2,
                    width: RING,
                    height: RING,
                    borderRadius: "50%",
                    background: `conic-gradient(rgba(0,150,255,0.95) ${progress * 360}deg, rgba(255,255,255,0.2) 0deg)`,
                    border: "5px solid rgba(255,255,255,0.95)",
                    boxShadow: "0 0 10px rgba(0,0,0,0.4)",
                    transition: "background 0.3s ease",
                }}
            />

            {/* Small toggle hint */}
            <div
                style={{
                    position: "absolute",
                    right: 20,
                    bottom: 16,
                    pointerEvents: "auto",
                    zIndex: 100001,
                }}
            >
                <button
                    onClick={() => setMouseMode((m) => !m)}
                    style={{
                        background: "rgba(255,255,255,0.8)",
                        border: "1px solid #ccc",
                        borderRadius: 8,
                        padding: "4px 10px",
                        fontSize: 13,
                        cursor: "pointer",
                    }}
                >
                    {mouseMode ? "Disable Mouse" : "Enable Mouse"}
                </button>
            </div>
        </div>
    );
}

// ---------- Helpers ----------
function medianPt(arr: Pt[]): Pt {
    if (!arr.length) return { x: 0.5, y: 0.5 };
    const xs = arr.map((p) => p.x).sort((a, b) => a - b);
    const ys = arr.map((p) => p.y).sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    return { x: xs[mid], y: ys[mid] };
}

function solveAffine(rawMeans: Pt[], targets: Pt[]) {
    const X = rawMeans.map((p) => [p.x, p.y, 1]);
    const yx = targets.map((t) => t.x);
    const yy = targets.map((t) => t.y);
    const c1 = normalEqSolve3(X, yx);
    const c2 = normalEqSolve3(X, yy);
    if (!c1 || !c2) return null;
    return { a11: c1[0], a12: c1[1], b1: c1[2], a21: c2[0], a22: c2[1], b2: c2[2] };
}

function normalEqSolve3(X: number[][], y: number[]) {
    const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const XtY = [0, 0, 0];
    for (let i = 0; i < X.length; i++) {
        const xi = X[i];
        for (let r = 0; r < 3; r++) {
            XtY[r] += xi[r] * y[i];
            for (let c = 0; c < 3; c++) XtX[r][c] += xi[r] * xi[c];
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
    for (let i = 0; i < 3; i++) {
        let piv = i;
        for (let r = i + 1; r < 3; r++)
            if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
        if (Math.abs(M[piv][i]) < 1e-9) return null;
        if (piv !== i) [M[i], M[piv]] = [M[piv], M[i]];
        const div = M[i][i];
        for (let c = i; c < 4; c++) M[i][c] /= div;
        for (let r = 0; r < 3; r++) {
            if (r === i) continue;
            const f = M[r][i];
            for (let c = i; c < 4; c++) M[r][c] -= f * M[i][c];
        }
    }
    return [M[0][3], M[1][3], M[2][3]];
}
