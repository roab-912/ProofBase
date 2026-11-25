# Spécifications normatives — proofbase/1

État : revue de cohérence technique Phase 0 effectuée par Codex le 2026-11-24 ;
empreinte dans `docs/phase-0-status.json`. Aucune implémentation cryptographique
validée, aucun audit externe. Les termes DOIT,
NE DOIT PAS et REJET désignent des exigences testables.

| Document                                      | Contenu                                                 |
| --------------------------------------------- | ------------------------------------------------------- |
| [leaf-format](leaf-format.md)                 | Champ, colonnes, sel, feuille et reçu                   |
| [encryption-vault](encryption-vault.md)       | AEAD, AAD, dérivation, coffre, rotation                 |
| [trees](trees.md)                             | Arbres Poseidon et keccak, padding, chemins             |
| [completeness](completeness.md)               | Périmètre, snapshot, couverture et cas limites          |
| [two-level-anchoring](two-level-anchoring.md) | Contrats, états, reorgs, finalité                       |
| [bundle](bundle.md)                           | Manifeste, signaux publics, vérification indépendante   |
| [api](api.md)                                 | Routes, scopes, formats, idempotence et confidentialité |
| [zero-clear](zero-clear.md)                   | Protocole du test de non-divulgation                    |

Les changements qui modifient un hash, l’ordre d’un signal ou l’encodage exigent
une nouvelle version de protocole et un ADR. Les vecteurs interopérables et
tests de contraintes seront produits avant les implémentations de Phase 1.
La validation documentaire ne remplace pas ces tests.

## Modèle de menace

Plateforme curieuse ou malveillante, stockage/logs compromis, prouveur malveillant,
RPC indisponible ou divergent, reorg, chiffré falsifié, réutilisation d’une preuve.
Confiance dans les primitives auditées, la cérémonie appropriée, le logiciel
client et les sources de consensus choisies par le vérificateur. Un navigateur
compromis peut voler sa propre clé : CSP et absence de scripts tiers sont requises.

Le serveur connaît identifiants opaques, volumes, tailles paddées, séquences,
horodatages d’ingestion, engagements et paramètres publics des preuves. Un
vérificateur peut apprendre seuil, partition pseudonyme, temps, nombre de blocs,
bornes de séquences et éventuellement compte. Pas de promesse de cacher ces
métadonnées ni la vérité des capteurs. Le relais L1 reste centralisé en V1.

## Revue et traçabilité

Revoir conjointement ADR-001 à ADR-006 et les huit specs. Vérifier :
encodages sans ambiguïté, séparation des clés, scopes, exclusions de logs,
preuves d’absence, jonctions de blocs/batchs, état pending, snapshot, reorg,
passphrase perdue et rotation. Consigner auteur/date/commit de la revue dans
`docs/phase-0-status.json` après la revue effective ; ne pas auto-attribuer
une approbation à une personne. Les cas adversariaux ci-dessous sont des
exigences futures, pas des tests ZK déjà exécutés.
