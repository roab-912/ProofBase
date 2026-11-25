# ADR-006 — Testnets réels et interfaces obligatoires

Date : 2026-11-24. Décision demandée explicitement par le propriétaire du projet.
Remplace les deux Anvil du cadrage et les dispositions locales d’ADR-002/005.

## Réseaux dès le premier développement

Sepolia (11155111) et Arbitrum Sepolia (421614) uniquement. Aucun Anvil,
aucune blockchain locale ni fork mainnet, aucun repli silencieux sur simulateur.
Compose contient seulement PostgreSQL et Redis. Les contrôles CI de réseaux
interrogent réellement les deux testnets, en lecture ; une indisponibilité est
un échec explicite. Mocks de ports pour tests unitaires autorisés, mais ils ne
peuvent pas valider un critère d’intégration blockchain.

Les URLs publiques permettent les lectures initiales. L’utilisateur fournira
RPC authentifiés/API et wallets de testnet lorsque des écritures seront requises.
Les clés opérationnelles sont configurées dans un signataire via fichier ignoré
à accès restreint ou gestionnaire de secrets, jamais dans les interfaces métier,
logs, Git ou conversation. Pas de clé privée requise pour les tests Phase 0.
Séparer signer L1 et L2, vérifier chainId et destination avant signature.

## Interfaces et injection obligatoires

Chaque fonctionnalité dépend de ports/interfaces TypeScript explicites pour
ses entrées/sorties et dépendances externes : hash, arbre, preuve, chiffrement,
coffre, RPC, signature, persistence, queue, horloge. Les adaptateurs concrets
sont injectés au point de composition ; pas de singleton global ni import d’une
bibliothèque crypto ou RPC dans le métier. Les nouveaux ports de persistance,
queue et horloge sont définis lors des fonctionnalités qui en ont besoin.

`core/ports.ts` contient les contrats publics `HashPort`, `MerklePort`,
`ProofVerifier`, `ChainReader`, `ChainWriter`, `TransactionSigner`.
`prover/ProofSystem` garde compile/setup/prove et les témoins côté client.
`sdk/EncryptionPort` et `VaultPort` gardent les secrets côté client. Pas de `any`
ni cast pour contourner la frontière. Tests de contrat communs à chaque adaptateur.

`ProtocolProfile` et `config/protocol.json` identifient encodage, hash, arbre,
moteur ZK et suite de chiffrement dans les artefacts/bundles. Le registre
d’adaptateurs futur résout exactement les IDs autorisés, jamais un module
fourni par le bundle. Incompatibilité => rejet, pas de conversion implicite.

## Changer un algorithme

Changer de hash implique nouvelles racines, circuits/contraintes, vecteurs et
éventuellement contrats ; changer de moteur ZK implique nouveaux artefacts,
clés de vérification et cérémonie. Créer un nouveau profil/version, conserver
les adaptateurs de lecture/vérification historiques, migrer explicitement les
nouvelles écritures. Les ports réduisent le couplage ; ils ne rendent pas les
engagements historiques interchangeables. Rebenchmark et tests négatifs requis.
