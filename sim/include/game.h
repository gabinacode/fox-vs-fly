#pragma once
#include <cstdint>
namespace flygame {
constexpr int SCALE=1000, STAGE=68000, GRAVITY=180, TERMINAL=3100, FASTFALL=4500;
constexpr int FULL_JUMP=3800, SHORT_HOP=2200; // Authored heights; not extracted Fox attributes.
constexpr int STARTUP=5, ACTIVE_END=8, RECOVERY_END=23, JUMPSQUAT=3;
enum Action { Idle, Walk, Dash, Run, JumpSquat, Air, Attack, Hurt, Respawn, Eliminated };
enum Button { Jump=1, Fastfall=2, Strike=4 };
struct ControllerInput { int32_t axis=0; uint32_t buttons=0; };
struct Fighter {
 int32_t x=0,y=0,vx=0,vy=0,facing=1,grounded=1,action=Idle,action_frame=0;
 int32_t damage=0,stocks=3,hitlag=0,hitstun=0,jumps=2,fastfall=0,hit_mask=0,invulnerable=0;
 uint32_t previous_buttons=0;
 int32_t short_hop=0;
};
struct GameState { uint32_t tick=0,seed=0; int32_t winner=-1; Fighter fighters[2]; };
GameState game_reset(uint32_t seed);
void game_step(GameState&,ControllerInput fox,ControllerInput fly);
uint32_t game_hash(const GameState&);
int32_t fighter_field(const Fighter&,int field);
}
