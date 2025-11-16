import React, { useState, useMemo } from "react";

interface VowelPopupProps {
    predictions: string[];
    onSelect: (value: string) => void;
    onClose: () => void;
    position: { top: number; left: number };
    onControlClick?: (label: "More" | "Back") => void; // optional metrics hook
}

/**
 * Vowel popup with:
 * - Unlimited stages (pages)
 * - Configurable number of diacritics per "full" stage (DIACRITICS_PER_STAGE)
 * - First stage: ONLY "More" (when there is a next page)
 * - Middle stages: both "Back" and "More"
 * - Last stage: ONLY "Back"
 * - First stage shows one more diacritic than the rest (e.g., 7 if default is 6)
 */
const VowelPopup: React.FC<VowelPopupProps> = ({
                                                   predictions,
                                                   onSelect,
                                                   onClose,
                                                   position,
                                                   onControlClick
                                               }) => {
    /**
     * Change this to control how many diacritics
     * appear in each "full" middle stage.
     *
     * Example: 6 means
     *  - First stage: 7 diacritics + "More"
     *  - Middle stages: 6 diacritics + "Back" + "More"
     *  - Last stage: ≤6 diacritics + "Back"
     */
    const DIACRITICS_PER_STAGE = 6;

    const [page, setPage] = useState<number>(0);

    const totalDiacritics = predictions.length;

    // Compute total number of pages based on total diacritics and stage size.
    const totalPages = useMemo(() => {
        if (totalDiacritics === 0) return 1;

        // If all diacritics fit in the first page (which can show DIACRITICS_PER_STAGE + 1),
        // then we only have one page and no More/Back buttons.
        if (totalDiacritics <= DIACRITICS_PER_STAGE + 1) {
            return 1;
        }

        // Otherwise:
        // - First page: DIACRITICS_PER_STAGE + 1 diacritics
        // - Remaining pages: DIACRITICS_PER_STAGE diacritics each (except possibly last)
        const remaining = totalDiacritics - (DIACRITICS_PER_STAGE + 1);
        return 1 + Math.ceil(remaining / DIACRITICS_PER_STAGE);
    }, [totalDiacritics, DIACRITICS_PER_STAGE]);

    const pageItems = useMemo(() => {
        if (totalDiacritics === 0) return [];

        // Only one page -> show everything
        if (totalPages === 1) {
            return predictions.slice(0, totalDiacritics);
        }

        if (page === 0) {
            // First page shows DIACRITICS_PER_STAGE + 1 diacritics
            return predictions.slice(0, DIACRITICS_PER_STAGE + 1);
        }

        // Middle/last pages:
        // offset after the first page
        const start = (DIACRITICS_PER_STAGE + 1) + (page - 1) * DIACRITICS_PER_STAGE;
        const end = start + DIACRITICS_PER_STAGE;
        return predictions.slice(start, end);
    }, [predictions, page, totalPages, totalDiacritics, DIACRITICS_PER_STAGE]);

    const controlLabels = useMemo((): ("More" | "Back")[] => {
        // If everything fits in one page, no controls.
        if (totalDiacritics === 0 || totalPages === 1) {
            return [];
        }

        if (page === 0) {
            // First stage: only "More"
            return ["More"];
        }

        if (page === totalPages - 1) {
            // Last stage: only "Back"
            return ["Back"];
        }

        // Middle stages: both "Back" and "More"
        return ["Back", "More"];
    }, [page, totalDiacritics, totalPages]);

    const radius = 200;
    const innerRadius = radius * 0.65;
    const buttonSize = 90;
    const fontSize = 26;

    const options = [...pageItems, ...controlLabels];
    const angleStep = (2 * Math.PI) / Math.max(options.length, 1);

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
            data-vowel-popup
            style={{
                position: "absolute",
                top: position.top - radius + buttonSize / 2,
                left: position.left - radius / 2,
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
