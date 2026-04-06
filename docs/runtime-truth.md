# Runtime Truth

## Canonical Rules

- A real match must be created through `createMatchFromDecks`.
- Commanders are deck identity objects and live in runtime state:
  - `player.commander`
  - `player.commanderZone`
- Commanders do NOT belong in the main deck.
- Main deck contains only playable TCG cards:
  - units
  - equipment
  - artifacts

## Validation

- Deck legality is validated through `src/engine/deckRules.ts`
- `src/engine/deckRulesV2.ts` is now a compatibility shim and must not diverge.
- Commander truth comes from `COMMANDER_SPECS`
- Commander runtime registry comes from `src/engine/commanders.ts`
- Playable card truth comes from `src/engine/cards.ts`

## Asset Truth

- OpenSea fetch output is stored in `src/data/openseaAssets.json`
- UI render data is stored in `src/data/renderManifest.json`
- Commander image mapping is explicit in `src/data/commanderImageMap.json`

## Production vs Dev

### Production path
- `createMatchFromDecks`
- `validateDeck`
- commander/playable registries
- render manifest

### Dev/test-only path
- raw `createMatch()`
- manual hand/board mutation
- synthetic or illegal state injection

Do not use dev mutation paths for real match startup.
