import axios from "axios"
import type { Session, PromptSet } from "./types"

const API = axios.create({ baseURL: "http://localhost:5000" })

export async function startSession(participant_id: string, layouts: string[]) {
  const { data } = await API.post<Session>("/session/start", { participant_id, layouts })
  return data
}
export async function getPrompts() {
  const { data } = await API.get<PromptSet>("/prompts")
  return data
}
export async function logEvents(events: any[]) {
  await API.post("/events/bulk", { events })
}
export async function submitTrial(payload: any) {
  const { data } = await API.post("/trial/submit", payload)
  return data
}
export async function submitSUS(payload: any) {
  const { data } = await API.post("/sus/submit", payload)
  return data
}
