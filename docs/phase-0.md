# Phase 0 — fondations et spécifications

Branche : `phase/0-foundations`. Périmètre : aucune implémentation métier,
aucun circuit/proof benchmark, aucun contrat déployé. Les interfaces font
partie de la fondation ; les adaptateurs viendront dans les phases dédiées.

La consigne du propriétaire du 2026-11-24 remplace les deux Anvil du cadrage :
Sepolia et Arbitrum Sepolia dès le premier développement, interfaces et
adaptateurs obligatoires. Voir ADR-006 et AGENTS.md.

## Critères d’acceptation

| Critère        | Preuve attendue                                                                 |
| -------------- | ------------------------------------------------------------------------------- |
| Monorepo       | 8 workspaces compilables, ESM strict, frontières client/plateforme              |
| Versions       | Sources officielles, versions exactes, lockfile, SHA actions, digests images    |
| CI             | pnpm install --frozen-lockfile, lint, typecheck, test et build verts sur GitHub |
| Infrastructure | PostgreSQL/Redis healthy, SQL SELECT 1 et Redis PING réussis                    |
| Réseaux        | Lecture réelle chainId/blocs Sepolia et Arbitrum Sepolia, sans wallet           |
| Specs          | Revue cohérente des 8 specs et 6 ADR, empreinte du contenu revu                 |
| Zéro clair     | Test défini ; scanner testé avec canaris et preuves manquantes                  |
| Extensibilité  | Ports hash/arbre/ZK/chiffrement/coffre/RPC/signature, profil versionné          |

## Exécution locale

`pnpm check` exécute les contrôles de code. `pnpm dev:init && pnpm infra:up &&
pnpm test:infra` contrôle les services. `pnpm test:chains` vérifie les testnets.
`pnpm check:phase0` ajoute le contrôle de preuve de revue/CI ; un critère non
observé reste bloquant, même si les tests locaux sont verts.

Le scanner Phase 0 utilise des fixtures synthétiques et ne prouve pas encore
le zéro clair du produit. Le véritable E2E est obligatoire en Phase 3, puis
étendu aux preuves et navigateur. Aucun test ZK ni de contrat n’est annoncé ici.

## État du passage de phase

La source machine est `phase-0-status.json`. Tant que `remoteCi` est pending
ou qu’une preuve manque, la Phase 1 reste fermée. La revue technique des specs
peut être faite par l’ingénieur ; elle ne vaut pas audit cryptographique externe.
Le rapport final de cette session précisera les commandes et résultats réels.

## Résultats observés le 2026-11-24

- Node 26.13.1 et Compose 5.8.0 téléchargés dans `.local/` et vérifiés contre
  leurs checksums officiels ; aucune mise à jour globale de la machine.
- Installation pnpm 12.23.0 avec lockfile figé réussie, y compris hors ligne.
- Lint, TypeScript strict, tests de contrats de types et compilation réussis.
- 35 tests Node réussis : frontières, fondations et scanner zéro clair.
- Lectures RPC réelles réussies sur Sepolia 11155111 et Arbitrum Sepolia 421614,
  avec contrôle des blocs latest et finalized/safe ; aucune transaction envoyée.
- Revue technique des spécifications : encodages/AAD, frontières des clés,
  séparation des ports, couverture totale, profils versionnés et finalité
  cohérents. Audit crypto et tests des implémentations restent aux phases prévues.
- Le 2026-11-25, PostgreSQL et Redis ont démarré avec Compose. Les contrôles
  `SELECT 1` et `PING` ont réussi. Les jobs `quality` et `integration` ont réussi
  sur le commit `d65f63b` ([exécution GitHub Actions](https://github.com/roab-912/ProofBase/actions/runs/45574440378)).
