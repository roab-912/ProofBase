pragma circom 2.1.9;
include "commitment.circom";
include "circomlib/circuits/comparators.circom";

template BatchNode() {
    signal input pair[2];
    signal output digest;
    digest <== Poseidon(3)([0x5042313a4e4f4445, pair[0], pair[1]]);
}

// A single authenticated block. The bundle verifier must join boundaries and
// obtain root/count and the complete block inventory independently.
template ThresholdMax(logN) {
    var N = 1 << logN;
    signal input root, start, count, target, from, to, column, max;
    signal input partitionId[N], pseq[N], ts[N], colsCommit[N];
    signal input columns[N][8], salts[N], siblings[20-logN];
    signal output inScopeCount;
    signal output first[3], last[3];
    signal output targetFirst[2], targetLast[2];

    signal bits[20] <== Num2Bits(20)(start);
    for (var j=0;j<logN;j++) bits[j] === 0;
    _ <== Num2Bits(21)(count);
    signal validCount <== LessThan(21)([count,(1<<20)+1]); validCount === 1;
    signal validStart <== LessThan(21)([start,count]); validStart === 1;
    _ <== Num2Bits(64)(target);
    _ <== Num2Bits(64)(from);
    _ <== Num2Bits(64)(to);
    _ <== Num2Bits(64)(max);
    _ <== Num2Bits(3)(column);
    signal validWindow <== LessThan(64)([from,to]); validWindow === 1;

    signal choose[8];
    for (var j=0;j<8;j++) choose[j] <== IsEqual()([column,j]);
    signal zero[21];
    zero[0] <== Poseidon(1)([0x5042313a454d505459]);
    for (var h=0;h<20;h++) zero[h+1] <== BatchNode()([zero[h],zero[h]]);

    signal isPadding[N], partDrop[N-1], timeDrop[N-1], equalTarget[N], beforeFrom[N], beforeTo[N], siblingOccupied[20-logN];
    signal occupied[N], matchPart[N], inWindow[N], selected[N], openings[N], chosen[N][8];
    signal digest[N], heap[2*N-1], same[N-1], joined[N-1];
    signal tail[N+1][3], headTarget[N+1][2], tailTarget[N+1][2];
    signal seen[N+1], firstMatch[N];
    for(var j=0;j<3;j++) tail[0][j] <== 0;
    for(var j=0;j<2;j++){ headTarget[0][j] <== 0; tailTarget[0][j] <== 0; }
    seen[0] <== 0;
    var total=0;
    for(var i=0;i<N;i++){
        occupied[i] <== LessThan(21)([start+i,count]);
        _ <== Num2Bits(64)(partitionId[i]);
        _ <== Num2Bits(64)(pseq[i]);
        _ <== Num2Bits(64)(ts[i]);
        isPadding[i] <== IsZero()(pseq[i]); isPadding[i] === 1-occupied[i];
        if(i>0){
            same[i-1] <== IsEqual()([partitionId[i-1],partitionId[i]]);
            joined[i-1] <== same[i-1]*occupied[i];
            partDrop[i-1] <== LessThan(64)([partitionId[i],partitionId[i-1]]); occupied[i]*partDrop[i-1] === 0;
            joined[i-1]*(pseq[i]-pseq[i-1]-1) === 0;
            timeDrop[i-1] <== LessThan(64)([ts[i],ts[i-1]]); joined[i-1]*timeDrop[i-1] === 0;
        }
        equalTarget[i] <== IsEqual()([target,partitionId[i]]); matchPart[i] <== occupied[i]*equalTarget[i];
        beforeFrom[i] <== LessThan(64)([ts[i],from]); beforeTo[i] <== LessThan(64)([ts[i],to]); inWindow[i] <== (1-beforeFrom[i])*beforeTo[i];
        selected[i] <== matchPart[i]*inWindow[i];
        total += selected[i];
        openings[i] <== ColumnsCommitment()(columns[i],salts[i]);
        selected[i]*(openings[i]-colsCommit[i]) === 0;
        var value=0;
        for(var j=0;j<8;j++){
            chosen[i][j] <== choose[j]*columns[i][j];
            value += chosen[i][j];
        }
        // Range-check the selected column before comparing as an unsigned integer.
        CheckedThreshold()(value,selected[i],max);
        digest[i] <== Poseidon(5)([0x5042313a4c454146,partitionId[i],pseq[i],ts[i],colsCommit[i]]);
        heap[N-1+i] <== zero[0]+occupied[i]*(digest[i]-zero[0]);
        var tuple[3]=[partitionId[i],pseq[i],ts[i]];
        for(var j=0;j<3;j++) tail[i+1][j] <== tail[i][j]+occupied[i]*(tuple[j]-tail[i][j]);
        firstMatch[i] <== matchPart[i]*(1-seen[i]);
        seen[i+1] <== seen[i]+firstMatch[i];
        for(var j=0;j<2;j++){
            headTarget[i+1][j] <== headTarget[i][j]+firstMatch[i]*(tuple[j+1]-headTarget[i][j]);
            tailTarget[i+1][j] <== tailTarget[i][j]+matchPart[i]*(tuple[j+1]-tailTarget[i][j]);
        }
    }
    inScopeCount <== total;
    first[0] <== partitionId[0]; first[1] <== pseq[0]; first[2] <== ts[0];
    for(var j=0;j<3;j++) last[j] <== tail[N][j];
    for(var j=0;j<2;j++){ targetFirst[j] <== headTarget[N][j];targetLast[j] <== tailTarget[N][j]; }
    for(var i=N-2;i>=0;i--) heap[i] <== BatchNode()([heap[2*i+1],heap[2*i+2]]);
    signal path[21-logN], left[20-logN];
    path[0] <== heap[0];
    for(var h=logN;h<20;h++){
        var k=h-logN;
        var siblingStart=(1-bits[h])*(1<<h);
        for(var j=h+1;j<20;j++) siblingStart+=bits[j]*(1<<j);
        siblingOccupied[k] <== LessThan(21)([siblingStart,count]); (1-siblingOccupied[k])*(siblings[k]-zero[h]) === 0;
        left[k] <== path[k]+bits[h]*(siblings[k]-path[k]);
        path[k+1] <== BatchNode()([left[k],path[k]+siblings[k]-left[k]]);
    }
    path[20-logN] === root;
}

template CheckedThreshold() {
    signal input value, selected, max;
    signal activeValue <== selected*value;
    _ <== Num2Bits(64)(activeValue);
    signal exceeds <== LessThan(64)([max,activeValue]); exceeds === 0;
}
