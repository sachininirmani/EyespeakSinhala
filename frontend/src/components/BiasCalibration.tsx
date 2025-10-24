import React, { useEffect, useRef, useState } from "react";
import { useGaze } from "../gaze/useGaze";

type Point = { x: number; y: number };

// 3–5 calibration points
const TARGETS: Point[] = [
    { x: 0.2, y: 0.3 },
    { x: 0.8, y: 0.3 },
    { x: 0.5, y: 0.5 },
    { x: 0.2, y: 0.8 },
    { x: 0.8, y: 0.8 }
];

export default function BiasCalibration({ onDone }: { onDone: () => void }) {
    const gaze = useGaze();
    const [step, setStep] = useState(0);
    const [collecting, setCollecting] = useState(true);
    const samples = useRef<{ dx: number; dy: number }[]>([]);

    useEffect(() => {
        if (!collecting) return;
        const timer = setInterval(() => {
            const target = TARGETS[step];
            const tx = target.x * window.innerWidth;
            const ty = target.y * window.innerHeight;
            const dx = gaze.x - tx;
            const dy = gaze.y - ty;
            samples.current.push({ dx, dy });

            if (samples.current.length >= 40) {
                if (step < TARGETS.length - 1) {
                    setStep((s) => s + 1);
                    samples.current = [];
                } else {
                    // compute average bias
                    const avg = samples.current.reduce(
                        (acc, s) => ({ dx: acc.dx + s.dx, dy: acc.dy + s.dy }),
                        { dx: 0, dy: 0 }
                    );
                    const n = samples.current.length;
                    const horizontal = avg.dx / n;
                    const vertical = avg.dy / n;
                    localStorage.setItem(
                        "gazeBias",
                        JSON.stringify({ horizontal, vertical })
                    );
                    setCollecting(false);
                    onDone();
                }
            }
        }, 50);
        return () => clearInterval(timer);
    }, [gaze.x, gaze.y, step, collecting, onDone]);

    if (!collecting) return null;

    const t = TARGETS[step];
    const tx = t.x * window.innerWidth;
    const ty = t.y * window.innerHeight;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 99999
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: ty - 20,
                    left: tx - 20,
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "white",
                    border: "4px solid dodgerblue",
                    boxShadow: "0 0 12px rgba(0,0,0,0.3)"
                }}
            />
            <div
                style={{
                    position: "absolute",
                    bottom: 40,
                    width: "100%",
                    textAlign: "center",
                    color: "white",
                    fontSize: 18,
                    textShadow: "0 1px 3px black"
                }}
            >
                Look at the white dot ({step + 1}/{TARGETS.length})
            </div>
        </div>
    );
}
