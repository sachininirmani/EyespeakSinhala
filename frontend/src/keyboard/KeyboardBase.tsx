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
    } | null>(null);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const [showBias, setShowBias] = useState(false);

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

    const getCurrentLayout = () => {
        if (showNumbers) return numbers;
        if (showPunctuation) return punctuation;
        return isSecondStage ? layout.secondStageLetters : layout.firstStageLetters;
    };

    const fetchWordPredictions = async (prefix: string) => {
        try {
            const res = await axios.get("http://localhost:5000/predict/word", {
                params: { prefix },
            });
            setSuggestions(res.data);
        } catch {}
    };

    const fetchVowelPredictions = async (
        prefix: string,
        char: string,
        e: React.MouseEvent
    ) => {
        try {
            const vowelRes = await axios.get("http://localhost:5000/predict/vowel", {
                params: { prefix, current: char },
            });
            if (
                Array.isArray(vowelRes.data) &&
                vowelRes.data.length > 0 &&
                containerRef.current
            ) {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setVowelPopup({
                    options: vowelRes.data,
                    position: {
                        top: rect.top - containerRef.current.offsetTop,
                        left: rect.left - containerRef.current.offsetLeft,
                    },
                });
            } else setVowelPopup(null);
        } catch {
            setVowelPopup(null);
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

    const handleKeyPress = async (char: string, e: React.MouseEvent) => {
        triggerKeyFlash(char);
        setTotalKeys((k) => k + 1);
        const chosen =
            layout.id === "wijesekara" ? chooseWijesekaraChar(char) : char;
        appendWithSinhalaCompose(chosen);

        const words = (typedText + chosen).trim().split(" ");
        const lastPrefix = words[words.length - 1];

        await fetchWordPredictions(lastPrefix);
        if (layout.hasVowelPopup) await fetchVowelPredictions(lastPrefix, chosen, e);
    };

    const handleSuggestionClick = (word: string) => {
        setTotalKeys((k) => k + 1);
        const parts = typedText.trim().split(" ");
        parts[parts.length - 1] = word;
        const newText = parts.join(" ") + " ";
        setTypedText(newText);
        setSuggestions([]);
        setVowelPopup(null);
        emit(newText);
    };

    const handleVowelSelect = async (vowelChunk: string) => {
        setVowelClicks((v) => v + 1);
        setTotalKeys((k) => k + 1);
        const newText = typedText.slice(0, -1) + vowelChunk;
        setTypedText(newText);
        setVowelPopup(null);
        emit(newText);
        const lastWord = newText.trim().split(" ").pop() || "";
        await fetchWordPredictions(lastWord);
    };

    // ---------- EYESPEAK V2: vowel-row hiding logic (restored) ----------
    const rows = getCurrentLayout();
    const columns = layout.columns ?? 6;

    // Active when we are on eyespeak_v2, first set, and not in numbers/punctuation
    const isV2FirstSetActive =
        layout.id === "eyespeak_v2" &&
        !isSecondStage &&
        !showNumbers &&
        !showPunctuation;

    // Hide the last row (vowel row) when the current word has at least one character
    const currentLastWord = (typedText.split(" ").pop() ?? "");
    const shouldHideVowelRow = isV2FirstSetActive && currentLastWord.length > 0;

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
                    padding: "6px 4px",
                    background: "#f8fbff",
                    border: "1px solid #e1ecff",
                    borderRadius: 10,
                    overflowX: "auto",
                    whiteSpace: "nowrap",
                }}
            >
                {suggestions.length === 0 ? (
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

            {/* Main keyboard: per-row rendering so we can handle both rules:
          - Wijesekara last row centering
          - Eyespeak v2 last row hiding (first set only, after first char) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {rows.map((row, rowIdx) => {
                    const isLastRow = rowIdx === rows.length - 1;

                    // --- Wijesekara LAST ROW: center 8 keys within a 10-col grid (same widths as other rows) ---
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
                                }}
                            >
                                {/* Left padding slots */}
                                {Array.from({ length: Math.floor(emptySlots / 2) }).map((_, i) => (
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
                                            onClick={(e) => handleKeyPress(char, e)}
                                            style={{
                                                position: "relative",
                                                padding: "16px",
                                                fontSize: "26px",
                                                borderRadius: 8,
                                                transition: "all 0.15s ease",
                                                backgroundColor:
                                                    activeKey === char ? "#b3e6ff" : "#fdfdfd",
                                                border: "1px solid #ccc",
                                                width: "100%",
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
                                    length: emptySlots - Math.floor(emptySlots / 2),
                                }).map((_, i) => (
                                    <div key={`pad-right-${i}`} />
                                ))}
                            </div>
                        );
                    }

                    // --- Default rendering for all other layouts (including Eyespeak v1/v2) ---
                    return (
                        <div
                            key={`row-${rowIdx}`}
                            style={{
                                display: "grid",
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

                                // Eyespeak v2: hide *last row* of first-set vowel row AFTER first char typed in current word
                                const hideThisKey = shouldHideVowelRow && isLastRow;

                                return (
                                    <button
                                        key={`key-${rowIdx}-${colIdx}`}
                                        onClick={(e) => handleKeyPress(char, e)}
                                        style={{
                                            position: "relative",
                                            padding: "16px",
                                            fontSize: "26px",
                                            borderRadius: 8,
                                            transition: "all 0.15s ease",
                                            backgroundColor:
                                                activeKey === char ? "#b3e6ff" : "#fdfdfd",
                                            border: "1px solid #ccc",
                                            // Keep row height/width the same while hiding the key
                                            visibility: hideThisKey ? "hidden" : "visible",
                                            pointerEvents: hideThisKey ? "none" : "auto",
                                        }}
                                        aria-hidden={hideThisKey}
                                        tabIndex={hideThisKey ? -1 : 0}
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

            {/* Controls (unchanged) */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                    onClick={() => {
                        triggerKeyFlash(isSecondStage ? "⇠ First Set" : "⇢ Second Set");
                        setIsSecondStage((p) => !p);
                        setVowelPopup(null);
                        setTotalKeys((k) => k + 1);
                        emit(typedText);
                    }}
                    style={controlButtonStyle}
                >
                    {isSecondStage ? "⇠ First Set" : "⇢ Second Set"}
                </button>

                <button
                    onClick={() => {
                        triggerKeyFlash("Space");
                        const next = typedText + " ";
                        setTypedText(next);
                        setVowelPopup(null);
                        setTotalKeys((k) => k + 1);
                        emit(next);
                    }}
                    style={{ ...controlButtonStyle, flex: 2 }}
                >
                    Space
                </button>

                <button
                    onClick={() => {
                        triggerKeyFlash("⌫ Delete");
                        const next = typedText.slice(0, -1);
                        setTypedText(next);
                        setVowelPopup(null);
                        setDeleteCount((d) => d + 1);
                        setTotalKeys((k) => k + 1);
                        emit(next);
                    }}
                    style={controlButtonStyle}
                >
                    ⌫ Delete
                </button>

                <button onClick={() => setShowBias(true)} style={controlButtonStyle}>
                    Bias Adjust
                </button>
            </div>

            {/* Vowel popup */}
            {layout.hasVowelPopup && vowelPopup && (
                <VowelPopup
                    predictions={vowelPopup.options}
                    onSelect={handleVowelSelect}
                    onClose={() => setVowelPopup(null)}
                    position={vowelPopup.position}
                    onControlClick={(label) => {
                        if (label === "More") {
                            setVowelMoreClicks((m) => m + 1);
                            setTotalKeys((k) => k + 1);
                            emit(typedText);
                        } else {
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
