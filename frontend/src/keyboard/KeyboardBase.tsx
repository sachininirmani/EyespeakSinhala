import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import VowelPopup from "./VowelPopup";
import { useGaze } from "../gaze/useGaze";
import { useDwell } from "../gaze/useDwell";
import { useGazeEvents } from "../gaze/useGazeEvents";
import GazeIndicator from "../gaze/GazeIndicator";
import BiasTuner from "../gaze/BiasTuner";
import { useKeyCornerConfirm } from "../interaction/useKeyCornerConfirm";
import type {
    GazeEventType,
    InteractionConfig,
    InteractionId,
    InteractionMapping,
} from "../interaction/types";

/** Number & punctuation overlays (unchanged) */
const numbers = [
    ["1", "2", "3", "4", "5", "6"],
    ["7", "8", "9", "0", "(", ")"],
];
const punctuation = [
    [".", ",", "!", "?", ":", ";"],
    ['"', "'", "’", "“", "”", "…"],
];

/** Style for control buttons (unchanged) */
const controlButtonStyle: React.CSSProperties = {
    padding: "16px",
    fontSize: "22px",
    backgroundColor: "#fff5cc",
    border: "1px solid #ccc",
    borderRadius: 8,
    transition: "background-color 0.2s ease",
};

/** Layout constants */
const TYPED_ROW_MIN_HEIGHT = 30;
const SUGGESTION_ROW_HEIGHT = 50;

/** Shared keyboard footprint (width/height) across all layouts */
type KeyboardSize = { width: number; height: number };

let globalKeyboardSize: KeyboardSize = {
    width: 1800,
    height: 450,
};

type KeyboardSizePreset = "s" | "m" | "l";

/**
 * Predefined keyboard footprints for a user session.
 * NOTE: Width/height ratio is constant across presets.
 */
const KEYBOARD_SIZE_PRESETS: Record<KeyboardSizePreset, KeyboardSize> = {
    l: { width: 1600, height: 400 },
    m: { width: 1500, height: 375 },
    s: { width: 1400, height: 350 },
};

/**
 * Sinhala vowel + diacritic combination map
 * Combines vowel and diacritic into a single independent vowel
 */
const COMBINATION_MAP: Record<string, string> = {
    "අා": "ආ",
    "අැ": "ඇ",
    "අෑ": "ඈ",
    "එ්": "ඒ",
    "ඔ්": "ඕ",
    "ඔෟ": "ඖ",
    "උෟ": "ඌ",
};

const PURE_VOWELS = new Set([
    "ඊ",
    "ඉ",
    "අ",
    "එ",
    "උ",
    "ඔ",
    "ඍ",
    "ඏ",
    "ං",
    "ආ",
    "ඇ",
    "ඈ",
    "ඒ",
    "ඕ",
    "ඖ",
    "ඌ",
    "ඐ",
    "ඎ",
    "ඃ",
]);

/**
 * UNIVERSAL SINHALA DIACRITIC PATTERNS
 * Consonant-agnostic suffix patterns reused for all bases.
 */
const PLAIN_SUFFIXES: string[] = [
    "්",
    "",
    "ා",
    "ැ",
    "ෑ",
    "ි",
    "ී",
    "ු",
    "ූ",
    "ෘ",
    "ෲ",
    "ෙ",
    "ේ",
    "ෛ",
    "ො",
    "ෝ",
    "ෞ",
    "ං",
    "ඃ",
];

const RAKA_SUFFIX_BASE = "්‍ර";
const RAKA_VOWEL_SUFFIXES: string[] = ["", "ා", "ැ", "ෑ", "ි", "ී", "ෙ", "ේ", "ො", "ෝ"];

const YANSA_SUFFIX_BASE = "්‍ය";
const YANSA_VOWEL_SUFFIXES: string[] = ["", "ා", "ු", "ූ", "ැ", "ෑ", "ෙ", "ේ", "ො", "ෝ"];

function buildAllDiacriticsForBase(base: string): string[] {
    const forms = new Set<string>();

    const CONJUNCT_ALLOWED = new Set([
        "ක",
        "ග",
        "ජ",
        "ට",
        "ඩ",
        "ත",
        "ද",
        "ප",
        "බ",
        "ම",
        "ස",
        "ල",
        "ළ",
        "හ",
    ]);

    for (const suf of PLAIN_SUFFIXES) forms.add(base + suf);

    if (CONJUNCT_ALLOWED.has(base)) {
        const rakaBase = base + RAKA_SUFFIX_BASE;
        for (const suf of RAKA_VOWEL_SUFFIXES) forms.add(rakaBase + suf);

        const yansaBase = base + YANSA_SUFFIX_BASE;
        for (const suf of YANSA_VOWEL_SUFFIXES) forms.add(yansaBase + suf);
    }

    return Array.from(forms);
}

type Metrics = {
    total_keystrokes: number;
    deletes: number;
    eye_distance_px: number;
    vowel_popup_clicks: number;
    vowel_popup_more_clicks: number;
    vowel_popup_close_clicks: number;

    // helpful for backend next step (won't break current callers)
    interaction_id?: InteractionId;
};

type LastAction =
    | null
    | { type: "popup"; prevText: string; base: string; position: { top: number; left: number } }
    | { type: "prediction"; prevText: string }
    | { type: "char" };

export default function KeyboardBase({
                                         layout,
                                         dwellMainMs,
                                         dwellPopupMs,
                                         onChange,
                                         evaluationMode = false,
                                         keyboardSizePreset = "m",
                                         interactionConfig,
                                         interactionMode,
                                         interactionMapping,
                                     }: {
    layout: {
        columns?: number;
        id: string;
        label: string;
        hasVowelPopup: boolean;
        firstStageLetters: string[][];
        secondStageLetters: string[][];
        primarySecondaryMap?: Record<string, string>;
    };
    dwellMainMs: number;
    dwellPopupMs: number;
    onChange?: (text: string, metrics: Metrics) => void;
    evaluationMode?: boolean;
    keyboardSizePreset?: KeyboardSizePreset;
    interactionConfig?: InteractionConfig;
    // Backward compatibility (migration support)
    interactionMode?: InteractionId;
    interactionMapping?: InteractionMapping;
}) {
    // ---------------- Interaction Config ----------------
    // Backward compatible resolution:
    // 1) interactionConfig (preferred)
    // 2) interactionMode + interactionMapping (migration support)
    // 3) default dwell
    const derivedInteraction: InteractionConfig = useMemo(() => {
        if (interactionConfig) return interactionConfig;

        if (interactionMode) {
            return {
                id: interactionMode,
                mapping: interactionMapping ?? {},
            } as InteractionConfig;
        }

        return { id: "dwell", mapping: {} } as InteractionConfig;
    }, [interactionConfig, interactionMode, interactionMapping]);

    const interactionId: InteractionId = derivedInteraction.id ?? "dwell";
    const interactionMappingResolved: InteractionMapping = derivedInteraction.mapping ?? {};

    const isDwell = interactionId === "dwell";
    const isHybrid = interactionId === "hybrid_c";
    const isDwellFree = interactionId === "dwell_free_c";

    const resolvedMapping = useMemo<InteractionMapping>(() => {
        const m = interactionMappingResolved ?? {};

        return {
            // Dwell-free default: CORNER_CONFIRM (two-phase)
            select: isDwellFree
                ? (m.select ?? "CORNER_CONFIRM")
                : m.select,

            // Action bindings
            space: m.space ?? "BLINK_INTENT",
            delete: m.delete ?? "CHORD:FLICK_RIGHT+FLICK_DOWN",

            // Popup control
            open_vowel_popup:
                m.open_vowel_popup ??
                (isHybrid || isDwellFree ? "FLICK_DOWN" : undefined),

            close_vowel_popup:
                m.close_vowel_popup ??
                (isHybrid || isDwellFree
                    ? "CHORD:FLICK_DOWN+BLINK_INTENT"
                    : undefined),

            // Backward compatibility (only if explicitly used)
            toggle_vowel_popup: m.toggle_vowel_popup,
        };
    }, [interactionMappingResolved, isDwellFree, isHybrid]);

    // ---------- STATE ----------
    const [typedText, setTypedText] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isSecondStage, setIsSecondStage] = useState(false);
    const [showNumbers, setShowNumbers] = useState(false);
    const [showPunctuation, setShowPunctuation] = useState(false);

    const [vowelPopup, setVowelPopup] = useState<{
        options: string[];
        position: { top: number; left: number };
        scaleBoost: number;
    } | null>(null);

    // HYBRID: "armed" popup (generated but not shown until toggle gesture)
    const [pendingVowelPopup, setPendingVowelPopup] = useState<{
        options: string[];
        position: { top: number; left: number };
        scaleBoost: number;
    } | null>(null);

    // Eyespeak v2/v3/v4: vowel row hiding state
    const [v234VowelRowMode, setV234VowelRowMode] = useState<"start" | "pendingPopup" | "hidden">(
        "start"
    );

    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [activeControl, setActiveControl] = useState<string | null>(null);
    const [showBias, setShowBias] = useState(false);

    const [lastAction, setLastAction] = useState<LastAction>(null);

    const [lastVowelAnchor, setLastVowelAnchor] = useState<{
        base: string;
        prefix: string;
        position: { top: number; left: number };
        scaleBoost: number;
    } | null>(null);

    // Metrics
    const [totalKeys, setTotalKeys] = useState(0);
    const [deleteCount, setDeleteCount] = useState(0);
    const [vowelClicks, setVowelClicks] = useState(0);
    const [vowelMoreClicks, setVowelMoreClicks] = useState(0);
    const [vowelCloseClicks, setVowelCloseClicks] = useState(0);

    // Gaze / distance
    const containerRef = useRef<HTMLDivElement>(null);
    const resizeContainerRef = useRef<HTMLDivElement | null>(null);

    const gazeData = useGaze();
    const [gaze, setGaze] = useState({ x: window.innerWidth / 2, y: 80 });
    const [eyeDistance, setEyeDistance] = useState(0);
    const lastGazeRef = useRef<{ x: number; y: number } | null>(null);

    // Fixation/arming for dwell-free: we will click element under gaze on "select" gesture.
    // For visual feedback, we keep a lightweight "armed element" reference.
    const armedElRef = useRef<HTMLElement | null>(null);

    // --- Dwell-free popup lock (blink-confirm) ---
    const [popupLockedGestureId, setPopupLockedGestureId] = useState<string | null>(null);
    const popupLockedElRef = useRef<HTMLElement | null>(null);
    const popupCandidateIdRef = useRef<string | null>(null);
    const popupCandidateSinceRef = useRef<number>(0);
    const popupLastConfirmedIdRef = useRef<string | null>(null);
    const popupLastInsideLockedAtRef = useRef<number>(0);

    const clickAtGaze = () => {
        const el = (armedElRef.current ??
            (document.elementFromPoint(gaze.x, gaze.y) as HTMLElement | null)) as HTMLElement | null;
        el?.click();
    };

    // Dwell-free 2-phase select: lock key then confirm via corner triangle.
    const cornerConfirm = useKeyCornerConfirm({
        enabled: isDwellFree && resolvedMapping.select === "CORNER_CONFIRM",
        gaze,
        containerRef,
        eligibleRootRef: resizeContainerRef,
        onConfirm: (el) => {
            try {
                (el as any).click?.();
            } catch {
                clickAtGaze();
            }
        },
    });

    // Dwell-free popup lock (blink-confirm) tracking.
    useEffect(() => {
        if (!isDwellFree) return;
        if (!vowelPopup) {
            setPopupLockedGestureId(null);
            popupLockedElRef.current = null;
            popupCandidateIdRef.current = null;
            popupCandidateSinceRef.current = 0;
            popupLastConfirmedIdRef.current = null;
            popupLastInsideLockedAtRef.current = 0;
            return;
        }

        const now = performance.now();
        const el = document.elementFromPoint(gaze.x, gaze.y) as HTMLElement | null;
        const target = el?.closest?.("[data-gesture-id^='vowel:']") as HTMLElement | null;
        const id = target?.getAttribute?.("data-gesture-id") || null;

        // Reset "repeat guard" once gaze leaves the last confirmed target
        if (popupLastConfirmedIdRef.current && id !== popupLastConfirmedIdRef.current) {
            popupLastConfirmedIdRef.current = null;
        }

        const lockedId = popupLockedGestureId;
        const lockedEl = popupLockedElRef.current;

        if (lockedId && lockedEl) {
            // Maintain lock while gaze stays on locked target
            const stillOnLocked = id === lockedId;

            if (stillOnLocked) {
                popupLastInsideLockedAtRef.current = now;
            }

            // Unlock if gaze left the locked target for a short time
            if (
                !stillOnLocked &&
                popupLastInsideLockedAtRef.current > 0 &&
                now - popupLastInsideLockedAtRef.current > 180
            ) {
                setPopupLockedGestureId(null);
                popupLockedElRef.current = null;
                popupCandidateIdRef.current = id;
                popupCandidateSinceRef.current = id ? now : 0;
                popupLastInsideLockedAtRef.current = 0;
            }
            return;
        }

        // No lock: fixation detection to lock popup target
        if (id && popupCandidateIdRef.current === id) {
            if (popupCandidateSinceRef.current === 0) popupCandidateSinceRef.current = now;
            if (now - popupCandidateSinceRef.current >= 150) {
                setPopupLockedGestureId(id);
                popupLockedElRef.current = target;
                popupLastInsideLockedAtRef.current = now;
            }
        } else {
            popupCandidateIdRef.current = id;
            popupCandidateSinceRef.current = id ? now : 0;
        }
    }, [gaze.x, gaze.y, isDwellFree, vowelPopup, popupLockedGestureId]);
    // shared, resizable keyboard size
    const [kbSize, setKbSize] = useState<KeyboardSize>(globalKeyboardSize);

    // Apply predefined keyboard footprint (per session) when provided.
    useEffect(() => {
        const preset = KEYBOARD_SIZE_PRESETS[keyboardSizePreset] ?? KEYBOARD_SIZE_PRESETS.m;
        globalKeyboardSize = preset;
        setKbSize(preset);
    }, [keyboardSizePreset]);

    // Track gaze + eye distance
    useEffect(() => {
        if (gazeData?.x == null || gazeData?.y == null) return;

        const prev = lastGazeRef.current;
        if (prev) {
            const dx = gazeData.x - prev.x;
            const dy = gazeData.y - prev.y;
            setEyeDistance((p) => p + Math.sqrt(dx * dx + dy * dy));
        }
        lastGazeRef.current = { x: gazeData.x, y: gazeData.y };
        setGaze(gazeData);
    }, [gazeData]);

    // ---------------- Dwell Hook (disabled in dwell-free) ----------------
    // In dwell-free: we set dwellMs huge so it never auto-triggers.
    const effectiveDwellMainMs = isDwellFree ? 1_000_000_000 : dwellMainMs;
    const effectiveDwellPopupMs = isDwellFree ? 1_000_000_000 : dwellPopupMs;

    const { progress } = useDwell(gaze.x, gaze.y, {
        stabilizationMs: 120,
        stabilityRadiusPx: 90,
        dwellMs: effectiveDwellMainMs,
        dwellMsPopup: effectiveDwellPopupMs,
        refractoryMs: 200,
    });

    const dwellTime = dwellMainMs * progress;

    // ---------------- Emit helper ----------------
    const emit = (nextText: string) => {
        onChange?.(nextText, {
            total_keystrokes: totalKeys,
            deletes: deleteCount,
            eye_distance_px: eyeDistance,
            vowel_popup_clicks: vowelClicks,
            vowel_popup_more_clicks: vowelMoreClicks,
            vowel_popup_close_clicks: vowelCloseClicks,
            interaction_id: interactionId,
        });
    };

    // ---------------- UI feedback helpers ----------------
    const triggerKeyFlash = (key: string) => {
        setActiveKey(key);
        window.setTimeout(() => setActiveKey(null), 180);
    };

    const triggerControlFlash = (id: string) => {
        setActiveControl(id);
        window.setTimeout(() => setActiveControl(null), 180);
    };

    const getCurrentLayout = () => {
        if (showNumbers) return numbers;
        if (showPunctuation) return punctuation;
        return isSecondStage ? layout.secondStageLetters : layout.firstStageLetters;
    };

    // ---------------- Predictions ----------------
    const fetchWordPredictions = async (prefix: string) => {
        if (evaluationMode) {
            setSuggestions([]);
            return;
        }
        try {
            const res = await axios.get("http://localhost:5000/predict/word", { params: { prefix } });
            setSuggestions(res.data);
        } catch {
            // ignore
        }
    };

    const fetchVowelPredictions = async (
        prefix: string,
        char: string,
        e: React.MouseEvent | null,
        positionOverride?: { top: number; left: number },
        isFirstCharVowelRowKey?: boolean,
        openImmediately: boolean = true
    ) => {
        const base = char;

        const isPureVowel = PURE_VOWELS.has(base);
        const dynamicAll = isPureVowel ? [] : buildAllDiacriticsForBase(base);

        const buildAndSetPopup = (corpusList: string[]) => {
            const seen = new Set<string>();
            const ordered: string[] = [];

            for (const form of corpusList) {
                if (!seen.has(form)) {
                    seen.add(form);
                    ordered.push(form);
                }
            }
            for (const form of dynamicAll) {
                if (!seen.has(form)) {
                    seen.add(form);
                    ordered.push(form);
                }
            }

            if (!ordered.length || !containerRef.current) {
                setVowelPopup(null);
                setPendingVowelPopup(null);
                if (isFirstCharVowelRowKey) setV234VowelRowMode("hidden");
                setPopupLockedGestureId(null);
                popupLockedElRef.current = null;
                popupCandidateIdRef.current = null;
                popupCandidateSinceRef.current = 0;
                popupLastConfirmedIdRef.current = null;
                popupLastInsideLockedAtRef.current = 0;
                return;
            }

            if (isFirstCharVowelRowKey) setV234VowelRowMode("pendingPopup");

            let pos = positionOverride;
            if (!pos && e) {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                pos = {
                    top: rect.top - containerRef.current.offsetTop,
                    left: rect.left - containerRef.current.offsetLeft,
                };
            }

            if (!pos) {
                setVowelPopup(null);
                setPendingVowelPopup(null);
                return;
            }

            const scaleBoost = pos.left < kbSize.width * 0.2 || pos.left > kbSize.width * 0.8 ? 1.25 : 1.0;

            setLastVowelAnchor({ base, prefix, position: pos, scaleBoost });

            const payload = { options: ordered, position: pos, scaleBoost };

            if (openImmediately) {
                setVowelPopup(payload);
                setPendingVowelPopup(null);
            } else {
                setPendingVowelPopup(payload);
                setVowelPopup(null);
            }
        };

        try {
            const vowelRes = await axios.get("http://localhost:5000/predict/vowel", {
                params: { prefix, current: char },
            });
            const corpusList = Array.isArray(vowelRes.data) ? (vowelRes.data as string[]) : [];
            buildAndSetPopup(corpusList);
        } catch {
            // backend fail -> dynamic only
            buildAndSetPopup([]);
        }
    };

    // ---------------- Text composition ----------------
    const appendWithSinhalaCompose = (nextChar: string) => {
        let newText = typedText + nextChar;
        const lastTwo = newText.slice(-2);
        const composed = COMBINATION_MAP[lastTwo];
        if (composed) newText = newText.slice(0, -2) + composed;
        setTypedText(newText);
        emit(newText);
    };

    const chooseWijesekaraChar = (char: string) => {
        const secondary = layout.primarySecondaryMap?.[char];
        if (!secondary) return char;
        return dwellTime >= 2 * dwellMainMs ? secondary : char;
    };

    // ---------------- Core actions (must preserve behavior) ----------------
    const handleStageToggleAction = () => {
        triggerControlFlash("stageToggle");
        setIsSecondStage((p) => !p);
        setVowelPopup(null);
        setPendingVowelPopup(null);
        setTotalKeys((k) => k + 1);
        setLastAction({ type: "char" });
        emit(typedText);
    };

    const handleSpaceAction = () => {
        triggerControlFlash("space");
        const next = typedText + " ";
        setTypedText(next);
        setVowelPopup(null);
        setPendingVowelPopup(null);
        setTotalKeys((k) => k + 1);
        setLastAction({ type: "char" });
        setIsSecondStage(false);
        setV234VowelRowMode("start");
        emit(next);
    };

    const handleDeleteAction = () => {
        triggerControlFlash("delete");

        // (1) Undo prediction: restore full previous text
        if (lastAction?.type === "prediction") {
            const next = lastAction.prevText;
            setTypedText(next);
            setSuggestions([]);
            setVowelPopup(null);
            setPendingVowelPopup(null);
            setLastAction(null);
            setDeleteCount((d) => d + 1);
            setTotalKeys((k) => k + 1);
            emit(next);
            return;
        }

        // (2) Undo popup selection: restore previous text, reopen popup ONCE (correction flow)
        if (lastAction?.type === "popup") {
            const next = lastAction.prevText;
            const base = lastAction.base;
            const pos = lastAction.position;

            setTypedText(next);
            setSuggestions([]);
            setVowelPopup(null);
            setPendingVowelPopup(null);
            setLastAction(null);

            if (layout.hasVowelPopup) {
                const words = next.trim().split(" ");
                const lastPrefix = words.length ? words[words.length - 1] : "";
                // In HYBRID we should arm popup (open only if toggle gesture is used),
                // but your correction flow expects popup reopening to help fix immediately.
                // So: open immediately in DWELL + DWELL_FREE; in HYBRID we respect model by arming.
                fetchVowelPredictions(
                    lastPrefix,
                    base,
                    null,
                    pos,
                    undefined,
                    !isHybrid // open immediately unless HYBRID
                );
            }

            setDeleteCount((d) => d + 1);
            setTotalKeys((k) => k + 1);
            emit(next);
            return;
        }

        // (3) Normal delete: remove last char
        const next = typedText.slice(0, -1);
        setTypedText(next);
        setSuggestions([]);
        setVowelPopup(null);
        setPendingVowelPopup(null);
        setLastAction({ type: "char" });
        setDeleteCount((d) => d + 1);
        setTotalKeys((k) => k + 1);
        emit(next);
    };

    const handleBiasAdjustOpen = () => {
        triggerControlFlash("bias");
        setShowBias(true);
    };

    const handleSuggestionClick = (word: string) => {
        if (evaluationMode) return;
        const prevText = typedText;
        setLastAction({ type: "prediction", prevText });

        setTotalKeys((k) => k + 1);
        const parts = typedText.trim().split(" ");
        parts[parts.length - 1] = word;
        const newText = parts.join(" ") + " ";

        setTypedText(newText);
        setSuggestions([]);
        setVowelPopup(null);
        setPendingVowelPopup(null);
        setIsSecondStage(false);
        setV234VowelRowMode("start");
        emit(newText);
    };

    const handleVowelSelect = async (vowelChunk: string) => {
        const prevText = typedText;

        if (lastVowelAnchor) {
            setLastAction({
                type: "popup",
                prevText,
                base: lastVowelAnchor.base,
                position: lastVowelAnchor.position,
            });
        } else {
            setLastAction({ type: "char" });
        }

        setVowelClicks((v) => v + 1);
        setTotalKeys((k) => k + 1);

        const newText = typedText.slice(0, -1) + vowelChunk;
        setTypedText(newText);

        setVowelPopup(null);
        setPendingVowelPopup(null);
        setV234VowelRowMode("hidden");
        setPopupLockedGestureId(null);
        popupLockedElRef.current = null;
        popupCandidateIdRef.current = null;
        popupCandidateSinceRef.current = 0;
        popupLastConfirmedIdRef.current = null;
        popupLastInsideLockedAtRef.current = 0;
        emit(newText);

        const lastWord = newText.trim().split(" ").pop() || "";
        await fetchWordPredictions(lastWord);
    };

    const handleKeyPress = async (char: string, e: React.MouseEvent, rowIdx?: number) => {
        // If vowel row was pending popup and they typed a vowel-row key first char, close implicit popup state
        const implicitResolveFirstVowel = !!(vowelPopup && v234VowelRowMode === "pendingPopup");
        if (implicitResolveFirstVowel) setVowelPopup(null);

        triggerKeyFlash(char);
        setTotalKeys((k) => k + 1);
        setLastAction({ type: "char" });

        const chosen = layout.id === "wijesekara" ? chooseWijesekaraChar(char) : char;

        appendWithSinhalaCompose(chosen);

        const words = (typedText + chosen).trim().split(" ");
        const lastPrefix = words[words.length - 1];

        await fetchWordPredictions(lastPrefix);

        const isV234FirstSetActiveNow =
            (layout.id === "eyespeak_v2" || layout.id === "eyespeak_v3" || layout.id === "eyespeak_v4") &&
            !isSecondStage &&
            !showNumbers &&
            !showPunctuation;

        const currentWordBefore = typedText.split(" ").pop() ?? "";
        const isFirstCharNow = isV234FirstSetActiveNow && currentWordBefore.length === 0;
        const isVowelRowKeyNow = isV234FirstSetActiveNow && rowIdx === getCurrentLayout().length - 1;

        if (layout.hasVowelPopup) {
            // DWELL + DWELL_FREE: open immediately
            // HYBRID: arm only, open via gesture toggle
            const openImmediately = !isHybrid;
            await fetchVowelPredictions(
                lastPrefix,
                chosen,
                e,
                undefined,
                isFirstCharNow && isVowelRowKeyNow,
                openImmediately
            );
        }

        if (implicitResolveFirstVowel) setV234VowelRowMode("hidden");
        setPopupLockedGestureId(null);
        popupLockedElRef.current = null;
        popupCandidateIdRef.current = null;
        popupCandidateSinceRef.current = 0;
        popupLastConfirmedIdRef.current = null;
        popupLastInsideLockedAtRef.current = 0;
    };

    // ---------------- Eyespeak v2/v3/v4: vowel-row hide after first char ----------------
    const rows = getCurrentLayout();
    const isV234FirstSetActive =
        (layout.id === "eyespeak_v2" || layout.id === "eyespeak_v3" || layout.id === "eyespeak_v4") &&
        !isSecondStage &&
        !showNumbers &&
        !showPunctuation;

    const currentLastWord = typedText.split(" ").pop() ?? "";
    const shouldHideVowelRow = isV234FirstSetActive && currentLastWord.length > 0 && v234VowelRowMode === "hidden";

    // ---------------- Resizable container observer ----------------
    useEffect(() => {
        if (evaluationMode) return;

        const el = resizeContainerRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;

        let isInitial = true;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                const w = Math.round(width);
                const h = Math.round(height);
                if (w <= 0 || h <= 0) return;

                if (isInitial) {
                    isInitial = false;
                    return;
                }

                if (Math.abs(w - globalKeyboardSize.width) > 10 || Math.abs(h - globalKeyboardSize.height) > 10) {
                    globalKeyboardSize = { width: w, height: h };
                    setKbSize(globalKeyboardSize);
                }
            }
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, [evaluationMode]);

    // ---------------- DWELL_FREE: arm element under gaze (no clicks) ----------------
    useEffect(() => {
        if (!isDwellFree) {
            armedElRef.current = null;
            return;
        }
        if (showBias) return;

        // "Immediate" arming: element under gaze is considered current target.
        // (You said: look at key and immediately flick/blink.)
        const el = document.elementFromPoint(gaze.x, gaze.y) as HTMLElement | null;
        armedElRef.current = el;

        // Optional: could add CSS highlight in future; for now activeKey flash is used only on click.
    }, [isDwellFree, gaze.x, gaze.y, showBias]);

    // ---------------- Gesture router (HYBRID + DWELL_FREE) ----------------
    const gestureCooldownUntilRef = useRef<number>(0);

    const closeVowelPopup = () => {
        if (!layout.hasVowelPopup) return;
        if (!vowelPopup) return;
        setVowelPopup(null);
        setPendingVowelPopup(null);
        setV234VowelRowMode("hidden");
        setPopupLockedGestureId(null);
        popupLockedElRef.current = null;
        popupCandidateIdRef.current = null;
        popupCandidateSinceRef.current = 0;
        popupLastConfirmedIdRef.current = null;
        popupLastInsideLockedAtRef.current = 0;
    };

    const openVowelPopup = () => {
        if (!layout.hasVowelPopup) return;

        // Open-only: prevents "open then immediately close" due to double firing/jitter.
        if (vowelPopup) return;

        if (pendingVowelPopup) {
            setVowelPopup(pendingVowelPopup);
            return;
        }

        if (lastVowelAnchor) {
            fetchVowelPredictions(
                lastVowelAnchor.prefix,
                lastVowelAnchor.base,
                null,
                lastVowelAnchor.position,
                undefined,
                true
            );
        }
    };

    const toggleVowelPopup = () => {
        if (vowelPopup) closeVowelPopup();
        else openVowelPopup();
    };


    useGazeEvents((ev: GazeEventType) => {
        if (showBias) return;

        const now = performance.now();
        if (now < gestureCooldownUntilRef.current) return;
        gestureCooldownUntilRef.current = now + 220;

        // HYBRID: popup control by mapping (open/close preferred; toggle kept for backward compatibility)
        if (isHybrid) {
            if (resolvedMapping.open_vowel_popup && ev === resolvedMapping.open_vowel_popup) {
                openVowelPopup();
                return;
            }
            if (resolvedMapping.close_vowel_popup && ev === resolvedMapping.close_vowel_popup) {
                closeVowelPopup();
                return;
            }
            if (resolvedMapping.toggle_vowel_popup && ev === resolvedMapping.toggle_vowel_popup) {
                toggleVowelPopup();
                return;
            }
            return;
        }

        // DWELL_FREE: select/delete/space by mapping
        if (isDwellFree) {

            // Popup blink-confirm (dwell-free): lock a popup option by short fixation, confirm via BLINK_INTENT.
            if (
                vowelPopup &&
                popupLockedGestureId &&
                (ev === "BLINK_INTENT" || ev === "BLINK")
            ) {
                // one activation per gaze entry on the same popup target
                if (popupLastConfirmedIdRef.current !== popupLockedGestureId) {
                    const el = popupLockedElRef.current;
                    popupLastConfirmedIdRef.current = popupLockedGestureId;
                    try {
                        (el as any)?.click?.();
                    } catch {
                        // ignore
                    }
                }
                return;
            }

            // Handle select only if it is NOT CORNER_CONFIRM
            // (CORNER_CONFIRM is gaze-based via useKeyCornerConfirm, not event-based)
            if (
                resolvedMapping.select &&
                resolvedMapping.select !== "CORNER_CONFIRM" &&
                ev === resolvedMapping.select
            ) {
                clickAtGaze();
                return;
            }

            if (resolvedMapping.delete && ev === resolvedMapping.delete) {
                handleDeleteAction();
                return;
            }

            if (resolvedMapping.space && ev === resolvedMapping.space) {
                handleSpaceAction();
                return;
            }

            return;
        }

        // DWELL: ignore gestures entirely
    });


    // --- Keyboard fallback for gesture-mapped actions (dev / no-eye-tracker) ---
    // This does NOT replace gaze input. It simply provides alternative triggers so you can test end-to-end
    // even when Tobii data is unavailable.
    useEffect(() => {
        const isEditableTarget = (t: EventTarget | null) => {
            const el = t as HTMLElement | null;
            if (!el) return false;
            const tag = el.tagName?.toLowerCase();
            return (
                tag === "input" ||
                tag === "textarea" ||
                tag === "select" ||
                (el as any).isContentEditable === true
            );
        };

        const onKeyDown = (e: KeyboardEvent) => {
            // Don't intercept typing into text fields
            if (isEditableTarget(e.target)) return;

            // Don't allow keyboard fallbacks during bias overlay
            if (showBias) return;

            // Basic cooldown to mirror gesture debounce
            const now = performance.now();
            if (now < gestureCooldownUntilRef.current) return;
            gestureCooldownUntilRef.current = now + 220;

            // Map physical keyboard inputs to the same ACTIONS used by gaze events.
            // If either gaze OR keyboard trigger happens, the mapped action occurs.
            // Space -> "space" action
            if (e.code === "Space") {
                e.preventDefault();
                handleSpaceAction();
                return;
            }

            // Backspace/Delete -> "delete" action
            if (e.code === "Backspace" || e.code === "Delete") {
                e.preventDefault();
                handleDeleteAction();
                return;
            }

            // Popup toggle (hybrid / dwell-free testing): "P" (or "O") toggles popup
            if (e.code === "KeyP" || e.code === "KeyO") {
                e.preventDefault();
                toggleVowelPopup();
                return;
            }

            // Enter -> "select" action (only meaningful in dwell-free)
            if (e.code === "Enter" || e.code === "NumpadEnter") {
                if (isDwellFree) {
                    e.preventDefault();
                    clickAtGaze();
                }
                return;
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [
        showBias,
        isDwellFree,
        handleSpaceAction,
        handleDeleteAction,
        toggleVowelPopup,
        clickAtGaze,
    ]);


    // ---------------- Render ----------------
    return (
        <div
            ref={containerRef}
            style={{
                padding: "16px clamp(8px, 2vw, 24px)",
                position: "relative",
                width: "100%",
                maxWidth: "100%",
            }}
        >
            {/* Typed text */}
            <div
                style={{
                    marginBottom: 10,
                    fontSize: 18,
                    minHeight: TYPED_ROW_MIN_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <strong>Typed Text:&nbsp;</strong> <span>{typedText}</span>
            </div>

            {/* Suggestion bar */}
            <div
                style={{
                    height: SUGGESTION_ROW_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 16,
                    marginLeft: "auto",
                    marginRight: "auto",
                    padding: "6px 4px",
                    background: "#f8fbff",
                    border: "1px solid #e1ecff",
                    borderRadius: 10,
                    overflowX: "auto",
                    whiteSpace: "nowrap",
                }}
            >
                {evaluationMode ? (
                    <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
            Predictions are disabled in evaluation mode.
          </span>
                ) : suggestions.length === 0 ? (
                    <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Suggestions will appear here…</span>
                ) : (
                    suggestions.map((word, i) => (
                        <button
                            key={i}
                            onClick={() => handleSuggestionClick(word)}
                            style={{
                                padding: "12px 14px",
                                fontSize: "20px",
                                backgroundColor: "#e6f0ff",
                                border: "1px solid #c7dafd",
                                borderRadius: 8,
                            }}
                        >
                            {word}
                        </button>
                    ))
                )}
            </div>

            {/* Resizable keyboard footprint (keys + controls) */}
            <div
                ref={resizeContainerRef}
                style={{
                    resize: evaluationMode ? "none" : "both",
                    overflow: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 16,
                    marginLeft: "auto",
                    marginRight: "auto",
                    width: kbSize.width,
                    height: kbSize.height,
                    maxWidth: "100%",
                    minWidth: 700,
                    minHeight: 300,
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10,
                }}
            >
                {/* Main keyboard */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        flex: 1,
                        minHeight: 0,
                    }}
                >
                    {rows.map((row, rowIdx) => {
                        const isLastRow = rowIdx === rows.length - 1;

                        // Eyespeak v2/v3/v4: last row (vowel row) collapse when shouldHideVowelRow
                        if (isLastRow) {
                            const collapsing = shouldHideVowelRow;
                            return (
                                <div
                                    key={`row-${rowIdx}`}
                                    style={{
                                        display: "grid",
                                        gridTemplateRows: "1fr",
                                        flex: collapsing ? 0 : 1,
                                        minHeight: 0,
                                        gridTemplateColumns: `repeat(${row.length}, 1fr)`,
                                        gap: 10,
                                        overflow: "hidden",
                                        maxHeight: collapsing ? 0 : 1000,
                                        opacity: collapsing ? 0 : 1,
                                        transition: "max-height 0.18s ease, opacity 0.18s ease, flex 0.18s ease",
                                        pointerEvents: collapsing ? "none" : "auto",
                                    }}
                                >
                                    {row.map((char, colIdx) => {
                                        const secondaryChar = layout.id === "wijesekara" ? layout.primarySecondaryMap?.[char] : null;
                                        const isDual = !!secondaryChar;

                                        return (
                                            <button
                                                key={`key-${rowIdx}-${colIdx}`}
                                                onClick={(e) => handleKeyPress(char, e, rowIdx)}
                                                style={{
                                                    position: "relative",
                                                    height: "100%",
                                                    width: "100%",
                                                    padding: "0",
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    alignItems: "center",
                                                    fontSize: "26px",
                                                    borderRadius: 8,
                                                    transition: "all 0.15s ease",
                                                    backgroundColor: activeKey === char ? "#b3e6ff" : "#fdfdfd",
                                                    border: "1px solid #ccc",
                                                }}
                                            >
                                                <span>{char}</span>
                                                {isDual && (
                                                    <span
                                                        style={{
                                                            position: "absolute",
                                                            top: 4,
                                                            right: 6,
                                                            fontSize: "16px",
                                                            opacity: 0.8,
                                                            color: "#555",
                                                        }}
                                                    >
                            {secondaryChar}
                          </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        }

                        // Wijesekara last row centering (kept)
                        if (layout.id === "wijesekara" && isLastRow) {
                            const totalColumns = 10;
                            const emptySlots = totalColumns - row.length;

                            return (
                                <div
                                    key={`row-${rowIdx}`}
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: `repeat(${totalColumns}, 1fr)`,
                                        gap: 10,
                                        justifyItems: "center",
                                        flex: 1,
                                        minHeight: 0,
                                        gridTemplateRows: "1fr",
                                    }}
                                >
                                    {Array.from({ length: Math.floor(emptySlots / 2) }).map((_, i) => (
                                        <div key={`pad-left-${i}`} />
                                    ))}

                                    {row.map((char, colIdx) => {
                                        const secondaryChar = layout.id === "wijesekara" ? layout.primarySecondaryMap?.[char] : null;
                                        const isDual = !!secondaryChar;

                                        return (
                                            <button
                                                key={`key-${rowIdx}-${colIdx}`}
                                                onClick={(e) => handleKeyPress(char, e, rowIdx)}
                                                style={{
                                                    position: "relative",
                                                    height: "100%",
                                                    width: "100%",
                                                    padding: "0",
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    alignItems: "center",
                                                    fontSize: "26px",
                                                    borderRadius: 8,
                                                    transition: "all 0.15s ease",
                                                    backgroundColor: activeKey === char ? "#b3e6ff" : "#fdfdfd",
                                                    border: "1px solid #ccc",
                                                }}
                                            >
                                                <span>{char}</span>
                                                {isDual && (
                                                    <span
                                                        style={{
                                                            position: "absolute",
                                                            top: 4,
                                                            right: 6,
                                                            fontSize: "16px",
                                                            opacity: 0.8,
                                                            color: "#555",
                                                        }}
                                                    >
                            {secondaryChar}
                          </span>
                                                )}
                                            </button>
                                        );
                                    })}

                                    {Array.from({ length: emptySlots - Math.floor(emptySlots / 2) }).map((_, i) => (
                                        <div key={`pad-right-${i}`} />
                                    ))}
                                </div>
                            );
                        }

                        // Default row rendering
                        return (
                            <div
                                key={`row-${rowIdx}`}
                                style={{
                                    display: "grid",
                                    gridTemplateRows: "1fr",
                                    flex: 1,
                                    minHeight: 0,
                                    gridTemplateColumns: `repeat(${row.length}, 1fr)`,
                                    gap: 10,
                                }}
                            >
                                {row.map((char, colIdx) => {
                                    const secondaryChar = layout.id === "wijesekara" ? layout.primarySecondaryMap?.[char] : null;
                                    const isDual = !!secondaryChar;

                                    return (
                                        <button
                                            key={`key-${rowIdx}-${colIdx}`}
                                            onClick={(e) => handleKeyPress(char, e, rowIdx)}
                                            style={{
                                                position: "relative",
                                                height: "100%",
                                                width: "100%",
                                                padding: "0",
                                                display: "flex",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                fontSize: "26px",
                                                borderRadius: 8,
                                                transition: "all 0.15s ease",
                                                backgroundColor: activeKey === char ? "#b3e6ff" : "#fdfdfd",
                                                border: "1px solid #ccc",
                                            }}
                                        >
                                            <span>{char}</span>
                                            {isDual && (
                                                <span
                                                    style={{
                                                        position: "absolute",
                                                        top: 4,
                                                        right: 6,
                                                        fontSize: "16px",
                                                        opacity: 0.8,
                                                        color: "#555",
                                                    }}
                                                >
                          {secondaryChar}
                        </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* Controls */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                    <button
                        onClick={handleStageToggleAction}
                        style={{
                            ...controlButtonStyle,
                            backgroundColor: activeControl === "stageToggle" ? "#e1be4a" : controlButtonStyle.backgroundColor,
                        }}
                    >
                        {isSecondStage ? "⇠ First Set" : "⇢ Second Set"}
                    </button>

                    <button
                        onClick={handleSpaceAction}
                        style={{
                            ...controlButtonStyle,
                            flex: 2,
                            backgroundColor: activeControl === "space" ? "#e1be4a" : controlButtonStyle.backgroundColor,
                        }}
                    >
                        Space
                    </button>

                    <button
                        onClick={handleDeleteAction}
                        style={{
                            ...controlButtonStyle,
                            backgroundColor: activeControl === "delete" ? "#ec8c76" : controlButtonStyle.backgroundColor,
                        }}
                    >
                        ⌫ Delete
                    </button>

                    <button
                        onClick={handleBiasAdjustOpen}
                        style={{
                            ...controlButtonStyle,
                            backgroundColor: activeControl === "bias" ? "#e1be4a" : controlButtonStyle.backgroundColor,
                        }}
                    >
                        Bias Adjust
                    </button>
                </div>
            </div>

            {/* Vowel popup */}
            {layout.hasVowelPopup && vowelPopup && (
                <VowelPopup
                    key={vowelPopup.options[0]}
                    predictions={vowelPopup.options}
                    onSelect={handleVowelSelect}
                    onClose={() => {
                        setVowelPopup(null);
                        setPendingVowelPopup(null);
                        setV234VowelRowMode("hidden");
                        setPopupLockedGestureId(null);
                        popupLockedElRef.current = null;
                        popupCandidateIdRef.current = null;
                        popupCandidateSinceRef.current = 0;
                        popupLastConfirmedIdRef.current = null;
                        popupLastInsideLockedAtRef.current = 0;
                    }}
                    position={vowelPopup.position}
                    keyboardWidth={kbSize.width}
                    scaleBoost={vowelPopup.scaleBoost}
                    lockedGestureId={popupLockedGestureId}
                    onControlClick={(label) => {
                        if (label === "More") {
                            setVowelMoreClicks((m) => m + 1);
                            setTotalKeys((k) => k + 1);
                            emit(typedText);
                        } else if (label === "Close") {
                            setVowelCloseClicks((c) => c + 1);
                            setTotalKeys((k) => k + 1);
                            emit(typedText);
                        } else {
                            setTotalKeys((k) => k + 1);
                            emit(typedText);
                        }
                    }}
                />
            )}

            {/* Dwell-free corner confirm overlay */}
            {cornerConfirm?.showCorner && cornerConfirm.overlayStyle && (
                <div style={cornerConfirm.overlayStyle as any}>
                    <div
                        style={{
                            width: 0,
                            height: 0,
                            borderTop: `${cornerConfirm.cornerSize}px solid rgba(59,130,246,0.35)`,
                            borderLeft: `${cornerConfirm.cornerSize}px solid transparent`,
                        }}
                    />
                </div>
            )}

            {showBias && <BiasTuner onClose={() => setShowBias(false)} />}

            <GazeIndicator
                x={gaze.x}
                y={gaze.y}
                progress={progress}
                color={layout.id === "wijesekara" && dwellTime >= 2 * dwellMainMs ? "#ff7675" : "#3b82f6"}
                layoutId={layout.id}
            />
        </div>
    );
}