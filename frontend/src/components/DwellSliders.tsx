import React from "react";
import GazeDwellButton from "./GazeDwellButton";

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export default function DwellSliders({
                                         main,
                                         popup,
                                         setMain,
                                         setPopup,
                                     }: {
    main: number;
    popup: number;
    setMain: (v: number) => void;
    setPopup: (v: number) => void;
}) {
    const MAIN_MIN = 250;
    const MAIN_MAX = 1200;
    const POPUP_MIN = 200;
    const POPUP_MAX = 1000;

    const STEP_MAIN = 50;
    const STEP_POPUP = 50;

    const adjustMain = (delta: number) => {
        setMain(clamp(main + delta, MAIN_MIN, MAIN_MAX));
    };

    const adjustPopup = (delta: number) => {
        setPopup(clamp(popup + delta, POPUP_MIN, POPUP_MAX));
    };

    return (
        <div
            className="card"
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                padding: 16,
            }}
        >
            {/* Main dwell */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ minWidth: 160 }}>
                    <div className="label" style={{ marginBottom: 4 }}>
                        Main dwell (ms)
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{main} ms</div>
                </div>

                {/* Slider for mouse users */}
                <div
                    style={{
                        flex: 1,
                        minWidth: 180,
                    }}
                >
                    <input
                        type="range"
                        min={MAIN_MIN}
                        max={MAIN_MAX}
                        step={STEP_MAIN}
                        value={main}
                        onChange={(e) => setMain(parseInt(e.target.value, 10))}
                        style={{ width: "100%" }}
                    />
                </div>

                {/* Gaze-friendly +/- buttons */}
                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                    }}
                >
                    <GazeDwellButton
                        onActivate={() => adjustMain(-STEP_MAIN)}
                        dwellMs={850}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: "999px",
                            background: "#e2e8f0",
                            fontSize: 24,
                            fontWeight: 700,
                        }}
                    >
                        −
                    </GazeDwellButton>
                    <GazeDwellButton
                        onActivate={() => adjustMain(+STEP_MAIN)}
                        dwellMs={850}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: "999px",
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

            {/* Popup dwell */}
            <div
                style={{
                    marginTop: 8,
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: 12,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ minWidth: 160 }}>
                    <div className="label" style={{ marginBottom: 4 }}>
                        Vowel popup dwell (ms)
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{popup} ms</div>
                </div>

                {/* Slider for mouse users */}
                <div
                    style={{
                        flex: 1,
                        minWidth: 180,
                    }}
                >
                    <input
                        type="range"
                        min={POPUP_MIN}
                        max={POPUP_MAX}
                        step={STEP_POPUP}
                        value={popup}
                        onChange={(e) => setPopup(parseInt(e.target.value, 10))}
                        style={{ width: "100%" }}
                    />
                </div>

                {/* Gaze-friendly +/- buttons */}
                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                    }}
                >
                    <GazeDwellButton
                        onActivate={() => adjustPopup(-STEP_POPUP)}
                        dwellMs={850}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: "999px",
                            background: "#e2e8f0",
                            fontSize: 24,
                            fontWeight: 700,
                        }}
                    >
                        −
                    </GazeDwellButton>
                    <GazeDwellButton
                        onActivate={() => adjustPopup(+STEP_POPUP)}
                        dwellMs={850}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: "999px",
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
        </div>
    );
}
