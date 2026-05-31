import { GameAppState } from "../domain/types";
import { defaultAppState } from "../mock-data/defaultAppState";

const STORAGE_KEY = "crypt_game_app_state_v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadAppState(): GameAppState {
  if (!canUseStorage()) return structuredClone(defaultAppState);

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultAppState);

  try {
    const parsed = JSON.parse(raw) as GameAppState;
    return parsed;
  } catch {
    return structuredClone(defaultAppState);
  }
}

export function saveAppState(state: GameAppState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetAppState() {
  const fresh = structuredClone(defaultAppState);
  saveAppState(fresh);
  return fresh;
}
