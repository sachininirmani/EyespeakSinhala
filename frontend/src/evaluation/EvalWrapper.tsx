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
    const [dwellPopup, setDwellPopup] = useState(450);

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

    // Prompts (stable per phase)
    const [phasePrompts, setPhasePrompts] = useState<PromptSet | null>(null);
    const [promptIndex, setPromptIndex] = useState(0);

    // Typing telemetry
    const [currentText, setCurrentText] = useState("");
    const [startTime, setStartTime] = useState<number | null>(null);
    const [keystrokes, setKeystrokes] = useState(0);
    const [deletes, setDeletes] = useState(0);
    const [eyeDist, setEyeDist] = useState(0);

    const [feedback, setFeedback] = useState("");

    const [showCalibration, setShowCalibration] = useState(false);

    // Anti-double-advance guards
    const startingRef = useRef(false);
    const submittingRef = useRef(false);

    // Derived
    const currentLayout = layouts[layoutIndex];
    const allOneWord = phasePrompts?.one_word ?? [];
    const allSentences = phasePrompts?.composition ?? [];
    const allPromptsForPhase = useMemo(
        () => [...allOneWord, ...allSentences],
        [allOneWord, allSentences]
    );
    const totalPromptsThisPhase = allPromptsForPhase.length;
    const currentPrompt =
        allPromptsForPhase[promptIndex % Math.max(1, totalPromptsThisPhase)];

    // Start session
    async function beginSession() {
        const randomized = getRandomizedLayouts(); // random order for this user/session
        setLayouts(randomized);
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

    // Load prompts once per phase (per layoutIndex)
    // This ensures each keyboard gets its OWN 4+3 random subset, and stays stable.
    const fetchedForLayoutRef = useRef<number | null>(null);
    useEffect(() => {
        if (phase === "familiarize" && layoutIndex !== fetchedForLayoutRef.current) {
            getPrompts().then((p) => {
                setPhasePrompts(p);
                setPromptIndex(0);
                fetchedForLayoutRef.current = layoutIndex;
            });
        }
    }, [phase, layoutIndex]);

    function finishBiasCalibration() {
        setPhase("familiarize");
    }

    function toReady() {
        setPhase("ready");
    }

    function startTyping() {
        // Guard against double-trigger (e.g., fast double click)
        if (startingRef.current) return;
        startingRef.current = true;

        setCurrentText("");
        setEyeDist(0);
        setKeystrokes(0);
        setDeletes(0);
        setStartTime(performance.now());
        setPhase("typing");

        // release guard shortly after render switch
        setTimeout(() => (startingRef.current = false), 50);
    }

    async function finishRound() {
        if (submittingRef.current) return; // prevent double submit
        submittingRef.current = true;

        const end = performance.now();
        const durMs = Math.max(0, end - (startTime ?? end));

        await submitTrial({
            session_id: session?.session_id,
            participant_id: participant,
            layout_id: currentLayout,
            round_id: `layout${layoutIndex}_round${promptIndex}`,
            prompt_id: `prompt_${promptIndex}`,
            intended_text: currentPrompt,
            transcribed_text: currentText,
            dwell_main_ms: dwellMain,
            dwell_popup_ms: dwellPopup,
            duration_ms: durMs,
            total_keystrokes: keystrokes,
            deletes,
            eye_distance_px: eyeDist,
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
            // Next line is optional because we fetch in useEffect when phase === 'familiarize'
            // But calling here warms up the next set early if you want.
            // getPrompts().then(setPhasePrompts);
            setPhase("familiarize");
        } else {
            setPhase("feedback");
        }
    }

    return (
        <div
            style={{
                width: "100vw",
                height: "100vh",
                margin: 0,
                padding: "12px clamp(8px, 2vw, 20px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "#f8fafc",
            }}
        >
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
                            <div className="label">Familiar with Eye-Controlled Keyboards?</div>
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
                            <h3>Horizontal & Vertical Bias Calibration</h3>
                            <p style={{ textAlign: "center", maxWidth: 400 }}>
                                Look at each dot on the screen as instructed. The system will
                                compute your gaze bias and store it automatically for this
                                session.
                            </p>
                            <button
                                className="btn primary"
                                onClick={() => setShowCalibration(true)}
                                style={{ marginTop: 24 }}
                            >
                                Continue
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
            {phase !== "setup" && phase !== "biascalibration" && (
                <div className="card" style={{ marginTop: 12 }}>
                    <div className="row">
                        <div>
                            <b>Participant:</b> {participant}
                        </div>
                        <div>
                            <b>Layout:</b> {currentLayout}
                        </div>
                        <div>
                            <b>Prompt:</b> {promptIndex + 1} / {totalPromptsThisPhase}
                        </div>
                    </div>
                </div>
            )}

            {/* ---------------- FAMILIARIZATION ---------------- */}
            {phase === "familiarize" && (
                <div className="card" style={{ marginTop: 12 }}>
                    <div className="label">
                        Familiarization (adjust dwell as needed) for {currentLayout}
                    </div>
                    <DwellSliders
                        main={dwellMain}
                        popup={dwellPopup}
                        setMain={setDwellMain}
                        setPopup={setDwellPopup}
                    />
                    <div style={{ marginTop: 8 }}>
                        <button className="btn primary" onClick={toReady}>
                            Ready
                        </button>
                    </div>
                </div>
            )}

            {/* ---------------- READY & TYPING ---------------- */}
            {phase === "ready" && phasePrompts && (
                <ReadyScreen prompt={currentPrompt} seconds={10} onStart={startTyping} />
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
                    <KeyboardLoader
                        layoutId={currentLayout}
                        dwellMainMs={dwellMain}
                        dwellPopupMs={dwellPopup}
                        onChange={setCurrentText}
                    />
                    <div style={{ marginTop: 12, alignSelf: "center" }}>
                        <button
                            className="btn ghost"
                            onClick={finishRound}
                            disabled={submittingRef.current}
                            title={submittingRef.current ? "Saving…" : "Submit this answer"}
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
                <div className="card" style={{ marginTop: 12 }}>
                    <h3>All layouts complete!</h3>
                    <p>
                        Data saved to backend SQLite and exported to a JSON file per session.
                    </p>
                </div>
            )}
        </div>
    );
}
