import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import {
  addFriend,
  listFriends,
  removeFriend,
  type Friend,
} from "../services/socialApi";

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
        setNote("Enter a name to add a friend.");
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

  return (
    <CryptPageFrame
      eyebrow="Social"
      title="Friends"
      lead="Save the people you duel. Add a friend with the private code they share under Play, then challenge them straight into a head-to-head match. Stored on this device only for now."
    >
      <div className="crypt-friends">
        <section className="crypt-friends__add" aria-label="Add a friend">
          <h2 className="crypt-play-section-label">Add a friend</h2>
          <form className="crypt-friends__form" onSubmit={(e) => void onAdd(e)}>
            <input
              className="crypt-challenge__input"
              type="text"
              autoComplete="off"
              placeholder="Friend's name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Friend's name"
            />
            <input
              className="crypt-challenge__input"
              type="text"
              autoComplete="off"
              placeholder="Challenge code (optional)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Friend's challenge code"
            />
            <button
              type="submit"
              className="crypt-challenge__cta"
              disabled={!name.trim()}
            >
              Add
            </button>
          </form>
          {note ? (
            <p className="crypt-challenge__note" aria-live="polite">
              {note}
            </p>
          ) : null}
        </section>

        <section className="crypt-friends__list" aria-label="Your friends">
          <h2 className="crypt-play-section-label crypt-play-section-label--spaced">
            Your friends
          </h2>
          {friends.length === 0 ? (
            <p className="crypt-challenge__hint">
              No friends yet. Add one above to challenge them directly.
            </p>
          ) : (
            <ul className="crypt-friends__items">
              {friends.map((friend) => (
                <li key={friend.id} className="crypt-friends__item">
                  <div className="crypt-friends__who">
                    <span className="crypt-friends__name">{friend.name}</span>
                    <span className="crypt-friends__code">
                      {friend.code ? `Code: ${friend.code}` : "No code yet"}
                    </span>
                  </div>
                  <div className="crypt-friends__actions">
                    <button
                      type="button"
                      className="crypt-challenge__cta"
                      onClick={() => onChallenge(friend)}
                    >
                      ⬡ Challenge
                    </button>
                    <button
                      type="button"
                      className="crypt-challenge__cancel"
                      onClick={() => void onRemove(friend.id)}
                      aria-label={`Remove ${friend.name}`}
                    >
                      Remove
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
