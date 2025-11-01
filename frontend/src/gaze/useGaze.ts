import { useEffect, useState } from "react";

export type GazePoint = { x: number; y: number; valid: boolean };

export function useGaze(): GazePoint {
  const [pt, setPt] = useState<GazePoint>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    valid: false,
  });

  useEffect(() => {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${scheme}://127.0.0.1:7777`;

    let ws: WebSocket | null = null;
    let rafId = 0;
    let latest = { x: 0.5, y: 0.5, valid: false };

    try {
      ws = new WebSocket(url);
      ws.onopen = () => console.log("[useGaze] Connected to TobiiBridge");
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          latest = {
            x: Math.min(1, Math.max(0, data.x)),
            y: Math.min(1, Math.max(0, data.y)),
            valid: true,
          };
        } catch (err) {
          console.warn("[useGaze] Invalid WS frame", err);
        }
      };
      ws.onerror = (err) => console.error("[useGaze] WS error", err);
      ws.onclose = () => console.warn("[useGaze] WS closed");
    } catch (err) {
      console.error("[useGaze] WS init failed", err);
    }

    const tick = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setPt({
        x: latest.x * w,
        y: latest.y * h,
        valid: latest.valid,
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (ws) try { ws.close(); } catch {}
    };
  }, []);

  return pt;
}
