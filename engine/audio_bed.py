#!/usr/bin/env python3
"""Original ambient music and scene-synchronized sound effects, synthesized with NumPy."""
import argparse, json, math, wave
import numpy as np

p=argparse.ArgumentParser()
p.add_argument('--duration',type=float,required=True)
p.add_argument('--output',required=True)
p.add_argument('--script',default=None)
a=p.parse_args()
sr=44100
n=int(sr*a.duration)
t=np.arange(n,dtype=np.float64)/sr
# Evolving, original ambient harmonic bed.
notes=[110.00,164.81,220.00,261.63,329.63]
pad=np.zeros(n)
for i,f in enumerate(notes):
    drift=.12*np.sin(2*np.pi*(.025+i*.006)*t+i)
    pad+=(.012/(1+i*.18))*np.sin(2*np.pi*f*t+drift+i*.7)
slow=.72+.28*np.sin(2*np.pi*.075*t)
pulse=.006*np.sin(2*np.pi*55*t)*(.5+.5*np.sin(2*np.pi*.18*t))
shimmer=.0025*np.sin(2*np.pi*660*t)*np.maximum(0,np.sin(2*np.pi*.12*t))
noise=np.random.default_rng(17).normal(0,.0007,n)
fade=np.minimum(1,t/2)*np.minimum(1,np.maximum(0,(a.duration-t)/3))
effects=np.zeros(n)
scene_types=[]
if a.script:
    with open(a.script,encoding="utf-8") as f:
        scene_types=[str(x.get("sound_effect","whoosh")).lower() for x in json.load(f).get("scenes",[])]
if not scene_types: scene_types=["whoosh"]*8
for k,kind in enumerate(scene_types):
    start=int((a.duration*k/max(1,len(scene_types))+.12)*sr)
    length=min(int(.62*sr),n-start)
    if length<=0: continue
    x=np.arange(length)/sr
    env=np.sin(np.pi*np.minimum(1,x/.62))**2*np.exp(-x*3.2)
    rng=np.random.default_rng(91+k)
    hiss=rng.normal(0,1,length)
    if kind in ("mechanical","engine","machine"):
        fx=(np.sin(2*np.pi*72*x)+.55*np.sin(2*np.pi*144*x))*env*.014
    elif kind in ("electric","science","energy"):
        fx=(np.sin(2*np.pi*(420+900*x)*x)+.4*np.sin(2*np.pi*1250*x))*env*.009
    elif kind in ("water","liquid"):
        fx=hiss*env*.012+np.sin(2*np.pi*310*x)*env*.004
    elif kind in ("impact","reveal"):
        fx=(np.sin(2*np.pi*85*x)*np.exp(-x*11)+hiss*np.exp(-x*15)*.12)*env*.05
    elif kind in ("click","switch"):
        fx=np.sin(2*np.pi*1250*x)*np.exp(-x*35)*.035
    elif kind in ("wind","air","flight"):
        fx=hiss*env*.014
    else:
        fx=hiss*env*.008+np.sin(2*np.pi*(520+180*x)*x)*env*.004
    effects[start:start+length]+=fx
audio=(pad*slow+pulse+shimmer+noise+effects)*fade
peak=np.max(np.abs(audio))
if peak: audio=audio/peak*.17
with wave.open(a.output,'wb') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr)
    f.writeframes((audio*32767).astype(np.int16).tobytes())
print(f'cama musical y efectos originales: {a.duration:.1f}s · {len(scene_types)} acentos sincronizados')
