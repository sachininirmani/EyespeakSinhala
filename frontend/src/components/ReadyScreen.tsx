import React, { useEffect, useState } from "react";

export default function ReadyScreen({
                                        prompt,
                                        seconds = 10,
                                        onStart
                                    }: {
    prompt: string;
    seconds?: number;
    onStart: () => void;
}) {
    const [timeLeft, setTimeLeft] = useState(seconds);
    const [started, setStarted] = useState(false);

    // Reset countdown for each new prompt
    useEffect(() => {
        setTimeLeft(seconds);
        setStarted(false);
    }, [prompt, seconds]);

    // Countdown tick
    useEffect(() => {
        if (started || timeLeft <= 0) return;
        const id = setInterval(() => {
            setTimeLeft((x) => (x > 0 ? x - 1 : 0));
        }, 1000);
        return () => clearInterval(id);
    }, [started, timeLeft]);

    // Auto-start when timer hits zero
    useEffect(() => {
        if (timeLeft === 0 && !started) {
            setStarted(true);
            onStart();
        }
    }, [timeLeft, started, onStart]);

    const handleStartNow = () => {
        if (started) return;
        setStarted(true);
        onStart();
    };

    // Progress bar percentage (fills as countdown proceeds)
    const progress = ((seconds - timeLeft) / seconds) * 100;

    return (
        <div
            className="card"
            style={{
                textAlign: "center",
                padding: "24px",
                marginTop: "20px",
                maxWidth: 700,
                width: "100%"
            }}
        >


            <div style={{ fontSize: 16, opacity: 0.8, marginBottom: 12 }}>
                ආරම්භයට {timeLeft} s
            </div>

            {/* Progress bar */}
            <div
                style={{
                    height: 10,
                    width: "100%",
                    maxWidth: 400,
                    backgroundColor: "#e2e8f0",
                    borderRadius: 6,
                    overflow: "hidden",
                    margin: "0 auto 14px"
                }}
            >
                <div
                    style={{
                        width: `${progress}%`,
                        height: "100%",
                        backgroundColor: "#3b82f6",
                        transition: "width 1s linear"
                    }}
                />
            </div>

            {/* Ready / Start Now button */}
            <button
                className="btn primary"
                onClick={handleStartNow}
                disabled={started}
                style={{ marginTop: 4 }}
            >
                {started ? "ආරම්භ වෙමින්..." : "සූදානම් / Start Now"}
            </button>
        </div>
    );
}

