# Preuve de seuil depuis des enregistrements chiffrés

Mesures du 25 novembre 2026 sur un portable Intel Core i7-1165G7 (4 cœurs physiques, 8 processeurs logiques, 16 Go de RAM). L’agent prépare un bloc plein, entièrement dans la fenêtre, avec une colonne int64 et les mêmes valeurs synthétiques pour chaque moteur. Identifiants, sels et clés sont frais à chaque exécution. Le stockage intermédiaire reçoit des chiffrés et des métadonnées publiques. Les durées numériques correspondent à des preuves vérifiées. Pour PLONK à 64 lignes, les trois appels au prouveur ont dépassé le délai de 60 s et ont été interrompus avant vérification.

## Résultats par bloc

| Moteur          |   N | Preuve médiane / p95 (s) | Vérification médiane / p95 (s) | Pic (Mio) |
| --------------- | --: | -----------------------: | -----------------------------: | --------: |
| Groth16 natif   |  16 |            0.780 / 0.850 |                  0.203 / 0.207 |        44 |
| Groth16 natif   |  64 |            2.290 / 2.360 |                  0.215 / 0.226 |       145 |
| Groth16 natif   | 256 |          30.570 / 33.090 |                  0.983 / 1.135 |       544 |
| Groth16 WASM    |  16 |            7.124 / 9.867 |                  0.534 / 0.923 |       491 |
| Groth16 WASM    |  64 |           9.818 / 10.241 |                  0.012 / 0.014 |       819 |
| Groth16 WASM    | 256 |        238.325 / 301.740 |                  0.086 / 0.358 |      2049 |
| UltraHonk natif |  16 |            4.770 / 4.910 |                  0.900 / 1.000 |       169 |
| UltraHonk natif |  64 |            6.170 / 6.210 |                  0.260 / 0.270 |       454 |
| UltraHonk natif | 256 |          20.050 / 20.370 |                  0.250 / 0.330 |      1589 |
| PLONK WASM      |  16 |        363.355 / 749.070 |                  0.097 / 0.103 |      1209 |
| PLONK WASM      |  64 |                >60 / >60 |                              — |         — |
| PLONK WASM      | 256 |                        — |                              — |         — |

Trois exécutions par cellule. La médiane est la deuxième observation triée et le p95 empirique la troisième. Le pic est le maximum des trois RSS, arrondi au Mio supérieur. Les moteurs natifs tournent sous Debian/WSL avec une affinité de quatre processeurs logiques. Le moteur WASM tourne sous Node 26.13.1 sur Windows avec quatre workers de calcul. La colonne de vérification Groth16 utilise snarkjs. Le processus WASM peut réutiliser la courbe déjà initialisée pendant la preuve. La vérification UltraHonk démarre un processus Barretenberg distinct.

Le temps de preuve exclut compilation, setup, chiffrement, déchiffrement et génération du témoin. La mémoire native couvre le processus prouveur et la mémoire WASM couvre Node avec ses workers. Des préparations de paramètres concurrentes ont ralenti des essais, notamment à 256 lignes. Ces essais sur portable caractérisent un ordre de grandeur. Le p95 sur trois points ne permet pas de fixer un engagement de service.

## Choix de taille

Le setup Circom/PLONK N=256 a compté 1 517 398 contraintes et refusé les paramètres de puissance 19. La puissance requise est 21. Avec 19 signaux publics, snarkjs 0.7.6 alloue et remplit un tableau de `2²¹ × 32 × 4 × 19` octets, soit 4,75 Gio, avant les autres tableaux du prouveur. La cellule N=256 de cet adaptateur est éliminée pour dépassement du budget mémoire. Aucun temps de preuve ou RSS n’est attribué à ce cas. [Calcul dans snarkjs](https://github.com/iden3/snarkjs/blob/v0.7.6/src/plonk_prove.js#L505-L509)

Groth16 natif respecte à N=64 les budgets de 60 s, 4 Go et 1 s. Retenir 64 pour le profil de l’agent, garder 16 pour les petits lots et rendre 256 explicite. Le repli WASM est mesuré sous Node. La consommation et le temps dans un navigateur mobile restent à mesurer avant de le proposer.

Une requête visant 10 000 lignes réparties dans un seul batch exige 157 blocs de taille 64. La couverture exige en outre des preuves pour les autres blocs occupés de l’historique, même hors fenêtre. Le coût d’un bloc ne donne donc pas directement la latence d’une demande complète.

## Reproduction

Sur une préparation Groth16 N=16 distincte, la compilation Circom a pris
28,83 s et le setup, contribution et export de la clé de vérification compris,
184,31 s avec les paramètres de puissance 19. Ces coûts de préparation sont
amortis sur les preuves utilisant le même circuit.

Circom 2.2.3, circomlib 2.0.5, rapidsnark 0.0.8, snarkjs 0.7.6, Nargo 1.0.0, Poseidon Noir 0.4.0 et Barretenberg 6.1.0. Les clés du spike sont des paramètres de développement générés localement. La CI refait le setup Groth16 de taille 16 et ajoute une contribution fraîche. Une exécution interrompue peut reprendre depuis les paramètres compilés en relançant la mesure du bloc. Aucune mesure du temps perdu lors d’une interruption n’a été collectée.

Les commandes de préparation, de preuve et de génération du tableau figurent dans [le guide du spike](phase-1.md).

Pour recalculer le tableau depuis les échantillons publiés, exécuter
`node tools/spike/report.mjs docs/benchmark-samples.json`. Ce fichier contient
les durées, les pics de mémoire et les dépassements de délai.
