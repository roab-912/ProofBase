# Arbres et chemins

## Batch Poseidon

Un batch scelle un préfixe contigu des écritures du tenant sous verrou de
transaction. 1 à 2^20 lignes, jamais de batch vide. `seq` sélectionne le batch ;
les feuilles sont ensuite triées par (`partition_id` entier, `pseq` entier).
Doublon de cette paire => rejet. Les pseq d’une partition sont consécutifs et
ses ts non décroissants. Voir ADR-004 pour la vérification globale.

Profondeur 20, index de feuille 0..2^20-1. Feuilles réelles aux indices
0..count-1 ; `z[0]=Poseidon(DOM_EMPTY)` pour le suffixe vide.
`node(left,right)=Poseidon(DOM_NODE,left,right)` ;
`z[h+1]=node(z[h],z[h])`. Une feuille vide n’est pas un enregistrement de valeur
zéro. Le marqueur de présence dans le circuit est contraint à l’index<count.
L’empty root ne peut pas être ancrée en tant que batch vide.

Chemin : 20 siblings du bas vers le haut. Au niveau h, bit h de l’index détermine
gauche (0) ou droite (1). Rejeter index hors arbre, mauvais nombre de siblings
ou élément non canonique. Blocs alignés N=16/64/256, `start % N == 0` ;
N feuilles reconstruisent un sous-arbre puis `20-log2(N)` siblings jusqu’à la
racine du batch. Dernier bloc complété uniquement par feuilles vides canoniques.

L’engagement de feuille ne contient pas le chiffré : l’inclusion seule n’atteste
pas sa disponibilité. L’agent déchiffre et recalcule cols_commit ; le reçu lie
l’enveloppe. Export : toutes les métadonnées, enveloppes et reçus nécessaires
pour reconstruire chaque batch sans secret supplémentaire côté serveur.

## Arbre d’ancrages L2

Profondeur 32, feuilles indexées 0..anchorCount-1 dans l’ordre d’émission global
(tous tenants). `anchorLeaf = keccak256(abi.encode(bytes32 tenantId,
uint64 batchId, bytes32 root, uint64 firstSeq, uint64 lastSeq,
uint64 tsFrom, uint64 tsTo))`. ABI standard : chaque argument occupe 32 octets,
jamais `encodePacked` pour la feuille. Nœud = keccak256(left_bytes32 || right_bytes32).
Vide `z[0]=bytes32(0)` puis `z[h+1]=keccak256(z[h]||z[h])`.
Index uint32, refuser le 2^32+1e ancrage ; count peut valoir 2^32.

Chemin de 32 siblings et bits de l’index du bas vers le haut, vérifié contre la
racine au bloc L2 du checkpoint, pas forcément la racine courante. Tous les
champs de la feuille sont relus au contrat/événements canoniques. Les événements
du cadrage ne contiennent pas tsFrom/tsTo : utiliser `getAnchor` au bloc fixé.

Tests Phase 1/2 : ordre, doublons, counts 1/N-1/N/N+1/capacité, mauvais sens de
chemin, padding forgé, feuille réelle égale zéro, batch vide, ancrages intercalés
de tenants, preuve à un ancien snapshot et capacité maximale de l’arbre L2.
