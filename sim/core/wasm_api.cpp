#include "game.h"
static flygame::GameState state=flygame::game_reset(1);
extern "C" {
void sim_reset(unsigned seed){state=flygame::game_reset(seed);}
void sim_step(int x,unsigned b,int y,unsigned c){flygame::game_step(state,{x,b},{y,c});}
int sim_field(int player,int field){return player>=0&&player<2?flygame::fighter_field(state.fighters[player],field):0;}
unsigned sim_tick(){return state.tick;}
int sim_winner(){return state.winner;}
unsigned sim_hash(){return flygame::game_hash(state);}
}
