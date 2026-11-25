# ADR-004 — Ambiguïtés de protocole et complétude

## Contexte

Le cadrage donne les formules, mais pas tous les encodages, domaines, bornes,
horloges et règles de sélection. Deux frontières correctes choisies par un
prouveur ne garantissent pas l’absence d’une autre feuille pertinente cachée
dans une zone non contrôlée d’un arbre mal trié.

## Décision

Format `proofbase/1`, bornes temporelles `[from,to)`, millisecondes Unix serveur
non décroissantes, séquences démarrant à 1, batchs/index d’ancrage à 0.
Domaines Poseidon et encodages canoniques dans les specs ; aucun modulo implicite.
L’heure d’événement reste chiffrée et n’est pas l’horloge du périmètre V1.

La V1 conservatrice vérifie chaque batch du tenant depuis le premier jusqu’à
un instantané on-chain fixé, et tous les blocs occupés de chacun. Les circuits
contrôlent l’ordre local et publient les frontières nécessaires au vérificateur
pour contrôler toutes les jonctions. Même les batchs sans ligne pertinente
doivent apporter leur couverture/absence. Les blocs entièrement vides sont
prouvés par les sous-arbres de padding canoniques. Le nombre de feuilles occupées
doit être `lastSeq-firstSeq+1`.

Cela empêche qu’un prouveur sélectionne son propre inventaire de batchs/blocs.
Une optimisation par index authentifié ou preuve globale de bon tri requerra
un ADR et des tests adversariaux ; elle ne peut pas supprimer ce contrôle en V1.

## Limites

La preuve porte sur le snapshot ancré. Elle ne prouve ni la vérité physique,
ni qu’une mesure a été envoyée, ni l’inclusion d’un reçu resté pending.
Un suffixe jamais ancré n’est pas détectable par la seule racine : les reçus
permettent un audit séparé. La phrase du cadrage assimilant toute omission à
un trou de pseq est donc restreinte aux trous entre séquences effectivement engagées.
Le coût croît avec l’historique du tenant ; le benchmark Phase 1 doit l’expliciter.
