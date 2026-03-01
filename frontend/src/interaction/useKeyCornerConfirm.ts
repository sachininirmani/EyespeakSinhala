// src/interaction/useKeyCornerConfirm.ts
//
// Dwell-free two-phase confirmation:
//   1) Lock a button by short fixation (lockMs)
//   2) Confirm by gazing at a small top-right corner triangle (confirmHoldMs)
//
// This reduces accidental activation vs. global flicks.

import { useEffect, useMemo, useRef, useState } from "react";

type Pt = { x: number; y: number };

type Options = {
    enabled: boolean;
    gaze: Pt;
    containerRef: React.RefObject<HTMLElement>;
    eligibleRootRef?: React.RefObject<HTMLElement>;
    onConfirm: (el: HTMLElement) => void;

    lockMs?: number;
    confirmHoldMs?: number;
    unlockGraceMs?: number;

    cornerFrac?: number;
    cornerMinPx?: number;
    cornerMaxPx?: number;
};

export function useKeyCornerConfirm(opts: Options) {
    const {
        enabled,
        gaze,
        containerRef,
        eligibleRootRef,
        onConfirm,
        lockMs = 150,
        confirmHoldMs = 160,
        unlockGraceMs = 160,
        cornerFrac = 0.5,
        cornerMinPx = 70,
        cornerMaxPx = 110,
    } = opts;

    const [overlay, setOverlay] = useState<{ left: number; top: number; size: number; visible: boolean } | null>(null);

    const candidateRef = useRef<HTMLElement | null>(null);
    const candidateSinceRef = useRef<number>(0);

    const lastConfirmedRef = useRef<HTMLElement | null>(null);

    const lockedRef = useRef<HTMLElement | null>(null);
    const confirmEnterAtRef = useRef<number>(0);
    const lastInsideLockedAtRef = useRef<number>(0);

    const eligibleRoot = eligibleRootRef?.current ?? containerRef.current ?? null;

    const isEligibleButton = (el: Element | null): el is HTMLElement => {
        if (!el) return false;
        const h = el as HTMLElement;
        if (h.tagName !== "BUTTON") return false;
        if (!eligibleRoot) return false;
        return eligibleRoot.contains(h);
    };

    const computeOverlay = (locked: HTMLElement) => {
        const container = containerRef.current;
        if (!container) return null;

        const cRect = container.getBoundingClientRect();
        const r = locked.getBoundingClientRect();

        const size = clamp(Math.min(r.width, r.height) * cornerFrac, cornerMinPx, cornerMaxPx);
        const left = r.right - cRect.left - size;
        const top = r.top - cRect.top;

        return { left, top, size };
    };

    const pointInCorner = (x: number, y: number, corner: { left: number; top: number; size: number }): boolean => {
        const container = containerRef.current;
        if (!container) return false;
        const cRect = container.getBoundingClientRect();
        const px = x - cRect.left;
        const py = y - cRect.top;

        if (px < corner.left || px > corner.left + corner.size) return false;
        if (py < corner.top || py > corner.top + corner.size) return false;

        const sx = px - corner.left;
        const sy = py - corner.top;
        return sy <= sx;
    };

    useEffect(() => {
        if (!enabled) {
            lockedRef.current = null;
            candidateRef.current = null;
            confirmEnterAtRef.current = 0;
            lastConfirmedRef.current = null; // 🔹 reset
            setOverlay(null);
            return;
        }

        const now = performance.now();
        const el = document.elementFromPoint(gaze.x, gaze.y);
        const btn = isEligibleButton(el) ? (el as HTMLElement) : null;

        // 🔹 Prevent re-trigger while still gazing the same element after confirm.
        if (lastConfirmedRef.current) {
            if (btn !== lastConfirmedRef.current) {
                lastConfirmedRef.current = null; // reset only after gaze leaves
            } else {
                return; // block re-locking same button
            }
        }

        const locked = lockedRef.current;

        if (locked) {
            const corner = overlay && overlay.visible ? overlay : null;

            const insideLocked = locked.contains(el as any);
            const insideCorner = corner ? pointInCorner(gaze.x, gaze.y, corner) : false;

            if (insideLocked || insideCorner) {
                lastInsideLockedAtRef.current = now;
            }

            if (corner && insideCorner) {
                if (confirmEnterAtRef.current === 0) confirmEnterAtRef.current = now;

                if (now - confirmEnterAtRef.current >= confirmHoldMs) {
                    const confirmed = lockedRef.current;

                    lockedRef.current = null;
                    confirmEnterAtRef.current = 0;
                    setOverlay(null);

                    if (confirmed) {
                        lastConfirmedRef.current = confirmed; // 🔹 critical fix
                        onConfirm(confirmed);
                    }

                    return;
                }
            } else {
                confirmEnterAtRef.current = 0;
            }

            if (now - lastInsideLockedAtRef.current > unlockGraceMs) {
                lockedRef.current = null;
                confirmEnterAtRef.current = 0;
                setOverlay(null);
            }

            return;
        }

        // Not locked: build candidate fixation
        if (btn && candidateRef.current === btn) {
            if (now - candidateSinceRef.current >= lockMs) {
                lockedRef.current = btn;
                lastInsideLockedAtRef.current = now;

                const o = computeOverlay(btn);
                if (o) setOverlay({ ...o, visible: true });
            }
        } else {
            candidateRef.current = btn;
            candidateSinceRef.current = btn ? now : 0;
        }
    });

    const overlayStyle = useMemo(() => {
        if (!overlay || !overlay.visible) return null;
        return {
            position: "absolute" as const,
            left: overlay.left,
            top: overlay.top,
            width: overlay.size,
            height: overlay.size,
            pointerEvents: "none" as const,
            zIndex: 999,
        };
    }, [overlay]);

    return {
        showCorner: !!overlay && overlay.visible,
        cornerSize: overlay?.size ?? 0,
        overlayStyle,
    };
}

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}