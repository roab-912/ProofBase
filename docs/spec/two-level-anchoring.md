# Ancrage L2 et checkpoint L1

## Réseaux et ports

Sepolia 11155111 et Arbitrum Sepolia 421614 exclusivement, y compris en
développement (ADR-006). `ChainReader`, `ChainWriter` et `TransactionSigner`
isolent RPC et signature. RPC/chainId/adresse/codehash doivent correspondre au
registre de déploiement approuvé ; aucun de ces paramètres n’est accepté
aveuglément depuis un bundle. L1 et L2 ont des wallets opérationnels séparés,
fournis/configurés par l’utilisateur lorsque les écritures seront implémentées.
Le signer n’a jamais de clé de coffre ni de donnée tenant déchiffrée.

## Scellement et états

Heartbeat 5 s par défaut, configuration en base et verrou distribué avec lease
et fencing token. Pour chaque tenant : déclencher au délai du plan atteint OU
à la taille max atteinte. Aucun batch vide. Sous transaction/verrou tenant,
figer un préfixe contigu de pending et réserver le batchId ; recalculer la
racine selon le profil persisté, persister racine et limites avant soumission.
`tsFrom=min(ts)`, `tsTo=max(ts)` inclusives pour les métadonnées du batch
(à distinguer de la borne exclusive des requêtes).

| État            | Condition                                                |
| --------------- | -------------------------------------------------------- |
| pending         | Écriture durable avec reçu ; aucune assurance blockchain |
| sealed          | Batch immuable et racine calculée                        |
| anchored_l2     | Reçu L2 réussi, 20 confirmations, hash canonique         |
| checkpointed_l1 | Couvert par checkpoint canonique L1, 2 confirmations     |
| finalized       | Bloc du checkpoint ancêtre du tag L1 finalized           |

États d’exécution de jobs (queued/submitted/retrying/failed) séparés de l’assurance.
Crash après soumission : retrouver transaction par hash/nonce et état contrat
avant toute relance ; remplacement même nonce, pas de nouvel ancrage logique.
Unicité (tenant,batchId) et (chainId,signer,nonce), outbox transactionnelle.
Reorg : vérifier à nouveau hash et reçu, invalider états dérivés/bundles dépendants,
conserver les anciennes observations en journal sans données sensibles.

## AnchorRegistry

ABI du cadrage conservée : `anchor`, `anchorMany`, `getAnchor`, `batchCount`,
`anchorCount`, `anchorTreeRoot`. Anchor = root bytes32, firstSeq/lastSeq et
tsFrom/tsTo uint64. `tenantId = keccak256(ASCII("PB1:TENANT") || org_uuid ||
tenant_salt_32)` ; sel organisation aléatoire (identifiant pseudonyme, pas clé
de déchiffrement), mapping exportable pour l’audit client. Pas de PII on-chain.

Invariants : première firstSeq=1 ; ensuite previous.lastSeq+1 ; lastSeq>=firstSeq ;
taille<=2^20 ; tsFrom<=tsTo et tsFrom>=previous.tsTo ; root canonique BN254 pour
le profil courant ; batchId commence à 0. Arbre global keccak décrit dans trees.
`anchorMany` vérifie tailles égales et non nulles, applique les invariants dans
l’ordre (y compris deux batchs d’un même tenant) et revert atomique si violation.
Capacité de l’arbre vérifiée avant mutation. Événement Anchored du cadrage.

## CheckpointRegistry

Toutes les 24 h par défaut, tous tenants ensemble. Lire au bloc L2 `safe`
root/count/blockNumber/blockHash cohérents ; aucun mélange de lectures latest.
Vérifier les événements localement reconstruits avant publication. Si count
inchangé : aucun checkpoint à vide. Gas L1 au-dessus du seuil : reporter au plus
6 h (défaut configurable), puis alerter et soumettre dans le plafond de coût
autorisé ; plafond absolu dépassé => alerte/attente explicite, pas promesse de délai.

ABI du cadrage conservée : `checkpoint`, `getCheckpoint`, `checkpointCount`.
Index commence à 0. Count strictement croissant (donc non décroissant comme
exigé au cadrage), numéro L2 non décroissant ; même numéro => même hash.
Root et blockHash non nuls. `prevHash=0` au premier ; ensuite
`keccak256(abi.encode(previous.l2Root, previous.l2AnchorCount,
previous.l2BlockNumber, previous.l2BlockHash, previous.prevHash))`.
Le checkpoint courant est haché avec le même encodage pour le suivant.
Le contrat L1 **ne prouve pas** l’authenticité de L2. Le vérificateur relit
L2 et le chemin vers la racine checkpointée ; divergence => rejet.

`ANCHORER_ROLE`, `CHECKPOINTER_ROLE`, admin multisig, Pausable, pas de proxy V1.
Un nouveau hash de batch/moteur ZK exige nouveau profil et, si nécessaire,
nouveau déploiement versionné ; aucune réinterprétation d’une ancienne root.

Tests Phase 2/4 : rôles/pause, contiguïté, batch vide, timestamps, atomisme,
débordement, paths, restart après broadcast, nonce concurrent, RPC erroné,
reorg aux deux niveaux, mauvais snapshot, prevHash altéré, gas/report maximal.
L’intégration se fait sur les vrais testnets ; les mocks unitaires sont distincts.
