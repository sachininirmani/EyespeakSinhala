import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    getPrompts,
    startSession,
    submitSUS,
    submitTrial,
    submitFeedback,
} from "../api";
import type { LayoutId, PromptSet, Session } from "../types";
import DwellSliders from "../components/DwellSliders";
import ReadyScreen from "../components/ReadyScreen";
import SUSForm from "../components/SUSForm";
import KeyboardLoader from "../keyboard/KeyboardLoader";
import BiasCalibration from "../components/BiasCalibration";
import { getRandomizedLayouts } from "../keyboard/KeyboardLoader";
import GazeDwellButton from "../components/GazeDwellButton";
import DwellSliderSingle from "../components/DwellSliderSingle";
import GlobalGazeIndicator from "../components/GlobalGazeIndicator";

type LiveMetrics = {
    total_keystrokes: number;
    deletes: number;
    eye_distance_px: number;
    vowel_popup_clicks: number;
    vowel_popup_more_clicks: number;
};

export default function EvalWrapper() {
    // Participant details
    const [participant, setParticipant] = useState("P001");
    const [participantName, setParticipantName] = useState("");
    const [participantAge, setParticipantAge] = useState("");
    const [familiarity, setFamiliarity] = useState("No");
    const [wearsSpecks, setWearsSpecks] = useState("No");

    // Session & data
    const [session, setSession] = useState<Session | null>(null);

    // Dwell timing
    const [dwellMain, setDwellMain] = useState(600);
    const [dwellPopup, setDwellPopup] = useState<number | null>(450);

    // State tracking
    const [phase, setPhase] = useState<
        | "setup"
        | "biascalibration"
        | "familiarize"
        | "ready"
        | "typing"
        | "sus"
        | "feedback"
        | "done"
    >("setup");

    const [layouts, setLayouts] = useState<LayoutId[]>([]);
    const [layoutIndex, setLayoutIndex] = useState(0);

    // Prompts (stable for the whole session)
    const [phasePrompts, setPhasePrompts] = useState<PromptSet | null>(null);
    const [promptIndex, setPromptIndex] = useState(0);

    // NEW: track whether prompts have been fetched for this session
    const promptsFetchedRef = useRef(false);

    // Typing telemetry
    const [currentText, setCurrentText] = useState("");
    const [startTime, setStartTime] = useState<number | null>(null);
    const [live, setLive] = useState<LiveMetrics>({
        total_keystrokes: 0,
        deletes: 0,
        eye_distance_px: 0,
        vowel_popup_clicks: 0,
        vowel_popup_more_clicks: 0,
    });

    const [feedback, setFeedback] = useState("");

    const [showCalibration, setShowCalibration] = useState(false);

    // Anti-double-advance guards
    const startingRef = useRef(false);
    const submittingRef = useRef(false);

    // Derived
    const currentLayout = layouts[layoutIndex];
    const allPromptsForPhase = phasePrompts?.prompts ?? [];

    const totalPromptsThisPhase = allPromptsForPhase.length;
    const currentPrompt =
        allPromptsForPhase.length > 0
            ? allPromptsForPhase[promptIndex]
            : "";


    // Start session
    async function beginSession() {
        const randomized = getRandomizedLayouts(); // random order for this user/session
        setLayouts(randomized);

        // NEW: reset prompts for a fresh session
        setPhasePrompts(null);
        promptsFetchedRef.current = false;
        setPromptIndex(0);
        setLayoutIndex(0);

        const s = await startSession(
            participant,
            randomized,
            participantName,
            participantAge,
            familiarity,
            wearsSpecks
        );
        setSession(s);
        setPhase("biascalibration");
    }

    // Load prompts ONCE per session (first time we enter familiarization)
    useEffect(() => {
        if (phase === "familiarize" && !promptsFetchedRef.current) {
            getPrompts().then((p) => {
                setPhasePrompts(p);
                setPromptIndex(0);
                promptsFetchedRef.current = true;
            });
        }
    }, [phase]);

    function finishBiasCalibration() {
        setPhase("familiarize");
    }

    function toReady() {
        setPhase("ready");
    }

    function startTyping() {
        if (startingRef.current) return;
        startingRef.current = true;

        setCurrentText("");
        setLive({
            total_keystrokes: 0,
            deletes: 0,
            eye_distance_px: 0,
            vowel_popup_clicks: 0,
            vowel_popup_more_clicks: 0,
        });
        setStartTime(performance.now());
        setPhase("typing");

        setTimeout(() => (startingRef.current = false), 50);
    }

    async function finishRound() {
        if (submittingRef.current) return;
        submittingRef.current = true;

        const end = performance.now();
        const durMs = Math.max(0, end - (startTime ?? end));

        // word count by spaces
        const wordCount = currentText.trim().length
            ? currentText.trim().split(/\s+/).length
            : 0;

        await submitTrial({
            session_id: session?.session_id,
            participant_id: participant,
            layout_id: currentLayout,
            round_id: `layout${layoutIndex}_round${promptIndex}`,
            prompt_id: `prompt_${promptIndex}`,
            prompt: currentPrompt,                 // keep prompt separately
            intended_text: currentPrompt,          // NEW: intended = prompt (copy task)
            transcribed_text: currentText,
            dwell_main_ms: dwellMain,
            dwell_popup_ms: currentLayout === "wijesekara" ? null : dwellPopup,
            duration_ms: durMs,
            total_keystrokes: live.total_keystrokes,
            deletes: live.deletes,
            eye_distance_px: live.eye_distance_px,
            word_count: wordCount,
            vowel_popup_clicks: live.vowel_popup_clicks,
            vowel_popup_more_clicks: live.vowel_popup_more_clicks,
        });

        if (promptIndex + 1 < totalPromptsThisPhase) {
            setPromptIndex((p) => p + 1);
            setPhase("ready");
        } else {
            setPromptIndex(0);
            setPhase("sus");
        }

        submittingRef.current = false;
    }

    async function submitSUSForLayout(vals: number[]) {
        await submitSUS({
            session_id: session?.session_id,
            participant_id: participant,
            layout_id: currentLayout,
            items: vals,
        });

        if (layoutIndex + 1 < layouts.length) {
            const nextIndex = layoutIndex + 1;
            setLayoutIndex(nextIndex);
            setPromptIndex(0);

            // Reset dwell times to default when new phase begins
            setDwellMain(600);
            setDwellPopup(450);

            setPhase("familiarize");
        } else {
            setPhase("feedback");
        }
    }

    // Handle Enter key on session end
    useEffect(() => {
        if (phase !== "done") return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                const currentNum = parseInt(participant.replace(/\D/g, "")) || 1;
                const nextPid = `P${(currentNum + 1).toString().padStart(3, "0")}`;
                setParticipant(nextPid);
                setLayouts([]);
                setLayoutIndex(0);
                setPromptIndex(0);
                setPhasePrompts(null);            // NEW: reset prompts for next participant
                promptsFetchedRef.current = false; // NEW
                setPhase("setup");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [phase, participant]);

    const gazeIndicatorActive =
        phase === "familiarize" || phase === "ready" || phase === "sus";

    return (
        <div
            id="eval-scroll-container"
            style={{
                width: "100vw",
                height: "100vh",
                margin: 0,
                padding: "12px clamp(8px, 2vw, 20px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "#f8fafc",
                position: "relative",
                overflowY: "auto",
            }}
        >
            {/* Global gaze indicator for familiarization, ready & SUS */}
            <GlobalGazeIndicator
                active={gazeIndicatorActive}
                layoutId={currentLayout}
            />

            <h2>Eyespeak Sinhala — Evaluation Runner</h2>

            {/* ---------------- SETUP ---------------- */}
            {phase === "setup" && (
                <div className="card">
                    <div className="label">Participant Setup</div>

                    <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
                        <div>
                            <div className="label">Participant ID</div>
                            <input
                                value={participant}
                                onChange={(e) => setParticipant(e.target.value)}
                                placeholder="P001"
                            />
                        </div>

                        <div>
                            <div className="label">Name</div>
                            <input
                                value={participantName}
                                onChange={(e) => setParticipantName(e.target.value)}
                                placeholder="e.g., Nimal Perera"
                            />
                        </div>

                        <div>
                            <div className="label">Age</div>
                            <input
                                type="number"
                                value={participantAge}
                                onChange={(e) => setParticipantAge(e.target.value)}
                                placeholder="e.g., 26"
                            />
                        </div>

                        <div>
                            <div className="label">
                                Familiar with Eye-Controlled Keyboards?
                            </div>
                            <select
                                value={familiarity}
                                onChange={(e) => setFamiliarity(e.target.value)}
                            >
                                <option value="No">No</option>
                                <option value="Yes">Yes</option>
                            </select>
                        </div>

                        <div>
                            <div className="label">Wears Specks?</div>
                            <select
                                value={wearsSpecks}
                                onChange={(e) => setWearsSpecks(e.target.value)}
                            >
                                <option value="No">No</option>
                                <option value="Yes">Yes</option>
                            </select>
                        </div>
                    </div>

                    <div className="row" style={{ marginTop: 8 }}>
                        <div>
                            <div className="label">Randomized Layout Order</div>
                            <code>{layouts.join(", ") || "(will randomize on start)"}</code>
                        </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <button className="btn primary" onClick={beginSession}>
                            Start Session
                        </button>
                    </div>
                </div>
            )}

            {/* ---------------- CALIBRATION ---------------- */}
            {phase === "biascalibration" && (
                <>
                    {!showCalibration && (
                        <div
                            className="card"
                            style={{
                                width: "100%",
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <h3>Quick Gaze Calibration (≈5 seconds)</h3>
                            <p style={{ textAlign: "center", maxWidth: 480 }}>
                                Look briefly at each dot as it appears. We’ll compute a best-fit
                                transform automatically and apply it to your gaze for this session.
                                You’ll see your live gaze dot during calibration. Press <b>M</b> to
                                toggle mouse fallback if needed.
                            </p>
                            <button
                                className="btn primary"
                                onClick={() => setShowCalibration(true)}
                                style={{ marginTop: 24 }}
                            >
                                Start Calibration
                            </button>
                        </div>
                    )}

                    {showCalibration && (
                        <BiasCalibration
                            onDone={() => {
                                setShowCalibration(false);
                                finishBiasCalibration();
                            }}
                        />
                    )}
                </>
            )}

            {/* ---------------- STATUS BAR ---------------- */}
            {phase !== "setup" && phase !== "biascalibration" && phase !== "done" && (
                <div className="card" style={{ marginTop: 12 }}>
                    <div className="row">
                        <div>
                            <b>Participant:</b> {participant}
                        </div>
                        <div>
                            <b>Layout:</b> {currentLayout}
                        </div>
                        {phase !== "sus" && (
                            <div>
                                <b>Prompt:</b> {promptIndex + 1} / {totalPromptsThisPhase}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ---------------- FAMILIARIZATION ---------------- */}
            {phase === "familiarize" && (
                <div className="card" style={{ marginTop: 12 }}>
                    <div className="label">
                        Familiarization (adjust dwell as needed) for {currentLayout}
                    </div>
                    {currentLayout?.includes("eyespeak") ? (
                        <DwellSliders
                            main={dwellMain}
                            popup={dwellPopup ?? 450}
                            setMain={setDwellMain}
                            setPopup={(v)=>setDwellPopup(v)}
                        />
                    ) : (
                        <DwellSliderSingle
                            value={dwellMain}
                            setValue={setDwellMain}
                            min={200}
                            max={1200}
                            step={50}
                            label="Main Dwell (ms)"
                        />

                    )}
                    <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
                        <GazeDwellButton
                            onActivate={toReady}
                            dwellMs={900}
                            style={{
                                padding: "16px 50px",
                                background: "#0f766e",
                                color: "white",
                                borderRadius: 12,
                                fontSize: 20,
                                fontWeight: 600,
                                boxShadow: "0 4px 12px rgba(15,118,110,0.3)",
                            }}
                        >
                            Ready
                        </GazeDwellButton>
                    </div>

                </div>
            )}

            {/* ---------------- READY & TYPING ---------------- */}
            {phase === "ready" && phasePrompts && (
                <div style={{ width: "100%", maxWidth: 720 }}>
                    <div className="card" style={{ marginBottom: 16 }}>
                        <h3 style={{ marginBottom: 8 }}>Prompt {promptIndex + 1}</h3>
                        <p style={{ fontSize: 22, marginBottom: 6 }}>{currentPrompt}</p>

                        <div
                            style={{
                                borderTop: "1px solid #e2e8f0",
                                marginTop: 12,
                                paddingTop: 10,
                            }}
                        >
                            <div style={{ fontSize: 16, marginBottom: 6 }}>
                                Optional: Adjust dwell time before starting this prompt
                            </div>

                            {currentLayout.includes("eyespeak") ? (
                                <DwellSliders
                                    main={dwellMain}
                                    popup={dwellPopup ?? 450}
                                    setMain={setDwellMain}
                                    setPopup={(v) => setDwellPopup(v)}
                                />
                            ) : (
                                <DwellSliderSingle
                                    value={dwellMain}
                                    setValue={setDwellMain}
                                    min={200}
                                    max={1200}
                                    step={50}
                                    label="Main Dwell (ms)"
                                />
                            )}

                        </div>

                        <div style={{ marginTop: 18 }}>
                            <ReadyScreen
                                prompt={currentPrompt}
                                seconds={10}
                                onStart={startTyping}
                            />
                        </div>
                    </div>
                </div>
            )}

            {phase === "typing" && (
                <div
                    style={{
                        width: "100%",
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* NEW: show the prompt clearly above the keyboard */}
                    <div
                        className="card"
                        style={{
                            marginBottom: 12,
                            maxWidth: 900,
                            alignSelf: "center",
                            position: "absolute",
                            top: 30,
                            left: 45,
                        }}
                    >
                        <h3 style={{ marginBottom: 4 }}>Please copy this text exactly:</h3>
                        <p
                            style={{
                                fontSize: 22,
                                lineHeight: 1.4,
                                margin: 0,
                            }}
                        >
                            {currentPrompt}
                        </p>
                    </div>

                    <KeyboardLoader
                        layoutId={currentLayout}
                        dwellMainMs={dwellMain}
                        dwellPopupMs={currentLayout === "wijesekara" ? 0 : (dwellPopup ?? 450)}
                        onChange={(text, metrics) => {
                            setCurrentText(text);
                            setLive(metrics);
                        }}
                    />
                    <div style={{ marginTop: 16, alignSelf: "center" }}>
                        <button
                            onClick={finishRound}
                            disabled={submittingRef.current}
                            title={
                                submittingRef.current ? "Saving…" : "Submit this answer"
                            }
                            style={{
                                backgroundColor: submittingRef.current
                                    ? "#fca5a5cc"
                                    : "#fca5a5",
                                color: "#fff",
                                border: "none",
                                borderRadius: 10,
                                padding: "16px 60px",
                                fontSize: 20,
                                fontWeight: 600,
                                cursor: submittingRef.current ? "not-allowed" : "pointer",
                                transition: "background-color 0.3s ease, transform 0.2s ease",
                                width: 260,
                                textAlign: "center",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                            }}
                            onMouseEnter={(e) => {
                                if (!submittingRef.current)
                                    (e.target as HTMLButtonElement).style.backgroundColor =
                                        "#f87171";
                            }}
                            onMouseLeave={(e) => {
                                if (!submittingRef.current)
                                    (e.target as HTMLButtonElement).style.backgroundColor =
                                        "#fca5a5";
                            }}
                        >
                            {submittingRef.current ? "Saving…" : "Submit"}
                        </button>
                    </div>
                </div>
            )}

            {/* ---------------- SUS ---------------- */}
            {phase === "sus" && <SUSForm onSubmit={submitSUSForLayout} />}

            {/* ---------------- FEEDBACK ---------------- */}
            {phase === "feedback" && (
                <div
                    className="card"
                    style={{ marginTop: 12, width: "100%", maxWidth: 720 }}
                >
                    <h3>Final Feedback (normal keyboard)</h3>
                    <p style={{ marginTop: -8, color: "#64748b" }}>
                        Please share any suggestions for improving Eyespeak Sinhala.
                    </p>
                    <textarea
                        placeholder="Your suggestions for improvement..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        style={{
                            width: "100%",
                            height: 140,
                            padding: 12,
                            borderRadius: 8,
                            border: "1px solid #cbd5e1",
                        }}
                    />
                    <div style={{ marginTop: 10 }}>
                        <button
                            className="btn primary"
                            onClick={async () => {
                                await submitFeedback({
                                    session_id: session?.session_id,
                                    participant_id: participant,
                                    feedback,
                                });
                                setPhase("done");
                            }}
                        >
                            Submit Feedback & Finish
                        </button>
                    </div>
                </div>
            )}

            {/* ---------------- DONE ---------------- */}
            {phase === "done" && (
                <div
                    style={{
                        textAlign: "center",
                        marginTop: 60,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "60vh",
                    }}
                >
                    <h2 style={{ fontSize: 28, marginBottom: 12 }}>
                        Thank you for participating!
                    </h2>
                    <p style={{ fontSize: 18, color: "#475569", marginBottom: 24 }}>
                        All your responses have been recorded successfully.
                    </p>
                    <p style={{ fontSize: 16, color: "#64748b" }}>
                        Press <b>Enter</b> to start the next participant session.
                    </p>
                </div>
            )}
        </div>
    );
}
