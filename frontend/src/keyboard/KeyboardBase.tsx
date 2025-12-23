import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import VowelPopup from "./VowelPopup";
import { useGaze } from "../gaze/useGaze";
import { useDwell } from "../gaze/useDwell";
import GazeIndicator from "../gaze/GazeIndicator";
import BiasTuner from "../gaze/BiasTuner";

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
 *
 *  - s: 1400 x 350  (ratio 4.0)
 *  - m: 1600 x 400  (ratio 4.0)
 *  - l: 1800 x 450  (ratio 4.0)
 *
 */
const KEYBOARD_SIZE_PRESETS: Record<KeyboardSizePreset, KeyboardSize> = {
    s: { width: 1400, height: 350 },
    m: { width: 1600, height: 400 },
    l: { width: 1800, height: 450 },

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
 *
 * These are NOT per-consonant lists.
 * They are generic suffix patterns we can apply to ANY base consonant
 * or consonant cluster (e.g., "ක", "ක්‍ර", "ස්ත").
 *
 * We keep them as suffixes so the same patterns work for every consonant.
 * Unicode shaping will handle the correct glyph reordering.
 */

// Plain vowel + sign patterns relative to a base consonant.
// Includes:
//  - hal sign (්)
//  - inherent vowel (no extra sign, represented by "")
//  - long/short vowels
//  - reph forms like e/ē/ai/o/ō/au (as dependent signs)
//  - anusvara (ං) and visarga (ඃ)
const PLAIN_SUFFIXES: string[] = [
    "්",  // hal kireema (e.g., "ක්")
    "",   // bare consonant (e.g., "ක")
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

// Rakaransaya patterns (්‍ර + optional vowel signs)
const RAKA_SUFFIX_BASE = "්‍ර";
const RAKA_VOWEL_SUFFIXES: string[] = [
    "",   // ක්‍ර
    "ා",  // ක්‍රා
    "ැ",  // ක්‍රැ
    "ෑ",  // ක්‍රෑ (rare but allowed)
    "ි",  // ක්‍රි
    "ී",  // ක්‍රී
    "ෙ",  // ක්‍රෙ
    "ේ",  // ක්‍රේ
    "ො",  // ක්‍රො
    "ෝ",  // ක්‍රෝ
];

// Yansaya patterns (්‍ය + optional vowel signs)
const YANSA_SUFFIX_BASE = "්‍ය";
const YANSA_VOWEL_SUFFIXES: string[] = [
    "",   // ක්‍ය
    "ා",  // ක්‍යා
    "ු",
    "ූ",
    "ැ",
    "ෑ",
    "ෙ",
    "ේ",
    "ො",
    "ෝ",
];

/**
 * Given ANY base consonant or cluster (e.g., "ක", "ක්‍ර", "ස්ත්‍ර"),
 * generate all possible diacritic formations by applying the above suffix sets.
 *
 * This is consonant-agnostic: the same suffix patterns are reused for all bases.
 */
function buildAllDiacriticsForBase(base: string): string[] {
    const forms = new Set<string>();

    // --- Single allowed list for both Raka + Yansa ---
    const CONJUNCT_ALLOWED = new Set([
        "ක", "ග", "ජ", "ට", "ඩ", "ත", "ද", "ප", "බ", "ම", "ස", "ල", "ළ", "හ"
    ]);

    // 1. ALWAYS add plain suffixes
    for (const suf of PLAIN_SUFFIXES) {
        forms.add(base + suf);
    }

    // 2. Conditionally add Rakaranshaya (්‍ර)
    if (CONJUNCT_ALLOWED.has(base)) {
        const rakaBase = base + RAKA_SUFFIX_BASE;
        for (const suf of RAKA_VOWEL_SUFFIXES) {
            forms.add(rakaBase + suf);
        }
    }

    // 3. Conditionally add Yansaya (්‍ය)
    if (CONJUNCT_ALLOWED.has(base)) {
        const yansaBase = base + YANSA_SUFFIX_BASE;
        for (const suf of YANSA_VOWEL_SUFFIXES) {
            forms.add(yansaBase + suf);
        }
    }

    return Array.from(forms);
}

type Metrics = {
    total_keystrokes: number;
    deletes: number;
    eye_distance_px: number;
    vowel_popup_clicks: number;
    vowel_popup_more_clicks: number;
};

export default function KeyboardBase({
                                         layout,
                                         dwellMainMs,
                                         dwellPopupMs,
                                         onChange,
                                         evaluationMode = false,
                                         keyboardSizePreset = "m",
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
}) {
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
    const [v234VowelRowMode, setV234VowelRowMode] = useState<"start" | "pendingPopup" | "hidden">("start");
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [activeControl, setActiveControl] = useState<string | null>(null);
    const [showBias, setShowBias] = useState(false);

    const [lastAction, setLastAction] = useState<
        | null
        | { type: "popup"; prevText: string; base: string; position: { top: number; left: number } }
        | { type: "prediction"; prevText: string }
        | { type: "char" }
    >(null);

    const [lastVowelAnchor, setLastVowelAnchor] = useState<{
        base: string;
        prefix: string;
        position: { top: number; left: number };
        scaleBoost: number;
    } | null>(null);

    const [totalKeys, setTotalKeys] = useState(0);
    const [deleteCount, setDeleteCount] = useState(0);
    const [vowelClicks, setVowelClicks] = useState(0);
    const [vowelMoreClicks, setVowelMoreClicks] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const [gaze, setGaze] = useState({ x: window.innerWidth / 2, y: 80 });
    const [eyeDistance, setEyeDistance] = useState(0);
    const [lastGaze, setLastGaze] = useState<{ x: number; y: number } | null>(
        null
    );

    // shared, resizable keyboard size
    const [kbSize, setKbSize] = useState<KeyboardSize>(globalKeyboardSize);

    // Apply predefined keyboard footprint (per session) when provided.
    useEffect(() => {
        const preset = KEYBOARD_SIZE_PRESETS[keyboardSizePreset] ?? KEYBOARD_SIZE_PRESETS.m;
        globalKeyboardSize = preset;
        setKbSize(preset);
    }, [keyboardSizePreset]);

    const resizeContainerRef = useRef<HTMLDivElement | null>(null);

    const gazeData = useGaze();
    useEffect(() => {
        if (gazeData?.x != null && gazeData?.y != null) {
            if (lastGaze) {
                const dx = gazeData.x - lastGaze.x;
                const dy = gazeData.y - lastGaze.y;
                setEyeDistance((prev) => prev + Math.sqrt(dx * dx + dy * dy));
            }
            setLastGaze({ x: gazeData.x, y: gazeData.y });
            setGaze(gazeData);
        }
    }, [gazeData, lastGaze]);

    const { progress } = useDwell(gaze.x, gaze.y, {
        stabilizationMs: 120,
        stabilityRadiusPx: 90,
        dwellMs: dwellMainMs,
        dwellMsPopup: dwellPopupMs,
        refractoryMs: 200,
    });

    const dwellTime = dwellMainMs * progress;

    const emit = (nextText: string) => {
        onChange?.(nextText, {
            total_keystrokes: totalKeys,
            deletes: deleteCount,
            eye_distance_px: eyeDistance,
            vowel_popup_clicks: vowelClicks,
            vowel_popup_more_clicks: vowelMoreClicks,
        });
    };

    const triggerKeyFlash = (key: string) => {
        setActiveKey(key);
        setTimeout(() => setActiveKey(null), 180);
    };

    const triggerControlFlash = (id: string) => {
        setActiveControl(id);
        setTimeout(() => setActiveControl(null), 180);
    };

    const getCurrentLayout = () => {
        if (showNumbers) return numbers;
        if (showPunctuation) return punctuation;
        return isSecondStage ? layout.secondStageLetters : layout.firstStageLetters;
    };

    const fetchWordPredictions = async (prefix: string) => {
        if (evaluationMode) {
            setSuggestions([]);
            return;
        }
        try {
            const res = await axios.get("http://localhost:5000/predict/word", {
                params: { prefix },
            });
            setSuggestions(res.data);
        } catch {
            // silently ignore prediction errors for now
        }
    };

    /**
     * Fetch vowel diacritic predictions from the backend AND
     * augment them with all dynamically generated Sinhala diacritic formations
     * for the given base consonant/cluster.
     *
     * - Backend provides most probable ~30 diacritics (from corpus JSON files)
     * - We generate the full space of diacritics using Unicode suffix patterns
     * - We merge them: corpus-first, then remaining forms, with no duplicates
     * - VowelPopup will then paginate them (6 per stage, etc.)
     */
    const fetchVowelPredictions = async (
        prefix: string,
        char: string,
        e: React.MouseEvent | null,
        positionOverride?: { top: number; left: number },
        isFirstCharVowelRowKey?: boolean
    ) => {
        // char is the base consonant / cluster the user just typed (e.g., "ක", "ක්‍ර")
        const base = char;

        // Do NOT generate extra diacritics for vowels ----
        const isPureVowel = PURE_VOWELS.has(base);

        // If it's a vowel → DO NOT build dynamic diacritics
        const dynamicAll = isPureVowel ? [] : buildAllDiacriticsForBase(base);

        const buildAndShowPopup = (corpusList: string[]) => {
            // Ensure uniqueness while keeping corpus order first.
            const seen = new Set<string>();
            const ordered: string[] = [];

            // 1. corpus suggestions (from JSON/backend)
            for (const form of corpusList) {
                if (!seen.has(form)) {
                    seen.add(form);
                    ordered.push(form);
                }
            }
            // 2. remaining dynamic forms (not in corpus)
            for (const form of dynamicAll) {
                if (!seen.has(form)) {
                    seen.add(form);
                    ordered.push(form);
                }
            }

            if (ordered.length > 0 && containerRef.current) {
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
                    return;
                }

                const scaleBoost =
                    pos.left < kbSize.width * 0.2 || pos.left > kbSize.width * 0.8
                        ? 1.25
                        : 1.0;

                setLastVowelAnchor({
                    base,
                    prefix,
                    position: pos,
                    scaleBoost,
                });

                setVowelPopup({
                    options: ordered,
                    position: pos,
                    scaleBoost,
                });
            } else {
                setVowelPopup(null);
                if (isFirstCharVowelRowKey) setV234VowelRowMode("hidden");
            }
        };

        try {
            const vowelRes = await axios.get(
                "http://localhost:5000/predict/vowel",
                {
                    params: { prefix, current: char },
                }
            );

            const corpusList = Array.isArray(vowelRes.data)
                ? (vowelRes.data as string[])
                : [];

            buildAndShowPopup(corpusList);
        } catch {
            // If backend fails, still allow typing by using dynamic diacritics only.
            buildAndShowPopup([]);
        }
    };

    // ---------- KEY ACTIVATION ----------
    const appendWithSinhalaCompose = (nextChar: string) => {
        let newText = typedText + nextChar;
        const lastTwo = newText.slice(-2);
        const composed = COMBINATION_MAP[lastTwo];
        if (composed) {
            newText = newText.slice(0, -2) + composed;
        }
        setTypedText(newText);
        emit(newText);
    };

    const chooseWijesekaraChar = (char: string) => {
        const secondary = layout.primarySecondaryMap?.[char];
        if (!secondary) return char;
        return dwellTime >= 2 * dwellMainMs ? secondary : char;
    };

    const handleKeyPress = async (char: string, e: React.MouseEvent, rowIdx?: number, colIdx?: number) => {
        const implicitResolveFirstVowel = !!(vowelPopup && v234VowelRowMode === "pendingPopup");
        if (implicitResolveFirstVowel) {
            setVowelPopup(null);
        }
        triggerKeyFlash(char);
        setTotalKeys((k) => k + 1);
        setLastAction({ type: "char" });
        const chosen =
            layout.id === "wijesekara" ? chooseWijesekaraChar(char) : char;
        appendWithSinhalaCompose(chosen);

        const words = (typedText + chosen).trim().split(" ");
        const lastPrefix = words[words.length - 1];

        await fetchWordPredictions(lastPrefix);

        const isV234FirstSetActiveNow =
            (layout.id === "eyespeak_v2" ||
                layout.id === "eyespeak_v3" ||
                layout.id === "eyespeak_v4") &&
            !isSecondStage &&
            !showNumbers &&
            !showPunctuation;

        const currentWordBefore = typedText.split(" ").pop() ?? "";
        const isFirstCharNow = isV234FirstSetActiveNow && currentWordBefore.length === 0;
        const isVowelRowKeyNow = isV234FirstSetActiveNow && rowIdx === getCurrentLayout().length - 1;

        if (layout.hasVowelPopup) {
            await fetchVowelPredictions(
                lastPrefix,
                chosen,
                e,
                undefined,
                isFirstCharNow && isVowelRowKeyNow
            );
        }

        if (implicitResolveFirstVowel) {
            setV234VowelRowMode("hidden");
        }
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
        setIsSecondStage(false); // reset to first stage after finishing word
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
        setV234VowelRowMode("hidden");
        emit(newText);
        const lastWord = newText.trim().split(" ").pop() || "";
        await fetchWordPredictions(lastWord);
    };

    // ---------- EYESPEAK V2: vowel-row hiding logic (restored) ----------
    const rows = getCurrentLayout();
    const columns = layout.columns ?? 6;

    // Active when we are on eyespeak_v2, v3, or v4 first set, and not in numbers/punctuation
    const isV234FirstSetActive =
        (layout.id === "eyespeak_v2" ||
            layout.id === "eyespeak_v3" ||
            layout.id === "eyespeak_v4") &&
        !isSecondStage &&
        !showNumbers &&
        !showPunctuation;

    // Hide the last row (vowel row) when the current word has at least one character
    const currentLastWord = typedText.split(" ").pop() ?? "";
    const shouldHideVowelRow = isV234FirstSetActive && currentLastWord.length > 0 && v234VowelRowMode === "hidden";

    // Resizable container: keep global footprint synced for all layouts
    useEffect(() => {
        if (evaluationMode) return;
        const el = resizeContainerRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;

        let isInitial = true; // prevents first shrink overwrite

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                const w = Math.round(width);
                const h = Math.round(height);

                if (w <= 0 || h <= 0) return;

                // Skip the first ResizeObserver call (initial mount)
                if (isInitial) {
                    isInitial = false;
                    return;
                }

                // Only update global size if user actually resized (change > 10px)
                if (
                    Math.abs(w - globalKeyboardSize.width) > 10 ||
                    Math.abs(h - globalKeyboardSize.height) > 10
                ) {
                    globalKeyboardSize = { width: w, height: h };
                    setKbSize(globalKeyboardSize);
                }
            }
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);


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
                    <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                        Suggestions will appear here…
                    </span>
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
                {/* Main keyboard (unchanged grid logic, including wijesekara last row centering) */}
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

                        // Eyespeak v2/v3/v4: remove *last row* (vowel row) of first-set AFTER first char typed in current word
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
                                        const secondaryChar =
                                            layout.id === "wijesekara"
                                                ? layout.primarySecondaryMap?.[char]
                                                : null;
                                        const isDual = !!secondaryChar;

                                        return (
                                            <button
                                                key={`key-${rowIdx}-${colIdx}`}
                                                onClick={(e) => handleKeyPress(char, e, rowIdx, colIdx)}
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
                                                    backgroundColor:
                                                        activeKey === char
                                                            ? "#b3e6ff"
                                                            : "#fdfdfd",
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

                        // --- Wijesekara LAST ROW: center 8 keys within a 10-col grid ---
                        if (layout.id === "wijesekara" && isLastRow) {
                            const totalColumns = 10; // other wijesekara rows have 10 columns
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
                                    {/* Left padding slots */}
                                    {Array.from({
                                        length: Math.floor(emptySlots / 2),
                                    }).map((_, i) => (
                                        <div key={`pad-left-${i}`} />
                                    ))}

                                    {/* Actual keys */}
                                    {row.map((char, colIdx) => {
                                        const secondaryChar =
                                            layout.id === "wijesekara"
                                                ? layout.primarySecondaryMap?.[char]
                                                : null;
                                        const isDual = !!secondaryChar;

                                        return (
                                            <button
                                                key={`key-${rowIdx}-${colIdx}`}
                                                onClick={(e) => handleKeyPress(char, e, rowIdx, colIdx)}
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
                                                    backgroundColor:
                                                        activeKey === char
                                                            ? "#b3e6ff"
                                                            : "#fdfdfd",
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

                                    {/* Right padding slots */}
                                    {Array.from({
                                        length:
                                            emptySlots -
                                            Math.floor(emptySlots / 2),
                                    }).map((_, i) => (
                                        <div key={`pad-right-${i}`} />
                                    ))}
                                </div>
                            );
                        }

                        // --- Default rendering for all other layouts (including Eyespeak v1/v2/v3/v4) ---
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
                                    const secondaryChar =
                                        layout.id === "wijesekara"
                                            ? layout.primarySecondaryMap?.[char]
                                            : null;
                                    const isDual = !!secondaryChar;

                                    return (
                                        <button
                                            key={`key-${rowIdx}-${colIdx}`}
                                            onClick={(e) => handleKeyPress(char, e)}
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
                                                backgroundColor:
                                                    activeKey === char
                                                        ? "#b3e6ff"
                                                        : "#fdfdfd",
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

                {/* Controls (unchanged behaviour, but now inside resized footprint) */}
                <div
                    style={{
                        display: "flex",
                        gap: 12,
                        flexWrap: "wrap",
                        marginTop: 4,
                    }}
                >
                    <button
                        onClick={() => {
                            triggerControlFlash("stageToggle");
                            setIsSecondStage((p) => !p);
                            setVowelPopup(null);
                            setTotalKeys((k) => k + 1);
                            setLastAction({ type: "char" });
                            emit(typedText);
                        }}
                        style={{
                            ...controlButtonStyle,
                            backgroundColor:
                                activeControl === "stageToggle"
                                    ? "#e1be4a"
                                    : controlButtonStyle.backgroundColor,
                        }}
                    >
                        {isSecondStage ? "⇠ First Set" : "⇢ Second Set"}
                    </button>

                    <button
                        onClick={() => {
                            triggerControlFlash("space");
                            const next = typedText + " ";
                            setTypedText(next);
                            setVowelPopup(null);
                            setTotalKeys((k) => k + 1);
                            setLastAction({ type: "char" });
                            setIsSecondStage(false); // reset to first stage after finishing word
                            setV234VowelRowMode("start");
                            emit(next);
                        }}
                        style={{
                            ...controlButtonStyle,
                            flex: 2,
                            backgroundColor:
                                activeControl === "space"
                                    ? "#e1be4a"
                                    : controlButtonStyle.backgroundColor,
                        }}
                    >
                        Space
                    </button>

                    <button
                        onClick={() => {
                            triggerControlFlash("delete");

                            // Smart delete / undo rules:
                            // 1) If last action was a popup diacritic selection -> undo whole combined grapheme and reopen popup once.
                            // 2) If last action was a predicted completion -> undo the whole inserted word.
                            // 3) Else -> normal delete (remove last typed character).
                            if (lastAction?.type === "prediction") {
                                const next = lastAction.prevText;
                                setTypedText(next);
                                setSuggestions([]);
                                setVowelPopup(null);
                                setLastAction(null);
                                setDeleteCount((d) => d + 1);
                                setTotalKeys((k) => k + 1);
                                emit(next);
                                return;
                            }

                            if (lastAction?.type === "popup") {
                                const next = lastAction.prevText;
                                setTypedText(next);
                                setSuggestions([]);
                                setVowelPopup(null);
                                setLastAction(null);

                                // Reopen the vowel popup immediately for correction (only once).
                                if (layout.hasVowelPopup) {
                                    const words = next.trim().split(" ");
                                    const lastPrefix = words.length ? words[words.length - 1] : "";
                                    fetchVowelPredictions(
                                        lastPrefix,
                                        lastAction.base,
                                        null,
                                        lastAction.position
                                    );
                                }

                                setDeleteCount((d) => d + 1);
                                setTotalKeys((k) => k + 1);
                                emit(next);
                                return;
                            }

                            const next = typedText.slice(0, -1);
                            setTypedText(next);
                            setSuggestions([]);
                            setVowelPopup(null);
                            setLastAction({ type: "char" });
                            setDeleteCount((d) => d + 1);
                            setTotalKeys((k) => k + 1);
                            emit(next);
                        }}
                        style={{
                            ...controlButtonStyle,
                            backgroundColor:
                                activeControl === "delete"
                                    ? "#ec8c76"
                                    : controlButtonStyle.backgroundColor,
                        }}
                    >
                        ⌫ Delete
                    </button>

                    <button
                        onClick={() => {
                            triggerControlFlash("bias");
                            setShowBias(true);
                        }}
                        style={{
                            ...controlButtonStyle,
                            backgroundColor:
                                activeControl === "bias"
                                    ? "#e1be4a"
                                    : controlButtonStyle.backgroundColor,
                        }}
                    >
                        Bias Adjust
                    </button>
                </div>
            </div>

            {/* Vowel popup (eyespeak only; wijesekara has hasVowelPopup = false) */}
            {layout.hasVowelPopup && vowelPopup && (
                <VowelPopup
                    key={vowelPopup.options[0]}
                    predictions={vowelPopup.options}
                    onSelect={handleVowelSelect}
                    onClose={() => {
                        setVowelPopup(null);
                        setV234VowelRowMode("hidden");
                    }}
                    position={vowelPopup.position}
                    keyboardWidth={kbSize.width}
                    scaleBoost={vowelPopup.scaleBoost}
                    onControlClick={(label) => {
                        if (label === "More") {
                            setVowelMoreClicks((m) => m + 1);
                            setTotalKeys((k) => k + 1);
                            emit(typedText);
                        } else {
                            // "Back"
                            setTotalKeys((k) => k + 1);
                            emit(typedText);
                        }
                    }}
                />
            )}

            {showBias && <BiasTuner onClose={() => setShowBias(false)} />}

            <GazeIndicator
                x={gaze.x}
                y={gaze.y}
                progress={progress}
                color={
                    layout.id === "wijesekara" && dwellTime >= 2 * dwellMainMs
                        ? "#ff7675"
                        : "#3b82f6"
                }
                layoutId={layout.id}
            />
        </div>
    );
}
