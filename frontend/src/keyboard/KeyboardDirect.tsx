import React, { useState } from "react";
import { useParams } from "react-router-dom";
import KeyboardLoader from "./KeyboardLoader";

export default function KeyboardDirect() {
    const { layoutId } = useParams();
    const [text, setText] = useState("");
    const [metrics, setMetrics] = useState<any>(null);

    if (!layoutId) {
        return <div style={{ padding: 20 }}>No layoutId provided.</div>;
    }

    return (
        <div style={{ padding: 20 }}>
            <h2>Keyboard Debug View — {layoutId}</h2>

            <KeyboardLoader
                layoutId={layoutId as any}
                dwellMainMs={600}
                dwellPopupMs={450}
                evaluationMode={false}
                keyboardSizePreset={"m"}
                onChange={(t, m) => {
                    setText(t);
                    setMetrics(m);
                }}
            />

            <div style={{ marginTop: 20 }}>
                <h3>Typed Text</h3>
                <div
                    style={{
                        background: "#f1f5f9",
                        padding: 12,
                        borderRadius: 8,
                        minHeight: 60,
                        fontSize: 20,
                    }}
                >
                    {text}
                </div>
            </div>

            {metrics && (
                <div style={{ marginTop: 20 }}>
                    <h4>Live Metrics</h4>
                    <pre>{JSON.stringify(metrics, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}
