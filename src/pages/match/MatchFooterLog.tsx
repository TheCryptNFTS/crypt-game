type MatchFooterLogProps = {
  combatLog: string[];
  onNewMatch: () => void;
};

export function MatchFooterLog({
  combatLog,
  onNewMatch,
}: MatchFooterLogProps) {
  return (
    <footer className="crypt-match-log-footer">
      <div className="crypt-match-log-footer-inner">
        {combatLog.length === 0 ? (
          <span className="crypt-log-quiet">Log</span>
        ) : (
          <ul className="crypt-log-lines">
            {combatLog.slice(-5).map((line, i) => (
              <li key={`${combatLog.length}-${i}`}>{line}</li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="crypt-log-reset"
          onClick={onNewMatch}
        >
          New match
        </button>
      </div>
    </footer>
  );
}
