import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../i18n";
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
      eyebrow={t("shop.eyebrow")}
      title={t("shop.title")}
      lead={t("shop.lead")}
    >
      <div className="crypt-shop-simple" role="region" aria-label={t("shop.region.aria")}>
        <p className="crypt-lore-whisper">
          {t("shop.whisper")}
        </p>
        <div className="crypt-preview-banner" role="status">
          <strong>{t("shop.banner.tag")}</strong>{t("shop.banner.copy")}
        </div>

        <aside className="crypt-shop-balance" aria-label={t("shop.balance.aria")}>
          <p className="crypt-shop-balance-label">{t("shop.balance.label")}</p>
          <p className="crypt-shop-balance-value">{snap.cryptBalance}</p>
          <p className="crypt-shop-balance-note">{t("shop.balance.note")}</p>
        </aside>

        <p className="crypt-shell-lead m-0 max-w-[52ch]">
          {t("shop.body")}
        </p>

        <ul className="crypt-shop-roadmap-list">
          <li>{t("shop.roadmap.checkout")}</li>
          <li>{t("shop.roadmap.skus")}</li>
          <li>{t("shop.roadmap.drops")}</li>
        </ul>

        <nav className="crypt-shop-foot" aria-label={t("shop.foot.aria")}>
          <Link to="/home" className="crypt-shop-foot-link">
            {t("shop.foot.hub")}
          </Link>
          <Link to="/play" className="crypt-shop-foot-link">
            {t("shop.foot.field")}
          </Link>
          <Link to="/profile" className="crypt-shop-foot-link crypt-shop-foot-link--muted">
            {t("shop.foot.dossier")}
          </Link>
        </nav>
      </div>
    </CryptPageFrame>
  );
}
