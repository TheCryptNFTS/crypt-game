# S-TIER AUDIT

## Current truth
The project is not S-tier yet.

### Proven working
- NFT/TCG import pipeline
- generated unit/equipment/artifact separation
- equipment play
- artifact play
- keyword targeting basics
- generated deck validation
- full match smoke flow
- turn/combat smoke flow

### Failing / weak
- 1544 outlier cards flagged
- 2-cost pool massively overstatted
- curated deck builder outputs illegal decks
- faction balance skewed
- faction identity not strong enough
- effect layering not hardened
- QA coverage too narrow

## Top priorities
1. Fix stat budget generation
2. Fix curated legal deck building
3. Define faction mechanics
4. Harden deterministic rules layer

## Expert verdicts
### Systems Designer
Core loop exists. Card economy does not.

### Balance Analyst
Generated pool is not safe to ship.

### Engine Architect
Prototype works. Rules core is not hardened.

### Gameplay QA
Only happy-path coverage exists.

### Lore Director
Strong world, weak mechanical canonization.

### Product Designer
Playable foundation exists, retention hook is weak.

## Red team summary
- stat soup risk
- faction identity collapse risk
- curated set credibility risk
- state/rules fragility risk
