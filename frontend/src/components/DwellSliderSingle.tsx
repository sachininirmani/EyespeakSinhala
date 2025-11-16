// components/DwellSliderSingle.tsx
import React from "react";
import GazeDwellButton from "./GazeDwellButton";

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export default function DwellSliderSingle({
                                              value,
                                              setValue,
                                              min = 200,
                                              max = 1200,
                                              step = 50,
                                              label = "Main Dwell (ms)"
                                          }: {
    value: number;
    setValue: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
}) {
    const adjust = (delta: number) => {
        setValue(clamp(value + delta, min, max));
    };

    return (
        <div
            className="card"
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                alignItems: "center",
                padding: 16,
            }}
        >
            <div style={{ minWidth: 160 }}>
                <div className="label" style={{ marginBottom: 4 }}>
                    {label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{value} ms</div>
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => setValue(parseInt(e.target.value))}
                    style={{ width: "100%" }}
                />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
                <GazeDwellButton
                    onActivate={() => adjust(-step)}
                    dwellMs={850}
                    style={{
                        width: 52,
                        height: 52,
                        borderRadius: 999,
                        background: "#e2e8f0",
                        fontSize: 24,
                        fontWeight: 700,
                    }}
                >
                    −
                </GazeDwellButton>

                <GazeDwellButton
                    onActivate={() => adjust(+step)}
                    dwellMs={850}
                    style={{
                        width: 52,
                        height: 52,
                        borderRadius: 999,
                        background: "#0f766e",
                        color: "white",
                        fontSize: 24,
                        fontWeight: 700,
                    }}
                >
                    +
                </GazeDwellButton>
            </div>
        </div>
    );
}
