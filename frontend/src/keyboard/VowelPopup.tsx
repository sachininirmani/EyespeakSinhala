// VowelPopup.tsx
import React, { useState, useMemo } from "react";
import { computeVowelPlacementsForPage } from "./VowelPlacement";

interface VowelPopupProps {
    predictions: string[];
    onSelect: (value: string) => void;
    onClose: () => void;
    position: { top: number; left: number };
    onControlClick?: (label: "More" | "Back") => void;
}

const VowelPopup: React.FC<VowelPopupProps> = ({
                                                   predictions,
                                                   onSelect,
                                                   onClose,
                                                   position,
                                                   onControlClick,
                                               }) => {
    const DIACRITICS_PER_STAGE = 6;

    const [page, setPage] = useState(0);
    const total = predictions.length;

    const totalPages = useMemo(() => {
        if (total === 0) return 1;
        return Math.ceil(total / DIACRITICS_PER_STAGE);
    }, [total]);

    const pageItems = useMemo(() => {
        if (total === 0) return [];
        const start = page * DIACRITICS_PER_STAGE;
        const end = start + DIACRITICS_PER_STAGE;
        return predictions.slice(start, end);
    }, [predictions, page]);

    const controlLabels = useMemo(() => {
        if (totalPages === 1) return [];
        const labels: ("More" | "Back")[] = [];
        if (page > 0) labels.push("Back");
        if (page < totalPages - 1) labels.push("More");
        return labels;
    }, [page, totalPages]);

    const radius = 200;
    const innerRadius = radius * 0.65;
    const btnSize = 90;

    const placements = useMemo(
        () => computeVowelPlacementsForPage(pageItems),
        [pageItems]
    );

    const handleClick = (option: string) => {
        if (option === "More") {
            onControlClick?.("More");
            setPage((p) => Math.min(p + 1, totalPages - 1));
            return;
        }
        if (option === "Back") {
            onControlClick?.("Back");
            setPage((p) => Math.max(p - 1, 0));
            return;
        }
        onSelect(option);
        onClose();
    };

    return (
        <div
            style={{
                position: "absolute",
                top: position.top - radius + btnSize / 2,
                left: position.left - radius / 2,
                width: radius * 2,
                height: radius * 2,
                borderRadius: "50%",
                background: "rgba(240,248,255,0.96)",
                boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
                border: "2px solid #bcd8ff",
                zIndex: 1000,
            }}
        >
            {/* Suggestions */}
            {placements.map(({ option, angle }) => {
                const x = radius + innerRadius * Math.cos(angle) - btnSize / 2;
                const y = radius + innerRadius * Math.sin(angle) - btnSize / 2;

                return (
                    <button
                        key={option}
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
                        }}
                    >
                        {option}
                    </button>
                );
            })}

            {/* CENTER CONTROLS */}
            {controlLabels.length > 0 && (
                <div
                    style={{
                        position: "absolute",
                        left: radius,
                        top: radius,
                        transform: "translate(-50%, -50%)",
                        display: "flex",
                        gap: 12,
                    }}
                >
                    {controlLabels.map((label) => (
                        <button
                            key={label}
                            onClick={() => handleClick(label)}
                            style={{
                                width: 90,
                                height: 90,
                                borderRadius: "50%",
                                backgroundColor: "#ffe08a",
                                border: "2px solid #888",
                                fontSize: 22,
                                fontWeight: 600,
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VowelPopup;
