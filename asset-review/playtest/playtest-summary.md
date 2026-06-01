# CRYPT TCG — Playtest Report (BASELINE)

Generated: 2026-06-01T16:46:36.256Z

> BASELINE on the pool present at run time. A parallel agent is expanding the card pool; re-run `npm run dev:playtest` after that lands to refresh every metric.

Matches: **300** · maxTurns: 60 · pool: **4129** playable cards (4178 total) · factions: STONE, IRON, BRONZE, SILVER, GOLD

## Match length
- avg **22.71** turns · median 18 · p90 41 · range 6–47
- turn-cap / stalemate hits: 0 (0%)

## First-player advantage
- decided games: 300 · **first-player win-rate 51.3%**

## Faction balance (non-mirror)
| Faction | Win-rate | W/G |
|---|---|---|
| GOLD | 66.7% | 64/96 |
| STONE | 63.5% | 61/96 |
| IRON | 52.1% | 50/96 |
| SILVER | 34.4% | 33/96 |
| BRONZE | 33.3% | 32/96 |

## Decisiveness
- nexus-kill 226 (75.3%) · deck-out 74 (24.7%) · timeout/stalemate 0 (0%)

## Tempo / curve
- energy available/turn 7.88 · spent/turn 2.28 · utilization 28.9% · stuck turns 1%

## Keywords — DEATHKNELL / DEPLOY
- pool carriers: DEATHKNELL 5 (0.1%), DEPLOY 3 (0.1%)
- triggers: DEPLOY 188 (0.63/match), DEATHKNELL 89 (0.3/match)
- carrier-deck win-rate: DEATHKNELL 33.3% (32/96), DEPLOY 51.4% (74/144)
- deepest single-action death cascade: 2 (all matches terminated → no runaway)

## Card performance
- distinct cards played: 60
- dead cards (in a deck, never played): 87
- top by appearance:
  - Sentinel of the Judged [SILVER_SENTINELS] ×99 (33%)
  - Watcher in the Gloom [SILVER_SENTINELS] ×94 (31.3%)
  - Watcher of the Waning Light [SILVER_SENTINELS] ×93 (31%)
  - Sentinel of Eternal Vigil [SILVER_SENTINELS] ×92 (30.7%)
  - Watcher of the Veiled Truth [SILVER_SENTINELS] ×91 (30.3%)
  - Echo of the Shrouded [SILVER_SENTINELS] ×90 (30%)
  - Watcher of the Gloom [SILVER_SENTINELS] ×90 (30%)
  - Watcher of the Veil [SILVER_SENTINELS] ×88 (29.3%)
  - Echo of the Forgotten [SILVER_SENTINELS] ×88 (29.3%)
  - Watcher of the Veil [SILVER_SENTINELS] ×88 (29.3%)
  - Watcher of the Veil [SILVER_SENTINELS] ×88 (29.3%)
  - Herald of the Gilded Oath [GOLDEN_SOVEREIGNS] ×87 (29%)

## Flags / anything OFF
- Faction GOLD win-rate out of band: 66.7% (sane ~40-60%).
- Faction STONE win-rate out of band: 63.5% (sane ~40-60%).
- Faction SILVER win-rate out of band: 34.4% (sane ~40-60%).
- Faction BRONZE win-rate out of band: 33.3% (sane ~40-60%).
- 87 DEAD card(s) (in a deck but never played).
- DEATHKNELL-carrying decks warp win-rate: 33.3%.
- Chain-reaction cascades terminate: all 300 matches completed; deepest single-action death cascade = 2.
