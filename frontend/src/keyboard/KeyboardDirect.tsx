import React, { useState } from "react";
import { useParams } from "react-router-dom";
import KeyboardLoader from "./KeyboardLoader";
import type { InteractionId } from "../interaction/types";

export default function KeyboardDirect() {
    const { layoutId } = useParams();
    const [text, setText] = useState("");
    const [metrics, setMetrics] = useState<any>(null);

    // Optional: debug view can be forced via URL query params
    //   ?interaction=dwell_free_c
    //   ?interaction=hybrid_c
    // Defaults to dwell (preserves existing behavior).
    const search = new URLSearchParams(window.location.search);
    const interaction = (search.get("interaction") as InteractionId | null) ?? "dwell";

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
                interactionMode={interaction}
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