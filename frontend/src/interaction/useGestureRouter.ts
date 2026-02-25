// src/interaction/useGestureRouter.ts
//
// Translates low-level TobiiBridge event labels into high-level actions.
// Composite/chord gestures REMOVED.
// Runtime logic is now FIXED (not user-mapped).
//
// Supported runtime rules:
// - Dwell mode ignores gestures.
// - FLICK_DOWN → open popup (if not open).
// - BLINK_INTENT → space (only if popup not open).
// - Other popup selection logic handled in KeyboardBase (flick left/right).
//
// Designed to keep KeyboardBase minimal and stable.

import { useCallback, useEffect, useRef } from "react";
import type { GazeEventType } from "./types";

type Handlers = {
    onSelect?: () => void;
    onDelete?: () => void;
    onSpace?: () => void;
    onPopupOpen?: () => void;
    onPopupClose?: () => void;
    onPopupToggle?: () => void;
};

type Context = {
    mode: "dwell" | "hybrid" | "dwell_free";
    popupOpen: boolean;
};

type Options = {
    cooldownMs?: number;
    cooldownUntilRef?: { current: number };
    getContext?: () => Context;
};

export function useGestureRouter(
    _mapping: any, // kept for compatibility with existing calls
    handlers: Handlers,
    opts?: Options
) {
    const cooldownMs = opts?.cooldownMs ?? 220;

    const internalCooldownRef = useRef<number>(0);
    const cooldownUntilRef = opts?.cooldownUntilRef ?? internalCooldownRef;

    const getContextRef = useRef<(() => Context) | null>(opts?.getContext ?? null);
    useEffect(() => {
        getContextRef.current = opts?.getContext ?? null;
    }, [opts?.getContext]);

    const handlersRef = useRef(handlers);
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

    const fire = useCallback(
        (fn?: () => void) => {
            const now = performance.now();
            if (now < cooldownUntilRef.current) return;
            cooldownUntilRef.current = now + cooldownMs;
            fn?.();
        },
        [cooldownMs, cooldownUntilRef]
    );

    const onEvent = useCallback(
        (ev: GazeEventType) => {
            const ctx = getContextRef.current?.() ?? {
                mode: "dwell",
                popupOpen: false,
            };

            // 🔹 DWELL MODE: ignore all gesture events
            if (ctx.mode === "dwell") return;

            // 🔹 POPUP OPEN (explicit only)
            if (!ctx.popupOpen && ev === "FLICK_DOWN") {
                fire(handlersRef.current.onPopupOpen);
                return;
            }

            // 🔹 SPACE (blink intent only when popup not open)
            if (!ctx.popupOpen && ev === "BLINK_INTENT") {
                fire(handlersRef.current.onSpace);
                return;
            }

            // 🔹 Ignore blink while popup is open (reserved)
            if (ctx.popupOpen && ev === "BLINK_INTENT") {
                return;
            }

            // 🔹 Delete is spatial (handled in KeyboardBase)
            // 🔹 Popup selection flick left/right handled in KeyboardBase
        },
        [fire]
    );

    return { onEvent, cooldownUntilRef };
}