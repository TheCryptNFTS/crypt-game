import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { getProgressSnapshot } from "../lib/localProgress";

/**
 * Reliquary preview — honest shell until commerce exists.
 * TODO: payment rails, inventory, pricing, seasonal SKUs; no API calls here.
 */
export default function ShopPage() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2000);
    return () => window.clearInterval(id);
  }, []);
  const snap = useMemo(() => getProgressSnapshot(Date.now()), [tick]);

  return (
    <CryptPageFrame
      eyebrow="Reliquary · preview"
      title="Claim the next relic"
      lead="No checkout or inventory. $CRYPT matches your field ledger on device—not entitlements, not on-chain in this build."
    >
      <div className="crypt-shop-simple" role="region" aria-label="Reliquary preview">
        <p className="crypt-lore-whisper">
          Crypt Legends stays skill-first—vanity for mats, backs, passes, never pay-to-win by intent.
        </p>
        <div className="crypt-preview-banner" role="status">
          <strong>Preview</strong> — counter sealed. Boards, backs, season goods for Crypt Digital Trading Cards arrive with
          commerce—nothing purchasable today.
        </div>

        <aside className="crypt-shop-balance" aria-label="Balance">
          <p className="crypt-shop-balance-label">$CRYPT (device ledger)</p>
          <p className="crypt-shop-balance-value">{snap.cryptBalance}</p>
          <p className="crypt-shop-balance-note">Same closed-alpha stub as Home · skill and earn paths stay first</p>
        </aside>

        <p className="crypt-shell-lead m-0 max-w-[52ch]">
          Collectible-first, tactical at core: when the Reliquary opens, receipts stay clear for cosmetics, mats, backs,
          events, passes—prestige without power creep by design.
        </p>

        <ul className="crypt-shop-roadmap-list">
          <li>Checkout, receipts, and entitlement sync</li>
          <li>Real SKUs priced in $CRYPT or fiat</li>
          <li>Seasonal drops tuned from the server</li>
        </ul>

        <nav className="crypt-shop-foot" aria-label="Leave reliquary">
          <Link to="/home" className="crypt-shop-foot-link">
            Command hub
          </Link>
          <Link to="/play" className="crypt-shop-foot-link">
            Field
          </Link>
          <Link to="/profile" className="crypt-shop-foot-link crypt-shop-foot-link--muted">
            Dossier
          </Link>
        </nav>
      </div>
    </CryptPageFrame>
  );
}
