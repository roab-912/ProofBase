# Versions vérifiées

Vérification directe des registres officiels le **2026-11-24**. Les versions
effectivement installées sont exactes dans package.json et pnpm-lock.yaml.
Le lockfile pnpm 12 contient plusieurs documents YAML ; tous doivent être lus.

| Outil                   | Version                                                                 | Usage                                                    | Source                                                                               |
| ----------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Node LTS                | 26.13.1                                                                 | Exécution et CI                                          | [index officiel](https://nodejs.org/dist/index.json)                                 |
| pnpm                    | 12.23.0                                                                 | Phase 0, épinglé                                         | [registre](https://registry.npmjs.org/pnpm/latest)                                   |
| typescript              | 7.0.2                                                                   | Phase 0, épinglé                                         | [registre](https://registry.npmjs.org/typescript/latest)                             |
| prettier                | 3.10.1                                                                  | Phase 0, épinglé                                         | [registre](https://registry.npmjs.org/prettier/latest)                               |
| eslint                  | 10.15.0                                                                 | Phase 0, épinglé                                         | [registre](https://registry.npmjs.org/eslint/latest)                                 |
| typescript-eslint       | 8.74.0                                                                  | Non installé : incompatible TS 7                         | [registre](https://registry.npmjs.org/typescript-eslint/latest)                      |
| yaml                    | 2.9.1                                                                   | Phase 0, épinglé                                         | [registre](https://registry.npmjs.org/yaml/latest)                                   |
| fastify                 | 5.12.8                                                                  | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/fastify/latest)                                |
| zod                     | 4.6.7                                                                   | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/zod/latest)                                    |
| drizzle-orm             | 0.45.4                                                                  | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/drizzle-orm/latest)                            |
| bullmq                  | 6.7.10                                                                  | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/bullmq/latest)                                 |
| viem                    | 2.58.6                                                                  | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/viem/latest)                                   |
| next                    | 16.4.6                                                                  | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/next/latest)                                   |
| react                   | 19.3.1                                                                  | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/react/latest)                                  |
| tailwindcss             | 4.3.5                                                                   | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/tailwindcss/latest)                            |
| libsodium-wrappers-sumo | 0.8.4                                                                   | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/libsodium-wrappers-sumo/latest)                |
| circomlib               | 2.0.5                                                                   | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/circomlib/latest)                              |
| circomlibjs             | 0.1.7                                                                   | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/circomlibjs/latest)                            |
| snarkjs                 | 0.7.6                                                                   | Inventaire futur ; revérifier avant installation         | [registre](https://registry.npmjs.org/snarkjs/latest)                                |
| iden3/circom            | v2.2.3                                                                  | Inventaire futur ; revérifier à utilisation              | [release](https://github.com/iden3/circom/releases/tag/v2.2.3)                       |
| iden3/rapidsnark        | v0.0.8                                                                  | Inventaire futur ; revérifier à utilisation              | [release](https://github.com/iden3/rapidsnark/releases/tag/v0.0.8)                   |
| ethereum/solidity       | v0.8.39                                                                 | Inventaire futur ; revérifier à utilisation              | [release](https://github.com/argotorg/solidity/releases/tag/v0.8.39)                 |
| foundry-rs/foundry      | v1.10.0                                                                 | Inventaire initial uniquement ; Anvil interdit (ADR-006) | [release](https://github.com/foundry-rs/foundry/releases/tag/v1.10.0)                |
| redis/redis             | 8.12.0                                                                  | Inventaire futur ; revérifier à utilisation              | [release](https://github.com/redis/redis/releases/tag/8.12.0)                        |
| docker/compose          | v5.8.0                                                                  | Compose local et CI                                      | [release](https://github.com/docker/compose/releases/tag/v5.8.0)                     |
| actions/checkout        | v7.0.1                                                                  | CI, SHA 3d3c42e5aac5ba805825da76410c181273ba90b1         | [release](https://github.com/actions/checkout/releases/tag/v7.0.1)                   |
| actions/setup-node      | v7.1.0                                                                  | CI, SHA 949feb2413d6458794dcd2491c4babbbce0c15c1         | [release](https://github.com/actions/setup-node/releases/tag/v7.1.0)                 |
| pnpm/action-setup       | v6.1.1                                                                  | CI, SHA 73e46992e05b19abd31f2f3c20e0e7370d762115         | [release](https://github.com/pnpm/action-setup/releases/tag/v6.1.1)                  |
| postgres:19.0-alpine    | sha256:cac45fb483caee3668946088a1c0532db89d5285c28dbfeac889b4068296e06f | Compose, digest immutable                                | [registre](https://hub.docker.com/v2/repositories/library/postgres/tags/19.0-alpine) |
| redis:8.12.0-alpine     | sha256:5af80107c1eeecb484a2269b80a26d12bfa6521787da4663bd9f19f60a163483 | Compose, digest immutable                                | [registre](https://hub.docker.com/v2/repositories/library/redis/tags/8.12.0-alpine)  |

PostgreSQL 19.0 a aussi été contrôlé dans les [notes officielles](https://www.postgresql.org/docs/release/).
WebCrypto est fourni par Node/navigateur, pas un paquet à installer. shadcn/ui est
un générateur de composants : pas encore exécuté, aucune dépendance UI installée.
Noir/Barretenberg seront examinés et épinglés au benchmark de Phase 1.

La dernière version stable observée directement pour pnpm (12.23.0) diffère
de certains résultats de recherche indexés (12.19.0) : le registre direct prévaut.
Aucune préversion/nightly sélectionnée. Les builds alpha Node 27 sont exclus.

Les packages inutilisés sont un inventaire, pas une promesse de compatibilité.
Les futurs adaptateurs feront l’objet de tests de contrat et de revue de dépendances.
Le Docker Engine appartient à la machine ; il n’est pas mis à jour par ce dépôt.
