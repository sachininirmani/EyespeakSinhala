import React, { useEffect, useState } from "react";
import { getPrompts, startSession, submitSUS, submitTrial } from "../api";
import type { LayoutId, PromptSet, Session } from "../types";
import DwellSliders from "../components/DwellSliders";
import ReadyScreen from "../components/ReadyScreen";
import SUSForm from "../components/SUSForm";
import Keyboard from "../keyboard/Keyboard";
import BiasCalibration from "../components/BiasCalibration";

export default function EvalWrapper() {
  const [participant, setParticipant] = useState("P001");
  const [session, setSession] = useState<Session | null>(null);
  const [prompts, setPrompts] = useState<PromptSet | null>(null);
  const [dwellMain, setDwellMain] = useState(600);
  const [dwellPopup, setDwellPopup] = useState(450);
  const [phase, setPhase] = useState<
      "setup" | "biascalibration" | "familiarize" | "ready" | "typing" | "sus" | "done"
  >("setup");
  const [layoutIndex, setLayoutIndex] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [keystrokes, setKeystrokes] = useState(0);
  const [deletes, setDeletes] = useState(0);
  const [eyeDist, setEyeDist] = useState(0);

  const layouts: LayoutId[] = ["eyespeak", "wijesekara", "helakuru"];
  const currentLayout = layouts[layoutIndex];
  const compPrompts = prompts?.composition ?? [];
  const currentPrompt = compPrompts[roundIndex % compPrompts.length];
  const promptId = `comp_${roundIndex}`;

  useEffect(() => {
    getPrompts().then(setPrompts);
  }, []);

  function beginSession() {
    startSession(participant, layouts).then(setSession);
    setPhase("biascalibration");
  }
  function finishBiasCalibration() {
    setPhase("familiarize");
  }
  function toReady() {
    setPhase("ready");
  }
  function startTyping() {
    setCurrentText("");
    setEyeDist(0);
    setKeystrokes(0);
    setDeletes(0);
    setStartTime(performance.now());
    setPhase("typing");
  }

  async function finishRound() {
    const end = performance.now();
    const durMs = Math.max(0, end - (startTime ?? end));
    await submitTrial({
      session_id: session?.session_id,
      participant_id: participant,
      layout_id: currentLayout,
      round_id: `layout${layoutIndex}_round${roundIndex}`,
      prompt_id: promptId,
      intended_text: "",
      transcribed_text: currentText,
      dwell_main_ms: dwellMain,
      dwell_popup_ms: dwellPopup,
      duration_ms: durMs,
      total_keystrokes: keystrokes,
      deletes,
      eye_distance_px: eyeDist
    });
    setRoundIndex((r) => r + 1);
    if ((roundIndex + 1) % 2 === 0) setPhase("sus");
    else setPhase("familiarize");
  }

  async function submitSUSForLayout(vals: number[]) {
    await submitSUS({
      session_id: session?.session_id,
      participant_id: participant,
      layout_id: currentLayout,
      items: vals
    });
    if (layoutIndex + 1 < layouts.length) {
      setLayoutIndex((i) => i + 1);
      setPhase("familiarize");
    } else setPhase("done");
  }
  const [showCalibration, setShowCalibration] = useState(false);

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
            background: "#f8fafc"
          }}
      >
        <h2>Eyespeak Sinhala — Evaluation Runner</h2>

        {phase === "setup" && (
            <div className="card">
              <div className="row">
                <div>
                  <div className="label">Participant ID</div>
                  <input
                      value={participant}
                      onChange={(e) => setParticipant(e.target.value)}
                      placeholder="P001"
                  />
                </div>
                <div>
                  <div className="label">Layouts</div>
                  <code>{layouts.join(", ")}</code>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn primary" onClick={beginSession}>
                  Start Session
                </button>
              </div>
            </div>
        )}

        {phase === "biascalibration" && (
            <>
              {/** Step 1: Instruction screen */}
              {!showCalibration && (
                  <div
                      className="card"
                      style={{
                        width: "100%",
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                  >
                    <h3>Horizontal & Vertical Bias Calibration</h3>
                    <p style={{ textAlign: "center", maxWidth: 400 }}>
                      Look at each dot on the screen as instructed. The system will compute
                      your gaze bias and store it automatically for this session.
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

              {/** Step 2: Actual calibration sequence */}
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
                  <b>Round:</b> {roundIndex + 1}
                </div>
              </div>
            </div>
        )}

        {phase === "familiarize" && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="label">Familiarization (adjust dwell as needed)</div>
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

        {phase === "ready" && prompts && (
            <ReadyScreen prompt={currentPrompt} seconds={10} onStart={startTyping} />
        )}

        {phase === "typing" && (
            <div
                style={{
                  width: "100%",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column"
                }}
            >
              <Keyboard
                  dwellMainMs={dwellMain}
                  dwellPopupMs={dwellPopup}
                  onChange={setCurrentText}
              />
              <div style={{ marginTop: 12, alignSelf: "center" }}>
                <button className="btn ghost" onClick={finishRound}>
                  Submit
                </button>
              </div>
            </div>
        )}

        {phase === "sus" && <SUSForm onSubmit={submitSUSForLayout} />}

        {phase === "done" && (
            <div className="card" style={{ marginTop: 12 }}>
              <h3>All layouts complete!</h3>
              <p>
                Data saved to backend SQLite (backend/data/evaluation.db).
              </p>
            </div>
        )}
      </div>
  );
}
