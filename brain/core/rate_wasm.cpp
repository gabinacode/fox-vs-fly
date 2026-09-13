#include "rate.h"
#include <memory>
static std::unique_ptr<flybrain::RateNetwork> net;
extern "C" {
int rate_allocate(unsigned n,unsigned e){if(!n||n>1000000||e>32000000)return 0;net=std::make_unique<flybrain::RateNetwork>(n,e);return 1;}
unsigned* rate_offsets(){return net->offsets.data();}unsigned* rate_targets(){return net->targets.data();}unsigned* rate_weights(){return net->weights.data();}
unsigned* rate_input(){return net->input.data();}unsigned* rate_values(){return net->values.data();}
int rate_initialize(){return net->initialize();}void rate_reset(){net->reset();}void rate_step(){net->step();}
}
