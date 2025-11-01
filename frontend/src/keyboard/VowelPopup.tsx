import React, { useState, useMemo } from "react";

interface VowelPopupProps {
    predictions: string[];
    onSelect: (value: string) => void;
    onClose: () => void;
    position: { top: number; left: number };
    onControlClick?: (label: "More" | "Back") => void; // NEW (optional)
}

const VowelPopup: React.FC<VowelPopupProps> = ({
                                                   predictions,
                                                   onSelect,
                                                   onClose,
                                                   position,
                                                   onControlClick
                                               }) => {
    const PAGE_SIZE = 5;
    const [page, setPage] = useState<0 | 1 | 2>(0);

    // Determine how many pages exist
    const hasSecondPage = predictions.length > PAGE_SIZE;
    const hasThirdPage = predictions.length > PAGE_SIZE * 2;

    const pageItems = useMemo(() => {
        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        return predictions.slice(start, end);
    }, [predictions, page]);

    const controlLabel = useMemo(() => {
        if (!hasSecondPage) return null;
        if (page === 0 && hasSecondPage) return "More";
        if (page === 1 && hasThirdPage) return "More";
        if (page > 0) return "Back";
        return null;
    }, [page, hasSecondPage, hasThirdPage]);

    const radius = 200;
    const innerRadius = radius * 0.65;
    const buttonSize = 90;
    const fontSize = 26;

    const options = controlLabel ? [...pageItems, controlLabel] : pageItems;
    const angleStep = (2 * Math.PI) / Math.max(options.length, 1);

    const handleClick = (option: string) => {
        if (option === "More") {
            onControlClick?.("More");         // NEW: notify parent for "More"
            if (page === 0 && hasSecondPage) setPage(1);
            else if (page === 1 && hasThirdPage) setPage(2);
            return;
        }
        if (option === "Back") {
            onControlClick?.("Back");         // optional: useful if you want to count Back
            if (page === 2) setPage(0);
            else setPage(0);
            return;
        }
        onSelect(option);
        onClose();
    };

    return (
        <div
            data-vowel-popup
            style={{
                position: "absolute",
                top: position.top - radius + buttonSize / 2,
                left: position.left - radius / 2 ,
                width: radius * 2,
                height: radius * 2,
                borderRadius: "50%",
                background: "rgba(240, 248, 255, 0.96)",
                boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
                border: "2px solid #bcd8ff",
                zIndex: 1000,
            }}
        >
            {options.map((option, i) => {
                const angle = angleStep * i - Math.PI / 2;
                const x = radius + innerRadius * Math.cos(angle) - buttonSize / 2;
                const y = radius + innerRadius * Math.sin(angle) - buttonSize / 2;
                const isControl = option === "More" || option === "Back";
                const bg = isControl ? "#ffe08a" : "#b3ffd9";
                return (
                    <button
                        key={`${option}-${i}`}
                        onClick={() => handleClick(option)}
                        style={{
                            position: "absolute",
                            left: x,
                            top: y,
                            width: buttonSize,
                            height: buttonSize,
                            borderRadius: "50%",
                            backgroundColor: bg,
                            border: "2px solid #888",
                            fontSize,
                            fontWeight: 600,
                            cursor: "pointer",
                            outline: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                        }}
                    >
                        {option}
                    </button>
                );
            })}
        </div>
    );
};

export default VowelPopup;
