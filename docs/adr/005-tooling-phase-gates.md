# ADR-005 — Fondations, versions et validation

## Décision

pnpm workspaces, TypeScript strict, Node LTS, tests natifs Node, Prettier et
ESLint pour les scripts JavaScript. Les 8 workspaces sont des modules compilables
sans logique métier ; Fastify est retenu pour la Phase 3, Next.js pour les
phases dashboard. Installer ces frameworks maintenant n’apporterait pas de
contrôle de fondation. Leurs versions sont inventoriées et seront revérifiées
avant leur installation dans la phase correspondante.

TypeScript 7.0.2 est stable ; typescript-eslint 8.74.0 déclare TypeScript <6.1.
Nous n’ignorons pas cette incompatibilité : pas de parseur ESLint TS installé.
TypeScript strict, Prettier et garde de frontières couvrent les fichiers TS.
Réévaluer le parseur à sa prochaine version compatible.

Versions exactes, lockfile généré par pnpm, scripts d’installation désactivés,
actions par SHA, images par version et digest lorsque le registre le permet.
Node LTS 26.13.1 préféré aux builds alpha 27. La version Compose de référence
est enregistrée ; la CI l’installe et vérifie son checksum officiel.

## Barrière

`pnpm check:phase0` combine contrôles locaux, infrastructure et validation de
`docs/phase-0-status.json`. Il reste rouge si la revue des specs et la CI distante
n’ont pas de preuve associée au commit testé. Les tests normaux peuvent passer
avant cette approbation ; cela ne débloque pas la Phase 1.

Le scanner zéro clair est testé avec canaris positifs/négatifs dès maintenant.
Son branchement au vrai E2E est requis en Phase 3 ; ne jamais appeler ses
fixtures synthétiques une preuve de confidentialité de l’application.
