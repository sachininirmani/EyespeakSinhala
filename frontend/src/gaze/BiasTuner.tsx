import React, { useEffect, useState } from "react";

export default function BiasTuner({ onClose }: { onClose?: () => void }) {
    const [bias, setBias] = useState(() => {
        try {
            const raw = localStorage.getItem("gazeBias");
            return raw ? JSON.parse(raw) : { horizontal: 0, vertical: 0 };
        } catch {
            return { horizontal: 0, vertical: 0 };
        }
    });

    useEffect(() => {
        localStorage.setItem("gazeBias", JSON.stringify(bias));
    }, [bias]);

    return (
        <div
            style={{
                position: "fixed",
                right: 16,
                bottom: 16,
                zIndex: 100000,
                background: "rgba(255,255,255,0.95)",
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 12,
                boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                width: 260
            }}
        >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Gaze Bias Adjust</div>
            <div style={{ marginBottom: 8 }}>
                <div>Horizontal Bias (px)</div>
                <input
                    type="range"
                    min={-200}
                    max={200}
                    value={bias.horizontal}
                    onChange={(e) =>
                        setBias({ ...bias, horizontal: parseInt(e.target.value, 10) })
                    }
                    style={{ width: "100%" }}
                />
                <div>{bias.horizontal} px — positive moves right</div>
            </div>
            <div style={{ marginBottom: 8 }}>
                <div>Vertical Bias (px)</div>
                <input
                    type="range"
                    min={-200}
                    max={200}
                    value={bias.vertical}
                    onChange={(e) =>
                        setBias({ ...bias, vertical: parseInt(e.target.value, 10) })
                    }
                    style={{ width: "100%" }}
                />
                <div>{bias.vertical} px — positive moves down</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button onClick={() => setBias({ horizontal: 0, vertical: 0 })}>
                    Reset
                </button>
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    );
}
