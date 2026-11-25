# Contrat API V1

REST JSON, `/v1`, HTTPS obligatoire. La Phase 0 spécifie le contrat ; Fastify
générera OpenAPI depuis les schémas stricts lors de l’implémentation Phase 3.
Types publics/ports dans core, types contenant du clair uniquement dans SDK/prover.
Les handlers dépendent de ports de services/repositories injectés, pas d’un ORM,
wallet, moteur ZK ou algorithme de hash directement (ADR-006).

## Écriture

`POST /v1/records`, scope write, `Idempotency-Key` requis (16..128 caractères
ASCII imprimables), enveloppe `{records:[...]}`, 1..100 objets. Chaque objet
contient exclusivement `protocol_id`, `collection_id`, `key_id`, `partition_id`,
`cols_commit`, `encryption_suite_id`, `nonce`, `ciphertext`. Aucun champ valeurs,
schema, salt, label, clé, passphrase ou witness ; `additionalProperties:false`
à tous les niveaux. Formats/bornes selon leaf-format et encryption-vault.
Maximum corps 9 MiB (padding + base64 + métadonnées) ; rejet 413 avant parsing.

Le tenant vient de l’authentification, jamais du body. La collection doit lui
appartenir. Transaction atomique pour le lot : validation, quota, attribution
de seq/pseq/ts, insert, idempotence et outbox. Rejet total si une ligne invalide.
Réponse 201 : record_id, champs publics assignés, statut pending et reçu signé
pour chaque ligne. Le SDK contrôle chaque reçu. Une enveloppe arbitraire ne
garantit pas un engagement correct ; le serveur ne déchiffre jamais pour vérifier.

Idempotence liée au tenant + route + hash canonique du corps, conservée au moins
30 jours : même clé/même hash => même résultat sans nouveau quota/seq ; autre
hash => 409 idempotency_conflict. Une tentative concurrente attend la transaction
ou renvoie 409 in_progress + Retry-After. Pas de trou de séquence sur rollback.

## Routes et autorisations

| Route                              | Méthodes  | Autorisation et contrat                                            |
| ---------------------------------- | --------- | ------------------------------------------------------------------ |
| /collections                       | POST, GET | write/read ; ID et profil seulement, schéma dans manifeste chiffré |
| /records                           | POST, GET | write/read ; GET filtres collection, partition, seq ou ts          |
| /records/{id}                      | GET       | read, uniquement chiffré et métadonnées                            |
| /records/{id}/inclusion-proof      | GET       | read ; pending → 409 not_anchored                                  |
| /anchors, /anchors/{batchId}       | GET       | read ; état, root, transactions et limites                         |
| /checkpoints, /checkpoints/{index} | GET       | read ; attestations globales publiques sans mapping PII            |
| /anchors/flush                     | POST      | write, quota, idempotence, 202 ; ne force pas la finalité          |
| /vault/wrapped-keys                | GET, PUT  | Session utilisateur seule ; blobs opaques, ETag/If-Match           |
| /vault/manifest                    | GET, PUT  | Session utilisateur seule ; manifeste chiffré, ETag/If-Match       |
| /circuits                          | POST, GET | write/read ; template/version/colonne/type ; labels chiffrés       |
| /proof-requests                    | POST, GET | prove ; paramètres publics et snapshot/assurance                   |
| /proof-requests/{id}               | GET       | prove ; progression et état                                        |
| /proof-requests/{id}/claim         | POST      | prove ; lease atomique 15 min, token opaque, renew même claimant   |
| /proof-requests/{id}/materials     | GET       | prove + claim valide ; chiffrés, chemins, artefacts publics        |
| /proof-requests/{id}/bundle        | POST      | prove + claim valide ; upload, vérification publique asynchrone    |
| /artifacts/{template}/{version}    | GET       | Public, catalogue approuvé, tailles et SHA-256                     |
| /verify                            | POST      | Public, limité par IP ; aucune clé ni témoin accepté               |
| /usage                             | GET       | read ou session ; usage/quota du tenant                            |

La clé API prove ne déverrouille pas le coffre ; l’agent dispose d’un coffre
local fourni séparément par le client. Les sessions utilisateur peuvent exercer
les scopes de leur organisation ; admin plateforme n’obtient jamais ce droit
pour ouvrir des données. Les identifiants d’autre tenant répondent 404.

Clés API : `pb_<env>_<prefix>_<secret>`, secret aléatoire >=256 bits affiché une
fois ; seul SHA-256 conservé, comparaison constante, scopes write/read/prove,
révocation immédiate et rotation. Aucun secret en URL. Sessions HttpOnly, Secure,
SameSite, protection CSRF pour mutations. Authentification email/mot de passe
distincte de la passphrase de coffre ; aucune récupération serveur du coffre.

## Cycle des demandes

awaiting_prover → claimed → verifying → verified/rejected ; failed/expired
séparés. Lease expirée => reprise atomique, ancien token rejeté. TTL demande
24 h par défaut. Upload répété de même bundle/hash => même résultat ; bundle
différent après terminal => 409. Le client signale predicate_not_satisfied sans
envoyer la valeur fautive ; aucune preuve fabriquée. Matériel stable lié au
snapshot et à la version de circuit ; artefacts hashés avant exécution.

## Lectures, erreurs et logs

Pagination curseur opaque signé lié aux filtres/tenant/snapshot, limite 100
(max 1000), ordre seq ascendant. ts `[from,to)`, seq bornes inclusives ; filtres
incompatibles rejetés. Aucune lecture tenant sans scope read/prove approprié.

Erreurs application/problem+json (RFC 9457, successeur compatible de RFC 7807) :
type, title, status, code, request_id, instance opaque. Ne jamais renvoyer valeur
rejetée, corps, token ou stack. Codes : invalid_request 400, unauthenticated 401,
forbidden 403, not_found 404, idempotency_conflict/not_anchored 409,
precondition_failed 412, payload_too_large 413, quota_exceeded/rate_limited 429,
verification_unavailable 503. `X-RateLimit-*`, `X-Quota-*`, Retry-After pour 429.
Quotas par catégorie, plans versionnés en base, comptage idempotent.

Logs allowlist : request_id, route normalisée, statut, durée, identifiant opaque
de job. Pas de body/header/query complet, RPC URL avec API key, password,
chiffré (inutile), témoin ou clé. Erreurs de validation ne dumpent pas l’entrée.
Files Redis : IDs et metadata nécessaires seulement ; aucun témoin ni preuve
à produire côté serveur. Test zéro clair obligatoire sur chemins d’erreur aussi.
