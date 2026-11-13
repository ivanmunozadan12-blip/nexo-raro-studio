#!/usr/bin/env python3
import argparse, math, wave
import numpy as np

p=argparse.ArgumentParser()
p.add_argument('--duration',type=float,required=True)
p.add_argument('--output',required=True)
a=p.parse_args()
sr=44100
n=int(sr*a.duration)
t=np.arange(n,dtype=np.float64)/sr
# Soft, original ambient bed: evolving synth-like chord, low pulse and sparse high shimmer.
notes=[110.00, 164.81, 220.00, 261.63, 329.63]
pad=np.zeros(n)
for i,f in enumerate(notes):
    drift=0.12*np.sin(2*np.pi*(0.025+i*.006)*t+i)
    pad += (0.012/(1+i*.18))*np.sin(2*np.pi*f*t+drift+i*.7)
slow=.72+.28*np.sin(2*np.pi*.075*t)
pulse=.006*np.sin(2*np.pi*55*t)*(0.5+.5*np.sin(2*np.pi*.18*t))
shimmer=.0025*np.sin(2*np.pi*660*t)*np.maximum(0,np.sin(2*np.pi*.12*t))
noise=np.random.default_rng(17).normal(0,.0007,n)
fade=np.minimum(1,t/2)*np.minimum(1,np.maximum(0,(a.duration-t)/3))
effects=np.zeros(n)
# Eight soft transitions: a short airy whoosh and a restrained impact/chime.
for k in range(1,8):
    start=int((a.duration*k/8)*sr)
    length=min(int(.42*sr),n-start)
    if length<=0: continue
    x=np.arange(length)/sr
    env=np.sin(np.pi*np.minimum(1,x/.42))**2*np.exp(-x*4)
    whoosh=np.random.default_rng(91+k).normal(0,1,length)*env*.009
    chime=(np.sin(2*np.pi*(520+180*x)*x)+.45*np.sin(2*np.pi*(780+90*x)*x))*env*.006
    effects[start:start+length]+=whoosh+chime
audio=(pad*slow+pulse+shimmer+noise+effects)*fade
peak=np.max(np.abs(audio))
if peak: audio=audio/peak*.17
with wave.open(a.output,'wb') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr)
    f.writeframes((audio*32767).astype(np.int16).tobytes())
print(f'cama musical original generada: {a.duration:.1f}s')
