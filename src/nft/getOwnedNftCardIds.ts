export function getOwnedNftCardIds(tokenIds: Array<string | number>): string[] {
  const cleaned = tokenIds
    .map((tokenId) => String(tokenId).trim())
    .filter((tokenId) => tokenId.length > 0);

  const unique = Array.from(new Set(cleaned));

  return unique.map((tokenId) => `nft_unit_${tokenId}`);
}
