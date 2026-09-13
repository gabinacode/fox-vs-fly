#include "batch.h"
#include <stdexcept>
namespace flygame {
GameBatch::GameBatch(std::size_t count,uint32_t first_seed){
 if(count==0||count>65536)throw std::invalid_argument("Batch count must be 1..65536");
 states_.reserve(count);for(std::size_t i=0;i<count;i++)states_.push_back(game_reset(first_seed+uint32_t(i)));
}
void GameBatch::reset(std::size_t index,uint32_t seed){states_.at(index)=game_reset(seed);}
void GameBatch::step(const std::vector<ControllerInput>& fox,const std::vector<ControllerInput>& fly){
 if(fox.size()!=size()||fly.size()!=size())throw std::invalid_argument("Batch input size mismatch");
 for(std::size_t i=0;i<size();i++)game_step(states_[i],fox[i],fly[i]);
}
}
