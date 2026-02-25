// src/interaction/gestureBindings.ts
//
// Lightweight parsing helpers for gesture bindings (single events, chords, corner confirm).
// Kept separate so KeyboardBase stays readable and doesn't get longer.

import type { GestureBinding, GazeEventType } from "./types";

export type ParsedBinding =
    | { kind: "event"; event: GazeEventType }
    | { kind: "chord"; first: GazeEventType; second: GazeEventType; withinMs: number }
    | { kind: "corner_confirm" };

const DEFAULT_CHORD_WINDOW_MS = 450;

export function parseBinding(binding: GestureBinding | undefined | null): ParsedBinding | null {
    if (!binding) return null;

    if (binding === "CORNER_CONFIRM") return { kind: "corner_confirm" };

    if (typeof binding === "string" && binding.startsWith("CHORD:")) {
        const rest = binding.slice("CHORD:".length);
        const parts = rest.split("+");
        if (parts.length !== 2) return null;
        return {
            kind: "chord",
            first: parts[0] as GazeEventType,
            second: parts[1] as GazeEventType,
            withinMs: DEFAULT_CHORD_WINDOW_MS,
        };
    }

    return { kind: "event", event: binding as GazeEventType };
}

export function isCornerConfirm(binding: GestureBinding | undefined | null): boolean {
    return binding === "CORNER_CONFIRM";
}
