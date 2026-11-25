# Complétude d’un snapshot ancré

## Périmètre

Une requête cible un tenant, une partition pseudonyme, `[ts_from,ts_to)` avec
from<to, une colonne et un prédicat. Temps = ingestion serveur, entier u64 en ms.
Snapshot = réseau/contrat/bloc/hash L2 et nombre d’ancrages ; pour assurance L1,
utiliser le snapshot couvert par le checkpoint choisi. Pending et batches
scellés non ancrés sont exclus et signalés comme tels. Le résultat ne prétend
pas être complet au-delà de ce snapshot.

## Algorithme normatif conservateur

1. Le vérificateur obtient indépendamment tous les batchs du tenant à ce bloc,
   batchId 0..batchCount-1. Un manifeste fourni par le prouveur ne fait pas foi.
2. Pour chaque batch, vérifier `firstSeq=previous.lastSeq+1` (premier=1),
   `lastSeq>=firstSeq`, tsFrom/tsTo canoniques. `count=lastSeq-firstSeq+1`.
   Chaque batch figure une fois, y compris sans ligne dans le périmètre.
3. Couvrir tous les indices occupés par les blocs alignés du circuit, sans
   chevauchement, trou ou mélange de tailles. Vérifier le suffixe vide jusqu’à
   la capacité avec les hashes vides canoniques et chemins liés à la racine.
4. Chaque circuit reconstruit le sous-arbre et son chemin ; impose l’ordre
   numérique des partitions ; dans une partition pseq+1 et ts non décroissant.
   Toutes les feuilles `partition==target && from<=ts<to` sont sélectionnées,
   sans bit de sélection libre. Elles ouvrent cols_commit et satisfont le prédicat.
   Hors scope, seuls métadonnées et cols_commit sont nécessaires, pas les valeurs.
5. Les signaux publics de bloc incluent première/dernière feuille occupée
   (partition,pseq,ts), bornes de pseq/ts de la partition cible ou marqueur
   d’absence contraint, compte pertinent et indicateurs de frontière contraints.
   Le vérificateur impose le même ordre/continuité à toutes les jonctions de
   blocs. D’un batch au suivant où la partition cible existe, son premier pseq
   vaut dernier précédent+1, même si des batchs intermédiaires l’ignorent.
   Sa première occurrence historique démarre à pseq=1.
6. Les frontières temporelles immédiates entourant les lignes sélectionnées
   doivent être hors scope ou inexistantes de manière prouvée. La couverture
   totale et les jonctions rendent impossible une seconde plage cachée.
7. Somme des comptes de blocs = compte du bundle. Les modes threshold/range
   avec zéro ligne retournent `empty_scope` (pas de succès trompeur) ; le template
   `count_in_scope` peut prouver zéro. Aucun batch => snapshot vide relu on-chain,
   même politique `empty_scope`, sans fabriquer de preuve de circuit.

Tous les signaux sont liés à l’instance du circuit et aux paramètres exacts.
Le vérificateur refuse les champs ignorés ou une version inconnue. Les données
de frontières sont des métadonnées publiques ; leur fuite supplémentaire est
documentée, jamais qualifiée de confidentialité absolue.

## Cas d’acceptation adversariaux requis

| ID  | Cas                                                   | Attendu                                                       |
| --- | ----------------------------------------------------- | ------------------------------------------------------------- |
| C01 | Partition absente au milieu de trois batchs           | Accepter une absence couverte ; continuité entre les autres   |
| C02 | Fenêtre à cheval sur deux batchs                      | Couvrir les deux, vérifier jonction et bornes                 |
| C03 | Premier/dernier enregistrement                        | Frontière inexistante contrainte, aucun underflow             |
| C04 | Batch partiellement dans la fenêtre                   | Predicate seulement dans scope ; couverture de tous les blocs |
| C05 | ts exactement from / to, timestamps égaux             | from inclus, to exclu, tous les pseq concernés                |
| C06 | Batch sauté/dupliqué/réordonné                        | Rejet par inventaire on-chain et seq                          |
| C07 | Bloc sauté/dupliqué/non aligné                        | Rejet par couverture des indices                              |
| C08 | pseq trou/dupliqué, ordre de partitions faux          | Rejet circuit ou jonction vérificateur                        |
| C09 | Frontière omise/falsifiée                             | Rejet, même si prédicat vrai ailleurs                         |
| C10 | Valeur hors seuil, sel/colonne modifiés               | Échec preuve / predicate_not_satisfied                        |
| C11 | Chemin/racine/chiffré altéré                          | Échec ouverture ou vérification                               |
| C12 | Partition totalement absente / fenêtre vide           | empty_scope sauf count=0                                      |
| C13 | Feuille pertinente cachée dans un bloc hors sélection | Rejet par couverture totale et ordre global                   |
| C14 | Suffixe reçu mais jamais ancré                        | Hors garantie du snapshot, audit des reçus séparé             |
| C15 | Dernier bloc incomplet, padding manipulé              | Rejet si présence/index/count non cohérents                   |
| C16 | Mauvais tenant/réseau/contrat/snapshot                | Rejet de domaine et lecture indépendante                      |

Ces cas seront des tests exécutables en Phase 1 puis d’intégration en Phase 5.
Les lister en Phase 0 ne signifie pas qu’un circuit les satisfait déjà.
