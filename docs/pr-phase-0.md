# Phase 0 : monorepo, testnets et contrats d’architecture

ProofBase dispose d’un monorepo pnpm de huit workspaces TypeScript stricts,
d’une CI lint/types/tests/build et d’une infrastructure PostgreSQL/Redis.
Les tests d’intégration blockchain ciblent Sepolia et Arbitrum Sepolia dès le
départ, conformément à la règle du propriétaire ; aucune blockchain locale.

Les ports typés isolent hash, arbre, ZK, chiffrement, coffre, RPC et signature.
Un profil versionné lie les algorithmes aux données et artefacts afin de
conserver la vérification des engagements historiques lors d’un changement.
Les capacités de preuve/déchiffrement restent côté client ; les tests de
frontières empêchent les dépendances client dans les workspaces plateforme.

Six ADR et huit spécifications définissent formats, complétude, ancrage,
bundle, API et scénario zéro clair. Les versions proviennent des registres
officiels, les images sont épinglées par digest et les actions par SHA.

Validation locale : installation figée, lint, types, build et 35 tests réussis ;
lectures réelles des deux testnets réussies. Voir `docs/phase-0.md` pour l’état
final de l’infrastructure et de la CI distante. Le scanner zéro clair est testé
sur des fixtures synthétiques ; le véritable scénario E2E reste obligatoire en
Phase 3. Aucun circuit, contrat ou service métier n’est implémenté dans cette PR.

La Phase 1 reste fermée tant que les critères de Phase 0 ne sont pas tous verts.
