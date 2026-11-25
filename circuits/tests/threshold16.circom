pragma circom 2.1.9;
include "../threshold-max.circom";
component main {public [root,start,count,target,from,to,column,max]} = ThresholdMax(4);
