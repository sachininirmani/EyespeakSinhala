// components/GazeDwellButton.tsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import { useGaze } from "../gaze/useGaze";

/**
 * A reusable dwell-activatable button.
 * - Works with gaze dwell using useGaze()
 * - Still supports mouse click fallback
 * - Shows a dwell progress ring
 */
export default function GazeDwellButton({
                                            onActivate,
                                            dwellMs = 800,
                                            disabled = false,
                                            children,
                                            style,
                                            className,
                                        }: {
    onActivate: () => void;
    dwellMs?: number;
    disabled?: boolean;
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const gaze = useGaze();

    const [progress, setProgress] = useState(0);
    const [center, setCenter] = useState<{ x: number; y: number } | null>(null);

    const startTimeRef = useRef<number | null>(null);
    const triggeredRef = useRef(false);

    const activate = useCallback(() => {
        if (disabled) return;
        onActivate();
    }, [onActivate, disabled]);

    useEffect(() => {
        if (disabled) {
            setProgress(0);
            startTimeRef.current = null;
            triggeredRef.current = false;
            setCenter(null);
            return;
        }

        const x = gaze?.x;
        const y = gaze?.y;

        if (!ref.current || x == null || y == null) {
            setProgress(0);
            startTimeRef.current = null;
            triggeredRef.current = false;
            setCenter(null);
            return;
        }

        const rect = ref.current.getBoundingClientRect();
        const padding = 14;

        const inside =
            x >= rect.left - padding &&
            x <= rect.right + padding &&
            y >= rect.top - padding &&
            y <= rect.bottom + padding;

        const now = performance.now();

        if (inside) {
            if (!startTimeRef.current) {
                startTimeRef.current = now;
                triggeredRef.current = false;
                setCenter({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                });
            }

            const elapsed = now - startTimeRef.current;
            const p = Math.min(1, Math.max(0, elapsed / dwellMs));
            setProgress(p);

            if (!triggeredRef.current && elapsed >= dwellMs) {
                triggeredRef.current = true;
                activate();
            }
        } else {
            startTimeRef.current = null;
            triggeredRef.current = false;
            setProgress(0);
            setCenter(null);
        }
    }, [gaze?.x, gaze?.y, dwellMs, activate, disabled]);

    return (
        <>
            <div
                ref={ref}
                className={className}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: disabled ? "not-allowed" : "pointer",
                    userSelect: "none",
                    opacity: disabled ? 0.7 : 1,
                    ...style,
                }}
                onClick={activate} // mouse fallback
            >
                {children}
            </div>

            {/* dwell ring */}
            {center && progress > 0 && progress < 1 && (
                <div
                    style={{
                        position: "fixed",
                        left: center.x - 26,
                        top: center.y - 26,
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        background: `conic-gradient(rgba(56,189,248,0.95) ${
                            progress * 360
                        }deg, rgba(15,23,42,0.15) 0deg)`,
                        border: "4px solid rgba(248,250,252,0.95)",
                        boxShadow: "0 0 10px rgba(15,23,42,0.4)",
                        pointerEvents: "none",
                        zIndex: 999999,
                    }}
                />
            )}
        </>
    );
}
