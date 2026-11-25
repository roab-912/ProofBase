# ADR-001 — Système de preuve côté client

## Contexte

La plateforme n’a ni données déchiffrées ni clé. Le prouveur doit fonctionner
sur une machine client de 4 cœurs avec moins de 4 Go de mémoire.

## Décision

Circom 2, Poseidon BN254 circomlib, Groth16. Agent natif avec rapidsnark ;
snarkjs WASM en repli et, si les mesures le permettent, dans le navigateur.
Une interface `ProofSystem` séparera `compile`, `setup`, `prove`, `verify`.
Seule la capacité `verify` sera exposée aux applications plateforme ; `prove`
ne recevra ses témoins que dans le processus client. L’interface est à implémenter
en Phase 1, pas sous forme d’un faux prouveur dans cette fondation.

Templates précompilés, blocs 16/64/256, artefacts identifiés par version et
SHA-256, pas de compilation par tenant. Paramètres et ordre des signaux publics
font partie du `spec_hash`. Cérémonies de développement explicitement marquées
`development`; rejet pour tout profil mainnet. Cérémonie publique par circuit
et audit avant mainnet.

## Alternatives et critère de révision

Phase 1 : mesurer Circom/Groth16 natif et WASM, Circom/PLONK et
Noir/Barretenberg sur les mêmes données, N=16/64/256, matériel et versions
consignés. Objectif N=64 : preuve <60 s, pic RSS <4 Go, vérification <1 s.
Rapport médiane/p95, compilation/setup séparés, reprise et mémoire incluses.
Un échec impose la révision de cet ADR avant de continuer.

## Conséquences

Cérémonies Groth16 multiples, calcul payé par le client et demandes asynchrones.
Les garanties de complétude d’ADR-004 peuvent augmenter le nombre de blocs ;
le budget par bloc ne constitue pas un budget par requête de 10 000 lignes.

## Décision après mesures du 25 novembre 2026

L’agent utilise Groth16 natif avec des blocs de 64. Sur le portable de
référence, la preuve médiane prend 2,29 s, la vérification 0,215 s et le
prouveur atteint 145 Mio de RSS. Le repli snarkjs sous Node satisfait aussi
les trois seuils à cette taille. Garder 16 pour les petits lots et réserver
256 aux demandes explicites. La preuve WASM de 256 lignes a dépassé quatre
minutes sur un des essais. UltraHonk vérifie les trois tailles et reste un
candidat pour un futur profil versionné. L’usage dans le navigateur demande
des mesures sur les appareils visés.

Pour le comparatif complémentaire Circom/PLONK, arrêter avant la preuve si
une seule allocation nécessaire dépasse le budget client. Le circuit N=256
converti par snarkjs comporte 1 517 398 contraintes et 19 signaux publics.
Son domaine de taille 2²¹ impose 4,75 Gio pour le seul tableau de Lagrange.
La taille 256 est donc éliminée pour cet adaptateur. Le rapport distingue
cette borne calculée des pics RSS effectivement mesurés.

Les tailles, les versions, la méthode et les observations figurent dans le
[rapport des mesures](../benchmarks.md).
