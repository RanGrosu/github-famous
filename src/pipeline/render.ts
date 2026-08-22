import { readFileSync } from 'fs';
import path from 'node:path';
import Handlebars from 'handlebars';
import { ScoredRepo } from './select';

Handlebars.registerHelper('lt', (a, b) => a < b);
Handlebars.registerHelper('gte', (a, b) => a >= b);
Handlebars.registerHelper('and', (a, b) => a && b);
Handlebars.registerHelper('formatNumber', (num: number) => num.toLocaleString());
Handlebars.registerHelper('truncate', (str: string, len: number) => {
  if (len <= 0) return str;
  if (str.length <= len) return str;
  if (str[len - 1] === ' ') len -= 1; // trailing space
  return str.slice(0, len) + '…';
});

export function render(templateName: string, repos: ScoredRepo[]): string {
  // Read template file from src; only *.ts files are compiled to dist/
  const absolutePath = path.join(process.cwd(), 'src', 'templates', templateName);
  const templateSource = readFileSync(absolutePath, 'utf-8');
  const template = Handlebars.compile(templateSource);

  const now = new Date();
  const date = now.toISOString().split('T')[0];

  const descLimit = parseInt(process.env.RELEASE_TRUNCATE_DESC!);

  // Template-urile itereaza peste `sections`, ca sa nu duplicam markup-ul.
  // Cand selectia nu e impartita pe categorii (sau repo-urile vin fara `section`,
  // ca in teste), cade inapoi pe o singura sectiune cu toate repo-urile.
  const discoveries = repos.filter(repo => repo.section === 'discoveries');
  const movers = repos.filter(repo => repo.section === 'movers');

  const sections =
    discoveries.length || movers.length
      ? [
          {
            title: '🌱 fresh finds',
            subtitle: 'new projects picking up speed',
            repos: discoveries,
          },
          {
            title: '🚀 big movers',
            subtitle: 'established repos surging this week',
            repos: movers,
          },
        ].filter(section => section.repos.length > 0)
      : [{ title: '🔥 fresh trends', subtitle: 'x3 star growth over the past week', repos }];

  return template({ repos, sections, date, descLimit });
}
