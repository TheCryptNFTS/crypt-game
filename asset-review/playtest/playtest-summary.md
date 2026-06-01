# CRYPT TCG — Playtest Report (BASELINE)

Generated: 2026-06-01T16:28:40.314Z

> BASELINE on the pool present at run time. A parallel agent is expanding the card pool; re-run `npm run dev:playtest` after that lands to refresh every metric.

Matches: **300** · maxTurns: 60 · pool: **4129** playable cards (4178 total) · factions: STONE, IRON, BRONZE, SILVER, GOLD

## Match length
- avg **17.38** turns · median 16 · p90 26 · range 7–50
- turn-cap / stalemate hits: 0 (0%)

## First-player advantage
- decided games: 300 · **first-player win-rate 50.3%**

## Faction balance (non-mirror)
| Faction | Win-rate | W/G |
|---|---|---|
| STONE | 61.5% | 59/96 |
| GOLD | 60.4% | 58/96 |
| SILVER | 52.1% | 50/96 |
| IRON | 38.5% | 37/96 |
| BRONZE | 37.5% | 36/96 |

## Decisiveness
- nexus-kill 299 (99.7%) · deck-out 1 (0.3%) · timeout/stalemate 0 (0%)

## Tempo / curve
- energy available/turn 7.24 · spent/turn 2.18 · utilization 30.2% · stuck turns 1.4%

## Keywords — DEATHKNELL / DEPLOY
- pool carriers: DEATHKNELL 5 (0.1%), DEPLOY 3 (0.1%)
- triggers: DEPLOY 146 (0.49/match), DEATHKNELL 116 (0.39/match)
- carrier-deck win-rate: DEATHKNELL 39.6% (38/96), DEPLOY 41% (59/144)
- deepest single-action death cascade: 4 (all matches terminated → no runaway)

## Card performance
- distinct cards played: 90
- dead cards (in a deck, never played): 59
- top by appearance:
  - Herald of the Gilded Oath [GOLDEN_SOVEREIGNS] ×84 (28%)
  - Sentinel of the Judged [SILVER_SENTINELS] ×71 (23.7%)
  - Echo of the Shrouded [SILVER_SENTINELS] ×68 (22.7%)
  - Scales of Stone [STONE_KEEPERS] ×66 (22%)
  - Reflection of the Unblinking [SILVER_SENTINELS] ×66 (22%)
  - Mask of the Verdant Veil [BRONZE_GUARDIANS] ×65 (21.7%)
  - Watcher of the Veil [SILVER_SENTINELS] ×63 (21%)
  - Sentinel of Mournful Winds [STONE_KEEPERS] ×62 (20.7%)
  - Emberroot Sentinel [BRONZE_GUARDIANS] ×62 (20.7%)
  - The Shade's Page [SILVER_SENTINELS] ×62 (20.7%)
  - Watcher of the Veil [SILVER_SENTINELS] ×62 (20.7%)
  - Watcher of the Waning Light [SILVER_SENTINELS] ×62 (20.7%)

## Flags / anything OFF
- Faction STONE win-rate out of band: 61.5% (sane ~40-60%).
- Faction GOLD win-rate out of band: 60.4% (sane ~40-60%).
- Faction IRON win-rate out of band: 38.5% (sane ~40-60%).
- Faction BRONZE win-rate out of band: 37.5% (sane ~40-60%).
- 59 DEAD card(s) (in a deck but never played).
- DEATHKNELL-carrying decks warp win-rate: 39.6%.
- Chain-reaction cascades terminate: all 300 matches completed; deepest single-action death cascade = 4.
