// Central API layer used by the frontend
// Uses fetch (browser-native). Adjust BASE_URL if your backend runs elsewhere.

import type { InteractionId, InteractionMapping } from "./interaction/types";

const BASE_URL = "http://localhost:5000";

async function handle<T = any>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function getPrompts() {
  const res = await fetch(`${BASE_URL}/prompts`);
  return handle(res);
}

/**
 * Start a session with extended participant metadata.
 *
 * Backward compatible:
 * - Existing callers can keep passing the first 6 arguments.
 * - New optional args allow storing session-level interaction config for reproducibility.
 */
export async function startSession(
    participant_id: string,
    layouts: string[],
    participant_name: string,
    participant_age: string,
    familiarity: string, // "Never" | "Rarely" | ...
    wears_specks: string, // "Yes" | "No" | "NA"
    interaction_id?: InteractionId,
    interaction_mapping?: InteractionMapping
) {
  const res = await fetch(`${BASE_URL}/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participant_id,
      layouts,
      participant_name,
      participant_age,
      // backend accepts either familiarity or sinhala_usage
      familiarity,
      wears_specks,
      // NEW (optional)
      interaction_id,
      interaction_mapping,
    }),
  });
  return handle(res);
}

export async function submitTrial(payload: any) {
  const res = await fetch(`${BASE_URL}/trial/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function submitSUS(payload: any) {
  const res = await fetch(`${BASE_URL}/sus/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function submitFeedback(payload: { session_id?: number; participant_id: string; feedback: string }) {
  const res = await fetch(`${BASE_URL}/feedback/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}
