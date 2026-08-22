# State — github-famous (newsletter GitHub trending)

## Ce e proiectul
Fork adaptat dupa `mhadidg/gh-trends`. Scaneaza evenimentele GitHub din ClickHouse,
alege top 20 repo-uri in crestere si trimite un email prin Resend.
Repo live: https://github.com/RanGrosu/github-famous (PUBLIC)

## Stare: FUNCTIONAL, pe automat
- Cron: sambata, `27 9 * * 6` UTC = 12:27 ora Romaniei (vara) / 11:27 (iarna)
- Destinatar: andreirobert436@gmail.com | Expeditor: onboarding@resend.dev
- Prima trimitere reusita: 2026-08-22, 20 repo-uri, Resend ID 5d0b268f-6c05-444d-84f5-5b35d8a4f1c1

## Config pe GitHub
Secrets: `RESEND_API_KEY`, `RESEND_TO`, `GH_PAT`
Variables: `RESEND_FROM`
Repo-ul e PUBLIC ca sa avem minute Actions nelimitate. Daca il faci privat,
minutele se contorizeaza din nou (~10 min/luna, cota gratuita e 2000).

## Capcane rezolvate (nu le repeta)
1. `secrets.GITHUB_TOKEN` (tokenul automat de Actions) NU poate citi `stargazers`
   pe repo-uri straine -> FORBIDDEN. Trebuie PAT propriu, mapat prin `GH_PAT`.
2. PAT **fine-grained** nu merge nici el pe `stargazers`. Trebuie **classic**.
3. `HAVING starsBefore > 0` in clickhouse.ts parea fix de impartire la zero, dar
   elimina exact repo-urile complet noi (in ClickHouse N/0 = inf, deci treceau
   intentionat). Cu garda: 2 repo-uri. Fara: 150. Acum e `starsBefore = 0 OR ...`.
4. `cdp.mjs` din .claude/skills strica pragul de coverage la pre-push (37% vs 80%).
   Exclus in vitest.config.ts.

## Ramase de facut
- [x] Heartbeat in workflow (commit gol la fiecare rulare) - FACUT, testat
- [x] `GITHUB_TOKEN` local inlocuit cu PAT classic - FACUT, preview:live merge
- [x] Praguri pe trepte de marime + doua sectiuni cu locuri rezervate - FACUT
- [x] Template-urile arata catre RanGrosu/github-famous/releases - FACUT
- [x] GitHub Releases activate (arhiva de editii + notificari) - FACUT, #57 creat
- [ ] Peste ~1 luna: reverifica pragurile. Sunt calibrate pe coverage-ul de
      azi (~1,5%); daca ingestia ClickHouse se schimba, numerele nu mai tin.

## Cum reglezi selectia (totul din .env, fara cod)
SCAN_BIG_REPO_AT=10000     granita mic/mare, in stele REALE
SCAN_MIN_STARS_SMALL=8     cat trebuie sa castige un repo mic (~+500 real)
SCAN_MIN_STARS_BIG=30      cat trebuie sa castige unul mare (~+2000 real)
RELEASE_TOP_DISCOVERIES=10 locuri rezervate sectiunii "fresh finds"
RELEASE_TOP_MOVERS=10      locuri rezervate sectiunii "big movers"
Sterge oricare din primele trei si te intorci la selectia veche, doar pe rata.

De ce locuri rezervate si nu o singura lista: scorul (select.ts:20) e
starsPerHour, marime absoluta. Un repo care ia 300 de stele bate mereu unul
care ia 20, deci o lista unica ajunge intotdeauna numai repo-uri mari.
Masurat: cu prag unic ieseau 2 mici / 17 mari; cu locuri rezervate, 10/10.

## Limitare importanta a sursei de date (masurat 2026-08-22)
Datasetul public ClickHouse `github.events` are ingestia degradata:
sep 2025 = 120.763 stele/zi -> aug 2026 = 1.671/zi, adica ~1,5% din realitate.
Istoricul vechi e complet (facebook/react: 291.808 evenimente vs 247.624 stele reale),
doar datele recente lipsesc. Ordinea/ranking-ul ramane valid, magnitudinile nu.
Consecinta: un prag absolut trebuie scris in unitatile datasetului
(+500 stele reale ~ 8 evenimente, +2000 ~ 30), NU in stele reale.
Solutia de fond ar fi mutarea sursei pe GH Archive via BigQuery (1TB/luna gratuit).

## Fisiere locale care NU se commit
`.secrets/API.txt` (cheia Resend), `.env`, `NPM START.png` — toate in .gitignore.
