// VowelPopup.tsx
import React, { useState, useMemo } from "react";
import { computeVowelPlacementsForPage } from "./VowelPlacement";

interface VowelPopupProps {
    predictions: string[];
    onSelect: (value: string) => void;
    onClose: () => void;
    position: { top: number; left: number };
    onControlClick?: (label: "More" | "Back" | "Close") => void;
    keyboardWidth: number;
    scaleBoost?: number;
    lockedGestureId?: string | null;
}

const VowelPopup: React.FC<VowelPopupProps> = ({
                                                   predictions,
                                                   onSelect,
                                                   onClose,
                                                   position,
                                                   onControlClick,
                                                   keyboardWidth,
                                                   scaleBoost = 1.0,
                                                   lockedGestureId = null
                                               }) => {
    const DIACRITICS_PER_STAGE = 6;

    const [page, setPage] = useState(0);
    const total = predictions.length;

    const [cooldown, setCooldown] = useState(false);

    const totalPages = useMemo(() => {
        if (total === 0) return 1;
        return Math.ceil(total / DIACRITICS_PER_STAGE);
    }, [total]);

    const pageItems = useMemo(() => {
        if (total === 0) return [];
        const start = page * DIACRITICS_PER_STAGE;
        return predictions.slice(start, start + DIACRITICS_PER_STAGE);
    }, [predictions, page]);

    const baseRadius = 110;
    const scale = Math.max(1.2, Math.min((keyboardWidth / 1000) * scaleBoost, 2.3));
    const radius = baseRadius * scale;

    const innerRadius = radius * 0.65;
    const btnSize = 60 * scale;

    const placements = useMemo(
        () => computeVowelPlacementsForPage(pageItems),
        [pageItems]
    );

    /* ----------------------------------------------------------
     *  HANDLE CLICK
     * ---------------------------------------------------------- */
    const handleClick = (option: string) => {
        if ((option === "More" || option === "Back") && cooldown) return;

        if (option === "More") {
            onControlClick?.("More");
            setPage((p) => Math.min(p + 1, totalPages - 1));

            setCooldown(true);
            setTimeout(() => setCooldown(false), 400);
            return;
        }

        if (option === "Back") {
            onControlClick?.("Back");
            setPage((p) => Math.max(p - 1, 0));

            setCooldown(true);
            setTimeout(() => setCooldown(false), 400);
            return;
        }

        if (option === "Close") {
            onControlClick?.("Close");
            onClose();
            return;
        }

        onSelect(option);
        onClose();
    };

    /* POSITIONING */
    const viewportWidth =
        typeof window !== "undefined" ? window.innerWidth : 1920;

    let leftPos = position.left - radius / 2;
    let topPos = position.top - radius + btnSize / 2;

    if (leftPos < 20) leftPos = 20;
    if (leftPos + radius * 2 > viewportWidth - 20) {
        leftPos = viewportWidth - radius * 2 - 20;
    }

    /* CONTROL BUTTON LOGIC */
    const showBack = page > 0;
    const showMore = page < totalPages - 1;

    // NEW: showClose if on first page
    const showClose = page === 0;

    const halfButtonSize = (btnSize / 2) + 20;
    const gap = 7;

    const activeColor = "#ffe08a";
    const cooldownColor = "#ffd2d2";

    const currentColor = cooldown ? cooldownColor : activeColor;

    const lockedRingStyle: React.CSSProperties = {
        boxShadow: "0 0 0 4px rgba(59,130,246,0.75), 0 10px 24px rgba(0,0,0,0.18)",
        borderColor: "#2563eb",
        transform: "scale(1.06)",
    };

    const isLocked = (id: string) => lockedGestureId === id;


    return (
        <div
            style={{
                position: "absolute",
                top: topPos,
                left: leftPos,
                width: radius * 2,
                height: radius * 2,
                borderRadius: "50%",
                background: "rgba(240,248,255,0.96)",
                boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
                border: "2px solid #bcd8ff",
                zIndex: 1000,
            }}
        >
            {/* SUGGESTION BUTTONS */}
            {placements.map(({ option, angle }) => {
                const x = radius + innerRadius * Math.cos(angle) - btnSize / 2;
                const y = radius + innerRadius * Math.sin(angle) - btnSize / 2;

                return (
                    <button
                        key={option}
                        data-gesture-id={`vowel:${option}`}
                        onClick={() => handleClick(option)}
                        style={{
                            position: "absolute",
                            left: x,
                            top: y,
                            width: btnSize,
                            height: btnSize,
                            borderRadius: "50%",
                            backgroundColor: "#b3ffd9",
                            border: "2px solid #888",
                            fontSize: 26,
                            fontWeight: 600,
                            ...(isLocked(`vowel:${option}`) ? lockedRingStyle : null),
                        }}
                    >
                        {option}
                    </button>
                );
            })}

            {/* SEMICIRCLE CENTER CONTROLS */}
            <div
                style={{
                    position: "absolute",
                    left: radius,
                    top: radius,
                    transform: "translate(-50%, -50%)",
                    width: halfButtonSize * 2 + gap,
                    height: halfButtonSize,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                {/* LEFT HALF — NEW CLOSE BUTTON ON PAGE 0 */}
                {showClose && (
                    <div
                        data-gesture-id="vowel:Close"
                        onClick={() => handleClick("Close")}
                        style={{
                            width: halfButtonSize,
                            height: halfButtonSize,
                            borderTopLeftRadius: halfButtonSize,
                            borderBottomLeftRadius: halfButtonSize,
                            background: "#ffd0d0",
                            border: "2px solid #888",
                            marginRight: gap,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontSize: 28,
                            fontWeight: 700,
                            cursor: "pointer",
                            ...(isLocked("vowel:Close") ? lockedRingStyle : null),
                        }}
                    >
                        ×
                    </div>
                )}

                {/* LEFT HALF — BACK (only when page > 0) */}
                {showBack && (
                    <div
                        data-gesture-id="vowel:Back"
                        onClick={() => handleClick("Back")}
                        style={{
                            width: halfButtonSize,
                            height: halfButtonSize,
                            borderTopLeftRadius: halfButtonSize,
                            borderBottomLeftRadius: halfButtonSize,
                            background: currentColor,
                            border: "2px solid #888",
                            marginRight: gap,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontSize: 22,
                            fontWeight: 600,
                            cursor: cooldown ? "not-allowed" : "pointer",
                            transition: "background 0.35s ease",
                            ...(isLocked("vowel:Back") ? lockedRingStyle : null),
                        }}
                    >
                        Back
                    </div>
                )}

                {/* RIGHT HALF — MORE (unchanged) */}
                {showMore && (
                    <div
                        data-gesture-id="vowel:More"
                        onClick={() => handleClick("More")}
                        style={{
                            width: halfButtonSize,
                            height: halfButtonSize,
                            borderTopRightRadius: halfButtonSize,
                            borderBottomRightRadius: halfButtonSize,
                            background: currentColor,
                            border: "2px solid #888",
                            marginLeft: showBack || showClose ? 0 : gap,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontSize: 22,
                            fontWeight: 600,
                            cursor: cooldown ? "not-allowed" : "pointer",
                            transition: "background 0.35s ease",
                            ...(isLocked("vowel:More") ? lockedRingStyle : null),
                        }}
                    >
                        More
                    </div>
                )}
            </div>
        </div>
    );
};

export default VowelPopup;
