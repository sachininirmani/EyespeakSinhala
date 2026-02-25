// src/interaction/defaults.ts

import type { InteractionConfig, GestureBinding, GazeEventType } from "./types";

/**
 * Canonical interaction IDs.
 * These MUST match:
 * - EvalWrapper (interactionMode)
 * - Backend DB (interaction_id)
 * - Google Colab analysis
 *
 * NOTE:
 * InteractionMapping values must be TobiiBridge event labels (GazeEventType).
 * Some actions (like CORNER_CONFIRM and spatial delete zone) are handled in KeyboardBase
 * and therefore may not appear in this mapping.
 */

export const DEFAULT_DWELL: InteractionConfig = {
    id: "dwell",
    label: "Dwell-Based",
    mapping: {},
};

export const DEFAULT_DWELL_FREE_C: InteractionConfig = {
    id: "dwell_free_c",
    label: "Dwell-Free (Model C)",
    mapping: {
        // Dwell-free main-key selection is always:
        //   look -> lock -> CORNER_CONFIRM
        // (Handled by useKeyCornerConfirm, not by gaze events.)
        select: "CORNER_CONFIRM" as GestureBinding,

        // Popup open is explicit in dwell-free (same as hybrid).
        // Popup selection confirm is handled in KeyboardBase as:
        //   look -> lock popup option -> FLICK_LEFT / FLICK_RIGHT
        open_vowel_popup: "FLICK_DOWN" as GestureBinding,

        // Space is intended blink.
        space: "BLINK_INTENT" as GestureBinding,
    },
};

export const DEFAULT_HYBRID_C: InteractionConfig = {
    id: "hybrid_c",
    label: "Hybrid (Model C)",
    mapping: {
        // Hybrid typing is still dwell-based.
        // Popup open is explicit.
        open_vowel_popup: "FLICK_DOWN" as GestureBinding,

        // Space is intended blink.
        space: "BLINK_INTENT" as GestureBinding,
    },
};

export const DEFAULT_INTERACTIONS: InteractionConfig[] = [
    DEFAULT_DWELL,
    DEFAULT_DWELL_FREE_C,
    DEFAULT_HYBRID_C,
];

/**
 * Helper to safely resolve an interaction config by id.
 * Falls back to dwell if not found.
 */
export function resolveInteractionById(id?: string): InteractionConfig {
    return DEFAULT_INTERACTIONS.find((i) => i.id === id) || DEFAULT_DWELL;
}

/**
 * Helper to normalize/validate a mapping coming from UI/backend.
 * (We keep this for backwards compatibility with older sessions / DB rows.)
 */
export function sanitizeInteractionMapping(
    mapping: Record<string, any> | null | undefined
): Record<string, GazeEventType> {
    const allowed: Set<string> = new Set([
        "FLICK_RIGHT",
        "FLICK_LEFT",
        "FLICK_DOWN",
        "BLINK",
        "DOUBLE_BLINK",
        "BLINK_INTENT",
        "WINK_LEFT",
        "WINK_RIGHT",
    ]);

    const out: Record<string, GazeEventType> = {};
    if (!mapping) return out;

    for (const [k, v] of Object.entries(mapping)) {
        if (typeof v === "string" && allowed.has(v)) {
            out[k] = v as GazeEventType;
        }
    }
    return out;
}
