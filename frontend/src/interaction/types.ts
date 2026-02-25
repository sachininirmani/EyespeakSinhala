// src/interaction/types.ts

export type InteractionId = "dwell" | "dwell_free_c" | "hybrid_c";

/* ------------------------------------------------------------------ */
/* 1. TobiiBridge event labels                                       */
/* ------------------------------------------------------------------ */

export type GazeEventType =
    | "FLICK_RIGHT"
    | "FLICK_LEFT"
    | "FLICK_DOWN"
    | "BLINK"
    | "DOUBLE_BLINK"
    | "BLINK_INTENT"
    | "WINK_LEFT"
    | "WINK_RIGHT";

/* ------------------------------------------------------------------ */
/* 2. Gesture binding types                                           */
/* ------------------------------------------------------------------ */

export type ChordBinding = `CHORD:${GazeEventType}+${GazeEventType}`;

export type GestureBinding =
    | GazeEventType
    | ChordBinding
    | "CORNER_CONFIRM";

/* ------------------------------------------------------------------ */
/* 3. Interaction mapping                                             */
/* ------------------------------------------------------------------ */

export type InteractionMapping = {
    select?: GestureBinding;
    delete?: GestureBinding;
    space?: GestureBinding;

    open_vowel_popup?: GestureBinding;
    close_vowel_popup?: GestureBinding;
    toggle_vowel_popup?: GestureBinding;
};

export type InteractionConfig = {
    id: InteractionId;
    label: string;
    mapping: InteractionMapping;
};

export type PromptPlan = {
    promptsPerCondition: 2 | 3 | 4;
    sizeByPromptIndex: ("l" | "m" | "s")[];
};