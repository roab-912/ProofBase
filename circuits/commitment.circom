pragma circom 2.1.9;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";

template ColumnsCommitment() {
    signal input columns[8];
    signal input salt;
    signal output commitment;
    component bounds = Num2Bits(128);
    bounds.in <== salt;
    component hash = Poseidon(9);
    for (var i = 0; i < 8; i++) {
        hash.inputs[i] <== columns[i];
    }
    hash.inputs[8] <== salt;
    commitment <== hash.out;
}
