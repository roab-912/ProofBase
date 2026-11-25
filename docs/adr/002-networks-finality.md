# ADR-002 — Réseaux, confirmations et finalité

## Décision

Développement, CI et V1 : Sepolia L1=11155111, Arbitrum Sepolia L2=421614.
Aucune chaîne locale ni Anvil (instruction propriétaire, ADR-006).
Ethereum et Arbitrum One sont hors configuration active. Aucun déploiement
ou financement dans la Phase 0 ; les contrôles réseaux sont en lecture seule.

`anchored_l2` exige un reçu réussi et 20 confirmations L2 par défaut
(`head - receipt.blockNumber + 1 >= 20`), bloc/hash toujours canoniques.
C’est une politique de disponibilité révisable, **pas** une preuve de finalité L1.
Un checkpoint utilise un bloc L2
`safe` accessible au RPC et vérifie son hash, ou attend si le RPC ne sait pas
fournir cette information ; aucun repli silencieux sur `latest`.

`checkpointed_l1` exige inclusion canonique avec 2 confirmations Sepolia ;
`finalized` exige que le checkpoint soit ancêtre du bloc renvoyé par le tag L1
`finalized`. Aucun minuteur de 15 minutes ne remplace cette lecture.

## Conséquences

Un checkpoint est une attestation du relais plateforme, pas une preuve de
consensus Arbitrum. Vérification indépendante du bloc L2, des événements et
de la racine cumulative obligatoire. Désaccord RPC => résultat indéterminé,
jamais validé. Reorg => invalidation des preuves dépendantes et réconciliation
canonique ; les statuts dérivés peuvent régresser sans réécrire l’historique d’audit.

Réseaux/adresses/codehash/rôles publiés dans `deployments.json` lors de la
Phase 2. Pas d’adresse fictive dans les bundles ; pas de proxy V1.

Sources officielles : [réseaux Arbitrum](https://docs.arbitrum.io/for-devs/dev-tools-and-resources/chain-info),
[JSON-RPC Ethereum](https://ethereum.org/en/developers/docs/apis/json-rpc/).
