#include "rate.h"
#include <cstdlib>
#include <iostream>
#define CHECK(x) do{if(!(x)){std::cerr<<__LINE__<<": "<<#x<<" failed\n";std::exit(1);}}while(0)
int main(){
 flybrain::RateNetwork n(3,2);n.offsets={0,1,2,2};n.targets={1,2};n.weights={4,8};CHECK(n.initialize());
 n.input[0]=1000;n.step();CHECK(n.values==std::vector<uint32_t>({1000,0,0}));n.input[0]=0;n.step();CHECK(n.values==std::vector<uint32_t>({250,600,0}));n.step();CHECK(n.values==std::vector<uint32_t>({62,300,360}));
 for(int i=0;i<100;i++)n.step();CHECK(n.values==std::vector<uint32_t>({0,0,0}));
 flybrain::RateNetwork recurrent(2,2);recurrent.offsets={0,1,2};recurrent.targets={1,0};recurrent.weights={100,999};CHECK(recurrent.initialize());recurrent.input[0]=65535;recurrent.step();recurrent.input[0]=0;
 auto previous=65535u;for(int i=0;i<100;i++){recurrent.step();unsigned maximum=std::max(recurrent.values[0],recurrent.values[1]);CHECK(maximum<=previous);previous=maximum;}CHECK(previous==0);
 recurrent.reset();CHECK(recurrent.values==std::vector<uint32_t>({0,0}));
 flybrain::RateNetwork pack(3,0);pack.offsets={0,0,0,0};CHECK(pack.initialize());
 pack.values={0,64,32704};CHECK(pack.pack_activity()==2);CHECK(pack.packed==std::vector<uint8_t>({0,1,255}));
 std::cout<<"rate model: weighted delay, normalization, recurrent decay, reset, pack passed\n";
}
