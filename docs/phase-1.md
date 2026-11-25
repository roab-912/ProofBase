# Spike ZK côté client

Le SDK chiffre les mesures et lie chaque enveloppe à son tenant, sa collection,
sa partition, sa version de clé et son engagement. Le processus de stockage du
spike reçoit ces enveloppes et leurs métadonnées sur son entrée standard.
L’agent travaille sur la relecture du stockage, ouvre les lignes pertinentes avec
sa clé et reconstruit les colonnes privées nécessaires au circuit.

Le circuit vérifie la fenêtre d’ingestion semi-ouverte, la partition, les sels,
le seuil, l’ordre des lignes et le chemin vers la racine. Le vérificateur reçoit
une clé de vérification publique et une requête indépendante. Le contrôle de
couverture exige un bloc pour chaque intervalle occupé de chaque batch de
l’inventaire fourni. En Phase 1 cet inventaire est une fixture. Sa lecture
depuis les contrats Sepolia et Arbitrum Sepolia appartient aux phases suivantes.

## Reproduire la preuve

Installer avec le lockfile, utiliser Circom 2.2.3 et un fichier de cérémonie
BN254 préparé, puis définir `CIRCOM` (exécutable) et `PTAU` (fichier).
Le workflow GitHub fournit les URLs et vérifie les empreintes pour N=16.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:circuit
node tools/spike/prepare.mjs groth16 16
node tools/spike/run.mjs 16
```

La préparation compile R1CS/WASM, exécute le setup et ajoute une contribution
aléatoire de développement avant d’exporter la clé de vérification. Chaque
exécution utilise un jeu de lignes synthétiques frais. Trois preuves sont
vérifiées, et un autre engagement public doit faire échouer la vérification.
Les fichiers du témoin sont temporaires. Les paramètres et les mesures restent
sous `.local/spike`. Les clés de développement sont réservées à ce spike.

## Reproduire la comparaison

Les tailles disponibles sont 16, 64 et 256. Le setup et le calcul du témoin
précèdent le chronométrage de la preuve. Pour Groth16 natif, définir
`RAPIDSNARK` avec le chemin Linux du binaire et éventuellement `GNU_TIME`.
Sous Windows le script utilise WSL Debian. Les binaires Linux et les chemins
doivent être accessibles depuis ce système. Le vérificateur utilise snarkjs.

Pour Noir, installer Nargo 1.0.0 et Barretenberg 6.1.0, puis compiler avec
`node tools/spike/prepare.mjs noir 64`. Définir `SPIKE_ENGINE=noir`,
`NARGO`, `BB` et `GNU_TIME` dans l’environnement Linux pour exécuter
`node tools/spike/run.mjs 64`. Le package Noir utilise Poseidon BN254
v0.4.0 avec les mêmes domaines et produit les mêmes onze sorties publiques.
Pour PLONK, utiliser `prepare.mjs plonk N` et `SPIKE_ENGINE=plonk` avec
une cérémonie assez grande pour les contraintes après conversion PLONK.
À N=64, `SPIKE_TIMEBOX=1` mesure trois tentatives avec un délai de 60 s
chacune à partir de l’appel au prouveur. Sans cette variable, le script attend
la preuve et sa vérification. `preparation.json` consigne séparément la
compilation et, pour Circom, le setup et l’export du catalogue.

`node tools/spike/report.mjs` calcule les médianes, p95 et pics à partir
des observations locales. Les mesures de référence et les limites sont dans
le [rapport de benchmark](benchmarks.md).

## Contrôles d’acceptation

- Le processus de stockage du spike reçoit uniquement les lignes sérialisées
  sur son entrée standard. Le scanner inspecte la requête et sa relecture avec
  des canaris pour le libellé, le sel, la clé racine et la clé dérivée.
- Le test du circuit exécute un bloc final partiel puis dix mutations de la
  racine, de la position, du compte, du seuil, de la colonne, de la fenêtre,
  du sel, du chemin, de la séquence et de l’ouverture.
- Le vérificateur relie une preuve à son profil, à la clé du catalogue et aux
  huit entrées publiques demandées. La vérification de l’historique compare le
  tenant, le réseau, le registre, le bloc, son hash et le nombre de batchs à
  l’inventaire indépendant. Ses tests injectent un inventaire de développement.
- Les écritures sur Arbitrum Sepolia et les checkpoints sur Sepolia commencent
  avec les contrats de Phase 2. Les lectures RPC utilisent déjà les deux testnets.
