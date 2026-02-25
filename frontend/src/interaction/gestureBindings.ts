// src/interaction/gestureBindings.ts
//
// Lightweight parsing helpers for gesture bindings (single events, chords, corner confirm).
// Kept separate so KeyboardBase stays readable and doesn't get longer.

import type { GestureBinding, GazeEventType } from "./types";

export type ParsedBinding =
    | { kind: "event"; event: GazeEventType }
    | { kind: "corner_confirm" };

export function parseBinding(binding: GestureBinding | undefined | null): ParsedBinding | null {
    if (!binding) return null;

    if (binding === "CORNER_CONFIRM") return { kind: "corner_confirm" };

    return { kind: "event", event: binding as GazeEventType };
}

export function isCornerConfirm(binding: GestureBinding | undefined | null): boolean {
    return binding === "CORNER_CONFIRM";
}
