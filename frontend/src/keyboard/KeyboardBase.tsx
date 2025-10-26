import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import VowelPopup from "./VowelPopup";
import { useGaze } from "../gaze/useGaze";
import { useDwell } from "../gaze/useDwell";
import GazeIndicator from "../gaze/GazeIndicator";
import BiasTuner from "../gaze/BiasTuner";

const numbers = [
    ["1", "2", "3", "4", "5", "6"],
    ["7", "8", "9", "0", "(", ")"],
];
const punctuation = [
    [".", ",", "!", "?", ":", ";"],
    ['"', "'", "’", "“", "”", "…"],
];

const controlButtonStyle: React.CSSProperties = {
    padding: "16px",
    fontSize: "22px",
    backgroundColor: "#fff5cc",
    border: "1px solid #ccc",
    borderRadius: 8,
    transition: "background-color 0.2s ease",
};

const TYPED_ROW_MIN_HEIGHT = 30;
const SUGGESTION_ROW_HEIGHT = 50;

export default function KeyboardBase({
                                         layout,
                                         dwellMainMs,
                                         dwellPopupMs,
                                         onChange,
                                     }: {
    layout: {
        columns: number;
        id: string;
        label: string;
        hasVowelPopup: boolean;
        firstStageLetters: string[][];
        secondStageLetters: string[][];
        primarySecondaryMap?: Record<string, string>;
    };
    dwellMainMs: number;
    dwellPopupMs: number;
    onChange?: (text: string) => void;
}) {
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

    const containerRef = useRef<HTMLDivElement>(null);
    const [gaze, setGaze] = useState({ x: window.innerWidth / 2, y: 80 }); // safe start
    const gazeData = useGaze("ws://127.0.0.1:7777");

    useEffect(() => {
        if (gazeData?.x && gazeData?.y) setGaze(gazeData);
    }, [gazeData]);

    const { progress } = useDwell(gaze.x, gaze.y, {
        stabilizationMs: 120,
        stabilityRadiusPx: 90,
        dwellMs: dwellMainMs,
        dwellMsPopup: dwellPopupMs,
        refractoryMs: 200,
    });

    // pseudo dwell time derived from progress (0–1)
    const dwellTime = dwellMainMs * progress;

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

    const handleClick = async (char: string, e: React.MouseEvent) => {
        triggerKeyFlash(char);
        const updatedText = typedText + char;
        setTypedText(updatedText);
        onChange?.(updatedText);

        const words = updatedText.trim().split(" ");
        const lastPrefix = words[words.length - 1];

        await fetchWordPredictions(lastPrefix);
        if (layout.hasVowelPopup) await fetchVowelPredictions(lastPrefix, char, e);
    };

    const handleSuggestionClick = (word: string) => {
        const parts = typedText.trim().split(" ");
        parts[parts.length - 1] = word;
        const newText = parts.join(" ") + " ";
        setTypedText(newText);
        onChange?.(newText);
        setSuggestions([]);
        setVowelPopup(null);
    };

    const handleVowelSelect = async (vowelChunk: string) => {
        const newText = typedText.slice(0, -1) + vowelChunk;
        setTypedText(newText);
        onChange?.(newText);
        setVowelPopup(null);
        const lastWord = newText.trim().split(" ").pop() || "";
        await fetchWordPredictions(lastWord);
    };

    // ---- v2-only optimization: hide FIRST-SET last row (vowels) after first char in a word ----
    const rows = getCurrentLayout(); // matrix (rows x cols)
    const columns = layout.columns ?? 6;

    // Only apply when:
    // - layout is eyespeak_v2
    // - we are on the first set (not second, not numbers, not punctuation)
    const isV2FirstSetActive =
        layout.id === "eyespeak_v2" &&
        !isSecondStage &&
        !showNumbers &&
        !showPunctuation;

    const lastWord = (typedText.split(" ").pop() ?? "");
    const wordHasAtLeastOneChar = lastWord.length > 0;

    // Hide when already typed >= 1 character in current word
    const shouldHideVowelRow = isV2FirstSetActive && wordHasAtLeastOneChar;

    // Compute last row boundaries in the flattened mapping to tag those keys
    const lastRowIndex = Math.max(rows.length - 1, 0);
    const flat = rows.flat();
    // Determine how many keys are in rows before last to find start index of last row
    const lastRowStartIndex = rows
        .slice(0, lastRowIndex)
        .reduce((acc, r) => acc + r.length, 0);
    const lastRowEndIndexExclusive = lastRowStartIndex + (rows[lastRowIndex]?.length ?? 0);

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

            {/* suggestion bar */}
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

            {/* main grid */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: 10,
                    marginBottom: 16,
                }}
            >
                {flat.map((char, index) => {
                    const secondaryChar =
                        layout.id === "wijesekara"
                            ? layout.primarySecondaryMap?.[char]
                            : null;
                    const isDual = !!secondaryChar;
                    const isExtended =
                        layout.id === "wijesekara" &&
                        isDual &&
                        dwellTime > dwellMainMs * 1.5 &&
                        activeKey === char;

                    // replace last typed primary with secondary during long dwell
                    useEffect(() => {
                        if (isExtended && isDual) {
                            setTypedText((prev) => {
                                if (prev.endsWith(char)) {
                                    const updated = prev.slice(0, -1) + secondaryChar;
                                    onChange?.(updated);
                                    return updated;
                                }
                                return prev;
                            });
                        }
                    }, [isExtended]);

                    // Determine if this key belongs to the FIRST-SET last row (vowel row)
                    const isKeyInFirstSetLastRow =
                        index >= lastRowStartIndex && index < lastRowEndIndexExclusive;

                    // Hide condition: only for v2 first set + vowel row after first char entered
                    const hideThisKey = shouldHideVowelRow && isKeyInFirstSetLastRow;

                    return (
                        <button
                            key={index}
                            onClick={(e) => handleClick(char, e)}
                            style={{
                                position: "relative",
                                padding: "16px",
                                fontSize: isExtended && isDual ? "20px" : "26px",
                                borderRadius: 8,
                                transition: "all 0.15s ease",
                                backgroundColor:
                                    activeKey === char
                                        ? isExtended
                                            ? "#ffd6d6"
                                            : "#b3e6ff"
                                        : "#fdfdfd",
                                border: "1px solid #ccc",
                                // Keep the grid row height constant while "hiding"
                                visibility: hideThisKey ? "hidden" : "visible",
                                pointerEvents: hideThisKey ? "none" : "auto",
                            }}
                            aria-hidden={hideThisKey}
                            tabIndex={hideThisKey ? -1 : 0}
                        >
              <span
                  style={{
                      fontSize: isExtended && isDual ? "20px" : "30px",
                      opacity: isExtended && isDual ? 0.5 : 1,
                  }}
              >
                {char}
              </span>

                            {isDual && (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: 4,
                                        right: 6,
                                        fontSize: isExtended ? "28px" : "16px",
                                        fontWeight: isExtended ? 600 : 400,
                                        color: isExtended ? "#111" : "#555",
                                        opacity: isExtended ? 1 : 0.8,
                                        transition: "all 0.1s ease",
                                    }}
                                >
                  {secondaryChar}
                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* controls */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                    onClick={() => {
                        triggerKeyFlash(isSecondStage ? "⇠ First Set" : "⇢ Second Set");
                        setIsSecondStage((p) => !p);
                        setVowelPopup(null);
                    }}
                    style={controlButtonStyle}
                >
                    {isSecondStage ? "⇠ First Set" : "⇢ Second Set"}
                </button>
                <button
                    onClick={() => {
                        triggerKeyFlash("Space");
                        setTypedText((prev) => prev + " ");
                        onChange?.((typedText + " "));
                        setVowelPopup(null);
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
                        onChange?.(next);
                        setVowelPopup(null);
                    }}
                    style={controlButtonStyle}
                >
                    ⌫ Delete
                </button>
                <button onClick={() => setShowBias(true)} style={controlButtonStyle}>
                    Bias Adjust
                </button>
            </div>

            {layout.hasVowelPopup && vowelPopup && (
                <VowelPopup
                    predictions={vowelPopup.options}
                    onSelect={handleVowelSelect}
                    onClose={() => setVowelPopup(null)}
                    position={vowelPopup.position}
                />
            )}

            {showBias && <BiasTuner onClose={() => setShowBias(false)} />}

            <GazeIndicator
                x={gaze.x}
                y={gaze.y}
                progress={progress}
                color={
                    layout.id === "wijesekara" && dwellTime > dwellMainMs * 1.5
                        ? "#ff7675"
                        : "#3b82f6"
                }
                layoutId={layout.id}
            />
        </div>
    );
}
