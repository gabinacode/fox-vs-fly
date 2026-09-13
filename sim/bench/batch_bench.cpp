#include "batch.h"
#include <algorithm>
#include <array>
#include <chrono>
#include <iostream>
#include <stdexcept>
using namespace flygame;
struct Result {double seconds;uint32_t checksum;uint64_t resets;};
Result run(std::size_t n){
 GameBatch batch(n);std::vector<ControllerInput> fox(n),fly(n);
 const std::size_t rounds=1048576/n;uint32_t checksum=2166136261u;uint64_t resets=0;
 const auto start=std::chrono::steady_clock::now();
 for(std::size_t tick=0;tick<rounds;tick++){
  for(std::size_t i=0;i<n;i++){
   const auto& s=batch.state(i);if(s.winner!=-1||s.tick>=600){batch.reset(i,uint32_t(tick*n+i));resets++;}
   const auto phase=tick+i*7;
   fox[i]={phase%120<60?1000:-1000,unsigned(phase%37==0?Jump:0)};
   fly[i]={phase%90<45?-1000:1000,unsigned(phase%27==0?Strike:0)};
  }
  batch.step(fox,fly);
  for(std::size_t i=0;i<n;i++)checksum=(checksum^game_hash(batch.state(i)))*16777619u;
 }
 return {std::chrono::duration<double>(std::chrono::steady_clock::now()-start).count(),checksum,resets};
}
int main(){
 std::cout<<"{\n  \"scope\": \"single-thread scalar games with scripted controls; neural model excluded\",\n  \"timing\": \"includes inputs, episode resets, stepping and per-frame hashing; construction excluded\",\n  \"rows\": [\n";
 bool first=true;
 for(const std::size_t n:{1,16,64,256,1024}){
  const auto warm=run(n);std::array<double,3> samples;
  for(auto& sample:samples){const auto r=run(n);if(r.checksum!=warm.checksum||r.resets!=warm.resets)throw std::runtime_error("Non-deterministic batch replay");sample=r.seconds;}
  std::sort(samples.begin(),samples.end());const double fps=1048576/samples[1];
  if(!first)std::cout<<",\n";first=false;
  std::cout<<"    {\"environments\":"<<n<<",\"frames\":1048576,\"repeats\":3,\"median_seconds\":"<<samples[1]<<",\"min_seconds\":"<<samples[0]<<",\"max_seconds\":"<<samples[2]<<",\"aggregate_frames_per_second\":"<<fps<<",\"frames_per_second_per_environment\":"<<fps/n<<",\"realtime_multiple_per_environment\":"<<fps/n/60<<",\"state_bytes\":"<<n*sizeof(GameState)<<",\"input_bytes\":"<<n*2*sizeof(ControllerInput)<<",\"episode_resets\":"<<warm.resets<<",\"checksum\":"<<warm.checksum<<"}";
 }
 std::cout<<"\n  ]\n}\n";
}
