import React from "react";
import { SnapBoard } from "../snap/SnapBoard";

/**
 * SNAP PROTOTYPE ROUTE (/snap) — Cut 1 of the "Marvel-Snap simplicity" rebuild.
 *
 * This is the FLAG: the current TCG stays the live default at /match, untouched.
 * /snap renders the drastically-simplified 3-Crypt lane battler so it can be
 * played and verified in isolation before it ever replaces anything.
 */
export default function SnapMatchPage() {
  return <SnapBoard />;
}
