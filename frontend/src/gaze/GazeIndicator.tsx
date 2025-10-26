import React from "react";

export default function GazeIndicator({
                                          x,
                                          y,
                                          progress,
                                          color = "rgba(0,150,255,0.9)", // default blue for Eyespeak
                                          layoutId = "eyespeak", // optional, allows special handling for wijesekara
                                      }: {
    x: number;
    y: number;
    progress: number;
    color?: string;
    layoutId?: string;
}) {
    const dot = 28;
    const ring = 44;
    const border = 5;

    // Determine visuals dynamically
    const isWijesekara = layoutId === "wijesekara";
    const fillColor = isWijesekara ? color : "rgba(0,150,255,0.9)";
    const innerDotColor = isWijesekara
        ? color.replace("0.9", "0.7") // softer tone for secondary mode
        : "rgba(0,0,0,0.65)";

    return (
        <div data-gaze-overlay style={{ pointerEvents: "none" }}>
            {/* Inner dark dot */}
            <div
                style={{
                    position: "fixed",
                    left: x - dot / 2,
                    top: y - dot / 2,
                    width: dot,
                    height: dot,
                    borderRadius: "50%",
                    background: innerDotColor,
                    boxShadow: "0 0 8px rgba(0,0,0,0.25)",
                    zIndex: 99998,
                    transition: "background-color 0.2s ease",
                }}
            />

            {/* Outer progress ring */}
            <div
                style={{
                    position: "fixed",
                    left: x - ring / 2,
                    top: y - ring / 2,
                    width: ring,
                    height: ring,
                    borderRadius: "50%",
                    background: `conic-gradient(${fillColor} ${progress * 360}deg, rgba(0,0,0,0.08) 0deg)`,
                    border: `${border}px solid rgba(255,255,255,0.9)`,
                    boxShadow: isWijesekara
                        ? "0 0 14px rgba(255, 85, 85, 0.3)"
                        : "0 0 10px rgba(0,0,0,0.2)",
                    zIndex: 99997,
                    transition: "background 0.2s ease, box-shadow 0.2s ease",
                }}
            />
        </div>
    );
}
