# Format de feuille, colonnes et reçus

## Encodages normatifs

Champ scalaire BN254 :
`r = 21888242871839275222246405745257275088548364400416034343698204186575808495617`.
Poseidon est la permutation de référence circomlib/circomlibjs, état initial
zéro, une sortie, arité égale au nombre d’éléments ci-dessous. Ne pas substituer
Poseidon2. Les constantes et vecteurs seront gelés par hash avec les circuits
avant toute preuve. Un élément de champ est dans `[0,r)` ; rejeter hors borne,
jamais réduire une entrée modulo r.

Sur JSON : u64, i64 et éléments de champ sont des chaînes décimales canoniques
(zéro `"0"`, pas de `+`, zéros initiaux, exposant ou `-0`). u64 dans `[0,2^64-1]`.
`partition_id` est une chaîne hexadécimale minuscule `0x` suivie de 16 chiffres,
convertie en entier non signé pour le tri et Poseidon. Racines/bytes32 : 64
chiffres après `0x`, ordre big-endian. UUID : représentation canonique minuscule,
octets RFC 9562 en ordre réseau, jamais encodage texte dans les structures binaires.
Blobs : base64url sans padding, décodage puis réencodage identique obligatoire.

## Colonnes privées

Au maximum 8 colonnes, indexées 0..7 ; positions inutilisées remplies par zéro.
Le manifeste chiffré lie collection, version du schéma, types et échelles.
Changer types/ordre/échelles crée une nouvelle collection ; jamais réinterpréter
une ancienne colonne sous un nouveau schéma.

| Type      | Élément engagé                                                                       |
| --------- | ------------------------------------------------------------------------------------ |
| int64     | valeur exacte `x + 2^63`, x dans `[-2^63,2^63-1]`                                    |
| decimal   | entier signé à échelle fixée puis biais `+2^63` ; rejeter arrondi implicite          |
| bool      | 0 ou 1 uniquement                                                                    |
| timestamp | millisecondes Unix u64, sans biais                                                   |
| string    | UTF-8 NFC, SHA-256, deux limbs big-endian de 128 bits ; Poseidon(DOM_STRING, hi, lo) |

Les templates de comparaison V1 acceptent int64/decimal/timestamp ; bool et
string refusés sauf comptage. Un seuil signé subit le même biais que la colonne.
Une échelle 100 donne 8,00 → 800 avant biais. Ne pas utiliser de flottant JS.
Le circuit contraint les bornes et le type public déclaré de la colonne.

`salt` : 16 octets CSPRNG indépendants par ligne, entier u128 big-endian,
jamais envoyé hors du chiffré. `cols_commit = Poseidon(c0,c1,c2,c3,c4,c5,c6,c7,salt)`.
Arbitrairement changer une valeur/sel casse l’engagement ; un chiffré incompatible
ne permet pas une preuve. Le serveur ne peut pas vérifier cette correspondance.

## Feuille publique

Domaines : entier big-endian des octets ASCII exacts, sans zéro final :
`DOM_LEAF = "PB1:LEAF"`, `DOM_NODE = "PB1:NODE"`,
`DOM_EMPTY = "PB1:EMPTY"`, `DOM_STRING = "PB1:STRING"`.

`leaf = Poseidon(DOM_LEAF, partition_id, pseq, ts, cols_commit)`.
`pseq` démarre à 1 par (tenant, partition_id), sans réemploi. `seq` démarre à 1
par tenant et ne fait pas partie de la feuille ; il détermine le préfixe scellé.
`ts` est attribué par le serveur à la transaction : `max(now_ms, lastTenantTs)`.
Les égalités sont autorisées ; pseq départage les lignes au même instant.
Le périmètre V1 porte sur `ts`, jamais l’heure d’événement chiffrée.

## Reçu

Objet RFC 8785 canonique signé Ed25519 par le signataire externe plateforme :
`protocol`, `receipt_id`, `tenant_id`, `collection_id`, `record_id`, `key_id`,
`seq`, `pseq`, `ts`, `partition_id`, `cols_commit`, `leaf`,
`envelope_sha256`, `signer_id`, `issued_at`. L’empreinte d’enveloppe porte sur
`AAD || nonce || ciphertext` en octets. Signature base64url détachée, clé publique
du signataire publiée/versionnée. Le SDK vérifie signature, contexte, hash du
chiffré et feuille avant d’accepter le reçu. Pas de preuve on-chain pour pending.

Tests Phase 1/3 : bornes min/max, débordement, padding de colonnes, Unicode NFC,
sel différent, arités, endianness, reçu altéré/rejoué, mauvais tenant/collection.
