import { useEffect, useRef, useState } from "react";

type Gaze = { x: number; y: number };

/**
 * Streams gaze data from Tobii Bridge WebSocket.
 * Converts normalized (0–1) values to pixel coordinates,
 * applies calibration & bias, and provides live gaze position.
 */
export function useGaze(wsUrl: string = "ws://127.0.0.1:7777"): Gaze {
  const [pos, setPos] = useState<Gaze>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // --- Mouse fallback ---
    const onMouse = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", onMouse);

    // --- WebSocket setup ---
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => console.log("[Gaze] Connected to", wsUrl);
      ws.onerror = (err) => console.error("[Gaze] WebSocket error:", err);
      ws.onclose = () => console.warn("[Gaze] Disconnected from", wsUrl);

      ws.onmessage = (ev) => {
        try {
          const d = JSON.parse(ev.data);
          if (typeof d.x === "number" && typeof d.y === "number") {
            // If normalized (0–1), convert to pixels
            const isNormalized = d.x <= 1 && d.y <= 1;
            const x = isNormalized ? d.x * window.innerWidth : d.x;
            const y = isNormalized ? d.y * window.innerHeight : d.y;
            setPos({ x, y });
          }
        } catch (err) {
          console.error("[Gaze] parse error:", err);
        }
      };
    } catch (err) {
      console.error("[Gaze] Failed to connect:", err);
    }

    return () => {
      window.removeEventListener("mousemove", onMouse);
      wsRef.current?.close();
    };
  }, [wsUrl]);

  // --- Load calibration & bias ---
  const affine = (() => {
    try {
      return JSON.parse(localStorage.getItem("gazeCalibAffine") || "null");
    } catch {
      return null;
    }
  })();

  const manual = (() => {
    try {
      return JSON.parse(localStorage.getItem("gazeManual") || "null");
    } catch {
      return null;
    }
  })();

  const bias = (() => {
    try {
      return JSON.parse(localStorage.getItem("gazeBias") || "null");
    } catch {
      return null;
    }
  })();

  let { x, y } = pos;

  // --- Apply affine calibration ---
  if (affine) {
    const nx = x / window.innerWidth;
    const ny = y / window.innerHeight;
    const tx = affine.a11 * nx + affine.a12 * ny + affine.b1;
    const ty = affine.a21 * nx + affine.a22 * ny + affine.b2;
    x = tx * window.innerWidth;
    y = ty * window.innerHeight;
  }

  // --- Apply horizontal & vertical bias ---
  if (bias) {
    const { horizontal = 0, vertical = 0 } = bias;
    x += horizontal;
    y += vertical;
  }

  // --- Apply top bias (legacy compatibility) ---
  if (manual?.topBiasPx) {
    const topBias = manual.topBiasPx;
    const h = window.innerHeight;
    const factor = 1 - y / h;
    y = y - topBias * factor;
  }

  return { x, y };
}
