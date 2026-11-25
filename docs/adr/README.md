# Décisions d’architecture

| ADR                                 | Décision                                               | État                                      |
| ----------------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| [001](001-client-proof-system.md)   | Circom/Groth16, preuve client                          | Groth16 natif, blocs de 64 en Phase 1     |
| [002](002-networks-finality.md)     | Deux réseaux, finalité et relais explicites            | Adopté                                    |
| [003](003-encryption-vault.md)      | Chiffrement client et frontière des clés               | Adopté                                    |
| [004](004-protocol-completeness.md) | Encodage et complétude conservatrice                   | Adopté pour V1 ; tests Phase 1 requis     |
| [005](005-tooling-phase-gates.md)   | Socle minimal, versions et barrières de phase          | Adopté                                    |
| [006](006-testnets-and-ports.md)    | Testnets réels dès le début, interfaces et adaptateurs | Demandé par le propriétaire ; prioritaire |

Date des décisions : 2026-11-24. « Adopté » décrit le choix d’ingénierie,
pas une approbation externe ou un audit de sécurité.
