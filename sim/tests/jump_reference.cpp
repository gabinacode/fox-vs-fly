#include "game.h"
#include <cstdlib>
#include <iostream>
using namespace flygame;
#define CHECK(x) do{if(!(x)){std::cerr<<__LINE__<<": "<<#x<<" failed\n";std::exit(1);}}while(0)
// Semantic reference fixtures, using authored attributes, not captured Melee states.
// Pinned KneeBend_Check_ShortHop: release latches; KneeBend_Anim transitions
// before launch-frame input. Jump_Phys_Inner skips first aerial physics call.
int main(){
 for(unsigned releases=0;releases<8;releases++){
  auto s=game_reset(1);game_step(s,{0,Jump},{});
  CHECK(s.fighters[0].grounded&&s.fighters[0].action_frame==0);
  for(int frame=1;frame<=3;frame++){
   game_step(s,{0,(releases&(1u<<(frame-1)))?0u:unsigned(Jump)},{});
   if(frame<3)CHECK(s.fighters[0].grounded&&s.fighters[0].y==0);
  }
  const bool expectedShort=(releases&3)!=0;
  auto& f=s.fighters[0];CHECK(f.short_hop==int(expectedShort));
  const int initial=expectedShort?SHORT_HOP:FULL_JUMP;
  CHECK(!f.grounded&&f.vy==initial&&f.y==initial&&f.jumps==1);
  game_step(s,{0,0},{});CHECK(f.vy==initial-GRAVITY);
 }
 // Releasing after takeoff cannot retroactively reduce the jump; short-hop
 // state is reset on the next ground jump and included in deterministic hashes.
 auto full=game_reset(2);for(int i=0;i<4;i++)game_step(full,{0,Jump},{});
 auto shortJump=game_reset(2);game_step(shortJump,{0,Jump},{});for(int i=0;i<3;i++)game_step(shortJump,{},{});
 int fullApex=0,shortApex=0;for(int i=0;i<70;i++){
  game_step(full,{},{});game_step(shortJump,{},{});
  fullApex=std::max(fullApex,full.fighters[0].y);shortApex=std::max(shortApex,shortJump.fighters[0].y);
 }
 CHECK(fullApex>shortApex&&shortApex>0);CHECK(shortJump.fighters[0].grounded);
 auto altered=shortJump;altered.fighters[0].short_hop^=1;CHECK(game_hash(altered)!=game_hash(shortJump));
 for(int i=0;i<4;i++)game_step(shortJump,{0,Jump},{});
 CHECK(!shortJump.fighters[0].short_hop&&shortJump.fighters[0].vy==FULL_JUMP);
 std::cout<<"jump reference predicates: all release windows, sticky latch, launch physics, reset/hash passed\n";
}
