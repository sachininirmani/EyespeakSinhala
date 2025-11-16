import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
    CSSProperties,
} from "react";
import { useGaze } from "../gaze/useGaze";

const items = [
    "මම මෙම පද්ධතිය නිතර භාවිතා කිරීමට කැමතියි.",
    "මෙම පද්ධතිය අවශ්‍ය නොවන ලෙස සංකීර්ණ බවක් දක්වයි.",
    "මෙම පද්ධතිය භාවිතා කිරීමට ඉතා පහසුය.",
    "මෙම පද්ධතිය භාවිතා කිරීමට තවත් කෙනෙකුගේ සහය අවශ්‍ය බව මට හැඟෙයි.",
    "මෙම පද්ධතියේ විවිධ කාර්යයන් හොඳින් ඒකාබද්ධ කර ඇත.",
    "මෙම පද්ධතියේ ක්‍රියාකාරීත්වයන් අතර විරෝධාත්මකතා තිබේ.",
    "බොහෝ අය මෙම පද්ධතිය ඉක්මනින් ඉගෙන ගනු ඇත.",
    "මෙම පද්ධතිය භාවිතා කිරීම අසීරුය.",
    "මෙම පද්ධතිය භාවිතා කිරීමේදී මට විශ්වාසයක් ඇතිවේ.",
    "මෙම පද්ධතිය භාවිතා කිරීමට පෙර මට ඉතා වැඩි පුහුණුවක් අවශ්‍ය වේ."
];

/* ---------------------
   Dwell-based target
---------------------- */
function GazeDwellTarget({
                             onActivate,
                             dwellMs = 800,
                             children,
                             style,
                             className,
                         }: {
    onActivate: () => void;
    dwellMs?: number;
    children: React.ReactNode;
    style?: CSSProperties;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const gaze = useGaze();
    const [progress, setProgress] = useState(0);
    const [center, setCenter] = useState<{ x: number; y: number } | null>(null);

    const startTimeRef = useRef<number | null>(null);
    const triggeredRef = useRef(false);

    const handleDwell = useCallback(() => {
        onActivate();
    }, [onActivate]);

    useEffect(() => {
        const x = gaze?.x;
        const y = gaze?.y;

        if (!ref.current || x == null || y == null) {
            setProgress(0);
            startTimeRef.current = null;
            triggeredRef.current = false;
            setCenter(null);
            return;
        }

        const rect = ref.current.getBoundingClientRect();
        const padding = 14;

        const inside =
            x >= rect.left - padding &&
            x <= rect.right + padding &&
            y >= rect.top - padding &&
            y <= rect.bottom + padding;

        const now = performance.now();

        if (inside) {
            if (!startTimeRef.current) {
                startTimeRef.current = now;
                triggeredRef.current = false;
                setCenter({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                });
            }
            const elapsed = now - startTimeRef.current;
            const p = Math.max(0, Math.min(1, elapsed / dwellMs));
            setProgress(p);

            if (!triggeredRef.current && elapsed >= dwellMs) {
                triggeredRef.current = true;
                handleDwell();
            }
        } else {
            startTimeRef.current = null;
            triggeredRef.current = false;
            setProgress(0);
            setCenter(null);
        }
    }, [gaze.x, gaze.y, dwellMs, handleDwell]);

    const handleClick = () => {
        handleDwell();
    };

    return (
        <>
            <div
                ref={ref}
                className={className}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    userSelect: "none",
                    ...style,
                }}
                onClick={handleClick}
            >
                {children}
            </div>

            {center && progress > 0 && progress < 1 && (
                <div
                    style={{
                        position: "fixed",
                        left: center.x - 26,
                        top: center.y - 26,
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        background: `conic-gradient(rgba(56,189,248,0.95) ${progress * 360
                        }deg, rgba(15,23,42,0.15) 0deg)`,
                        border: "4px solid rgba(248,250,252,0.95)",
                        boxShadow: "0 0 10px rgba(15,23,42,0.4)",
                        pointerEvents: "none",
                        zIndex: 99999,
                    }}
                />
            )}
        </>
    );
}

/* ---------------------
   Score Chip
---------------------- */
function ScaleChip({
                       label,
                       selected,
                       onSelect,
                   }: {
    label: number;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <GazeDwellTarget
            onActivate={onSelect}
            dwellMs={800}
            style={{
                minWidth: 44,
                minHeight: 44,
                borderRadius: 999,
                border: selected ? "2px solid #0f766e" : "1px solid #cbd5e1",
                backgroundColor: selected ? "#0f766e" : "#ffffff",
                color: selected ? "#f9fafb" : "#0f172a",
                fontWeight: 600,
                fontSize: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px 10px",
                boxShadow: selected
                    ? "0 0 0 2px rgba(15,118,110,0.25)"
                    : "0 1px 2px rgba(15,23,42,0.04)",
            }}
        >
            {label}
        </GazeDwellTarget>
    );
}

export default function SUSForm({
                                    onSubmit,
                                }: {
    onSubmit: (values: number[]) => void;
}) {
    const [vals, setVals] = useState<number[]>(Array(10).fill(3));

    /* ---------------------
        Smooth Auto-scroll
    ---------------------- */
    function autoScrollDown() {
        const container = document.getElementById("eval-scroll-container");
        if (!container) return;

        const SCROLL_CM = 180; // ~3cm
        container.scrollBy({
            top: SCROLL_CM,
            behavior: "smooth",
        });
    }


    const handleSetVal = (idx: number, value: number) => {
        setVals((prev) => {
            const next = [...prev];
            next[idx] = value;

            if (idx === 2) autoScrollDown();
            if (idx === 4) autoScrollDown();
            if (idx === 6) autoScrollDown();
            if (idx === 8) autoScrollDown();

            return next;
        });
    };

    const handleSubmit = () => {
        onSubmit(vals);
    };

    return (
        <div
            className="card"
            style={{
                maxWidth: 900,
                width: "100%",
                marginTop: 12,
                padding: 20,
            }}
        >
            <div className="label">SUS (1-5)</div>
            <h3 style={{ marginBottom: 8, textAlign: "center" }}>
                පද්ධතිය භාවිතා කිරීමේ අත්දැකීම (System Usability Scale)
            </h3>
            <p
                style={{
                    textAlign: "center",
                    marginBottom: 12,
                    color: "#475569",
                    fontSize: 14,
                    lineHeight: 1.5,
                }}
            >
                කරුණාකර සෑම ප්‍රශ්නයකටම ඔබේ අදහස{" "}
                <strong>1</strong> සිට <strong>5</strong> දක්වා තෝරන්න.
                <br />
                <strong>1 = එකග නොවෙමි</strong> – <strong>5 = එකග වෙමි</strong>
            </p>

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    margin: "8px 0 16px",
                    fontSize: 13,
                    color: "#64748b",
                }}
            >
                <span>1 – එකග නොවෙමි</span>
                <span>3 – මැද</span>
                <span>5 – එකග වෙමි</span>
            </div>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                }}
            >
                {items.map((q, i) => (
                    <div
                        key={i}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            padding: 10,
                            borderRadius: 10,
                            backgroundColor: i % 2 === 0 ? "#f8fafc" : "#f1f5f9",
                        }}
                    >
                        <div
                            style={{
                                fontSize: 14,
                                color: "#0f172a",
                            }}
                        >
                            <span style={{ fontWeight: 600, marginRight: 4 }}>{i + 1}.</span>
                            {q}
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: 8,
                                justifyContent: "flex-end",
                                alignItems: "center",
                                flexWrap: "wrap",
                            }}
                        >
                            {[1, 2, 3, 4, 5].map((v) => (
                                <ScaleChip
                                    key={v}
                                    label={v}
                                    selected={vals[i] === v}
                                    onSelect={() => handleSetVal(i, v)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Submit button */}
            <div
                style={{
                    marginTop: 20,
                    display: "flex",
                    justifyContent: "center",
                }}
            >
                <GazeDwellTarget
                    onActivate={handleSubmit}
                    dwellMs={900}
                    style={{
                        borderRadius: 999,
                        padding: "14px 40px",
                        backgroundColor: "#2563eb",
                        color: "#f9fafb",
                        fontSize: 16,
                        fontWeight: 600,
                        boxShadow: "0 4px 12px rgba(37,99,235,0.35)",
                    }}
                >
                    SUS පත්‍රය ඉදිරිපත් කරන්න / Submit SUS
                </GazeDwellTarget>
            </div>
        </div>
    );
}
