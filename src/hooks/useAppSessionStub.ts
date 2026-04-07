import { useEffect, useReducer } from "react";
import { getSessionStub, subscribeSessionStub, type AppSessionStub } from "../lib/appSession";

/** Plain React updates when guest session changes — avoids useSyncExternalStore edge cases. */
export function useAppSessionStubSnapshot(): AppSessionStub {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeSessionStub(() => bump()), []);
  return getSessionStub();
}
