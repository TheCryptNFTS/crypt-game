import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import {
  addFriend,
  listFriends,
  removeFriend,
  type Friend,
} from "../services/socialApi";
import { absoluteUrl, shareOrCopy } from "../lib/share";
import { t } from "../i18n";

/**
 * FRIENDS — a device-local contact list for DIRECT CHALLENGES.
 *
 * Add a friend by name plus the private challenge code they shared (the same
 * short code the "Challenge a friend · Create" flow mints). Hitting "Challenge"
 * routes into the existing PvP surface (/play) with that code in navigation
 * state, where the ChallengePanel opens pre-filled in Join mode — so this page
 * NEVER rebuilds matchmaking, it just hands a code off to the proven PvP entry.
 *
 * Persistence + the pluggable backend seam live in services/socialApi.ts; this
 * page only renders the list and dispatches add/remove/challenge.
 */
export default function FriendsPage() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string>("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    void listFriends().then((list) => {
      if (mountedRef.current) setFriends(list);
    });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed) {
        setNote(t("friends.add.needName"));
        return;
      }
      const next = await addFriend({ name: trimmed, code: code.trim() });
      if (!mountedRef.current) return;
      setFriends(next);
      setName("");
      setCode("");
      setNote("");
    },
    [name, code]
  );

  const onRemove = useCallback(async (id: string) => {
    const next = await removeFriend(id);
    if (!mountedRef.current) return;
    setFriends(next);
  }, []);

  /** Hand the friend's code off into the existing PvP challenge flow. */
  const onChallenge = useCallback(
    (friend: Friend) => {
      if (!friend.code) {
        setNote(
          `Add ${friend.name}'s challenge code first — ask them to "Create code" under Play.`
        );
        return;
      }
      navigate("/play", { state: { challengeCode: friend.code } });
    },
    [navigate]
  );

  /** Build a shareable deep-link for a friend's challenge code and copy/share it.
   *  The link lands at /play?challenge=<code> so a friend can click straight into
   *  the PvP join flow. (See report: /play does not yet read ?challenge.) */
  const onShareChallenge = useCallback(async (friend: Friend) => {
    if (!friend.code) {
      setNote(
        `Add ${friend.name}'s challenge code first — ask them to "Create code" under Play.`
      );
      return;
    }
    const link = absoluteUrl(
      `/play?challenge=${encodeURIComponent(friend.code)}`
    );
    const result = await shareOrCopy({
      title: t("friends.share.title"),
      text: t("friends.share.text"),
      url: link,
    });
    if (!mountedRef.current) return;
    setNote(
      result === "shared"
        ? t("friends.share.shared")
        : result === "copied"
          ? t("friends.share.copied")
          : t("friends.share.failed")
    );
  }, []);

  return (
    <CryptPageFrame
      eyebrow={t("friends.eyebrow")}
      title={t("friends.title")}
      lead={t("friends.lead")}
    >
      <div className="crypt-friends">
        <section className="crypt-friends__add" aria-label={t("friends.add.aria")}>
          <h2 className="crypt-play-section-label">{t("friends.add.label")}</h2>
          <form className="crypt-friends__form" onSubmit={(e) => void onAdd(e)}>
            <input
              className="crypt-challenge__input"
              type="text"
              autoComplete="off"
              placeholder={t("friends.add.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={t("friends.add.nameAria")}
            />
            <input
              className="crypt-challenge__input"
              type="text"
              autoComplete="off"
              placeholder={t("friends.add.codePlaceholder")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label={t("friends.add.codeAria")}
            />
            <button
              type="submit"
              className="crypt-challenge__cta"
              disabled={!name.trim()}
            >
              {t("friends.add.cta")}
            </button>
          </form>
          {note ? (
            <p className="crypt-challenge__note" aria-live="polite">
              {note}
            </p>
          ) : null}
        </section>

        <section className="crypt-friends__list" aria-label={t("friends.list.aria")}>
          <h2 className="crypt-play-section-label crypt-play-section-label--spaced">
            {t("friends.list.label")}
          </h2>
          {friends.length === 0 ? (
            <p className="crypt-challenge__hint">
              {t("friends.list.empty")}
            </p>
          ) : (
            <ul className="crypt-friends__items">
              {friends.map((friend) => (
                <li key={friend.id} className="crypt-friends__item">
                  <div className="crypt-friends__who">
                    <span className="crypt-friends__name">{friend.name}</span>
                    <span className="crypt-friends__code">
                      {friend.code ? `Code: ${friend.code}` : t("friends.item.noCode")}
                    </span>
                  </div>
                  <div className="crypt-friends__actions">
                    <button
                      type="button"
                      className="crypt-challenge__cta"
                      onClick={() => onChallenge(friend)}
                    >
                      {t("friends.item.challenge")}
                    </button>
                    <button
                      type="button"
                      className="crypt-challenge__cta"
                      onClick={() => void onShareChallenge(friend)}
                      disabled={!friend.code}
                      title={
                        friend.code
                          ? t("friends.item.copyTitle")
                          : t("friends.item.addCodeTitle")
                      }
                      style={{
                        fontFamily: '"Clash Display", system-ui, sans-serif',
                      }}
                    >
                      {t("friends.item.copyLink")}
                    </button>
                    <button
                      type="button"
                      className="crypt-challenge__cancel"
                      onClick={() => void onRemove(friend.id)}
                      aria-label={`Remove ${friend.name}`}
                    >
                      {t("friends.item.remove")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CryptPageFrame>
  );
}
