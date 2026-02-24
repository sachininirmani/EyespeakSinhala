// src/interaction/types.ts
export type InteractionId = "dwell" | "dwell_free_c" | "hybrid_c";

/**
 * Mapping from high-level actions to TobiiBridge event labels.
 * You can expand this later (double blink, long blink, etc.) without touching keyboard logic.
 */
export type InteractionMapping = {
    select?: GazeEventType;
    delete?: GazeEventType;
    space?: GazeEventType;
    toggle_vowel_popup?: GazeEventType;
};

export type InteractionConfig = {
    id: InteractionId;
    label: string;
    mapping: InteractionMapping;
};

export type PromptPlan = {
    /** number of prompts per condition INCLUDING practice */
    promptsPerCondition: 2 | 3 | 4;
    /** keyboard size preset per prompt index (0 is practice) */
    sizeByPromptIndex: ("l" | "m" | "s")[];
};

// TobiiBridge event labels we currently emit
export type GazeEventType =
    | "FLICK_RIGHT"
    | "FLICK_LEFT"
    | "FLICK_DOWN"
    | "BLINK"
    | "DOUBLE_BLINK"
    | "WINK_LEFT"
    | "WINK_RIGHT";
