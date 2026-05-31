/** Remove users who already received another notification for the same event. */
export function excludeRecipientIds(
  candidateIds: string[],
  alreadyNotifiedIds: string[],
): string[] {
  const exclude = new Set(alreadyNotifiedIds);
  return candidateIds.filter((id) => !exclude.has(id));
}
