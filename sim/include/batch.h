#pragma once
#include "game.h"
#include <vector>
#include <cstddef>
namespace flygame {
// Independent scalar game states. No neural model, threads or shared mutable state.
class GameBatch {
 std::vector<GameState> states_;
public:
 explicit GameBatch(std::size_t count,uint32_t first_seed=1);
 std::size_t size() const {return states_.size();}
 const GameState& state(std::size_t index) const {return states_.at(index);}
 void reset(std::size_t index,uint32_t seed);
 void step(const std::vector<ControllerInput>& fox,const std::vector<ControllerInput>& fly);
};
}
