# Chiffrement et coffre

## Frontière

Clair, racines de clé, dérivées, sels d’engagement et témoins restent dans SDK,
agent client ou navigateur déverrouillé. La plateforme ne reçoit que les champs
publics du format d’écriture, des enveloppes authentifiées et des preuves.
Ni preuve ni manifeste public ne contient de témoin. API/worker/admin n’importent
pas le SDK. Aucune fonction de déchiffrement à distance.

## Dérivation et pseudonyme

`K_root` : 32 octets CSPRNG. HKDF-SHA256 (RFC 5869) : salt = UUID tenant en
16 octets, info = domaine ASCII suivi des identifiants à largeur fixe ; sortie
32 octets. `K_data` : info `PB1:DATA || collection_uuid || key_uuid`.
`K_manifest` : `PB1:MANIFEST || key_uuid`. `K_part` : `PB1:PART`.
Les dérivations de domaines différents ne sont jamais interchangeables.

`partition_id = first8(HMAC-SHA256(K_part, collection_uuid ||
u32be(length(label_utf8)) || label_utf8))`, big-endian. Libellé NFC UTF-8,
maximum 1024 octets. Le manifeste chiffré maintient la table des pseudonymes de
toutes les collections du tenant ; collision de deux libellés différents =>
rejet explicite `partition_collision`, pas de fusion ni de suffixe implicite.
Le pseudonyme reste stable pendant une rotation de clés de données : conserver
la graine `K_part` dans le coffre enveloppé même si la racine de données change.
Une compromission de `K_part` exige une migration vers une nouvelle collection
et des périmètres distincts ; pas de continuité prétendue entre pseudonymes.

## Enveloppe d’enregistrement

`v=1`, `algorithm=XCHACHA20-POLY1305`, `key_id`, nonce 24 octets frais,
`ciphertext` comprenant le tag 16 octets. API transporte nonce/ciphertext en
base64url sans padding. AAD binaire exact :

```text
ASCII("PB1:RECORD") || tenant_uuid[16] || collection_uuid[16] ||
key_uuid[16] || partition_id_u64be[8] || cols_commit_be[32]
```

seq/pseq/ts sont assignés après chiffrement et donc absents de l’AAD ; le reçu
et la feuille les lient. `cols_commit` doit être <r. Nouvelle tentative idempotente
réutilise la même enveloppe ; nouvel enregistrement => nouveau nonce et sel.

Clair canonique RFC 8785 : version de schéma, valeurs canoniques (entiers en
chaînes), salt base64url, libellé de partition, heure d’événement. Préfixer sa
longueur u32be, puis des octets aléatoires jusqu’au premier palier suffisant
256, 1024, 4096, puis multiples de 4096 jusqu’à 65536 octets. Rejeter au-delà.
Le padding est à l’intérieur de l’AEAD. Rejeter un tag invalide avant de parser,
une longueur invalide, une version inconnue ou un engagement incohérent.

## Enveloppes de coffre

Trois méthodes enveloppent le même secret de coffre (racine de données et graine
de partitions). Chaque blob comporte version, méthode, vault_id, key_id, contexte
tenant, paramètres publics de KDF, nonce et chiffré. AAD = RFC 8785 des métadonnées
publiques complètes (sans nonce/ciphertext). Modification d’un paramètre => rejet.

- Passphrase UTF-8 exacte, aucune normalisation cachée : Argon2id v1.3,
  libsodium `crypto_pwhash`, salt 16 octets aléatoires, opslimit=3,
  memlimit=268435456 octets, sortie 32 octets. Client valide avant calcul des
  bornes anti-DoS (opslimit 3..6, mémoire 256..512 MiB) ; pas de repli silencieux.
- Passkey : WebAuthn PRF, salt de PRF 32 octets aléatoires lié au vault ;
  HKDF-SHA256 avec salt tenant_uuid et info `PB1:WRAP:PRF || vault_uuid`.
  PRF/KEK jamais envoyée ; credential ID est public. PRF indisponible => proposer
  passphrase, jamais transformer une signature WebAuthn en clé.
- Récupération : secret CSPRNG 32 octets imprimable base64url, version et checksum
  SHA-256 tronqué à 4 octets (détection de saisie uniquement). HKDF-SHA256 avec
  salt tenant_uuid, info `PB1:WRAP:RECOVERY || vault_uuid`. Secret et checksum
  sont présentés au client, jamais uploadés en clair. Confirmation obligatoire.

Toutes les enveloppes utilisent XChaCha20-Poly1305 et un nonce frais. Le client
vérifie que le contenu déchiffré correspond aux IDs attendus. Synchronisation
avec ETag/If-Match ; conflit 412, jamais écrasement aveugle. Sauvegarde client
des versions attendues : le serveur peut rejouer un ancien blob ; le chiffrement
seul ne garantit pas la fraîcheur d’un coffre sur un nouvel appareil.

Changer la passphrase réenveloppe sans réécrire les données. Rotation de données
crée un nouveau key_id, conserve les anciennes clés enveloppées en lecture.
La suppression est explicite et irréversible. Verrouillage efface les buffers
autant que le runtime le permet (pas de garantie d’effacement absolu en JS).
Pas de stockage en localStorage, pas de secret dans URL/analytics/crash reports.

Tests : mauvais AAD/tenant/clé, ciphertext/tag/nonce altérés, mauvais mot de passe,
kit faux, PRF absent, limites KDF, rotation/lecture ancienne, conflit ETag,
rejeu de coffre, collision pseudonyme, padding et sentinelles réseau/stockage.
