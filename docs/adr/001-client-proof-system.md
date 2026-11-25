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
