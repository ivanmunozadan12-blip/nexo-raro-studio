#!/usr/bin/env python3
"""BEHIND DEL MUNDO — deterministic code-authored explainer renderer."""
import argparse, json, math, os, random, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

W, H, FPS = 576, 1024, 30
S = 2
random.seed(23)
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(size, bold=True):
    path = FONT_B if bold else FONT_R
    try: return ImageFont.truetype(path, int(size*S))
    except OSError: return ImageFont.load_default()

def clamp(x, a=0, b=1): return max(a, min(b, x))
def smooth(a,b,x):
    t=clamp((x-a)/(b-a)); return t*t*(3-2*t)
def ease(x):
    x=clamp(x); return 1-(1-x)**3
def rgba(hex_color, alpha=255):
    h=hex_color.lstrip("#")
    return tuple(int(h[i:i+2],16) for i in (0,2,4))+(int(alpha),)
def text_fit(d, xy, txt, size, fill, max_width=480, bold=True, anchor=None):
    f=font(size,bold)
    while f.size>12 and d.textbbox((0,0),str(txt),font=f)[2]>max_width*S:
        f=font(max(12,f.size/S-1),bold)
    d.text((int(xy[0]*S),int(xy[1]*S)),str(txt),font=f,fill=fill,anchor=anchor,stroke_width=0)

def gradient():
    y=(np.linspace(0,1,H*S)**.86)[:,None,None]
    top=np.array([13,48,82],dtype=np.float32)[None,None,:]
    bot=np.array([4,12,31],dtype=np.float32)[None,None,:]
    rows=top*(1-y)+bot*y
    pixels=np.repeat(rows,W*S,axis=1).astype(np.uint8)
    return Image.fromarray(pixels,"RGB").convert("RGBA")
BG=gradient()
PARTICLES=[(random.randrange(W),random.randrange(H),random.randrange(2,6),random.random()*6.28) for _ in range(32)]

def base_frame(t, accent):
    im=BG.copy(); d=ImageDraw.Draw(im,"RGBA")
    for i in range(7):
        x=((i*155+t*13)%900)-180
        d.polygon([(int(x*S),0),(int((x+30)*S),0),(int((x-210)*S),H*S),(int((x-240)*S),H*S)],fill=(150,205,255,10))
    for x,y,r,p in PARTICLES:
        yy=(y-t*(9+r*2))%(H+20)-10
        xx=x+7*math.sin(t*.8+p)
        d.ellipse(((xx-r)*S,(yy-r)*S,(xx+r)*S,(yy+r)*S),outline=(190,225,255,50),width=S)
    d.rounded_rectangle((28*S,28*S,548*S,66*S),radius=12*S,fill=(7,22,42,165),outline=(255,255,255,35),width=S)
    text_fit(d,(44,39),"BEHIND DEL MUNDO",15,(245,249,255,245),bold=True)
    d.ellipse((511*S,43*S,521*S,53*S),fill=rgba(accent))
    return im

def panel(d, box, fill=(8,25,48,215), outline=(140,205,240,100), radius=18):
    d.rounded_rectangle(tuple(int(v*S) for v in box),radius=radius*S,fill=fill,outline=outline,width=2*S)

def draw_title(d, title, sub, t, accent):
    y=100-12*(1-ease(t/.6))
    text_fit(d,(W/2,y),title,34,(255,255,255,255),max_width=500,anchor="mm")
    if sub: text_fit(d,(W/2,y+48),sub,16,rgba(accent),max_width=490,anchor="mm",bold=False)

def draw_microwave(d, cx, cy, scale, t, accent):
    w,h=310*scale,205*scale; x=cx-w/2; y=cy-h/2
    d.rounded_rectangle((x*S,y*S,(x+w)*S,(y+h)*S),radius=22*S,fill=(218,227,239),outline=(255,255,255),width=4*S)
    d.rounded_rectangle(((x+15*scale)*S,(y+15*scale)*S,(x+220*scale)*S,(y+190*scale)*S),radius=14*S,fill=(8,16,33),outline=(95,120,145),width=3*S)
    d.rounded_rectangle(((x+235*scale)*S,(y+20*scale)*S,(x+295*scale)*S,(y+185*scale)*S),radius=10*S,fill=(177,190,208))
    d.rounded_rectangle(((x+245*scale)*S,(y+30*scale)*S,(x+285*scale)*S,(y+58*scale)*S),radius=5*S,fill=(4,16,25))
    text_fit(d,(x+265*scale,y+43*scale),"0:30",12,(100,255,174),max_width=48,bold=True,anchor="mm")
    d.ellipse(((cx-48*scale)*S,(cy+35*scale)*S,(cx+48*scale)*S,(cy+53*scale)*S),fill=(210,220,234))
    d.pieslice(((cx-39*scale)*S,(cy-32*scale)*S,(cx+39*scale)*S,(cy+48*scale)*S),0,180,fill=(238,240,246))
    d.ellipse(((cx-35*scale)*S,(cy-8*scale)*S,(cx+35*scale)*S,(cy+7*scale)*S),fill=(230,139,63))
    if t>0.2:
        for k in range(3):
            xx=cx+(-24+k*24)*scale
            pts=[]
            for j in range(22):
                yy=cy-16*scale-j*2.1*scale
                pts.append((xx+5*scale*math.sin(j*.55+t*3+k),yy))
            d.line([(int(a*S),int(b*S)) for a,b in pts],fill=(255,255,255,150),width=2*S)
    if t>.4:
        for row in range(3):
            pts=[]
            for xx in range(0,110,3):
                pts.append((x+25*scale+xx*scale,cy+(-35+row*25)*scale+7*scale*math.sin(xx/13-t*7)))
            d.line([(int(a*S),int(b*S)) for a,b in pts],fill=rgba(accent,230),width=3*S)

def draw_machine(d,cx,cy,t,accent,labels):
    # Mechanical explainer: linked gears, shafts and an animated drive belt.
    d.rounded_rectangle((105*S,390*S,471*S,700*S),radius=24*S,fill=(25,62,91),outline=rgba(accent),width=4*S)
    for i,(x,y,r) in enumerate(((205,500,74),(350,590,54),(365,445,35))):
        phase=t*2.4*(-1 if i%2 else 1)
        d.ellipse(((x-r)*S,(y-r)*S,(x+r)*S,(y+r)*S),fill=(10,29,48),outline=(205,224,237),width=4*S)
        for k in range(12):
            a=phase+k*math.pi/6
            x1=x+math.cos(a)*(r-7); y1=y+math.sin(a)*(r-7)
            x2=x+math.cos(a)*(r+8); y2=y+math.sin(a)*(r+8)
            d.line((x1*S,y1*S,x2*S,y2*S),fill=rgba(accent),width=5*S)
        d.ellipse(((x-12)*S,(y-12)*S,(x+12)*S,(y+12)*S),fill=rgba(accent))
    labels=labels or ["Motor","Engranaje","Eje"]
    for i,label in enumerate(labels[:3]):
        x=125+i*150
        text_fit(d,(x,745),label,13,(238,246,255),max_width=130,anchor="mm",bold=False)

def draw_cutaway(d,cx,cy,t,accent,labels):
    # Layered cutaway with visible internal components and animated flow.
    panel(d,(55,330,521,790),fill=(8,27,48,230),outline=rgba(accent,150),radius=26)
    d.rounded_rectangle((112*S,420*S,464*S,685*S),radius=26*S,fill=(29,82,113),outline=(210,231,244),width=4*S)
    d.rectangle((130*S,445*S,446*S,660*S),fill=(7,20,39),outline=rgba(accent),width=3*S)
    for i in range(4):
        x=160+i*76
        d.rounded_rectangle((x*S,480*S,(x+42)*S,625*S),radius=9*S,fill=(30+i*12,74+i*15,104+i*12),outline=(180,220,238),width=2*S)
        yy=520+int(24*math.sin(t*4+i))
        d.ellipse(((x+10)*S,(yy-10)*S,(x+32)*S,(yy+10)*S),fill=rgba(accent,220))
    for i,label in enumerate((labels or ["Entrada","Mecanismo","Salida"])[:3]):
        text_fit(d,(135+i*150,730),label,12,(240,248,255),max_width=135,anchor="mm",bold=False)

def draw_illustration(d,cx,cy,t,accent,labels):
    # Conceptual vector illustration with a moving central object and orbiting details.
    phase=t*math.pi*2
    d.ellipse(((cx-145)*S,(cy-145)*S,(cx+145)*S,(cy+145)*S),outline=rgba(accent,150),width=3*S)
    d.ellipse(((cx-82)*S,(cy-82)*S,(cx+82)*S,(cy+82)*S),fill=(13,48,78),outline=rgba(accent),width=4*S)
    text_fit(d,(cx,cy),"¿CÓMO?",26,(255,255,255),max_width=145,anchor="mm")
    for i,label in enumerate((labels or ["Causa","Proceso","Efecto"])[:3]):
        a=phase+i*math.pi*2/3
        x=cx+math.cos(a)*145; y=cy+math.sin(a)*145
        d.ellipse(((x-35)*S,(y-35)*S,(x+35)*S,(y+35)*S),fill=(19,58,87),outline=rgba(accent),width=3*S)
        text_fit(d,(x,y),label[:12],10,(245,250,255),max_width=62,anchor="mm",bold=False)

def draw_molecule(d,cx,cy,scale,phase,accent):
    for i in range(9):
        x=cx+math.cos(i*2.4+phase*.4)*105*scale
        y=cy+math.sin(i*1.8+phase*.6)*125*scale
        a=phase*2+i*.7
        hx=x+math.cos(a)*23*scale; hy=y+math.sin(a)*23*scale
        hx2=x+math.cos(a+2.1)*23*scale; hy2=y+math.sin(a+2.1)*23*scale
        d.line((x*S,y*S,hx*S,hy*S),fill=(255,255,255,180),width=3*S)
        d.line((x*S,y*S,hx2*S,hy2*S),fill=(255,255,255,180),width=3*S)
        d.ellipse(((x-12*scale)*S,(y-12*scale)*S,(x+12*scale)*S,(y+12*scale)*S),fill=(255,86,100))
        for xx,yy in ((hx,hy),(hx2,hy2)):
            d.ellipse(((xx-7*scale)*S,(yy-7*scale)*S,(xx+7*scale)*S,(yy+7*scale)*S),fill=(244,249,255))

def draw_building(d,cx,cy,t,accent):
    # Isometric cutaway building with visible floors and rooms.
    x0,y0=cx-165,cy-170
    d.polygon([(x0*S,y0*S),((x0+210)*S,(y0-55)*S),((x0+330)*S,(y0+8)*S),((x0+120)*S,(y0+70)*S)],fill=(67,119,158),outline=(180,225,250))
    d.polygon([(x0*S,y0*S),((x0+120)*S,(y0+70)*S),((x0+120)*S,(y0+330)*S),(x0*S,(y0+260)*S)],fill=(31,75,112),outline=(180,225,250))
    d.polygon([((x0+120)*S,(y0+70)*S),((x0+330)*S,(y0+8)*S),((x0+330)*S,(y0+270)*S),((x0+120)*S,(y0+330)*S)],fill=(19,49,82),outline=(180,225,250))
    for floor in range(1,4):
        yy=y0+floor*65
        d.line(((x0+120)*S,yy*S,(x0+330)*S,(yy-62)*S),fill=(174,211,230,210),width=3*S)
        d.line((x0*S,(yy-65)*S,(x0+120)*S,yy*S),fill=(174,211,230,180),width=3*S)
        for room in range(3):
            xx=x0+150+room*57
            d.rectangle((xx*S,(yy-48)*S,(xx+34)*S,(yy-13)*S),fill=(255,198,93,100+int(80*math.sin(t*3+room+floor))))
    # elevator shaft
    d.rounded_rectangle(((x0+240)*S,(y0+40)*S,(x0+285)*S,(y0+292)*S),radius=5*S,fill=(5,18,34),outline=rgba(accent))
    lift_y=y0+60+int((t*65)%180)
    d.rectangle(((x0+246)*S,lift_y*S,(x0+279)*S,(lift_y+28)*S),fill=rgba(accent,230))

def draw_process(d,cx,cy,t,accent,labels):
    n=max(3,min(5,len(labels)))
    radius=118
    pts=[]
    for i in range(n):
        a=-math.pi/2+i*2*math.pi/n
        x=cx+radius*math.cos(a); y=cy+radius*math.sin(a)
        pts.append((x,y))
    for i in range(n):
        a=pts[i]; b=pts[(i+1)%n]
        d.line((a[0]*S,a[1]*S,b[0]*S,b[1]*S),fill=rgba(accent,170),width=4*S)
    for i,(x,y) in enumerate(pts):
        active=(int(t*1.4)%n)==i
        r=43 if active else 34
        d.ellipse(((x-r)*S,(y-r)*S,(x+r)*S,(y+r)*S),fill=(14,48,77,245),outline=rgba(accent,255 if active else 130),width=4*S)
        text_fit(d,(x,y),str(i+1),23,(255,255,255),max_width=55,anchor="mm")
        text_fit(d,(x,y+52),labels[i][:18],12,(220,238,248),max_width=100,anchor="mm",bold=False)

def draw_timeline(d,cx,cy,t,accent,labels):
    y=cy
    d.line((65*S,y*S,511*S,y*S),fill=rgba(accent,200),width=4*S)
    for i,label in enumerate(labels[:5]):
        x=80+i*104
        d.ellipse(((x-10)*S,(y-10)*S,(x+10)*S,(y+10)*S),fill=rgba(accent))
        text_fit(d,(x,y+35),label[:20],11,(240,246,255),max_width=95,anchor="mm",bold=False)
        if i==int(t*1.2)%max(1,min(5,len(labels))):
            d.ellipse(((x-18)*S,(y-18)*S,(x+18)*S,(y+18)*S),outline=rgba(accent,220),width=3*S)

def draw_fact(d,cx,cy,t,accent,metric):
    panel(d,(55,cy-135,521,cy+135),fill=(7,27,50,225),outline=rgba(accent,170),radius=28)
    text_fit(d,(cx,cy-54),metric.get("value",""),54,rgba(accent),max_width=430,anchor="mm")
    text_fit(d,(cx,cy+18),metric.get("label",""),21,(255,255,255),max_width=430,anchor="mm")
    text_fit(d,(cx,cy+65),metric.get("detail",""),13,(190,215,230),max_width=420,anchor="mm",bold=False)

def draw_scene(im, scene, local_t, accent):
    d=ImageDraw.Draw(im,"RGBA")
    title=str(scene.get("headline",""))[:52]
    subtitle=str(scene.get("subtitle",""))[:90]
    draw_title(d,title,subtitle,local_t,accent)
    kind=scene.get("visual_type","illustration")
    cx,cy=288,560
    if kind in ("microwave","machine","object_cutaway","illustration"):
        draw_microwave(d,cx,cy,.95,.3+local_t,accent)
    elif kind in ("interior","building_cutaway","facility"):
        draw_building(d,cx,cy,local_t,accent)
    elif kind in ("molecule","science","microscopic"):
        panel(d,(48,300,528,795),fill=(7,27,50,160),outline=rgba(accent,120),radius=30)
        draw_molecule(d,cx,535,.92,local_t*4,accent)
        text_fit(d,(cx,780),"MODELO EXPLICATIVO",12,(200,225,240),anchor="mm",bold=False)
    elif kind in ("process","diagram"):
        draw_process(d,cx,565,local_t,accent,scene.get("labels") or ["Entrada","Proceso","Salida"])
    elif kind in ("timeline","history"):
        draw_timeline(d,cx,560,local_t,accent,scene.get("labels",["Origen","Cambio","Hoy"]))
    elif kind in ("fact","number","stat"):
        draw_fact(d,cx,565,local_t,accent,scene.get("metric",{}))
    elif kind in ("map","location"):
        panel(d,(50,310,526,800),fill=(11,48,62,220),outline=rgba(accent,160))
        for i in range(12):
            x=70+i*38
            d.line((x*S,330*S,(x+random.randrange(-12,15))*S,780*S),fill=(105,172,169,45),width=2*S)
        for i in range(10):
            y=350+i*43
            d.line((55*S,y*S,520*S,(y+random.randrange(-12,15))*S),fill=(105,172,169,45),width=2*S)
        for i,label in enumerate(scene.get("labels",["Punto A","Punto B","Punto C"])[:3]):
            x=135+i*145; y=450+(i%2)*140
            d.ellipse(((x-11)*S,(y-11)*S,(x+11)*S,(y+11)*S),fill=rgba(accent))
            text_fit(d,(x,y+28),label,12,(245,250,255),max_width=110,anchor="mm")
    else:
        # Abstract comparison / concept visualization, never a static photo.
        phase=local_t*math.pi*2
        for i in range(5):
            x=cx+math.cos(phase+i*1.25)*(80+i*17)
            y=cy+math.sin(phase+i*1.25)*(80+i*17)
            r=18+i*7
            d.ellipse(((x-r)*S,(y-r)*S,(x+r)*S,(y+r)*S),fill=rgba(accent,50+i*20),outline=rgba(accent,220),width=2*S)
    # Lower explanatory chip
    fact=str(scene.get("callout","")).strip()[:92]
    if fact:
        panel(d,(48,845,528,935),fill=(5,18,36,220),outline=rgba(accent,105),radius=16)
        text_fit(d,(288,890),fact,15,(245,249,255),max_width=440,anchor="mm",bold=True)

def render_frame(i, script, starts, durations):
    t=i/FPS
    index=max(0,min(len(starts)-1,next((j for j in range(len(starts)-1,-1,-1) if t>=starts[j]),0)))
    scene=script["scenes"][index]
    local=clamp((t-starts[index])/max(.1,durations[index]))
    accent=scene.get("accent","#62d9cf")
    im=base_frame(t,accent)
    draw_scene(im,scene,local,accent)
    # Narration captions are supplied as timestamped words from Edge TTS.
    for cue in script.get("captions",[]):
        if cue["start"]<=t<cue["end"]:
            d=ImageDraw.Draw(im,"RGBA")
            txt=cue["text"]
            panel(d,(45,950,531,1007),fill=(3,12,25,225),outline=(255,255,255,45),radius=12)
            text_fit(d,(288,979),txt,17,(255,255,255),max_width=450,anchor="mm")
            break
    return im.resize((W,H),Image.Resampling.LANCZOS).convert("RGB")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--script",required=True); ap.add_argument("--voice",required=True); ap.add_argument("--output",required=True); ap.add_argument("--fps",type=int,default=30)
    args=ap.parse_args()
    with open(args.script,encoding="utf-8") as f: script=json.load(f)
    if not isinstance(script.get("scenes"),list) or len(script["scenes"])<6: raise SystemExit("El guion necesita al menos 6 escenas.")
    voice_duration=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",args.voice],text=True).strip())
    duration=max(60,math.ceil(voice_duration+1))
    if duration>72: raise SystemExit(f"La voz dura {voice_duration:.1f}s; supera el máximo de 72s.")
    weights=[max(1,len(str(s.get("narration_excerpt","")).split())) for s in script["scenes"]]
    total=sum(weights); starts=[]; durations=[]; cursor=0
    for i,w in enumerate(weights):
        seg=(duration-cursor) if i==len(weights)-1 else duration*w/total
        starts.append(cursor); durations.append(seg); cursor+=seg
    os.makedirs(os.path.dirname(args.output) or ".",exist_ok=True)
    cmd=["ffmpeg","-y","-v","error","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(args.fps),"-i","-","-an","-c:v","libx264","-preset","veryfast","-crf","18","-pix_fmt","yuv420p","-vf","scale=1080:1920:flags=lanczos","-movflags","+faststart",args.output]
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for i in range(duration*args.fps):
            p.stdin.write(render_frame(i,script,starts,durations).tobytes())
            if i%(args.fps*10)==0: print(f"frames {i}/{duration*args.fps}",flush=True)
    finally:
        p.stdin.close()
    code=p.wait()
    if code: raise SystemExit(f"FFmpeg terminó con código {code}")
    print(f"render listo: {args.output} · {duration}s · 1080x1920",flush=True)
if __name__=="__main__": main()
