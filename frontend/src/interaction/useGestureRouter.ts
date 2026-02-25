// src/interaction/useGestureRouter.ts
//
// Translates low-level TobiiBridge event labels into high-level actions.
// Supports single-event bindings AND chord bindings.
// Designed to keep KeyboardBase minimal and avoid adding more logic there.

import { useCallback, useEffect, useRef } from "react";
import type { GestureBinding, GazeEventType, InteractionMapping } from "./types";
import { parseBinding } from "./gestureBindings";

type Handlers = {
    onSelect?: () => void;
    onDelete?: () => void;
    onSpace?: () => void;
    onPopupOpen?: () => void;
    onPopupClose?: () => void;
    onPopupToggle?: () => void;
};

type Options = {
    cooldownMs?: number;
    /** optional external cooldown ref to keep legacy keyboard fallback code working */
    cooldownUntilRef?: React.MutableRefObject<number>;
};

export function useGestureRouter(mapping: InteractionMapping, handlers: Handlers, opts?: Options) {
    const cooldownMs = opts?.cooldownMs ?? 220;

    const internalCooldownRef = useRef<number>(0);
    const cooldownUntilRef = opts?.cooldownUntilRef ?? internalCooldownRef;

    // chord state: we only support 2-step chords as "CHORD:A+B"
    const pendingFirstRef = useRef<{ ev: GazeEventType; at: number } | null>(null);

    // keep latest handlers without rebuilding the hook too often
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

    const matchBinding = useCallback((binding: GestureBinding | undefined, ev: GazeEventType): boolean => {
        const parsed = parseBinding(binding as any);
        if (!parsed) return false;

        if (parsed.kind === "event") return parsed.event === ev;

        if (parsed.kind === "chord") {
            const now = performance.now();
            const p = pendingFirstRef.current;

            // start chord
            if (!p) {
                if (ev === parsed.first) pendingFirstRef.current = { ev, at: now };
                return false;
            }

            // expired
            if (now - p.at > parsed.withinMs) {
                pendingFirstRef.current = null;
                if (ev === parsed.first) pendingFirstRef.current = { ev, at: now };
                return false;
            }

            // complete
            if (p.ev === parsed.first && ev === parsed.second) {
                pendingFirstRef.current = null;
                return true;
            }

            // wrong second: reset, but allow restart
            if (ev === parsed.first) pendingFirstRef.current = { ev, at: now };
            else pendingFirstRef.current = null;

            return false;
        }

        // CORNER_CONFIRM is gaze-based and is handled elsewhere
        return false;
    }, []);

    const onEvent = useCallback(
        (ev: GazeEventType) => {
            // Popup open/close/toggle
            if (matchBinding(mapping.open_vowel_popup, ev)) {
                fire(handlersRef.current.onPopupOpen);
                return;
            }
            if (matchBinding(mapping.close_vowel_popup, ev)) {
                fire(handlersRef.current.onPopupClose);
                return;
            }
            if (matchBinding(mapping.toggle_vowel_popup, ev)) {
                fire(handlersRef.current.onPopupToggle);
                return;
            }

            // Actions
            if (matchBinding(mapping.delete, ev)) {
                fire(handlersRef.current.onDelete);
                return;
            }
            if (matchBinding(mapping.space, ev)) {
                fire(handlersRef.current.onSpace);
                return;
            }
            if (matchBinding(mapping.select, ev)) {
                fire(handlersRef.current.onSelect);
                return;
            }
        },
        [fire, matchBinding, mapping]
    );

    return { onEvent, cooldownUntilRef };
}
