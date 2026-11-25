# ProofBase — Spécification produit et roadmap V1.0
> Mise à jour du propriétaire — 24 novembre 2026 : Sepolia et Arbitrum Sepolia
> dès le développement, aucune blockchain locale/Foundry Anvil. Chaque fonctionnalité
> utilise des interfaces/types et des adaptateurs injectés pour isoler hash, moteur
> ZK, chiffrement, stockage, RPC et signature (ADR-006). Les profils de protocole
> sont versionnés ; changer un hash ne réécrit pas les engagements historiques.
> Les accès RPC/API et wallets testnet seront fournis par le propriétaire pour
> les écritures, hors dépôt et logs. Cette mise à jour prime sur le cadrage initial.

*Nom de travail : ProofBase · Document de cadrage destiné à Codex · révision 2 : chiffrement côté client, ancrage L2 + L1 · 24 novembre 2026*

## 1. Le projet en bref

ProofBase est un SaaS de **base de données vérifiable et confidentielle**. Le client chiffre ses données **chez lui**, puis les écrit via une API. La plateforme ne stocke que du chiffré, l’engage dans des arbres de Merkle et ancre périodiquement leurs racines sur Arbitrum (L2). Chaque jour, un checkpoint de cet historique est ancré sur Ethereum (L1). Le client génère ensuite, avec un agent de preuve qu’il contrôle, des **preuves à divulgation nulle de connaissance** sur ses données. Exemple : « toutes les températures du Site A en octobre sont ≤ 8 °C ».

Le vérificateur (auditeur, client final, régulateur) n’a besoin que de la preuve, des paramètres publics de la requête et des racines lues sur les blockchains. Il ne voit jamais les mesures, et la plateforme non plus. La promesse : **prouver sans révéler, avec un historique que personne ne peut réécrire après ancrage**.

Cas d’usage : chaîne du froid, pharma, agroalimentaire, énergie et ESG, IoT industriel, conformité.

### Ce que le produit est, et n’est pas

- C’est une base de données *authentifiée* (append-only, ancrée) et *chiffrée côté client*, associée à un moteur de *preuves ZK de requêtes*.
- **Confidentialité de bout en bout** : la plateforme ne voit ni les valeurs ni les clés. Elle voit des métadonnées : volumes, rythme d’écriture, tailles, pseudonymes de partitions, paramètres publics des preuves.
- **Conséquence centrale** : la plateforme ne peut plus générer les preuves, faute de pouvoir lire les données. Elles sont produites par un **agent de preuve** exécuté chez le client (CLI, conteneur ou SDK), puis vérifiées publiquement.
- L’ancrage prouve qu’une donnée n’a pas changé depuis son ancrage, pas qu’elle est exacte. Des signatures de capteurs pourront répondre à ce point en V2.
- Une donnée écrite mais pas encore ancrée n’est pas prouvable ; elle dispose seulement d’un reçu signé par la plateforme.
- **Perdre la clé, c’est perdre les données** : la plateforme ne peut rien récupérer.

## 2. Garanties visées en V1.0

- **Intégrité** : toute modification après ancrage change la racine et devient détectable.
- **Lien avec les chaînes** : une preuve n’est valide que pour une racine de batch inscrite sur L2, que l’on relie à un checkpoint Ethereum pour le niveau d’assurance maximal (§3.5).
- **Complétude du périmètre** : la preuve couvre tous les enregistrements de la partition et de la fenêtre temporelle demandées, pas seulement ceux que le prouveur choisit de montrer (§4).
- **Confidentialité vis-à-vis de la plateforme** : seuls des chiffrés et des engagements sont stockés ; aucune clé de déchiffrement n’atteint le serveur.
- **Confidentialité vis-à-vis du vérificateur** : seuls les éléments publics déclarés (paramètres, racines, nombre de blocs) sont révélés.
- **Auditabilité indépendante** : un export chiffré et la clé permettent de reconstruire les arbres et de comparer les racines à celles des blockchains.
- **Limite assumée** : les métadonnées (volumes, horodatages, tailles, pseudonymes de partitions) restent visibles de la plateforme en V1.0.

## 3. Architecture

### 3.1 Composants

- **API** (REST, OpenAPI) : authentification, clés API, quotas, écriture de chiffrés, lecture, demandes de preuve, vérification.
- **PostgreSQL** : comptes, organisations, plans, clés API, blobs chiffrés, métadonnées d’enregistrements (`partition_id` pseudonyme, `pseq`, `ts`, `cols_commit`), batchs, ancrages L2, checkpoints L1, demandes de preuve, bundles, usage.
- **Redis + BullMQ** : files de jobs (ancrage, checkpoint).
- **SDK client** (`packages/sdk`, TypeScript, Node et navigateur) : coffre de clés, chiffrement, engagements Poseidon, écriture, lecture et déchiffrement.
- **Agent de preuve** (`packages/prover`, CLI, image Docker et librairie) : s’exécute chez le client, déchiffre localement et génère les preuves ZK.
- **Worker d’ancrage L2** et **worker de checkpoint L1** : scellement, transactions, confirmations, relances.
- **Smart contracts** : `AnchorRegistry` sur Arbitrum, `CheckpointRegistry` sur Ethereum.
- **Dashboard utilisateur** (Next.js) : déchiffrement dans le navigateur, circuits, suivi des preuves, abonnement.
- **Dashboard admin** (`apps/admin`) : supervision et configuration de l’ancrage L2 et L1, réservé aux opérateurs.
- **Vérificateur** : librairie open source (Node et navigateur), CLI et page publique `/verify`.
- **Stripe** : abonnements.

Il n’y a **pas de worker de preuves côté plateforme** : elle ne fait que vérifier.

### 3.2 Stack proposée (modifiable via ADR)

Monorepo pnpm en TypeScript ; Fastify ou NestJS avec validation zod ; PostgreSQL avec Drizzle ; Redis et BullMQ ; Foundry et viem pour les deux chaînes ; Circom 2 et circomlib pour les circuits ; libsodium et WebCrypto pour le chiffrement ; Next.js, Tailwind et shadcn/ui pour les deux dashboards ; Docker Compose en local (Postgres, Redis), Sepolia et Arbitrum Sepolia dès le développement ; GitHub Actions. Réseaux : **Arbitrum Sepolia et Sepolia pour la V1.0**, configuration prête pour Arbitrum One et Ethereum mainnet après audit. Codex vérifie et épingle les dernières versions stables en Phase 0.

### 3.3 Système de preuve (ADR-001, révisé pour le chiffrement)

Comme la preuve est générée chez le client, la vitesse du prouveur devient un critère produit. Défaut : **Circom 2 + Groth16**, avec le prouveur natif rapidsnark dans l’agent et snarkjs (WASM) en repli et dans le navigateur pour les petits blocs. Contrepartie : Groth16 exige une cérémonie par circuit. Avec une dizaine de combinaisons template × taille de bloc, c’est acceptable : cérémonie de développement pour les testnets, cérémonie publique multi-parties avant mainnet.

Alternatives à benchmarker en Phase 1 : Noir + Barretenberg (setup universel, WASM navigateur) et Circom + PLONK (setup universel, plus lent). Critères de décision : preuve d’un bloc de 64 feuilles en moins de 60 s sur un portable 4 cœurs, moins de 4 Go de mémoire, vérification en moins d’une seconde. Le système de preuve reste derrière une interface `ProofSystem` (compile, setup, prove, verify).

### 3.4 Flux d’écriture chiffrée

1. **Coffre** (une fois) : le client génère sa clé racine, l’enveloppe (passphrase, passkey, kit de récupération) et envoie à la plateforme uniquement les blobs enveloppés.
2. `sdk.write(...)` : validation du schéma, encodage en éléments de champ, sel aléatoire, `cols_commit`, `partition_id` pseudonyme, chiffrement, puis `POST /v1/records` avec la clé API.
3. La plateforme attribue `seq` (global au tenant), `pseq` (par partition) et `ts`, calcule la feuille à partir de données non secrètes, enregistre au statut `pending`, décrémente le quota et renvoie un **reçu signé**.
4. Le SDK recalcule la feuille et vérifie le reçu.

### 3.5 Flux d’ancrage à deux niveaux

1. **Heartbeat** (tick configurable, 5 s par défaut, verrou distribué) : pour chaque tenant ayant des enregistrements `pending`, évalue la politique du plan : délai depuis le dernier ancrage ≥ intervalle du plan, **ou** nombre d’enregistrements en attente ≥ taille maximale de batch.
2. **Scellement** : batch figé, arbre Poseidon construit, racine persistée.
3. **Ancrage L2** : `AnchorRegistry.anchor` ou `anchorMany` sur Arbitrum. Le contrat ajoute l’ancrage à un arbre incrémental et vérifie la contiguïté des séquences. Statut `anchored_l2`.
4. **Checkpoint L1** : une fois par jour par défaut, le worker lit la racine de l’arbre des ancrages L2, le nombre d’ancrages et le bloc L2, puis appelle `CheckpointRegistry.checkpoint` sur Ethereum. Un seul checkpoint couvre **tous** les tenants. Statuts `checkpointed_l1`, puis `finalized`.
5. **Gas-aware** : si le base fee L1 dépasse un seuil, le checkpoint est différé dans la limite d’un délai maximal configurable. Aucun ancrage à vide.

| Statut | Signification | Délai typique |
| --- | --- | --- |
| `pending` | reçu signé, pas encore dans un batch | jusqu’au prochain heartbeat |
| `sealed` | batch figé, racine calculée | secondes |
| `anchored_l2` | racine inscrite sur Arbitrum et confirmée | secondes à minutes |
| `checkpointed_l1` | ancrage couvert par un checkpoint Ethereum | ≤ 24 h |
| `finalized` | checkpoint finalisé sur Ethereum | environ 15 min de plus |

Une preuve est utilisable dès `anchored_l2`. Un vérificateur exigeant peut imposer `checkpointed_l1`.

### 3.6 Flux de preuve côté client et vérification

1. Depuis le dashboard ou l’API, création d’une **demande de preuve** : circuit, périmètre, paramètres publics. Statut `awaiting_prover`.
2. L’**agent** (clé API de scope `prove` et coffre local) récupère la demande, la prend en charge (`claim`) et télécharge le matériel : blobs chiffrés des blocs concernés, chemins de Merkle, données des feuilles frontières, artefacts du circuit.
3. Il déchiffre localement, construit les témoins, prouve bloc par bloc (en parallèle, avec reprise), assemble le **bundle** et le dépose.
4. La plateforme vérifie le bundle avec la librairie publique : `verified` ou `rejected`.
5. Un vérificateur tiers contrôle : validité des preuves, égalité entre chaque racine de batch et celle lue sur Arbitrum, chemin vers la racine L2 et vers le checkpoint Ethereum si exigé, enchaînement et complétude du bundle.

## 4. Spécification cryptographique (à figer en Phase 0)

- **Hash** : Poseidon sur BN254, une implémentation de référence en TypeScript, des vecteurs de test partagés avec les circuits.
- **Primitives de chiffrement** : XChaCha20-Poly1305 par défaut (nonce aléatoire de 192 bits, sans limite pratique de volume), HKDF-SHA256 pour la dérivation, Argon2id pour la passphrase, HMAC-SHA256 pour les pseudonymes. Uniquement des bibliothèques auditées (libsodium, WebCrypto), aucune cryptographie maison. Le clair est complété par paliers (256 o, 1 Ko, 4 Ko) pour masquer les tailles.
- **Coffre de clés** : clé racine de 256 bits générée **côté client**. Elle est enveloppée par une passphrase (Argon2id), par une passkey WebAuthn (extension PRF) et par un kit de récupération imprimable ; la plateforme stocke ces blobs enveloppés pour la synchronisation multi-appareils, sans pouvoir les ouvrir. Clés dérivées par HKDF : `K_data(collection, key_id)` pour les enregistrements, `K_part` pour les pseudonymes. Rotation par `key_id` : les anciennes données restent lisibles avec l’ancienne clé.
- **Schéma de collection** : colonnes typées (int64, decimal avec échelle, bool, timestamp, string hashée), 8 colonnes engagées au maximum. Le schéma vit dans un **manifeste chiffré** : la plateforme ne connaît que l’identifiant de collection. Les décimaux sont stockés en entiers à échelle fixe (4,25 °C avec échelle 100 → 425), les entiers signés sont décalés de 2^63 pour être comparables comme u64.
- **Enregistrement chiffré** : le clair contient valeurs, sel, libellé de partition et heure d’événement. Les données authentifiées associées lient le chiffré au tenant, à la collection, à la clé, à `cols_commit` et à `partition_id`, ce qui empêche de permuter des chiffrés.
- **Engagement** : `cols_commit = Poseidon(c0..c7, salt)`, avec un sel d’au moins 128 bits par enregistrement, conservé dans le chiffré. Sans sel, une valeur à faible entropie comme une température serait devinable à partir de la racine publique.
- **Partition pseudonyme** : `partition_id` = u64 tronqué de `HMAC-SHA256(K_part, collection_id ‖ libellé)`. La plateforme ne voit jamais « Site A ». Les collisions sont détectées côté client.
- **Feuille** : `Poseidon(DOM_LEAF, partition_id, pseq, ts, cols_commit)`. Elle est calculée par la plateforme à partir de données non secrètes, et recalculée par le client à la réception du reçu.
- **Arbre de batch** : binaire, profondeur fixe (20 par défaut), feuilles triées par (`partition_id`, `pseq`), sous-arbres vides remplacés par des hashes précalculés. La racine tient dans un `bytes32`.
- **Arbre des ancrages L2** : keccak256, profondeur 32, tenu par `AnchorRegistry`. Sa racine est celle que publient les checkpoints L1. Le chemin batch → ancrage → racine L2 → checkpoint est vérifié **hors circuit** par le vérificateur.
- **Preuves par blocs alignés** : un circuit prouve un bloc de N feuilles alignées (N ∈ {16, 64, 256}) : il reconstruit le sous-arbre (≈ N hashes) puis remonte à la racine. Pour les feuilles dans le périmètre, valeurs et sel sont des entrées **privées** ; pour les feuilles hors périmètre, `cols_commit` (non secret) suffit.
- **Règles de complétude vérifiées en circuit** : (a) deux feuilles voisines de même partition ont des `pseq` consécutifs et des `ts` croissants, sinon `partition_id` augmente ; (b) la feuille précédant la plage est hors périmètre à gauche (ou n’existe pas), celle qui suit est hors périmètre à droite (ou vide) ; (c) toute feuille du bloc dans le périmètre satisfait le prédicat.
- **Complétude entre batchs** : le contrat impose des séquences globales contiguës par tenant (§5) et le manifeste du bundle liste tous les batchs de la fenêtre avec leurs `pseq` de début et de fin. Un batch sauté ou un trou de `pseq` invalide la vérification.
- **Cas limites à spécifier et tester** : partition absente d’un batch, fenêtre à cheval sur deux batchs, premier et dernier enregistrement d’une partition, batch partiellement dans la fenêtre.
- **Limite de confiance V1.0** : l’arbre est construit par la plateforme, qui ne peut pas vérifier qu’un chiffré correspond à son `cols_commit`. Un enregistrement jamais inséré se voit comme un trou de `pseq`, et le client peut l’auditer avec ses reçus. Un client fautif ne peut que s’empêcher de prouver ses propres données ; le SDK contrôle la cohérence avant l’envoi.

## 5. Smart contracts

Deux contrats, déployés sur Arbitrum Sepolia et Sepolia en V1.0, sur Arbitrum One et Ethereum après audit. Les adresses, versions et identifiants de chaîne sont publiés dans `deployments.json` et référencés dans le manifeste de chaque bundle.

### 5.1 AnchorRegistry (Arbitrum)

```solidity
struct Anchor {
  bytes32 root;      // racine Poseidon du batch
  uint64 firstSeq;   // séquence globale du tenant
  uint64 lastSeq;
  uint64 tsFrom;
  uint64 tsTo;
}

function anchor(bytes32 tenantId, Anchor calldata a) external onlyAnchorer returns (uint64 batchId);
function anchorMany(bytes32[] calldata tenantIds, Anchor[] calldata a) external onlyAnchorer;
function getAnchor(bytes32 tenantId, uint64 batchId) external view returns (Anchor memory);
function batchCount(bytes32 tenantId) external view returns (uint64);
function anchorCount() external view returns (uint64);
function anchorTreeRoot() external view returns (bytes32);

event Anchored(bytes32 indexed tenantId, uint64 indexed batchId, bytes32 root, uint64 firstSeq, uint64 lastSeq, uint64 anchorIndex);
```

- `tenantId` = hash de l’identifiant d’organisation avec un sel : aucune donnée personnelle on-chain.
- Invariants : `firstSeq == lastSeq précédent + 1`, `tsFrom ≥ tsTo précédent`, `batchId` séquentiel.
- Chaque ancrage est ajouté à un arbre de Merkle incrémental (keccak256, profondeur 32) dont la feuille est `keccak256(abi.encode(tenantId, batchId, root, firstSeq, lastSeq, tsFrom, tsTo))`.
- `anchorMany` mutualise plusieurs tenants dans une transaction.

### 5.2 CheckpointRegistry (Ethereum)

```solidity
struct Checkpoint {
  bytes32 l2Root;        // anchorTreeRoot lu sur Arbitrum
  uint64 l2AnchorCount;
  uint64 l2BlockNumber;
  bytes32 l2BlockHash;
  bytes32 prevHash;      // chaînage des checkpoints
}

function checkpoint(bytes32 l2Root, uint64 l2AnchorCount, uint64 l2BlockNumber, bytes32 l2BlockHash) external onlyCheckpointer returns (uint64 index);
function getCheckpoint(uint64 index) external view returns (Checkpoint memory);
function checkpointCount() external view returns (uint64);

event Checkpointed(uint64 indexed index, bytes32 l2Root, uint64 l2AnchorCount, uint64 l2BlockNumber);
```

- Invariants : `l2AnchorCount` et `l2BlockNumber` ne décroissent jamais ; chaque checkpoint est chaîné au précédent.
- Rôles : `ANCHORER_ROLE` et `CHECKPOINTER_ROLE` pour les wallets des workers, administration par multisig, `Pausable`. Pas de proxy en V1.0.
- L1 ne vérifie pas le contenu de L2 : le relais est assuré par la plateforme, mais toute divergence est détectable en recalculant la racine depuis les événements L2. Un relais sans confiance, par message natif L2 vers L1, est prévu en V2.

## 6. Circuits et preuves côté client

Principe : **on ne compile pas un circuit par utilisateur**. On maintient des templates précompilés, paramétrés par des entrées publiques ; « créer un circuit » dans le dashboard revient à assembler et valider une définition déclarative. Les circuits sont publics ; seul le **témoin** (valeurs et sels) est secret, et il ne quitte jamais le client.

### Conséquences du chiffrement sur la génération de preuve

- **Qui prouve** : l’agent de preuve, chez le client. La plateforme crée la demande, sert le matériel chiffré, puis vérifie le bundle reçu.
- **Matériel fourni à l’agent** : blobs chiffrés des blocs concernés, chemins de Merkle, données des feuilles frontières (sans valeurs), artefacts du circuit. Rien de cela ne révèle une valeur.
- **Ressources** : le calcul se fait chez le client. L’agent parallélise les blocs, reprend après interruption, affiche sa progression et peut tourner sur un serveur du client.
- **Latence** : la preuve est asynchrone et dépend de la disponibilité de l’agent. Une demande reste `awaiting_prover` jusqu’à prise en charge, puis expire.
- **Le dashboard ne prouve pas seul** : il crée la demande et suit son état. La preuve dans le navigateur, pour de petits blocs, n’est un objectif que si les benchmarks de la Phase 1 le permettent.
- **Validation côté client** : schéma, bornes et compatibilité colonne/template sont contrôlés par le SDK, le dashboard et l’agent, la plateforme n’ayant pas accès aux valeurs.
- **Coffre indispensable** : sans clé, aucune preuve. L’agent charge la clé depuis un fichier protégé par passphrase ou une variable d’environnement, jamais envoyée au serveur.
- **Vérification inchangée** : publique, sans clé, avec les mêmes garanties.
- **Bénéfice** : la plateforme ne paie plus de calcul de preuve, ce qui améliore la marge.

### Templates, définitions et demandes

- **Templates V1.0** : `threshold_max` (valeur ≤ X), `threshold_min` (≥ X), `range_between` (X ≤ valeur ≤ Y), `count_in_scope` (nombre d’enregistrements en sortie publique). Ensuite : `sum_bound`, `max_violations` (au plus K dépassements).
- **Entrées publiques** : racine, `partition_id`, `ts_from`, `ts_to`, index de colonne, seuils, position du bloc, drapeaux de frontière. **Privées** : valeurs, sels, chemins.
- Une **définition de circuit** (versionnée, immutable, avec `spec_hash`) est distincte de la **demande de preuve**, qui lie le périmètre et les seuils. Libellés et noms de colonnes sont chiffrés : la plateforme ne voit que le template et l’index de colonne.

```yaml
# définition de circuit (créée dans le dashboard)
template: threshold_max
column_index: 0
label: chiffré côté client

# demande de preuve (paramètres publics)
circuit: crc_01H...
scope: { partition_id: 0x3f9a..., from: 2026-10-01, to: 2026-10-31 }   # partition_id dérivé de Site A
params: { max: 800 }                                                  # 8,00 °C, échelle 100
```

- Artefacts (wasm, zkey, vkey) versionnés avec leur hash, servis par l’API ; chaque preuve référence sa `circuit_version`. Compilation à la demande : hors V1.0.
- **Tests négatifs obligatoires** : valeur hors seuil, feuille falsifiée, mauvais chemin, frontière manquante, `pseq` non contigu, racine différente de celle du contrat, chiffré altéré. Chaque cas doit faire échouer la preuve ou la vérification.
- Si le prédicat est faux, l’agent refuse de produire une preuve (`predicate_not_satisfied`).

## 7. API, authentification et abonnements

```
POST   /v1/collections            GET /v1/collections          (identifiant seul ; le schéma vit dans le manifeste chiffré)
POST   /v1/records                (chiffré, unitaire ou lot ≤ 100, en-tête Idempotency-Key)
GET    /v1/records                (filtres : collection, partition_id, plage de seq ou de ts ; renvoie du chiffré)
GET    /v1/records/{id}           GET /v1/records/{id}/inclusion-proof   (chemins Poseidon, L2 et L1)
GET    /v1/anchors                GET /v1/anchors/{batchId}              (statuts L2 et L1)
GET    /v1/checkpoints            GET /v1/checkpoints/{index}
POST   /v1/anchors/flush
GET    /v1/vault/wrapped-keys     PUT /v1/vault/wrapped-keys             (blobs enveloppés, opaques)
GET    /v1/vault/manifest         PUT /v1/vault/manifest                 (schémas et libellés chiffrés)
POST   /v1/circuits               GET /v1/circuits
POST   /v1/proof-requests         GET /v1/proof-requests   GET /v1/proof-requests/{id}
POST   /v1/proof-requests/{id}/claim       GET /v1/proof-requests/{id}/materials
POST   /v1/proof-requests/{id}/bundle      (l’agent dépose le bundle ; vérifié côté serveur)
GET    /v1/artifacts/{template}/{version}  (wasm, zkey, vkey, hashes)
POST   /v1/verify                 (public, limité par IP)
GET    /v1/usage
```

- **Comptes** : inscription, vérification d’e-mail, connexion, réinitialisation, sessions cookie HttpOnly, mots de passe argon2id, 2FA TOTP en V1.1. Une organisation (tenant) est créée à l’inscription.
- **Clé API et clé de coffre sont deux choses distinctes.** La clé API authentifie l’appelant auprès de la plateforme et ne permet de lire aucune valeur. La clé de coffre déchiffre les données et ne quitte jamais le client.
- **Clés API** : générées à la demande depuis le dashboard, format `pb_<env>_<préfixe>_<secret>`, secret affiché **une seule fois**, seul le hash SHA-256 est stocké, scopes (`write`, `read`, `prove`), révocation, rotation, date de dernière utilisation. Authentification par en-tête `Authorization: Bearer`. Le scope `prove` est celui de l’agent.
- **Plans** (en base, jamais codés en dur), prix indicatifs en € HT par mois :

| Plan | Prix | Ancrage L2 | Checkpoint L1 | Écritures / mois | Bundles vérifiés / mois |
| --- | --- | --- | --- | --- | --- |
| Sandbox | 0 | 24 h | 24 h | 5 000 | 3 |
| Starter | 49 | 1 h | quotidien | 100 k | 20 |
| Pro | 299 | 15 min | quotidien | 2 M | 200 |
| Business | 990 | 5 min | quotidien | 20 M | 1 000 |
| Enterprise | dès 2 500 | 1 min (super-racine, V1.1) | horaire possible | sur mesure | sur mesure |

- Le Sandbox tourne sur testnets uniquement. Les autres plans visent Arbitrum One et Ethereum, activés après audit ; la V1.0 tourne sur testnets. Les prix et le coût réel du gaz L2 sont à valider par mesure.
- **Quotas** : par catégorie (écriture, lecture, bundle vérifié) plus limites de débit par clé, en-têtes `X-RateLimit-*` et `X-Quota-*`, erreur 429 `quota_exceeded`, remise à zéro à la période de facturation. Facturation à l’usage hors V1.0.
- **Stripe** : Checkout, Customer Portal, webhooks idempotents, changement de plan pris en compte au heartbeat suivant.
- **Erreurs** au format RFC 7807, OpenAPI généré depuis le code.

## 8. Dashboards

### 8.1 Dashboard utilisateur

- **Coffre** : création (passphrase, kit de récupération dont l’enregistrement est confirmé), déverrouillage par passphrase ou passkey, verrouillage automatique. Les clés restent dans le navigateur (clés non exportables quand c’est possible) et ne sont jamais envoyées.
- **Page Clés API** : création, révocation, usage.
- **Collections et schémas**, stockés dans le manifeste chiffré.
- **Explorateur de données**, déchiffré dans le navigateur, avec statut par enregistrement (`pending`, `anchored_l2`, `checkpointed_l1`).
- **Page Ancrages** : statuts L2 et L1 de chaque batch, liens vers les transactions sur les explorateurs, racine, plage de séquences, chemin de preuve.
- **Constructeur de circuits** : collection → partition → colonne → opérateur → seuil → fenêtre, validé côté client.
- **Demandes de preuve** : statut, commande à copier pour lancer l’agent, téléchargement du bundle, bouton Vérifier.
- **Abonnement**, facturation, consommation des quotas, lien vers la documentation.

### 8.2 Dashboard admin (`apps/admin`)

Application distincte, réservée aux opérateurs : rôle `platform_admin`, SSO et 2FA obligatoires, liste d’IP, journal d’audit de chaque action. Elle n’a **aucun accès au contenu des tenants** : elle ne voit que du chiffré et des métadonnées.

- **Supervision L2** : file d’attente, retard d’ancrage par tenant, dernier ancrage, transactions en échec, relance manuelle, ancrage forcé.
- **Supervision L1** : liste des checkpoints, délai depuis le dernier, écart entre le nombre d’ancrages L2 et celui du dernier checkpoint, relance manuelle, checkpoint forcé.
- **Wallets** (ancreur L2, checkpointeur L1) : adresses, soldes, nonces, seuils d’alerte.
- **Politique d’ancrage et de gas** : intervalle du heartbeat, seuils de base fee, délais maximaux de report, fréquence de checkpoint, pause globale ou par tenant.
- **Plans** : intervalles d’ancrage et quotas, édition versionnée.
- **Contrats et RPC** : adresses, versions, identifiants de chaîne, rôles en lecture, santé des RPC (bloc courant, latence, bascule).
- **Contrôle de cohérence** : rapport quotidien comparant racines locales, racines L2 et checkpoints L1, avec alerte en cas d’écart.

## 9. Roadmap V1.0

Tailles : S (quelques jours), M (1 à 2 semaines), L (2 à 4 semaines), pour un développeur assisté par Codex.

### Phase 0 — Fondations et spécification (S)

- Monorepo (`apps/api`, `apps/web`, `apps/admin`, `apps/worker`, `packages/core`, `packages/sdk`, `packages/prover`, `packages/verifier`, `circuits/`, `contracts/`, `docs/`), CI (lint, tests, build), Docker Compose avec Postgres et Redis, accès aux deux testnets, `AGENTS.md`.
- ADR-001 (système de preuve côté client), ADR-002 (réseaux, confirmations, finalité L2 et L1), ADR-003 (primitives de chiffrement et coffre de clés).
- Spécifications dans `docs/spec/` : format de feuille, chiffrement et coffre, arbre, complétude avec cas limites, ancrage à deux niveaux, format du bundle, API.
- **Critère** : `pnpm install && pnpm test` vert en CI, spécifications validées, test « zéro clair » défini (§12).

### Phase 1 — Spike ZK chiffré de bout en bout (M) — risque principal

- `packages/core` : Poseidon, encodage, arbre trié à profondeur fixe, chemins, chiffrement, engagement `cols_commit`, vecteurs de test.
- Circuit `threshold_max` (N=16) avec règles de complétude et tests négatifs, dont le témoin est construit **uniquement à partir de chiffrés et de la clé**.
- Benchmarks des prouveurs (Circom + Groth16 avec rapidsnark, snarkjs WASM, Noir + Barretenberg) pour N=16, 64 et 256 dans `docs/benchmarks.md`, puis décision ADR-001 et choix des tailles de bloc.
- **Critère** : preuve valide produite depuis des données chiffrées et une clé, sans aucun clair côté « serveur » du script ; échec sur 100 % des cas négatifs ; critères de performance du §3.3 atteints ou ADR révisé.

### Phase 2 — Smart contracts L2 et L1 (M)

- `AnchorRegistry` (arbre incrémental, invariants) et `CheckpointRegistry` selon le §5, tests Foundry (unitaires, fuzz, invariants de contiguïté), scripts de déploiement, package ABI.
- Déploiement sur Arbitrum Sepolia et Sepolia, vérification du code source, `deployments.json`.
- **Critère** : couverture > 90 %, gas par ancrage et par checkpoint mesuré et consigné, chemin de Merkle d’un ancrage vérifié contre la racine publiée par le contrat.

### Phase 3 — Comptes, clés API, coffre et écriture chiffrée (L)

- Authentification et organisations ; clés API (génération, hash, scopes, révocation, rotation) ; middleware d’authentification et limites de débit.
- Endpoints du coffre (blobs opaques) ; `packages/sdk` : coffre, dérivation de clés, chiffrement, engagement, écriture, lecture, déchiffrement, vérification du reçu.
- Collections ; `POST /v1/records` avec idempotence, attribution de `seq`, `pseq` et `ts`, reçu signé ; lecture paginée de chiffrés.
- **Critère** : avec le SDK, un utilisateur s’inscrit, crée un coffre, écrit et relit des données ; **le dump complet de la base et des logs ne contient aucune valeur en clair ni aucune clé** (test automatisé).

### Phase 4 — Ancrage L2 et checkpoint L1 (L)

- Heartbeat, politique par plan, scellement, construction d’arbre.
- Worker L2 : transactions viem, nonce et gas, `anchorMany`, confirmations, reorgs, relances idempotentes.
- Worker de checkpoint : lecture de la racine de l’arbre des ancrages, cadence quotidienne, report gas-aware, relances.
- Machine à états des statuts (§3.5) ; endpoints anchors, checkpoints, inclusion-proof et flush.
- **Critère** : sur Arbitrum Sepolia et Sepolia dès les premiers tests d’intégration, écriture → batch → ancrage L2 → checkpoint L1, avec racines recalculées indépendamment et égales à celles des contrats ; un crash du worker en pleine transaction ne duplique ni ne perd d’ancrage ; une alerte se déclenche en cas de retard.

### Phase 5 — Preuves côté client et vérification (L)

- Templates complets (`threshold_max`, `threshold_min`, `range_between`, `count_in_scope`), scripts reproductibles de compilation et de setup (cérémonie de développement), registre d’artefacts versionnés servi par l’API.
- API des demandes de preuve ; `packages/prover` : agent CLI, image Docker et librairie (interrogation des demandes, prise en charge, déchiffrement local, témoins, preuves par bloc en parallèle avec reprise et progression, assemblage du bundle).
- Bundle : preuves et manifeste (batchs, racines, chemins vers la racine L2 et le checkpoint L1, adresses, identifiants de chaîne).
- `packages/verifier` (Node et navigateur) : preuves, lecture des racines L2, chemin vers L1, complétude, niveaux d’assurance `L2` et `L1` ; endpoint `/v1/verify`.
- **Critère** : scénario de référence « températures du Site A ≤ 8 °C, 10 000 enregistrements sur 3 batchs » prouvé par l’agent à partir de chiffrés et vérifié par un tiers sans clé ; une altération d’un chiffré ou d’une racine fait échouer la vérification ; une température à 9 °C fait échouer la requête ≤ 8 côté agent (`predicate_not_satisfied`).

### Phase 6 — Abonnements et quotas (M)

- Plans en base (intervalle d’ancrage L2, cadence de checkpoint, quotas), Stripe (Checkout, Portal, webhooks idempotents), quotas mensuels et limites de débit, en-têtes et erreurs, remise à zéro par période.
- **Critère** : passer de Starter à Pro change la fréquence d’ancrage L2 au heartbeat suivant ; un dépassement de quota renvoie 429 ; tests de webhooks rejouables.

### Phase 7 — Dashboard utilisateur (M)

- Pages du §8.1, déchiffrement dans le navigateur, états de chargement et d’erreur, suivi des demandes de preuve.
- **Critère** : parcours complet sans `curl`, hors lancement de l’agent : inscription → abonnement → coffre → clé API → données → ancrage → circuit → demande de preuve → vérification. Test E2E Playwright vérifiant aussi qu’aucune clé ni aucun clair ne part vers le serveur.

### Phase 8 — Dashboard admin (M)

- Application `apps/admin` selon le §8.2 : supervision L2 et L1, wallets, politique de gas, plans, contrats et RPC, contrôle de cohérence, journal d’audit, SSO et 2FA.
- **Critère** : un opérateur voit l’état L2 et L1 en temps réel, force un ancrage et un checkpoint, met un tenant en pause et modifie la fréquence d’un plan, pris en compte au heartbeat suivant ; toutes les actions sont journalisées ; aucun accès au contenu des tenants.

### Phase 9 — Documentation, vérificateur public et CLI (M)

- Documentation : quickstart de 5 minutes, concepts, **modèle de confiance et limites**, guide du coffre et de la récupération de clé, guide de l’agent, référence OpenAPI, exemples curl, JavaScript et Python.
- Page publique `/verify` (vérification côté navigateur) ; CLI `proofbase verify-bundle` et `proofbase audit-export` (export chiffré et clé → reconstruction des arbres → comparaison avec les racines L2 et L1).
- **Critère** : un tiers sans compte vérifie un bundle de bout en bout, aux niveaux L2 et L1 ; l’audit d’un export détecte une altération.

### Phase 10 — Durcissement et release (M)

- Revue sécurité (OWASP, XSS et CSP strictes autour des clés dans le navigateur, secrets, dépendances), revue de la cryptographie, analyse des circuits (circomspect et relecture manuelle contre les sous-contraintes), tests de charge (k6), observabilité (logs sans données sensibles, métriques, alertes sur retard d’ancrage, échecs de transaction, soldes des wallets), sauvegardes, runbooks, CGU et politique de confidentialité.
- Déploiement staging et production sur testnets, bascule mainnet par configuration après audit, tag `v1.0`.

### Définition de « fini » pour la V1.0

- Ancrage L2 et checkpoint L1 fonctionnels et supervisés dans le dashboard admin.
- Aucune donnée en clair ni clé sur la plateforme, prouvé par le test « zéro clair ».
- Création de circuits, comptes, abonnements, clés API générées à la demande.
- Preuve ZK générée par l’agent à partir de données chiffrées, vérifiée publiquement aux niveaux L2 et L1.
- Tout ce qui précède couvert par des tests automatisés verts.

## 10. Hors périmètre V1.0 et évolutions

- **V1.1** : super-racine L2 (ancrage à la minute pour tous les tenants concernés), partage de clé avec un auditeur par chiffrement à clé publique, signatures client, 2FA, webhooks.
- **V2** : relais L1 sans confiance par message natif L2 vers L1, prouveur en enclave de confiance (TEE) pour lancer des preuves depuis le dashboard, multi-utilisateurs et rôles sur le coffre, signatures de capteurs.
- **Couche de redondance DA** (blobs EIP-4844, Celestia, EigenDA, Avail) : désormais sans risque de fuite puisque les données sont chiffrées ; tout auditeur détenteur de la clé pourra reconstruire les arbres sans la plateforme.
- Piste de recherche : preuves collaboratives (MPC) pour déléguer la preuve sans révéler le témoin.
- Agrégation récursive des preuves, preuve dans le navigateur à grande échelle, agent hébergé, circuits personnalisés compilés à la demande, zkVM pour requêtes libres.
- Vérification on-chain des preuves, mainnet après audit, multi-chaînes, SDK Python, facturation à l’usage.

## 11. Risques à surveiller

- **Perte de clé** : perte définitive des données. Kit de récupération obligatoire à l’onboarding, messages explicites, tests d’usage.
- **Clé exposée dans le navigateur** (XSS, extension, dépendance compromise) : CSP stricte, Trusted Types, SRI, dépendances figées, aucun script tiers sur les pages déverrouillées, verrouillage automatique.
- **Performance et expérience de la preuve côté client** : agent natif, bornes sur N, progression et reprise, agent hébergé plus tard.
- **Métadonnées visibles** (volumes, rythme, tailles, pseudonymes) : padding des tailles, documentation honnête.
- **Complétude et modèle de confiance** : ne pas promettre plus que le §2.
- **Circuits sous-contraints** : une preuve fausse acceptée est le pire scénario. Tests négatifs, outils d’analyse, audit externe avant mainnet.
- **Relais L1 centralisé** : divergence détectable, relais sans confiance prévu en V2.
- **L2** : séquenceur centralisé et reorgs avant publication sur L1 ; statuts explicites, checkpoint quotidien qui fige l’historique.
- **Cryptographie** : bibliothèques auditées uniquement, revue externe avant mainnet.
- **Dashboard admin** : surface privilégiée. SSO et 2FA, isolation réseau, moindres privilèges, journal d’audit, aucun accès au contenu.
- **Coût du gas** : faible sur L2, mutualisé sur L1 ; report gas-aware.
- **RGPD** : seules des racines sont on-chain et le reste est chiffré ; détruire la clé ou le blob rend un enregistrement irrécupérable.

## 12. Instructions pour Codex

- Lis ce document en entier et crée `AGENTS.md` (conventions, commandes, règles ci-dessous).
- Travaille phase par phase, une branche et une PR par phase. Ne passe à la suivante que lorsque les critères d’acceptation sont verts.
- Toute décision non prévue fait l’objet d’un ADR court dans `docs/adr/`.
- **Règle d’or** : aucun clair ni aucune clé ne doit atteindre `apps/api`, `apps/worker`, `apps/admin`, la base de données ou les logs. Seuls le SDK, l’agent et le navigateur de l’utilisateur voient du clair.
- **Test « zéro clair »** à garder vert en CI : après un scénario E2E avec des valeurs sentinelles, scanner le dump de la base et les logs, et échouer si une valeur ou une clé apparaît.
- Tests d’abord pour la cryptographie, les circuits et les contrats. Aucun secret dans le dépôt, aucun déploiement mainnet.

Prompt de démarrage :

```
Tu es l’ingénieur principal du projet ProofBase décrit dans ce document.
Commence par la Phase 0 : crée le monorepo, la CI, le Docker Compose avec Postgres et Redis, accès aux deux testnets,
AGENTS.md, les ADR et les spécifications de docs/spec/.
Respecte la règle d’or : aucun clair ni clé côté plateforme.
Vérifie les dernières versions stables des outils avant de les épingler.
Ne passe à la Phase 1 que lorsque les critères d’acceptation de la Phase 0 sont verts.
```
