import React from "react";
import KeyboardBase from "./KeyboardBase";
import { ALL_KEYBOARDS, LayoutId } from "./index";

/**
 * Randomize keyboard order for each session or participant
 * to avoid familiarity bias.
 */
export function getRandomizedLayouts(): LayoutId[] {
    const layouts = [...ALL_KEYBOARDS.map((k) => k.id)];
    for (let i = layouts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [layouts[i], layouts[j]] = [layouts[j], layouts[i]];
    }
    return layouts;
}

/**
 * Dynamically loads and renders the correct keyboard layout.
 * Supports any layout registered in `ALL_KEYBOARDS`.
 */
export default function KeyboardLoader({
                                           layoutId,
                                           dwellMainMs,
                                           dwellPopupMs,
                                           onChange
                                       }: {
    layoutId: LayoutId;
    dwellMainMs: number;
    dwellPopupMs: number;
    onChange: (text: string) => void;
}) {
    const layout = ALL_KEYBOARDS.find((l) => l.id === layoutId);

    if (!layout) {
        return (
            <div
                style={{
                    color: "red",
                    fontSize: 18,
                    marginTop: 20,
                    textAlign: "center"
                }}
            >
                ⚠️ Layout not found: {layoutId}
            </div>
        );
    }

    return (
        <KeyboardBase
            layout={layout}
            dwellMainMs={dwellMainMs}
            dwellPopupMs={dwellPopupMs}
            onChange={onChange}
        />
    );
}
