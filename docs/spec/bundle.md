# Bundle de preuve

## Conteneur et version

Manifeste JSON canonique RFC 8785, octets de preuves base64url, aucun témoin,
valeur, sel d’engagement, libellé ni clé. Entiers larges sous forme de chaînes.
`bundle_hash=SHA-256(manifeste canonique sans bundle_hash)` ; hash d’intégrité,
pas une signature ni une preuve ZK. Refuser champs inconnus, versions non supportées,
doublons et nombres non canoniques. Limites V1 : 16 MiB par upload, 4096 preuves,
profondeurs exactes ; découpage ou protocole futur nécessaire au-delà, pas de
parsing illimité. Une requête trop grande échoue explicitement `scope_too_large`.

Champs requis :

| Champ                                              | Type / contrainte                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| protocol                                           | ProtocolProfile complet, IDs exacts connus                                           |
| request_id, circuit_id, circuit_version, spec_hash | Identité immutable                                                                   |
| template, column_index, column_type, params        | Définition publique et bornes encodées                                               |
| scope                                              | tenantId, partition_id, ts_from inclusif, ts_to exclusif                             |
| snapshot                                           | l2ChainId, registry, codeHash, blockNumber, blockHash, anchorCount, tenantBatchCount |
| assurance                                          | L2, L1 ou L1_FINALIZED                                                               |
| deployments                                        | Versions et adresses L2/L1 approuvées                                                |
| artifacts                                          | IDs, sha256, proofSystemId, ceremony, vkey hash                                      |
| batches                                            | Liste ordonnée complète de batchId et champs Anchor                                  |
| batches[].blocks                                   | startIndex, N, publicSignals, proof, artifact ID                                     |
| batches[].anchorPath                               | anchorIndex, 32 siblings, root au snapshot                                           |
| checkpoint                                         | Obligatoire en L1 : index, struct complète, tx/block L1, chemin/état canonique       |
| total_in_scope                                     | Somme vérifiable ; zéro traité explicitement                                         |

Un profil ne charge jamais du code arbitraire : registre d’adaptateurs local
allowlisté. Pas de lien de téléchargement arbitraire pour vkey : catalogue
d’artefacts approuvé, hash vérifié avant usage. Même moteur, profil, version de
circuit et scope dans tous les blocs ; mélange => rejet.

## Signaux publics

L’ordre exact est versionné dans le manifeste d’artefact du circuit : root,
partition, from, to, columnIndex/type, seuils encodés, startIndex, N, count du
batch, présence/frontières de bloc, bornes de la partition cible, countInScope.
Tout champ du manifeste qui influe sur le prédicat est comparé à ces signaux.
Les chemins et les valeurs/sels restent privés dans le circuit ; les métadonnées
de jonction publiées sont contraintes par la reconstruction des feuilles.
Le format binaire d’une preuve relève de `ProofVerifier` identifié par ID,
pas d’un parseur Groth16 dans le code métier.

## Vérification indépendante

1. Parser sous limites ; résoudre le profil et artefacts connus, vérifier hashes.
2. Lire chainId/codehash/bloc canonique depuis les RPC du vérificateur, pas ceux
   dictés par le bundle. Fixer tous les appels au même snapshot.
3. Énumérer indépendamment l’inventaire complet des batchs du tenant et comparer
   chaque Anchor, séquence, root et metadata. Refaire les feuilles keccak.
4. Vérifier toutes les preuves via le port `ProofVerifier`, puis toutes les
   jonctions et la couverture selon completeness. Les succès individuels ZK
   seuls ne constituent pas un bundle valide.
5. Vérifier chaque anchorPath à la racine L2 du snapshot. En L1, relire le
   checkpoint, sa chaîne prevHash, le bloc L2 référencé et la racine, puis
   l’inclusion/finalité L1 demandée. En L2, ne pas annoncer d’assurance L1.
6. Produire valid + assurance effectivement observée + snapshot + avertissement
   sur limites. RPC indisponible : indeterminate, jamais valid. Preuve mauvaise :
   invalid avec code stable sans contenu secret. empty_scope distinct de valid.

Tests : mauvais ordre de signaux, mauvaise vkey/cérémonie/profil, replay autre
requête ou réseau, batch/bloc absent, couverture L1 trop ancienne, root falsifiée,
checkpoint divergent, parsers limités, RPC non canonique, somme compte incorrecte.
