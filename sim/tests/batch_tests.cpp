#include "batch.h"
#include <iostream>
#include <cstdlib>
#include <stdexcept>
using namespace flygame;
#define CHECK(x) do{if(!(x)){std::cerr<<__LINE__<<": "<<#x<<" failed\n";std::exit(1);}}while(0)
int main(){
 for(const std::size_t n:{1,16,64,256,1024}){
  GameBatch batch(n,99);std::vector<GameState> serial;std::vector<ControllerInput> fox(n),fly(n);
  for(std::size_t i=0;i<n;i++)serial.push_back(game_reset(99+uint32_t(i)));
  for(int tick=0;tick<240;tick++){
   if(tick==37){batch.reset(n/2,876);serial[n/2]=game_reset(876);}
   for(std::size_t i=0;i<n;i++){
    const unsigned phase=tick+unsigned(i)*7;
    fox[i]={phase%90<45?1000:-1000,unsigned(phase%23==0?Jump:phase%17==0?Strike:0)};
    fly[i]={phase%60<30?-750:750,unsigned(phase%19==0?Strike:phase%41==0?Jump:0)};
   }
   batch.step(fox,fly);
   // Reverse lane traversal cannot change results; each state has its own history.
   for(std::size_t i=n;i-->0;){game_step(serial[i],fox[i],fly[i]);CHECK(game_hash(batch.state(i))==game_hash(serial[i]));}
  }
  const auto before=game_hash(batch.state(0));fox.pop_back();bool rejected=false;
  try{batch.step(fox,fly);}catch(const std::invalid_argument&){rejected=true;}
  CHECK(rejected&&game_hash(batch.state(0))==before);
 }
 bool rejected=false;try{GameBatch invalid(0);}catch(const std::invalid_argument&){rejected=true;}CHECK(rejected);
 rejected=false;try{GameBatch invalid(65537);}catch(const std::invalid_argument&){rejected=true;}CHECK(rejected);
 std::cout<<"batch: 1/16/64/256/1024 lanes match serial per-frame states, isolated reset, atomic shape rejection passed\n";
}
