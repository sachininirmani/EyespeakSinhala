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
 * Dwell selection is NOT a TobiiBridge event, so dwell mapping should remain empty.
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
        // Two-phase dwell-free: lock key by short fixation, confirm via corner hotspot.
        // Users can override this in StudyConfigPanel if they want a gesture-confirm.
        select: "CORNER_CONFIRM" as GestureBinding,

        // Safer defaults avoid accidental deletes during natural horizontal scanning
        delete: "CHORD:FLICK_RIGHT+FLICK_DOWN" as GestureBinding,

        // If wrapper blink is improved, BLINK_INTENT is ideal; BLINK kept for backward compatibility
        space: "BLINK_INTENT" as GestureBinding,

        // Popup open/close split prevents "open then instantly close" due to double firing
        open_vowel_popup: "FLICK_DOWN" as GestureBinding,
        close_vowel_popup: "CHORD:FLICK_DOWN+BLINK_INTENT" as GestureBinding,
    },
};

export const DEFAULT_HYBRID_C: InteractionConfig = {
    id: "hybrid_c",
    label: "Hybrid (Model C)",
    mapping: {
        // Hybrid uses dwell for selection; only popup control is gesture-driven.
        // Prefer open-only + separate close to avoid accidental toggling.
        open_vowel_popup: "FLICK_DOWN" as GestureBinding,
        close_vowel_popup: "CHORD:FLICK_DOWN+BLINK_INTENT" as GestureBinding,


        // Optional
        delete: "CHORD:FLICK_RIGHT+FLICK_DOWN" as GestureBinding,
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
 * Ensures only known GazeEventType strings remain.
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
