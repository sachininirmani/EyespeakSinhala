import { useEffect, useRef, useState } from "react";

type Gaze = { x: number; y: number };

export function useGaze(wsUrl?: string): Gaze {
  const [pos, setPos] = useState<Gaze>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    function onMouse(e: MouseEvent) {
      // Mouse fallback for when Tobii not connected
      setPos({ x: e.clientX, y: e.clientY });
    }
    window.addEventListener("mousemove", onMouse);

    if (wsUrl) {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          try {
            const d = JSON.parse(ev.data);
            if (typeof d.x === "number" && typeof d.y === "number")
              setPos({ x: d.x, y: d.y });
          } catch {}
        };
        ws.onclose = () => {
          wsRef.current = null;
        };
      } catch {}
    }

    return () => {
      window.removeEventListener("mousemove", onMouse);
      wsRef.current?.close();
    };
  }, [wsUrl]);

  // --- Apply calibration & biases ---
  const affine = (() => {
    try {
      return JSON.parse(localStorage.getItem("gazeCalibAffine") || "null");
    } catch {
      return null;
    }
  })();

  // legacy "topBiasPx" kept for backward compatibility
  const manual = (() => {
    try {
      return JSON.parse(localStorage.getItem("gazeManual") || "null");
    } catch {
      return null;
    }
  })();

  // new bias format: { horizontal, vertical }
  const bias = (() => {
    try {
      return JSON.parse(localStorage.getItem("gazeBias") || "null");
    } catch {
      return null;
    }
  })();

  let { x, y } = pos;

  // 1️⃣ Apply affine calibration if available
  if (affine) {
    const nx = x / window.innerWidth,
        ny = y / window.innerHeight;
    const tx = affine.a11 * nx + affine.a12 * ny + affine.b1;
    const ty = affine.a21 * nx + affine.a22 * ny + affine.b2;
    x = tx * window.innerWidth;
    y = ty * window.innerHeight;
  }

  // 2️⃣ Apply new horizontal & vertical bias
  if (bias) {
    const { horizontal = 0, vertical = 0 } = bias;
    x += horizontal;
    y += vertical;
  }

  // 3️⃣ (Optional backward compatibility) Apply topBias if still stored
  if (manual?.topBiasPx) {
    const topBias = manual.topBiasPx;
    const h = window.innerHeight;
    const factor = 1 - y / h;
    y = y - topBias * factor;
  }

  return { x, y };
}
