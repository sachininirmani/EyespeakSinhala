import React, { useState, useRef } from "react";
import axios from "axios";
import VowelPopup from "./VowelPopup";
import { useGaze } from "../gaze/useGaze";
import { useDwell } from "../gaze/useDwell";
import GazeIndicator from "../gaze/GazeIndicator";
import BiasTuner from "../gaze/BiasTuner";

const firstStageLetters: string[][] = [
    ["ණ", "න", "ව", "ය", "ක", "ර"],
    ["ශ", "ම", "ත", "ල", "ස", "ද"],
    ["ච", "ප", "ට", "ග", "හ", "බ"],
    ["ජ", "අ", "ඉ", "උ", "එ", "ඒ"],
    ["ඩ", "ආ", "ඊ", "ඌ", "ඇ", "ඈ"]
];
const secondStageLetters: string[][] = [
    ["ඖ", "ථ", "භ", "ඝ", "ඛ", "ඡ"],
    ["ඓ", "ධ", "ඨ", "ඹ", "ඳ", "ඟ"],
    ["ෆ", "ළ", "ෂ", "ඵ", "ඥ", "ඓ"],
    ["ඃ", "ං", "ඤ", "ඬ", "ඣ", "ඪ"],
    ["ඍ", "ඎ", "ඏ", "ඐ", "ඞ", "ඖ"]
];
const numbers = [["1", "2", "3", "4", "5", "6"], ["7", "8", "9", "0", "(", ")"]];
const punctuation = [
    [".", ",", "!", "?", ":", ";"],
    ['"', "'", "’", "“", "”", "…"]
];

const controlButtonStyle: React.CSSProperties = {
    padding: "16px",
    fontSize: "22px",
    backgroundColor: "#fff5cc",
    border: "1px solid #ccc",
    borderRadius: 8,
    transition: "background-color 0.2s ease"
};
const TYPED_ROW_MIN_HEIGHT = 30;
const SUGGESTION_ROW_HEIGHT = 50;

export default function Keyboard({
                                     onChange,
                                     dwellMainMs,
                                     dwellPopupMs
                                 }: {
    onChange?: (text: string) => void;
    dwellMainMs: number;
    dwellPopupMs: number;
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

    const triggerKeyFlash = (key: string) => {
        setActiveKey(key);
        setTimeout(() => setActiveKey(null), 180);
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const gaze = useGaze("ws://127.0.0.1:7777");
    const { progress } = useDwell(gaze.x, gaze.y, {
        stabilizationMs: 120,
        stabilityRadiusPx: 90,
        dwellMs: dwellMainMs,
        dwellMsPopup: dwellPopupMs,
        refractoryMs: 200
    });

    const getCurrentLayout = () => {
        if (showNumbers) return numbers;
        if (showPunctuation) return punctuation;
        return isSecondStage ? secondStageLetters : firstStageLetters;
    };

    const fetchWordPredictions = async (prefix: string) => {
        try {
            const res = await axios.get("http://localhost:5000/predict/word", {
                params: { prefix }
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
                params: { prefix, current: char }
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
                        left: rect.left - containerRef.current.offsetLeft
                    }
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
        await fetchVowelPredictions(lastPrefix, char, e);
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

    return (
        <div
            ref={containerRef}
            style={{
                padding: "16px clamp(8px, 2vw, 24px)",
                position: "relative",
                width: "100%",
                maxWidth: "100%",
                margin: 0
            }}
        >
            <div
                style={{
                    marginBottom: 10,
                    fontSize: 18,
                    minHeight: TYPED_ROW_MIN_HEIGHT,
                    display: "flex",
                    alignItems: "center"
                }}
            >
                <strong>Typed Text:&nbsp;</strong> <span>{typedText}</span>
            </div>

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
                    overflowY: "hidden",
                    whiteSpace: "nowrap"
                }}
            >
                {suggestions.length === 0 ? (
                    <span style={{ color: "#94a3b8", fontStyle: "italic", paddingLeft: 6 }}>
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
                                borderRadius: 8
                            }}
                        >
                            {word}
                        </button>
                    ))
                )}
            </div>

            {/* Main keyboard grid */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(6, 1fr)",
                    gap: 10,
                    marginBottom: 16
                }}
            >
                {getCurrentLayout()
                    .flat()
                    .map((char, index) => (
                        <button
                            key={index}
                            onClick={(e) => handleClick(char, e)}
                            style={{
                                padding: "16px",
                                fontSize: "24px",
                                borderRadius: 8,
                                transition: "background-color 0.15s ease",
                                backgroundColor:
                                    activeKey === char ? "#b3e6ff" : "#fdfdfd",
                                border: "1px solid #ccc"
                            }}
                        >
                            {char}
                        </button>
                    ))}
            </div>

            {/* Control row */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                    onClick={() => {
                        triggerKeyFlash(isSecondStage ? "⇠ First Set" : "⇢ Second Set");
                        setIsSecondStage((p) => !p);
                        setVowelPopup(null);
                    }}
                    style={{
                        ...controlButtonStyle,
                        backgroundColor:
                            activeKey === "⇢ Second Set" || activeKey === "⇠ First Set"
                                ? "#ffe89c"
                                : controlButtonStyle.backgroundColor
                    }}
                >
                    {isSecondStage ? "⇠ First Set" : "⇢ Second Set"}
                </button>

                <button
                    onClick={() => {
                        triggerKeyFlash(showNumbers ? "Close Numbers" : "123");
                        setShowNumbers((p) => !p);
                        setVowelPopup(null);
                    }}
                    style={{
                        ...controlButtonStyle,
                        backgroundColor:
                            activeKey === "123" || activeKey === "Close Numbers"
                                ? "#ffe89c"
                                : controlButtonStyle.backgroundColor
                    }}
                >
                    {showNumbers ? "Close Numbers" : "123"}
                </button>

                <button
                    onClick={() => {
                        triggerKeyFlash(showPunctuation ? "Close Punctuation" : "Punctuations");
                        setShowPunctuation((p) => !p);
                        setVowelPopup(null);
                    }}
                    style={{
                        ...controlButtonStyle,
                        backgroundColor:
                            activeKey === "Punctuations" || activeKey === "Close Punctuation"
                                ? "#ffe89c"
                                : controlButtonStyle.backgroundColor
                    }}
                >
                    {showPunctuation ? "Close Punctuation" : "Punctuations"}
                </button>

                <button
                    onClick={() => {
                        triggerKeyFlash("Space");
                        setTypedText((prev) => prev + " ");
                        setVowelPopup(null);
                    }}
                    style={{
                        ...controlButtonStyle,
                        flex: 2,
                        backgroundColor:
                            activeKey === "Space" ? "#b3e6ff" : "#fff5cc"
                    }}
                >
                    Space
                </button>

                <button
                    onClick={() => {
                        triggerKeyFlash("⌫ Delete");
                        setTypedText((prev) => prev.slice(0, -1));
                        setVowelPopup(null);
                        onChange?.(typedText.slice(0, -1));
                    }}
                    style={{
                        ...controlButtonStyle,
                        backgroundColor:
                            activeKey === "⌫ Delete" ? "#ffb3b3" : "#fff5cc"
                    }}
                >
                    ⌫ Delete
                </button>

                <button onClick={() => setShowBias(true)} style={controlButtonStyle}>
                    Bias Adjust
                </button>
            </div>

            {vowelPopup && (
                <VowelPopup
                    predictions={vowelPopup.options}
                    onSelect={handleVowelSelect}
                    onClose={() => setVowelPopup(null)}
                    position={vowelPopup.position}
                />
            )}

            {showBias && <BiasTuner onClose={() => setShowBias(false)} />}

            <GazeIndicator x={gaze.x} y={gaze.y} progress={progress} />
        </div>
    );
}
