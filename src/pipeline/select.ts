import { clamp, daysSince, hoursSince, median } from '../utils/common';
import { GithubRepo } from '../clients/github.gql';
import { logInfo } from '../utils/logging';

export type Section = 'discoveries' | 'movers';

export interface ScoredRepo extends GithubRepo {
  score: number;
  section?: Section;
}

export function select(repos: GithubRepo[]): ScoredRepo[] {
  const topN = parseInt(process.env.RELEASE_TOP_N!);

  const ranked = repos
    .map(repo => {
      const maxHours = parseInt(process.env.SCAN_WINDOW_DAYS!) * 24;
      const hoursSinceFirstSeen = clamp(hoursSince(repo.clickhouse.firstSeenAt), 1, maxHours);
      const starsPerHour = parseInt(repo.clickhouse.starsWithin) / hoursSinceFirstSeen;

      // Reward repos with senior stargazers
      // Also, penalize repos with fake stars (fresh users)
      const stargazersAge = repo.stargazers.nodes.map(u => Math.round(daysSince(u.createdAt)));
      const medianStargazersAge = median(stargazersAge)!;

      // Adjust for eval date if set (historical scans)
      const evalDate = process.env.SCAN_EVAL_DATE;
      const daysSinceEval = evalDate ? daysSince(evalDate) : 0;

      const score = starsPerHour * ((medianStargazersAge - daysSinceEval) / 365);
      return { ...repo, score };
    })
    .sort((a, b) => b.score - a.score);

  // Locuri rezervate pe categorii. Fara ele, o singura lista ordonata e mereu
  // dominata de repo-urile mari: scorul e starsPerHour, o marime absoluta, deci
  // unul care ia 300 de stele bate mereu unul care ia 20, oricat de spectaculoasa
  // ar fi cresterea celui mic. Asa, fiecare categorie concureaza doar cu ea insasi.
  const bigAt = parseInt(process.env.SCAN_BIG_REPO_AT ?? '');
  const topDiscoveries = parseInt(process.env.RELEASE_TOP_DISCOVERIES ?? '');
  const topMovers = parseInt(process.env.RELEASE_TOP_MOVERS ?? '');
  const sectioned = [bigAt, topDiscoveries, topMovers].every(n => Number.isFinite(n) && n > 0);

  if (!sectioned) {
    const top5Missed = ranked.slice(topN, topN + 5).map(repo => repo.nameWithOwner);
    if (top5Missed.length > 0) {
      logInfo('score', `missed the cut: ${top5Missed.join(', ')}`);
    }

    return ranked.slice(0, topN);
  }

  const tag = (list: ScoredRepo[], section: Section, take: number): ScoredRepo[] =>
    list.slice(0, take).map(repo => ({ ...repo, section }));

  const discoveries = tag(
    ranked.filter(repo => repo.stargazerCount < bigAt),
    'discoveries',
    topDiscoveries
  );
  const movers = tag(
    ranked.filter(repo => repo.stargazerCount >= bigAt),
    'movers',
    topMovers
  );

  logInfo(
    'score',
    `${discoveries.length} descoperiri (<${bigAt} stele), ${movers.length} in miscare (>=${bigAt})`
  );

  return [...discoveries, ...movers];
}
