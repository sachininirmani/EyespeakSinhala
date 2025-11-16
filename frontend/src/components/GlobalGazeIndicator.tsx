// components/GlobalGazeIndicator.tsx
import React from "react";
import { useGaze } from "../gaze/useGaze";
import GazeIndicator from "../gaze/GazeIndicator";

export default function GlobalGazeIndicator({
                                                active,
                                                layoutId,
                                            }: {
    active: boolean;
    layoutId?: string;
}) {
    const gaze = useGaze();

    if (!active || !gaze || gaze.x == null || gaze.y == null) {
        return null;
    }

    return (
        <div style={{ pointerEvents: "none" }}>
            <GazeIndicator
                x={gaze.x}
                y={gaze.y}
                progress={0}
                layoutId={layoutId ?? "eyespeak"}
            />
        </div>
    );

}
