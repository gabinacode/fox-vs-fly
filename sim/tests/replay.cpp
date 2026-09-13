#include "game.h"
#include <fstream>
#include <iostream>
int main(int argc,char** argv){
 if(argc!=2)return 2;std::ifstream in(argv[1]);unsigned seed;int count;
 if(!(in>>seed>>count)||count<1)return 2;
 auto a=flygame::game_reset(seed),b=a;
 for(int i=0;i<count;++i){flygame::ControllerInput x,y;if(!(in>>x.axis>>x.buttons>>y.axis>>y.buttons))return 2;flygame::game_step(a,x,y);flygame::game_step(b,x,y);if(flygame::game_hash(a)!=flygame::game_hash(b))return 1;std::cout<<flygame::game_hash(a)<<'\n';}
}
