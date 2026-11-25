# Contrats — emplacement réservé

Phase 2 : AnchorRegistry sur L2 et CheckpointRegistry sur L1, sans proxy.
Voir `docs/spec/two-level-anchoring.md`. Tests Foundry unitaires, fuzz et
invariants avant implémentation. Aucun contrat ni déploiement en Phase 0.
Solidity 0.8.39 vérifié ; revérifier avant Phase 2. Les tests d’intégration
utiliseront Sepolia et Arbitrum Sepolia, jamais Anvil (ADR-006).
