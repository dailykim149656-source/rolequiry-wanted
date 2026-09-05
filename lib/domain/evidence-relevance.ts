export type RelevanceInput = {
  readonly role: string;
  readonly location: string;
  readonly evidenceText: string;
  readonly sourceUrl: string;
  readonly publishedAt?: string;
};

export type RelevanceScore = {
  readonly roleMatch: boolean;
  readonly locationMatch: boolean;
  readonly recency: number;
  readonly specificity: number;
};

export function scoreEvidenceRelevance(input: RelevanceInput): RelevanceScore {
  const text = `${input.evidenceText} ${input.sourceUrl}`.toLowerCase();
  const roleMatch = input.role
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 3)
    .some((token) => text.includes(token.toLowerCase()));
  const locationMatch = input.location
    ? text.includes(input.location.toLowerCase())
    : false;
  const year = Number((input.publishedAt ?? "").slice(0, 4));
  const recency = Number.isFinite(year) ? Math.max(0, Math.min(1, (year - 2020) / 6)) : 0.3;
  const specificity = Math.min(1, input.evidenceText.split(/\s+/).length / 18);
  return { roleMatch, locationMatch, recency, specificity };
}

export function clusterEvidence<T extends { readonly id: string; readonly sourceUrl: string; readonly text: string }>(
  items: readonly T[],
): Array<T & { clusterId: string }> {
  const clusters = new Map<string, string>();
  let n = 1;
  return items.map((item) => {
    const key = item.sourceUrl.replace(/\/$/, "");
    let clusterId = clusters.get(key);
    if (!clusterId) {
      clusterId = `cluster-${n}`;
      n += 1;
      clusters.set(key, clusterId);
    }
    return { ...item, clusterId };
  });
}
