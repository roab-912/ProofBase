# ProofBase — consignes de travail

Référence : `ProofBase — Spécification produit et roadmap V1.0.md`, révision 2.
Lire `docs/phase-0.md`, les ADR et `docs/spec/README.md` avant toute modification.

## Règles permanentes du propriétaire (2026-11-24)

Ces règles remplacent les passages contradictoires du document initial :

- Sepolia L1 et Arbitrum Sepolia L2 dès le début ; aucun Foundry Anvil,
  blockchain locale ou fork en substitution des tests d’intégration.
- Chaque développement doit utiliser des interfaces/types explicites et des
  adaptateurs injectés. Hash, arbre, moteur ZK, chiffrement, RPC, stockage et
  signature ne doivent pas être couplés au code métier. Voir ADR-006.
- Toute donnée engagée/artefact/bundle porte son profil de protocole. Changer
  de hash ou de moteur ZK crée une version et conserve la vérification historique.
- L’utilisateur fournira les accès RPC/API et wallets testnet pour les écritures.
  Les clés privées opérationnelles restent hors Git et logs, dans un signataire
  isolé ; ne jamais les confondre avec les clés de chiffrement des tenants.

## Règle d’or

Aucun clair métier, clé de coffre/déchiffrement, passphrase, sel secret,
kit de récupération ni témoin dans `apps/api`, `apps/worker`, `apps/admin`,
PostgreSQL, Redis, HTTP vers la plateforme, logs, télémétrie ou artefacts CI.
Seuls `packages/sdk`, `packages/prover` et le navigateur utilisateur manipulent
ces secrets. Aucun worker de preuve hébergé. `packages/core` reste public :
encodage non secret, types, engagements, arbres ; le chiffrement reste dans le SDK.
Le SSR et les Server Actions de `apps/web` sont côté plateforme. Le coffre
résidera dans `src/client/`, avec `use client`, sans sérialisation serveur.
Les identifiants d’infrastructure sont distincts des clés des tenants ; voir ADR-003.
Les signatures opérationnelles passent par un signataire externe en production.

## Phases et décisions

- Une branche `phase/<numéro>-<sujet>` et une PR par phase.
- Pas de Phase 1 tant que tous les critères de `docs/phase-0.md` ne sont pas verts.
  Un workflow écrit ou un test non exécuté ne constitue pas une CI verte.
- Toute décision non prévue ou modification du protocole requiert un ADR court.
- Tests d’abord pour crypto, circuits, contrats ; vecteurs partagés TS/Circom.
- Aucun secret réel dans Git ; aucun déploiement mainnet ; aucune cérémonie
  de développement utilisable en production.
- Enchaîner les développements d’une même phase jusqu’à ses critères
  d’acceptation. Remettre au propriétaire les commandes Git de publication
  en fin de phase. Conserver le périmètre de la PR.

## Commandes

Installer Node selon `.node-version` et pnpm selon `packageManager`.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev:init
pnpm infra:up
pnpm test:infra
pnpm test:chains
pnpm check:phase0
pnpm infra:down
```

`pnpm test` exécute les contrôles de fondation, les tests de frontières et le
scanner zéro clair. Aucun de ces tests ne prétend vérifier une preuve ZK.
`pnpm format` reformate ; `pnpm lint` contrôle format, JavaScript et frontières ;
`pnpm typecheck` contrôle TypeScript strict ; `pnpm build` compile les 8 espaces.

Pour la Phase 1, exécuter également `pnpm test:circuit` et le parcours de
preuve chiffré de [docs/phase-1.md](docs/phase-1.md). Conserver les témoins
temporaires, paramètres de développement et clés hors des artefacts CI.

## Conventions

TypeScript ESM strict, fonctions explicites, erreurs sans contenu sensible.
Identifiants et compteurs 64 bits transportés comme chaînes, jamais `number`.
Versions exactes et lockfile commité ; actions CI par SHA. Actualiser
`tools/versions.json` avec sources officielles avant tout nouvel épinglage.
Pas d’import relatif entre workspaces, pas de dépendance client dans un module
public/plateforme. Une nouvelle dépendance impose une revue de ses capacités.
Les gardes statiques sont une défense partielle, pas une preuve de confidentialité.
Ne pas journaliser corps HTTP, en-têtes d’authentification, valeurs ou témoins.
Ne pas joindre les dumps bruts à une PR ou un artefact CI.
