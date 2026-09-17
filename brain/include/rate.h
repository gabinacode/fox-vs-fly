#pragma once
#include <vector>
#include <cstdint>
namespace flybrain {
// Authored stable rate dynamics over measured positive counts. No NT inference.
struct RateNetwork {
 std::vector<uint32_t> offsets,targets,weights,input,values,next;
 std::vector<double> totals,sums;
 std::vector<uint8_t> packed;
 RateNetwork(uint32_t nodes,uint32_t edges);
 bool initialize();void reset();void step();
 /** Bit-identical to JS min(255, round(rate/128)); returns nonzero packed count. */
 uint32_t pack_activity();
};
}
