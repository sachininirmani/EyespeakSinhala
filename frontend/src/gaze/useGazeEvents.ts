// src/gaze/useGazeEvents.ts
//
// IMPORTANT:
// KeyboardBase expects this hook to emit ONLY the event label string (GazeEventType),
// e.g. "FLICK_DOWN", "BLINK", etc. (not the whole JSON object).
// This preserves existing behavior while keeping the websocket connection stable.

import { useEffect, useRef } from "react";
import type { GazeEventType } from "../interaction/types";

type GazeEventMessage = {
    type: "event";
    event: string;
    ts?: number;
    confidence?: number;
    meta?: any;
};

const DEFAULT_WS = "ws://127.0.0.1:7777";

export function useGazeEvents(onEvent: (ev: GazeEventType) => void) {
    const callbackRef = useRef(onEvent);

    // Always keep latest callback without reconnecting WS
    useEffect(() => {
        callbackRef.current = onEvent;
    }, [onEvent]);

    useEffect(() => {
        // Prefer the same WS used by useGaze (if configured) to avoid splitting streams.
        // You can override separately via localStorage.gazeWsUrlEvents if needed.
        const url =
            localStorage.getItem("gazeWsUrlEvents") ||
            localStorage.getItem("gazeWsUrl") ||
            DEFAULT_WS;

        const ws = new WebSocket(url);

        ws.onmessage = (msg) => {
            try {
                const data: any = JSON.parse(msg.data);

                // Only handle explicit event frames
                if (data?.type !== "event") return;
                if (typeof data?.event !== "string") return;

                // Emit ONLY the event label (string)
                callbackRef.current(data.event as GazeEventType);
            } catch (err) {
                console.error("Failed to parse gaze event:", err);
            }
        };

        ws.onerror = (err) => {
            console.error("WebSocket error (useGazeEvents):", err);
        };

        return () => {
            try {
                ws.close();
            } catch {}
        };
    }, []); // connect once
}
