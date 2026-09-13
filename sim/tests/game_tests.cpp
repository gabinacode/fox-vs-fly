#include "game.h"
#include <iostream>
#include <cstdlib>
using namespace flygame;
#define CHECK(x) do{if(!(x)){std::cerr<<__LINE__<<": "<<#x<<" failed\n";std::exit(1);}}while(0)
static void step(GameState& s,int n=1,ControllerInput a={},ControllerInput b={}){for(int i=0;i<n;++i)game_step(s,a,b);}
int main(){
 auto s=game_reset(5);CHECK(game_hash(s)==game_hash(game_reset(5)));CHECK(game_hash(s)!=game_hash(game_reset(6)));
 s.fighters[0].y=30000;s.fighters[0].grounded=0;step(s);CHECK(s.fighters[0].vy==-GRAVITY);step(s,20);CHECK(s.fighters[0].vy>=-TERMINAL);step(s,60);CHECK(s.fighters[0].y==0&&s.fighters[0].grounded);
 s=game_reset(1);step(s,1,{0,Jump});CHECK(s.fighters[0].action==JumpSquat&&s.fighters[0].y==0);step(s,2,{0,Jump});CHECK(s.fighters[0].y==0);step(s,1,{0,Jump});CHECK(s.fighters[0].y>0&&s.fighters[0].jumps==1);step(s,2,{0,Jump});CHECK(s.fighters[0].jumps==1);step(s);step(s,1,{0,Jump});CHECK(s.fighters[0].jumps==0);step(s);auto vy=s.fighters[0].vy;step(s,1,{0,Jump});CHECK(s.fighters[0].vy==vy-GRAVITY);
 s=game_reset(1);s.fighters[0].y=40000;s.fighters[0].grounded=0;s.fighters[0].vy=-50;step(s,1,{0,Fastfall});CHECK(s.fighters[0].vy==-FASTFALL);step(s);CHECK(s.fighters[0].vy==-FASTFALL);step(s,20);CHECK(s.fighters[0].grounded&&!s.fighters[0].fastfall);
 s=game_reset(1);step(s,10,{1000,0});CHECK(s.fighters[0].x>-26000);CHECK(s.fighters[0].vx==1750);step(s,20);CHECK(s.fighters[0].vx==0);
 s=game_reset(1);s.fighters[0].x=STAGE;s.fighters[0].vx=1750;step(s,1,{1000,0});CHECK(!s.fighters[0].grounded&&s.fighters[0].y<0);CHECK(s.fighters[0].jumps==1);
 s=game_reset(1);s.fighters[0].x=STAGE+1000;s.fighters[0].y=1000;s.fighters[0].grounded=0;s.fighters[0].vy=-3000;step(s);CHECK(!s.fighters[0].grounded);
 s=game_reset(1);s.fighters[0].x=-5000;s.fighters[1].x=5000;step(s,1,{0,Strike});step(s,STARTUP-1);CHECK(s.fighters[1].damage==0);step(s);CHECK(s.fighters[1].damage==8);CHECK(s.fighters[1].vx>0&&s.fighters[1].vy>0);CHECK(s.fighters[1].hitlag==5&&s.fighters[1].hitstun>0);int x=s.fighters[1].x;step(s,5);CHECK(s.fighters[1].x==x);step(s);CHECK(s.fighters[1].x>x);step(s,30);CHECK(s.fighters[1].damage==8&&s.fighters[0].action!=Attack);CHECK(s.fighters[1].hitstun==0);
 s=game_reset(1);step(s,1,{0,Strike});step(s,RECOVERY_END);CHECK(s.fighters[1].damage==0&&s.fighters[0].action==Idle);
 s=game_reset(1);s.fighters[0].x=-5000;s.fighters[1].x=5000;s.fighters[0].facing=-1;step(s,1,{0,Strike});step(s,8);CHECK(s.fighters[1].damage==0);
 s=game_reset(1);s.fighters[0].x=-5000;s.fighters[1].x=5000;step(s,1,{0,Strike},{0,Strike});step(s,STARTUP);CHECK(s.fighters[0].damage==8&&s.fighters[1].damage==8);
 s=game_reset(1);s.fighters[0].y=-66000;step(s);CHECK(s.fighters[0].stocks==2&&s.fighters[0].damage==0&&s.fighters[0].invulnerable==75);s.fighters[0].y=-66000;step(s);s.fighters[0].y=-66000;step(s);CHECK(s.winner==1&&s.fighters[0].stocks==0);auto h=game_hash(s);step(s,10);CHECK(game_hash(s)==h);
 // The first active frame is inclusive, the active end is exclusive.
 s=game_reset(1);s.fighters[0].x=-5000;s.fighters[1].x=5000;s.fighters[0].action=Attack;s.fighters[0].action_frame=ACTIVE_END-1;step(s);CHECK(s.fighters[1].damage==0);
 s=game_reset(1);s.fighters[0].x=-5000;s.fighters[1].x=5000;s.fighters[1].invulnerable=20;step(s,1,{0,Strike});step(s,8);CHECK(s.fighters[1].damage==0);
 s=game_reset(1);s.fighters[0].y=80000;s.fighters[0].grounded=0;step(s,20);CHECK(s.fighters[0].vy==-TERMINAL);
 s=game_reset(1);s.fighters[0].y=30000;s.fighters[0].grounded=0;s.fighters[0].vy=2000;step(s,1,{0,Fastfall});CHECK(!s.fighters[0].fastfall&&s.fighters[0].vy>0);
 s=game_reset(1);s.fighters[0].y=-66000;s.fighters[1].y=-66000;s.fighters[0].stocks=s.fighters[1].stocks=1;step(s);CHECK(s.winner==2);
 s=game_reset(99);auto t=s;for(int i=0;i<10000;++i){ControllerInput a{i%60<30?1000:-1000,unsigned(i%13==0?Strike:i%17==0?Jump:0)};game_step(s,a,{});game_step(t,a,{});CHECK(game_hash(s)==game_hash(t));}
 std::cout<<"native: reset/replay, gravity, landing, jump, double jump, fastfall, traction, collision, combat phases/range/facing/trades, lag/stun, stock/respawn/end passed\n";
}
