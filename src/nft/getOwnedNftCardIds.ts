/**
 * Map owned OpenSea token ids → playable card ids.
 *
 * The live card catalogue (runtimeMatchPlayableCards / generatedTcgCards) is
 * keyed `tcg_<tokenId>` — verified: token 6658 → card `tcg_6658`, full
 * coverage of the 4129-card collection. The old `nft_unit_<tokenId>` scheme
 * pointed at a stale, incomplete set the live engine never loads, so every
 * owned deck resolved to EMPTY (which is why createOwnedNftMatch sat unused).
 */
export function getOwnedNftCardIds(tokenIds: Array<string | number>): string[] {
  const cleaned = tokenIds
    .map((tokenId) => String(tokenId).trim())
    .filter((tokenId) => tokenId.length > 0);

  const unique = Array.from(new Set(cleaned));

  return unique.map((tokenId) => `tcg_${tokenId}`);
}
