#include "game.h"
#include <chrono>
#include <iostream>
int main(){auto s=flygame::game_reset(1);constexpr int frames=1000000;auto begin=std::chrono::steady_clock::now();uint32_t result=0;for(int i=0;i<frames;++i){if(s.winner!=-1||s.tick>600)s=flygame::game_reset(i);flygame::game_step(s,{i%120<60?1000:-1000,unsigned(i%37==0?1:0)},{i%90<45?-1000:1000,unsigned(i%27==0?4:0)});result^=flygame::game_hash(s);}double seconds=std::chrono::duration<double>(std::chrono::steady_clock::now()-begin).count();std::cout<<"game_frames_per_second="<<frames/seconds<<" realtime_multiple="<<frames/seconds/60<<" frames="<<frames<<" checksum="<<result<<'\n';}
