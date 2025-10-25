// Reuse the auto-generated LayoutId type from keyboard/index.ts
import type { LayoutId } from "./keyboard";

export type { LayoutId };

// Keep your other shared types here
export interface Session {
  session_id: number;
  participant_id: string;
  layouts: LayoutId[];
}

export interface PromptSet {
  composition: string[];
  one_word: string[];
}
