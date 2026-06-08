# CRYPT TCG — Playtest Report (BASELINE)

Generated: 2026-06-08T21:16:59.927Z

> BASELINE on the pool present at run time. A parallel agent is expanding the card pool; re-run `npm run dev:playtest` after that lands to refresh every metric.

Matches: **300** · maxTurns: 60 · pool: **4129** playable cards (4203 total) · factions: STONE, IRON, BRONZE, SILVER, GOLD

## Match length
- avg **17.98** turns · median 15 · p90 36 · range 4–45
- turn-cap / stalemate hits: 0 (0%)

## First-player advantage
- decided games: 300 · **first-player win-rate 48.7%**

## Faction balance (non-mirror)
| Faction | Win-rate | W/G |
|---|---|---|
| GOLD | 65.6% | 63/96 |
| SILVER | 59.4% | 57/96 |
| STONE | 55.2% | 53/96 |
| IRON | 51% | 49/96 |
| BRONZE | 18.8% | 18/96 |

## Decisiveness
- nexus-kill 281 (93.7%) · deck-out 19 (6.3%) · timeout/stalemate 0 (0%)

## Tempo / curve
- energy available/turn 7.41 · spent/turn 2.39 · utilization 32.3% · stuck turns 2.6%

## Keywords — DEATHKNELL / DEPLOY
- pool carriers: DEATHKNELL 5 (0.1%), DEPLOY 3 (0.1%)
- triggers: DEPLOY 157 (0.52/match), DEATHKNELL 184 (0.61/match)
- carrier-deck win-rate: DEATHKNELL 34.4% (33/96), DEPLOY 40.3% (58/144)
- deepest single-action death cascade: 4 (all matches terminated → no runaway)

## Card performance
- distinct cards played: 60
- dead cards (in a deck, never played): 89
- top by appearance:
  - Sovereign of the Gilded Oath [GOLDEN_SOVEREIGNS] ×82 (27.3%)
  - Cairn of Mournful Winds [STONE_KEEPERS] ×81 (27%)
  - Prism in the Gloom [SILVER_SENTINELS] ×74 (24.7%)
  - Seer of Silent Depths [STONE_KEEPERS] ×73 (24.3%)
  - Wildwood Watcher of Ashes [BRONZE_GUARDIANS] ×72 (24%)
  - Loam of Verdant Oaths [BRONZE_GUARDIANS] ×72 (24%)
  - Coppice of the Verdant Oath [BRONZE_GUARDIANS] ×71 (23.7%)
  - Bedrock of Forgotten Whispers [STONE_KEEPERS] ×69 (23%)
  - Bramble of the Old Grove [BRONZE_GUARDIANS] ×69 (23%)
  - Grove of the Grove [BRONZE_GUARDIANS] ×69 (23%)
  - Stoneward's Silent Watcher [STONE_KEEPERS] ×68 (22.7%)
  - Standing-Stone of Silent Depths [STONE_KEEPERS] ×68 (22.7%)

## Flags / anything OFF
- Faction GOLD win-rate out of band: 65.6% (sane ~40-60%).
- Faction BRONZE win-rate out of band: 18.8% (sane ~40-60%).
- 89 DEAD card(s) (in a deck but never played).
- DEATHKNELL-carrying decks warp win-rate: 34.4%.
- Chain-reaction cascades terminate: all 300 matches completed; deepest single-action death cascade = 4.
