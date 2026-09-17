#include "rate.h"
#include <algorithm>
#include <cmath>
namespace flybrain {
RateNetwork::RateNetwork(uint32_t n,uint32_t e):offsets(n+1),targets(e),weights(e),input(n),values(n),next(n),totals(n),sums(n),packed(n){}
bool RateNetwork::initialize(){
 const auto n=values.size();if(!n||offsets[0]||offsets[n]!=targets.size())return false;
 std::fill(totals.begin(),totals.end(),0);
 for(uint32_t i=0;i<n;i++){
  if(offsets[i]>offsets[i+1]||offsets[i+1]>targets.size())return false;
  for(uint32_t e=offsets[i];e<offsets[i+1];e++){if(targets[e]>=n||!weights[e])return false;totals[targets[e]]+=weights[e];}
 }
 reset();return true;
}
void RateNetwork::reset(){std::fill(values.begin(),values.end(),0);std::fill(input.begin(),input.end(),0);std::fill(sums.begin(),sums.end(),0);std::fill(packed.begin(),packed.end(),0);}
void RateNetwork::step(){
 std::fill(sums.begin(),sums.end(),0);
 for(uint32_t i=0;i<values.size();i++)if(values[i]>=32){
  for(uint32_t e=offsets[i];e<offsets[i+1];e++)sums[targets[e]]+=double(values[i])*weights[e];
 }
 for(uint32_t i=0;i<values.size();i++){
  const double incoming=totals[i]?sums[i]/totals[i]:0;
  // Retained self-state .25 plus network gain .60 contracts in max norm without input.
  next[i]=uint32_t(std::min(65535.0,std::floor(.25*values[i]+.60*incoming+std::min(input[i],uint32_t(65535)))));
 }
 values.swap(next);
}
uint32_t RateNetwork::pack_activity(){
 uint32_t active=0;
 for(uint32_t i=0;i<values.size();i++){
  const uint32_t byte=uint32_t(std::min(255.0,std::round(double(values[i])/128.0)));
  packed[i]=uint8_t(byte);if(byte)active++;
 }
 return active;
}
}
