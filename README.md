# ProofBase

Base de données vérifiable, chiffrée côté client, avec ancrage L2 et checkpoints
L1. Ce dépôt contient la **Phase 0 uniquement** : espaces TypeScript compilables,
CI, infrastructure locale et spécifications. Aucun service métier ne tourne encore.

## Démarrer

Installer Node **26.13.1**, pnpm **12.23.0**, Docker avec Compose
(référence épinglée : **5.8.0**). Les versions et sources sont dans
[docs/toolchain.md](docs/toolchain.md).

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev:init
pnpm infra:up
pnpm test:infra
pnpm test:chains
pnpm infra:down
```

Sous PowerShell, utiliser `pnpm.cmd` si la politique locale bloque les scripts.
`dev:init` crée un mot de passe aléatoire d’infrastructure dans `.env` ignoré par
Git ; il ne remplace jamais un fichier existant. Ne jamais y mettre de clé tenant.
Docker Desktop doit être démarré en mode conteneurs Linux. Les ports 5432 et 6379
doivent être libres ; ils sont liés à `127.0.0.1` uniquement.

| Espace                    | Responsabilité future                            | Confiance                          |
| ------------------------- | ------------------------------------------------ | ---------------------------------- |
| `apps/api`                | REST, chiffrés, métadonnées, vérification        | Plateforme                         |
| `apps/worker`             | Ancrage L2, checkpoint L1                        | Plateforme                         |
| `apps/admin`              | Supervision des métadonnées                      | Plateforme                         |
| `apps/web`                | Dashboard ; coffre dans le navigateur uniquement | SSR plateforme / navigateur client |
| `packages/core`           | Types et primitives publiques, aucun coffre      | Public                             |
| `packages/sdk`            | Coffre, chiffrement, lecture locale              | Client                             |
| `packages/prover`         | Témoins et preuves chez le client                | Client                             |
| `packages/verifier`       | Vérification indépendante sans clé               | Public                             |
| `circuits/`, `contracts/` | Emplacements réservés aux phases 1 et 2          | Public                             |

Les réseaux sont **Sepolia (11155111)** et **Arbitrum Sepolia (421614)** dès
le développement. Aucun Anvil ni blockchain locale. `pnpm test:chains` vérifie
les vrais chain IDs et les blocs latest/safe/finalized en lecture seule.
Les RPC publics de `config/networks.json` peuvent être remplacés par les variables
de `.env.example`. Les wallets privés ne seront requis qu’aux phases d’écriture,
via un signataire isolé ; aucune clé n’est nécessaire à la Phase 0.
Les volumes PostgreSQL/Redis persistent après `infra:down`.

Les interfaces `HashPort`, `MerklePort`, `ProofVerifier`, `ProofSystem`,
`EncryptionPort`, `VaultPort` et les ports blockchain isolent les adaptateurs.
Chaque changement de hash/moteur crée un profil versionné, avec compatibilité
de lecture des anciens profils : voir [ADR-006](docs/adr/006-testnets-and-ports.md).

Voir [les critères Phase 0](docs/phase-0.md), [les spécifications](docs/spec/README.md)
et [les décisions](docs/adr/README.md). L’état réel des validations est consigné
dans le rapport Phase 0 ; une case non vérifiée interdit le passage en Phase 1.
