export type LayoutId = "eyespeak" | "wijesekara" | "helakuru"
export interface Session {
  session_id: number
  participant_id: string
  layouts: LayoutId[]
}
export interface PromptSet {
  composition: string[]
  one_word: string[]
}
