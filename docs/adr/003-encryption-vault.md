# ADR-003 — Chiffrement et coffre sous contrôle client

## Décision

XChaCha20-Poly1305 via libsodium, HKDF/HMAC-SHA256 via WebCrypto,
Argon2id via libsodium. Clé racine 256 bits générée chez le client,
nonce 192 bits aléatoire par chiffrement. Pas d’implémentation maison.
Formats normatifs dans [encryption-vault](../spec/encryption-vault.md).

La règle « aucune clé plateforme » concerne les clés des tenants, leurs
dérivées, secrets de récupération, passphrases, témoins et valeurs métier.
Les clés API d’authentification sont reçues sous TLS puis seulement hachées
en base ; elles ne déchiffrent rien. Les credentials PostgreSQL et les secrets
de service sont nécessaires au fonctionnement, isolés et jamais journalisés.
Les clés de signature des reçus et wallets d’ancrage restent dans un signataire
externe/KMS/HSM ; l’API et les workers n’importent pas de clé privée de signature.
L’admin ne voit que les adresses et états publics.

`core` reste utilisable par le serveur sans importer le coffre. La proposition
initiale « chiffrement dans core » en Phase 1 est remplacée par `sdk/crypto`
pour rendre la frontière vérifiable. `web` SSR reste plateforme ; la possession
du code client n’autorise pas son exécution avec des secrets côté serveur.

## Conséquences

Pas de récupération par support. Kit de récupération confirmé avant premières
données. Rotation conserve les anciennes clés enveloppées ; effacer une clé
est irréversible. Les blobs enveloppés permettent une attaque hors ligne contre
une passphrase faible : Argon2id ne dispense pas d’une passphrase robuste.
Une passkey sans PRF ne déverrouille pas le coffre ; repli explicite passphrase.

Sources : [libsodium AEAD](https://doc.libsodium.org/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction),
[Argon2 libsodium](https://doc.libsodium.org/password_hashing/default_phf).
