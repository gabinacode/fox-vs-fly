#include "game.h"
#include <algorithm>
#include <cstdlib>
namespace flygame {
static int approach(int v,int target,int amount) { return v<target?std::min(v+amount,target):std::max(v-amount,target); }
static void action(Fighter& f,int a) { if(f.action!=a){f.action=a;f.action_frame=0;} }
static void spawn(Fighter& f,int player,int stocks,bool initial) {
 f=Fighter{};f.x=player?26000:-26000;f.facing=player?-1:1;f.stocks=stocks;
 if(!initial){f.y=24000;f.grounded=0;f.jumps=1;f.invulnerable=75;f.action=Respawn;}
 if(!stocks) f.action=Eliminated;
}
GameState game_reset(uint32_t seed) { GameState s;s.seed=seed;spawn(s.fighters[0],0,3,true);spawn(s.fighters[1],1,3,true);return s; }
static void move(Fighter& f,ControllerInput input) {
 const auto pressed=input.buttons&~f.previous_buttons;f.previous_buttons=input.buttons;
 if(!f.stocks)return;
 if(f.invulnerable>0)--f.invulnerable;
 if(f.hitlag>0){--f.hitlag;return;}
 ++f.action_frame;
 if(f.action==Respawn)action(f,Air);
 if(f.action==Attack && f.action_frame>=RECOVERY_END)action(f,f.grounded?Idle:Air);
 if(f.hitstun>0){--f.hitstun;action(f,Hurt);}else if(f.action==Hurt)action(f,f.grounded?Idle:Air);
 const int axis=std::clamp(input.axis,-1000,1000);
 bool launched=false;
 if(f.action!=Hurt && f.action!=Attack){
  if(axis)f.facing=axis<0?-1:1;
  if((pressed&Jump)&&f.jumps>0){
   if(f.grounded){if(f.action!=JumpSquat){f.short_hop=0;action(f,JumpSquat);}}
   else{f.vy=3500;--f.jumps;f.fastfall=0;action(f,Air);}
  }
  // Reference: KneeBend_Check_ShortHop latches release; animation transitions
  // before the launch-frame input callback, so release on launch is too late.
  if(f.action==JumpSquat){
   if(f.action_frame>=JUMPSQUAT){f.grounded=0;f.vy=f.short_hop?SHORT_HOP:FULL_JUMP;f.jumps=1;f.fastfall=0;launched=true;action(f,Air);}
   else if(!(input.buttons&Jump))f.short_hop=1;
  }
  if((pressed&Strike)&&f.action!=JumpSquat){action(f,Attack);f.hit_mask=0;}
 }
 if(f.action!=Hurt&&!launched){
  if(axis && f.action!=JumpSquat && f.action!=Attack){
   const int cap=f.grounded?1750:1400;
   f.vx=approach(f.vx,axis*cap/1000,f.grounded?180:75);
   if(f.grounded){if(std::abs(axis)<600)action(f,Walk);else if(f.action!=Dash&&f.action!=Run)action(f,Dash);else if(f.action==Dash&&f.action_frame>=10)action(f,Run);}
  } else if(f.grounded) {f.vx=approach(f.vx,0,120);if(f.action!=Attack&&f.action!=JumpSquat)action(f,Idle);}
 }
 const int oldx=f.x,oldy=f.y;
 f.x+=f.vx;
 if(f.grounded&&std::abs(f.x)>STAGE){f.grounded=0;f.jumps=std::min(f.jumps,1);if(f.action!=Attack&&f.action!=Hurt)action(f,Air);}
 if(!f.grounded){
  if((input.buttons&Fastfall)&&f.vy<0&&f.action!=Hurt)f.fastfall=1;
  if(!launched)f.vy=f.fastfall?-FASTFALL:std::max(f.vy-GRAVITY,-TERMINAL);
  f.y+=f.vy;
  // Swept feet-plane intersection; use crossing x rather than only the endpoint.
  if(oldy>=0&&f.y<=0&&f.vy<0){
   const int64_t denominator=int64_t(oldy)-f.y;
   const int crossing=denominator?oldx+int(int64_t(f.x-oldx)*oldy/denominator):f.x;
   if(std::abs(crossing)<=STAGE&&std::abs(f.x)<=STAGE){f.y=0;f.vy=0;f.grounded=1;f.jumps=2;f.fastfall=0;if(f.action==Air)action(f,Idle);}
  }
 }
}
static bool strikes(const Fighter& a,const Fighter& b) {
 const int dx=(b.x-a.x)*a.facing;
 return a.stocks&&b.stocks&&!a.hitlag&&!b.invulnerable&&a.action==Attack&&a.action_frame>=STARTUP&&a.action_frame<ACTIVE_END&&!a.hit_mask&&dx>=-2500&&dx<=15500&&std::abs(b.y-a.y)<10500;
}
void game_step(GameState& s,ControllerInput fox,ControllerInput fly) {
 if(s.winner!=-1)return;
 ++s.tick;move(s.fighters[0],fox);move(s.fighters[1],fly);
 const bool hit[2]={strikes(s.fighters[0],s.fighters[1]),strikes(s.fighters[1],s.fighters[0])};
 const int facing[2]={s.fighters[0].facing,s.fighters[1].facing};
 for(int i=0;i<2;++i)if(hit[i]){
  auto& a=s.fighters[i];auto& b=s.fighters[1-i];a.hit_mask=1;a.hitlag=5;b.hitlag=5;
  b.damage=std::min(b.damage+8,999);b.vx=facing[i]*(1600+b.damage*32);b.vy=2100+b.damage*16;
  b.grounded=0;b.jumps=std::min(b.jumps,1);b.fastfall=0;b.hitstun=12+b.damage/3;action(b,Hurt);
 }
 for(int i=0;i<2;++i){auto& f=s.fighters[i];if(f.stocks&&(std::abs(f.x)>115000||f.y< -65000||f.y>95000))spawn(f,i,f.stocks-1,false);}
 if(!s.fighters[0].stocks||!s.fighters[1].stocks)s.winner=!s.fighters[0].stocks?(!s.fighters[1].stocks?2:1):0;
}
int32_t fighter_field(const Fighter& f,int n){
 switch(n){case 0:return f.x;case 1:return f.y;case 2:return f.vx;case 3:return f.vy;case 4:return f.facing;case 5:return f.grounded;case 6:return f.action;case 7:return f.action_frame;case 8:return f.damage;case 9:return f.stocks;case 10:return f.hitlag;case 11:return f.hitstun;case 12:return f.jumps;case 13:return f.fastfall;case 14:return f.hit_mask;case 15:return f.invulnerable;case 16:return int32_t(f.previous_buttons);case 17:return f.short_hop;default:return 0;}
}
uint32_t game_hash(const GameState& s){
 uint32_t h=2166136261u;auto mix=[&](uint32_t v){for(int i=0;i<4;++i){h^=(v>>(8*i))&255;h*=16777619u;}};
 mix(s.tick);mix(s.seed);mix(uint32_t(s.winner));for(const auto& f:s.fighters)for(int i=0;i<18;++i)mix(uint32_t(fighter_field(f,i)));return h;
}
}
