// gaze/useGaze.ts
import { useEffect, useRef, useState } from "react";

/**
 * Unified gaze hook
 * - Consumes NORMALIZED gaze frames (0..1) from a websocket OR a window event.
 * - Applies rapid-calibration affine (localStorage.gazeCalibAffine_v2), then clamps.
 * - Applies manual pixel biases (localStorage.gazeBias, TopBiasTuner's gazeManual.topBiasPx).
 * - Smooths a bit (EMA) to reduce jitter.
 * - Always exposes PIXEL coordinates (x,y). Also stores raw normalized sample globally for calibration.
 * - Mouse fallback: if no fresh gaze in ~250ms OR user toggles M in calibration, we use mouse.
 */

// Types
type Pt = { x: number; y: number };
type Affine = { a11: number; a12: number; b1: number; a21: number; a22: number; b2: number };

// Globals (bridge → this hook)
declare global {
  interface Window {
    __EYESPEAK_LAST_RAW_GAZE__?: Pt; // normalized source sample (0..1)
  }
}

const WS_DEFAULT = "ws://127.0.0.1:7777";

export function useGaze() {
  const [xy, setXy] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  // Keep some refs for performance
  const lastTsRef = useRef<number>(0);
  const emaRef = useRef<Pt>({ x: xy.x, y: xy.y });

  // Load biases
  function readBiasPx() {
    let h = 0, v = 0;
    try {
      const b = JSON.parse(localStorage.getItem("gazeBias") || "null");
      if (b) { h = Number(b.horizontal) || 0; v = Number(b.vertical) || 0; }
    } catch {}
    return { h, v };
  }

  function readAffine(): Affine | null {
    try {
      const v2 = JSON.parse(localStorage.getItem("gazeCalibAffine_v2") || "null");
      if (v2 && isFinite(v2.a11) && isFinite(v2.a12)) return v2;
    } catch {}
    try {
      const v1 = JSON.parse(localStorage.getItem("gazeCalibAffine") || "null");
      if (v1 && isFinite(v1.a11) && isFinite(v1.a12)) return v1;
    } catch {}
    // Very old simple bias fallback (if present) — converts to a degenerate affine
    try {
      const bn = JSON.parse(localStorage.getItem("gazeBiasNorm") || "null");
      if (bn && isFinite(bn.horizontalNorm) && isFinite(bn.verticalNorm)) {
        return { a11: 1, a12: 0, b1: -bn.horizontalNorm, a21: 0, a22: 1, b2: -bn.verticalNorm };
      }
    } catch {}
    return null;
  }

  // Consume gaze frames
  useEffect(() => {
    let ws: WebSocket | null = null;
    let alive = true;

    const openWs = () => {
      try {
        const url = localStorage.getItem("gazeWsUrl") || WS_DEFAULT;
        ws = new WebSocket(url);
        ws.onmessage = (e) => {
          try {
            const o = JSON.parse(e.data);
            if (!o) return;
            // we expect normalized floats 0..1
            const x = clamp01(Number(o.x));
            const y = clamp01(Number(o.y));
            window.__EYESPEAK_LAST_RAW_GAZE__ = { x, y };
            lastTsRef.current = performance.now();
          } catch {}
        };
        ws.onclose = () => { if (alive) setTimeout(openWs, 1000); };
        ws.onerror = () => { try { ws?.close(); } catch {} };
      } catch {
        // ignore
      }
    };

    openWs();

    // Also accept custom window events if the app posts them
    const evt = (ev: Event) => {
      const anyEv = ev as CustomEvent;
      const d = anyEv.detail;
      if (d && typeof d.x === "number" && typeof d.y === "number") {
        const x = clamp01(d.x);
        const y = clamp01(d.y);
        window.__EYESPEAK_LAST_RAW_GAZE__ = { x, y };
        lastTsRef.current = performance.now();
      }
    };
    window.addEventListener("eyespeak:gaze", evt as EventListener);

    // Mouse fallback (always available)
    const onMouse = (e: MouseEvent) => {
      const now = performance.now();
      // only use as *fallback* if gaze stale
      if (now - lastTsRef.current > 250) {
        const norm: Pt = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
        window.__EYESPEAK_LAST_RAW_GAZE__ = { x: clamp01(norm.x), y: clamp01(norm.y) };
      }
    };
    window.addEventListener("mousemove", onMouse);

    return () => {
      alive = false;
      window.removeEventListener("eyespeak:gaze", evt as EventListener);
      window.removeEventListener("mousemove", onMouse);
      try { ws?.close(); } catch {}
    };
  }, []);

  // Render loop — apply calibration + bias + smoothing → pixels
  useEffect(() => {
    let raf = 0;
    const run = () => {
      raf = requestAnimationFrame(run);

      const raw = window.__EYESPEAK_LAST_RAW_GAZE__;
      const affine = readAffine();
      const bias = readBiasPx();

      // Default to center if nothing yet
      const inNorm = raw ?? { x: 0.5, y: 0.5 };

      // Apply affine (normalized→normalized)
      const outNorm = affine
          ? {
            x: affine.a11 * inNorm.x + affine.a12 * inNorm.y + affine.b1,
            y: affine.a21 * inNorm.x + affine.a22 * inNorm.y + affine.b2,
          }
          : inNorm;

      // Clamp after transform
      const cx = clamp01(outNorm.x);
      const cy = clamp01(outNorm.y);

      // Convert to pixels
      let px = cx * window.innerWidth;
      let py = cy * window.innerHeight;

      // Apply manual pixel biases (post-calibration nudges)
      px += bias.h || 0;
      py += bias.v || 0;

      // Clamp to viewport
      px = Math.max(0, Math.min(window.innerWidth, px));
      py = Math.max(0, Math.min(window.innerHeight, py));

      // Smooth (EMA): faster when moving, slower when steady
      const ema = emaRef.current;
      const alpha = 0.35; // balanced; feel free to tweak
      const sx = ema.x + alpha * (px - ema.x);
      const sy = ema.y + alpha * (py - ema.y);
      emaRef.current = { x: sx, y: sy };

      setXy({ x: sx, y: sy });
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, []);

  return xy;
}

// helpers
function clamp01(v: number) {
  if (!isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

export default useGaze;
