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
    while f.size>18 and d.textbbox((0,0),str(txt),font=f)[2]>max_width*S:
        f=font(max(9,f.size/S-1),bold)
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

def draw_cloud(d, x, y, scale=1.0, alpha=190):
    color=(248,252,255,int(alpha))
    parts=[(-34,8,34,25),(-12,-8,38,22),(18,2,43,24)]
    for x0,y0,rx,ry in parts:
        d.ellipse(((x+x0*scale-rx*scale)*S,(y+y0*scale-ry*scale)*S,(x+x0*scale+rx*scale)*S,(y+y0*scale+ry*scale)*S),fill=color)

def sky_background(t):
    y=(np.linspace(0,1,H*S)**.9)[:,None,None]
    top=np.array([43,126,202],dtype=np.float32)[None,None,:]
    bottom=np.array([203,226,239],dtype=np.float32)[None,None,:]
    rows=top*(1-y)+bottom*y
    pixels=np.repeat(rows,W*S,axis=1).astype(np.uint8)
    im=Image.fromarray(pixels,"RGB").convert("RGBA")
    clouds=Image.new("RGBA",im.size,(0,0,0,0)); d=ImageDraw.Draw(clouds,"RGBA")
    for i in range(9):
        x=((i*137-t*(8+i%3)*2)%(W+180))-90
        yy=180+(i%4)*132+math.sin(t*.35+i)*12
        draw_cloud(d,x,yy,.72+(i%3)*.17,110+(i%3)*22)
    d.rectangle((0,790*S,W*S,H*S),fill=(215,231,229,110))
    return Image.alpha_composite(im,clouds)

def base_frame(t, accent, scene=None):
    scene=scene or {}
    background=str(scene.get("background","dark_lab")).lower()
    if background=="sky":
        im=sky_background(t)
    elif background=="clean":
        im=Image.new("RGBA",(W*S,H*S),(13,28,43,255))
    elif background=="workshop":
        im=Image.new("RGBA",(W*S,H*S),(24,31,40,255))
    elif background=="ocean":
        im=Image.new("RGBA",(W*S,H*S),(4,54,78,255))
    elif background=="nature":
        im=Image.new("RGBA",(W*S,H*S),(21,63,56,255))
    else:
        im=BG.copy()
    overlay=Image.new("RGBA",im.size,(0,0,0,0)); d=ImageDraw.Draw(overlay,"RGBA")
    if background=="workshop":
        for x in range(0,W,48): d.line((x*S,90*S,x*S,H*S),fill=(180,205,220,18),width=S)
        for y in range(130,H,48): d.line((0,y*S,W*S,y*S),fill=(180,205,220,18),width=S)
        for i in range(4):
            x=((i*170+t*5)%700)-70
            d.line((x*S,100*S,(x-150)*S,H*S),fill=(255,185,90,12),width=12*S)
    elif background=="ocean":
        for i in range(5):
            y=560+i*82+math.sin(t*1.1+i)*10
            pts=[(x*S,(y+math.sin(x/38+t*1.5+i)*9)*S) for x in range(0,W+1,5)]
            d.line(pts,fill=(110,215,225,35),width=3*S)
    elif background=="nature":
        for i in range(7):
            x=(i*96+35)*S
            d.ellipse((x-85*S,710*S,x+85*S,1030*S),fill=(5,36,35,45))
    for i in range(7):
        x=((i*155+t*13)%900)-180
        d.polygon([(int(x*S),0),(int((x+30)*S),0),(int((x-210)*S),H*S),(int((x-240)*S),H*S)],fill=(150,205,255,4))
    if background not in ("sky","clean","workshop","ocean","nature"):
        for x,y,r,p in PARTICLES:
            yy=(y-t*(9+r*2))%(H+20)-10
            xx=x+7*math.sin(t*.8+p)
            d.ellipse(((xx-r)*S,(yy-r)*S,(xx+r)*S,(yy+r)*S),outline=(190,225,255,50),width=S)
    d.rounded_rectangle((28*S,28*S,548*S,66*S),radius=12*S,fill=(7,22,42,165),outline=(255,255,255,35),width=S)
    text_fit(d,(44,39),"BEHIND DEL MUNDO",15,(245,249,255,245),bold=True)
    d.ellipse((511*S,43*S,521*S,53*S),fill=rgba(accent))
    return Image.alpha_composite(im,overlay)

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

def draw_aircraft(d,cx,cy,t,accent):
    panel(d,(48,330,528,790),fill=(7,27,50,175),outline=rgba(accent,130),radius=28)
    body=[(92,555),(150,525),(360,520),(468,548),(488,568),(450,582),(160,585),(100,575)]
    d.polygon([(x*S,y*S) for x,y in body],fill=(205,220,232),outline=(255,255,255),width=4*S)
    d.polygon([(245*S,548*S),(345*S,430*S),(390*S,432*S),(330*S,558*S)],fill=(104,147,180),outline=(226,239,248),width=3*S)
    d.polygon([(265*S,575*S),(365*S,675*S),(400*S,673*S),(330*S,574*S)],fill=(71,113,151),outline=(226,239,248),width=3*S)
    d.polygon([(120*S,545*S),(155*S,480*S),(190*S,480*S),(175*S,552*S)],fill=(123,166,196),outline=(240,248,255),width=3*S)
    for i in range(8):
        x=205+i*27
        d.rounded_rectangle((x*S,542*S,(x+13)*S,554*S),radius=4*S,fill=(35,72,102))
    for x,y,r in ((300,585,30),(395,565,25)):
        d.ellipse(((x-r)*S,(y-r)*S,(x+r)*S,(y+r)*S),fill=(12,29,45),outline=rgba(accent),width=4*S)
        for k in range(8):
            a=t*5+k*math.pi/4
            d.line((x*S,y*S,(x+math.cos(a)*r*.8)*S,(y+math.sin(a)*r*.8)*S),fill=(190,220,238),width=3*S)
    for k in range(5):
        x=90-k*16+((t*30)%30)
        d.line((x*S,600*S,(x-22)*S,600*S),fill=rgba(accent,120),width=2*S)
    text_fit(d,(285,720),"SUSTENTACIÓN · EMPUJE · CONTROL",12,(235,247,255),max_width=420,anchor="mm",bold=False)

def draw_aircraft_in_sky(d,cx,cy,t,accent):
    # Tracking shot: a passenger jet crosses a real sky with layered moving clouds.
    x=cx+12*math.sin(t*.7); y=cy-18+7*math.sin(t*.9)
    trail_x=max(28,x-210-25*math.sin(t*.5))
    d.line((trail_x*S,(y+18)*S,(x-70)*S,(y+18)*S),fill=(255,255,255,125),width=5*S)
    d.line((trail_x*S,(y+24)*S,(x-80)*S,(y+24)*S),fill=(230,245,255,80),width=2*S)
    body=[(x-142,y+4),(x-92,y-10),(x+112,y-9),(x+148,y+2),(x+119,y+15),(x-105,y+17)]
    d.polygon([(a*S,b*S) for a,b in body],fill=(238,244,248),outline=(65,91,112),width=2*S)
    d.polygon([((x-18)*S,(y+3)*S),((x+32)*S,(y-112)*S),((x+63)*S,(y-110)*S),((x+42)*S,(y+5)*S)],fill=(128,158,180),outline=(238,247,251),width=2*S)
    d.polygon([((x-6)*S,(y+12)*S),((x+55)*S,(y+104)*S),((x+82)*S,(y+102)*S),((x+35)*S,(y+12)*S)],fill=(105,137,160),outline=(236,246,250),width=2*S)
    d.polygon([((x-112)*S,(y-4)*S),((x-154)*S,(y-57)*S),((x-129)*S,(y-58)*S),((x-78)*S,(y-8)*S)],fill=(130,162,182),outline=(238,247,251),width=2*S)
    for k in range(7):
        wx=x-78+k*25
        d.ellipse(((wx-3)*S,(y-1)*S,(wx+3)*S,(y+5)*S),fill=(40,91,125))
    for ex in (x-8,x+45):
        d.ellipse(((ex-13)*S,(y+13)*S,(ex+13)*S,(y+31)*S),fill=(50,69,82),outline=(220,234,242),width=2*S)
    # Foreground cloud banks create depth and parallax.
    for i in range(4):
        cloud_x=((i*185-t*(12+i*2))%(W+220))-110
        draw_cloud(d,cloud_x,755+(i%2)*55,1.2+(i%2)*.2,220)
    text_fit(d,(288,820),"AIRE · VAPOR · CRISTALES DE HIELO",12,(255,255,255,240),max_width=430,anchor="mm",bold=True)

def draw_vehicle(d,cx,cy,t,accent):
    panel(d,(48,340,528,790),fill=(7,27,50,170),outline=rgba(accent,130),radius=28)
    body=[(88,620),(110,570),(180,545),(230,480),(360,480),(415,540),(472,570),(492,620),(475,650),(105,650)]
    d.polygon([(x*S,y*S) for x,y in body],fill=(47,112,150),outline=(229,241,249),width=4*S)
    d.polygon([(195*S,540*S),(245*S,495*S),(350*S,495*S),(390*S,540*S)],fill=(8,30,49),outline=(188,222,239),width=3*S)
    for x in (180,405):
        d.ellipse(((x-42)*S,610*S,(x+42)*S,694*S),fill=(7,14,24),outline=(210,225,235),width=5*S)
        d.ellipse(((x-19)*S,633*S,(x+19)*S,671*S),fill=(130,153,168),outline=rgba(accent),width=3*S)
        for k in range(6):
            a=t*3+k*math.pi/3
            d.line((x*S,652*S,(x+16*math.cos(a))*S,(652+16*math.sin(a))*S),fill=(235,243,248),width=2*S)
    d.rounded_rectangle((115*S,570*S,177*S,613*S),radius=8*S,fill=(245,190,91),outline=(255,240,205),width=2*S)
    d.rounded_rectangle((420*S,580*S,472*S,610*S),radius=8*S,fill=(255,92,80),outline=(255,220,210),width=2*S)
    d.rectangle((250*S,556*S,335*S,600*S),fill=(18,48,67),outline=rgba(accent),width=3*S)
    for k in range(3):
        x=265+k*25
        d.line((x*S,564*S,x*S,590*S),fill=rgba(accent,180),width=3*S)
    text_fit(d,(290,735),"MOTOR · TRANSMISIÓN · RUEDAS",12,(235,247,255),max_width=420,anchor="mm",bold=False)

def draw_phone(d,cx,cy,t,accent):
    panel(d,(48,320,528,805),fill=(7,27,50,175),outline=rgba(accent,130),radius=28)
    d.rounded_rectangle((190*S,350*S,386*S,770*S),radius=30*S,fill=(4,10,20),outline=(222,235,244),width=5*S)
    d.rounded_rectangle((203*S,382*S,373*S,730*S),radius=18*S,fill=(20,64,89),outline=rgba(accent),width=3*S)
    d.rounded_rectangle((260*S,362*S,316*S,370*S),radius=4*S,fill=(80,105,122))
    for i in range(5):
        y=430+i*52
        d.rounded_rectangle((220*S,y*S,355*S,(y+30)*S),radius=8*S,fill=(31+i*8,94+i*10,125+i*8),outline=(128,198,220),width=2*S)
    d.ellipse((275*S,690*S,300*S,715*S),outline=(220,235,244),width=2*S)
    for i in range(3):
        r=70+i*34+int(4*math.sin(t*5+i))
        d.arc(((cx-r)*S,(cy-r)*S,(cx+r)*S,(cy+r)*S),210,330,fill=rgba(accent,210-i*35),width=3*S)
    text_fit(d,(288,790),"PANTALLA · BATERÍA · ANTENAS",11,(235,247,255),max_width=430,anchor="mm",bold=False)

def draw_turbine(d,cx,cy,t,accent):
    panel(d,(48,330,528,790),fill=(7,27,50,175),outline=rgba(accent,130),radius=28)
    cx,cy=288,550
    d.ellipse((118*S,380*S,458*S,720*S),fill=(13,34,52),outline=(200,224,237),width=7*S)
    d.ellipse((143*S,405*S,433*S,695*S),fill=(5,17,31),outline=rgba(accent),width=3*S)
    for k in range(9):
        a=t*4+k*2*math.pi/9
        p1=(cx+20*math.cos(a),cy+20*math.sin(a))
        p2=(cx+135*math.cos(a+.24),cy+135*math.sin(a+.24))
        p3=(cx+115*math.cos(a+.55),cy+115*math.sin(a+.55))
        d.polygon([(x*S,y*S) for x,y in (p1,p2,p3)],fill=(117,157,184),outline=(234,245,250))
    d.ellipse((cx-28*S,cy-28*S,cx+28*S,cy+28*S),fill=rgba(accent),outline=(255,255,255),width=3*S)
    for k in range(4):
        y=735+k*12
        d.line(((190+k*12)*S,y*S,(385-k*12)*S,y*S),fill=rgba(accent,150),width=2*S)

def draw_octopus(d,cx,cy,t,accent):
    # Silueta reconocible: manto, ojos y ocho brazos ondulantes con ventosas.
    d.ellipse(((cx-82)*S,(cy-155)*S,(cx+82)*S,(cy+15)*S),fill=(210,105,119),outline=(255,207,198),width=4*S)
    d.ellipse(((cx-48)*S,(cy-95)*S,(cx-17)*S,(cy-52)*S),fill=(255,255,245))
    d.ellipse(((cx+17)*S,(cy-95)*S,(cx+48)*S,(cy-52)*S),fill=(255,255,245))
    for ex in (cx-33,cx+33):
        d.ellipse(((ex-9)*S,(cy-83)*S,(ex+9)*S,(cy-59)*S),fill=(14,28,42))
    for arm in range(8):
        a=math.pi*2*arm/8-math.pi/2
        pts=[]
        for k in range(30):
            u=k/29
            bend=math.sin(u*math.pi*2+t*2+arm)*22*u
            x=cx+math.cos(a)*(48+190*u)+math.cos(a+math.pi/2)*bend
            y=cy-5+math.sin(a)*(38+165*u)+math.sin(a+math.pi/2)*bend
            pts.append((int(x*S),int(y*S)))
        d.line(pts,fill=(222,128,139),width=13*S,joint="curve")
        for k in range(3,27,4):
            x,y=pts[k]
            d.ellipse((x-4*S,y-4*S,x+4*S,y+4*S),fill=(255,215,196))
def draw_flamingo(d,cx,cy,t,accent):
    # Ave completa con cuello en S, pico negro y patas largas.
    d.ellipse(((cx-105)*S,(cy-40)*S,(cx+80)*S,(cy+82)*S),fill=(244,133,157),outline=(255,218,222),width=3*S)
    d.ellipse(((cx+18)*S,(cy-145)*S,(cx+94)*S,(cy-70)*S),fill=(245,145,166),outline=(255,225,229),width=3*S)
    neck=[(cx+50,cy-65),(cx+22,cy-108),(cx+38,cy-155),(cx+75,cy-160)]
    d.line([(x*S,y*S) for x,y in neck],fill=(245,145,166),width=24*S,joint="curve")
    d.polygon([((cx+83)*S,(cy-112)*S),((cx+132)*S,(cy-101)*S),((cx+91)*S,(cy-88)*S)],fill=(28,35,43))
    d.ellipse(((cx+65)*S,(cy-126)*S,(cx+73)*S,(cy-118)*S),fill=(15,25,35))
    for x,phase in ((cx-28,0),(cx+28,1)):
        d.line((x*S,(cy+65)*S,(x+math.sin(t*2+phase)*7)*S, (cy+250)*S),fill=(242,151,170),width=7*S)
        d.line(((x+math.sin(t*2+phase)*7)*S,(cy+250)*S,(x+28)*S,(cy+255)*S),fill=(242,151,170),width=6*S)
def draw_satellite(d,cx,cy,t,accent):
    # Satélite de navegación con paneles solares y antena.
    d.rectangle(((cx-42)*S,(cy-48)*S,(cx+42)*S,(cy+48)*S),fill=(190,205,215),outline=(255,255,255),width=4*S)
    for side in (-1,1):
        x1=cx+side*48
        left,right=sorted((x1-side*105,x1+side*105))
        d.rectangle((left*S,(cy-62)*S,right*S,(cy+62)*S),fill=(31,83,132),outline=(125,201,238),width=3*S)
        for k in range(1,5):
            xx=left+k*(right-left)/5
            d.line((xx*S,(cy-60)*S,xx*S,(cy+60)*S),fill=(150,210,240),width=2*S)
    d.line((cx*S,(cy-48)*S,cx*S,(cy-125)*S),fill=(230,238,243),width=4*S)
    d.ellipse(((cx-18)*S,(cy-145)*S,(cx+18)*S,(cy-109)*S),fill=rgba(accent))
    for k in range(3):
        r=72+k*24+int(5*math.sin(t*4+k))
        d.arc(((cx-r)*S,(cy-r)*S,(cx+r)*S,(cy+r)*S),205,335,fill=rgba(accent,190-k*35),width=3*S)
def draw_mars(d,cx,cy,t,accent):
    # Planeta rojo, horizonte y resplandor azul del atardecer marciano.
    d.ellipse((70*S,340*S,506*S,776*S),fill=(157,66,48),outline=(241,150,112),width=5*S)
    for i in range(9):
        x=110+i*43
        y=450+int(95*math.sin(i*1.3))
        d.arc(((x-40)*S,(y-20)*S,(x+60)*S,(y+45)*S),190,345,fill=(91,43,40,180),width=5*S)
    d.rectangle((0,710*S,W*S,860*S),fill=(83,43,42,255))
    for i in range(6):
        x=i*120-30
        d.polygon([(x*S,740*S),((x+65)*S,(690+i%2*22)*S),((x+145)*S,740*S)],fill=(112,57,48))
    for r in range(8,0,-1):
        d.ellipse(((cx-r*27)*S,(690-r*9)*S,(cx+r*27)*S,(690+r*9)*S),outline=(68,160,231,18),width=2*S)
def draw_roman_concrete(d,cx,cy,t,accent):
    # Arco romano y sección de opus caementicium con fragmentos minerales visibles.
    d.rectangle((95*S,600*S,481*S,790*S),fill=(145,119,91),outline=(224,202,163),width=4*S)
    d.pieslice((145*S,350*S,431*S,700*S),180,360,fill=(170,143,108),outline=(237,214,172),width=5*S)
    d.rectangle((145*S,525*S,431*S,700*S),fill=(17,35,48))
    d.rectangle((145*S,525*S,431*S,790*S),fill=(160,132,98),outline=(235,211,169),width=4*S)
    for i in range(18):
        x=170+(i*47)%245; y=555+(i*37)%205
        r=7+(i%4)*3
        d.polygon([((x+math.cos(k*math.pi/3)*r)*S,(y+math.sin(k*math.pi/3)*r)*S) for k in range(6)],fill=((93+i*3)%180, (86+i*2)%160, (69+i)%130))
    for i in range(4):
        x=170+i*85
        d.line((x*S,540*S,x*S,780*S),fill=(224,202,163,100),width=2*S)

def draw_visual_elements(d, elements, t, accent):
    """Renderiza elementos en una composición con colisiones evitadas."""
    placed=[]
    palette_fallback=rgba(accent,235)
    # Área reservada: título arriba y subtítulos abajo.
    for item in (elements or [])[:14]:
        if not isinstance(item,dict): continue
        shape=str(item.get("shape","circle")).lower()
        wanted_x=48+clamp(float(item.get("x",500))/1000)*480
        wanted_y=300+clamp(float(item.get("y",500))/1000)*490
        w=max(28,min(220,float(item.get("width",100))*0.38))
        h=max(28,min(190,float(item.get("height",100))*0.38))
        label=str(item.get("label","")).strip()
        role=str(item.get("role","detail")).lower()
        # El sujeto principal es la base de la composición: los mecanismos y detalles
        # deben poder colocarse DENTRO de él, no ser expulsados fuera de su silueta.
        # Solo evitamos colisiones entre elementos secundarios del mismo plano.
        box_h=h/2+(24 if label and shape!="text" else 0)
        candidates=[]
        for radius in range(0,241,24):
            for dx,dy in ((0,0),(radius,0),(-radius,0),(0,radius),(0,-radius),
                          (radius,radius),(-radius,radius),(radius,-radius),(-radius,-radius)):
                x=max(70,min(506,wanted_x+dx)); y=max(350,min(755,wanted_y+dy))
                rect=(x-w/2-12,y-h/2-10,x+w/2+12,y+box_h+10)
                overlap=0
                for other_rect,other_role in placed:
                    if role!="main_subject" and other_role=="main_subject":
                        continue
                    a,b,c,e=other_rect
                    if not (rect[2]<a or rect[0]>c or rect[3]<b or rect[1]>e):
                        overlap+=1
                distance=(x-wanted_x)**2+(y-wanted_y)**2
                candidates.append((overlap,distance,x,y,rect))
            if candidates and min(v[0] for v in candidates)==0: break
        _,_,x,y,rect=min(candidates,key=lambda v:(v[0],v[1]))
        placed.append((rect,role))
        motion=str(item.get("motion","none")).lower()
        phase=t*2.8+float(item.get("phase",0))
        if motion=="float": y+=math.sin(phase)*5
        elif motion=="pulse":
            scale=1+0.05*math.sin(phase*1.5); w*=scale; h*=scale
        elif motion=="flow": x+=math.sin(phase)*7
        x1,y1,x2,y2=x-w/2,y-h/2,x+w/2,y+h/2
        color=item.get("color",accent)
        try: fill=rgba(color,225)
        except Exception: fill=palette_fallback
        sw=max(2,int(float(item.get("stroke",3))*S))
        if shape in ("rect","rounded_rect"):
            if shape=="rounded_rect":
                d.rounded_rectangle((x1*S,y1*S,x2*S,y2*S),radius=min(w,h)*.12*S,fill=fill,outline=(245,250,255,190),width=sw)
            else:
                d.rectangle((x1*S,y1*S,x2*S,y2*S),fill=fill,outline=(245,250,255,190),width=sw)
        elif shape in ("circle","ellipse"):
            d.ellipse((x1*S,y1*S,x2*S,y2*S),fill=fill,outline=(245,250,255,190),width=sw)
        elif shape in ("line","arrow","wave"):
            if shape=="wave":
                pts=[(x1+(x2-x1)*k/36,y+math.sin(k*.48+phase)*h*.25) for k in range(37)]
                d.line([(int(a*S),int(b*S)) for a,b in pts],fill=fill,width=sw)
            else:
                d.line((x1*S,y1*S,x2*S,y2*S),fill=fill,width=sw)
                if shape=="arrow":
                    a=math.atan2(y2-y1,x2-x1)
                    for delta in (-.55,.55):
                        ex=x2-15*math.cos(a+delta); ey=y2-15*math.sin(a+delta)
                        d.line((x2*S,y2*S,ex*S,ey*S),fill=fill,width=sw)
        elif shape=="polygon":
            pts=item.get("points",[])
            if isinstance(pts,list) and len(pts)>=3:
                mapped=[((x-w/2+clamp(float(p[0])/1000)*w)*S,(y-h/2+clamp(float(p[1])/1000)*h)*S) for p in pts[:12] if isinstance(p,(list,tuple)) and len(p)>=2]
                if len(mapped)>=3: d.polygon(mapped,fill=fill,outline=(245,250,255,190))
        elif shape=="gear":
            radius=min(w,h)/2
            for k in range(12):
                a=phase+k*math.pi/6
                d.line(((x+math.cos(a)*radius*.72)*S,(y+math.sin(a)*radius*.72)*S,(x+math.cos(a)*radius)*S,(y+math.sin(a)*radius)*S),fill=fill,width=max(sw,5*S))
            d.ellipse(((x-radius*.62)*S,(y-radius*.62)*S,(x+radius*.62)*S,(y+radius*.62)*S),outline=fill,width=sw)
            d.ellipse(((x-radius*.16)*S,(y-radius*.16)*S,(x+radius*.16)*S,(y+radius*.16)*S),fill=fill)
        elif shape=="arc":
            d.arc((x1*S,y1*S,x2*S,y2*S),start=int((phase*50)%360),end=int((phase*50)%360)+245,fill=fill,width=sw)
        elif shape=="text":
            text_fit(d,(x,y),str(item.get("label",""))[:26],max(10,min(25,float(item.get("font_size",16)))),fill,max_width=int(w*S),anchor="mm")
        if label and shape!="text":
            text_fit(d,(x,y+h/2+17),label[:22],10,(239,247,255,245),max_width=int(max(90,w+45)*S),anchor="mm",bold=False)

def draw_scene(im, scene, local_t, accent):
    overlay=Image.new("RGBA",im.size,(0,0,0,0)); d=ImageDraw.Draw(overlay,"RGBA")
    title=str(scene.get("headline",""))[:52]
    subtitle=str(scene.get("subtitle",""))[:90]
    draw_title(d,title,subtitle,local_t,accent)
    kind=scene.get("visual_type","illustration")
    cx,cy=288,560
    elements=scene.get("visual_elements",[])
    # Primero se dibuja el sujeto reconocible o mecanismo propio del tema.
    # Los elementos del JSON se superponen después como detalles, nunca lo sustituyen.
    if kind=="microwave": draw_microwave(d,cx,cy,1.24,.3+local_t,accent)
    elif kind in ("machine","engine","industrial"): draw_machine(d,cx,cy,local_t,accent,scene.get("labels"))
    elif kind=="aircraft":
        if scene.get("background")=="sky": draw_aircraft_in_sky(d,cx,cy,local_t,accent)
        else: draw_aircraft(d,cx,cy,local_t,accent)
    elif kind=="vehicle": draw_vehicle(d,cx,cy,local_t,accent)
    elif kind in ("phone","gps"): draw_phone(d,cx,cy,local_t,accent)
    elif kind=="satellite": draw_satellite(d,cx,cy,local_t,accent)
    elif kind=="flamingo": draw_flamingo(d,cx,cy,local_t,accent)
    elif kind=="octopus": draw_octopus(d,cx,cy,local_t,accent)
    elif kind=="mars": draw_mars(d,cx,cy,local_t,accent)
    elif kind in ("roman_concrete","pompeii"): draw_roman_concrete(d,cx,cy,local_t,accent)
    elif kind=="turbine": draw_turbine(d,cx,cy,local_t,accent)
    elif kind=="object_cutaway": draw_cutaway(d,cx,cy,local_t,accent,scene.get("labels"))
    elif kind in ("interior","building_cutaway","facility"): draw_building(d,cx,cy,local_t,accent)
    elif kind in ("molecule","science"):
        panel(d,(48,300,528,795),fill=(7,27,50,160),outline=rgba(accent,120),radius=30)
        draw_molecule(d,cx,535,.92,local_t*4,accent)
        text_fit(d,(cx,780),"MODELO EXPLICATIVO",12,(200,225,240),anchor="mm",bold=False)
    elif kind in ("process","diagram"): draw_process(d,cx,565,local_t,accent,scene.get("labels") or ["Entrada","Proceso","Salida"])
    elif kind in ("timeline","history"): draw_timeline(d,cx,560,local_t,accent,scene.get("labels",["Origen","Cambio","Hoy"]))
    elif kind in ("fact","number","stat"): draw_fact(d,cx,565,local_t,accent,scene.get("metric",{}))
    elif kind in ("map","location"):
        panel(d,(50,310,526,800),fill=(11,48,62,220),outline=rgba(accent,160))
        for i in range(12):
            x=70+i*38
            d.line((x*S,330*S,(x+12*math.sin(i*1.7))*S,780*S),fill=(105,172,169,45),width=2*S)
        for i in range(10):
            y=350+i*43
            d.line((55*S,y*S,520*S,(y+10*math.sin(i*1.3))*S),fill=(105,172,169,45),width=2*S)
        for i,label in enumerate(scene.get("labels",["Punto A","Punto B","Punto C"])[:3]):
            x=135+i*145; y=450+(i%2)*140
            d.ellipse(((x-11)*S,(y-11)*S,(x+11)*S,(y+11)*S),fill=rgba(accent))
            text_fit(d,(x,y+28),label,12,(245,250,255),max_width=110,anchor="mm")
    elif kind in ("illustration","abstract"): draw_illustration(d,cx,565,local_t,accent,scene.get("labels"))
    if elements: draw_visual_elements(d,elements,local_t,accent)
    im.alpha_composite(overlay)

def draw_caption(im,cue,t,accent):
    start=float(cue["start"]); end=max(start+.05,float(cue["end"]))
    progress=clamp((t-start)/(end-start))
    words=str(cue.get("text","")).split()
    if not words: return
    visible=max(1,min(len(words),int(math.ceil(progress*len(words)))))
    active=min(len(words)-1,int(progress*len(words)))
    overlay=Image.new("RGBA",im.size,(0,0,0,0)); d=ImageDraw.Draw(overlay,"RGBA")
    rise=(1-ease(min(1,progress/.18)))*12
    alpha=int(245*smooth(0,.12,progress))
    top=870+rise
    panel(d,(42,top,534,top+90),fill=(3,12,25,int(alpha*.91)),outline=(255,255,255,int(alpha*.32)),radius=18)
    f=font(19,True)
    shown=words[:visible]
    widths=[d.textbbox((0,0),w,font=f)[2]+10*S for w in shown]
    total=sum(widths)
    x=(W*S-total)//2
    y=int((top+46)*S)
    for idx,(word,width) in enumerate(zip(shown,widths)):
        color=rgba(accent,255) if idx==active else (255,255,255,245)
        d.text((x,y),word,font=f,fill=color,anchor="lm",stroke_width=0)
        x+=width
    im.alpha_composite(overlay)

def render_frame(i, script, starts, durations):
    t=i/FPS
    index=max(0,min(len(starts)-1,next((j for j in range(len(starts)-1,-1,-1) if t>=starts[j]),0)))
    scene=script["scenes"][index]
    local=clamp((t-starts[index])/max(.1,durations[index]))
    accent=scene.get("accent","#62d9cf")
    im=base_frame(t,accent,scene)
    draw_scene(im,scene,local,accent)
    for cue in script.get("captions",[]):
        if float(cue["start"])<=t<float(cue["end"]):
            draw_caption(im,cue,t,accent)
            break
    # Per-scene camera direction: push, pull, pan or a steady tracking shot.
    camera=scene.get("camera",{}) if isinstance(scene.get("camera",{}),dict) else {}
    movement=str(camera.get("movement","push_in"))
    zoom_start=float(camera.get("zoom_start",1.0))
    zoom_end=float(camera.get("zoom_end",1.045))
    zoom=zoom_start+(zoom_end-zoom_start)*ease(local)
    sw,sh=int(W*S*zoom),int(H*S*zoom)
    if zoom>1.001:
        enlarged=im.resize((sw,sh),Image.Resampling.LANCZOS)
        pan_x=float(camera.get("pan_x",0))*S + math.sin(local*math.pi)*5*S
        pan_y=float(camera.get("pan_y",0))*S
        if movement=="pan_left": pan_x-=local*18*S
        elif movement=="pan_right": pan_x+=local*18*S
        elif movement=="follow": pan_x+=math.sin(local*math.pi*2)*8*S
        left=max(0,min(sw-W*S,int((sw-W*S)//2+pan_x)))
        top=max(0,min(sh-H*S,int((sh-H*S)*(.42+.16*local)+pan_y)))
        im=enlarged.crop((left,top,left+W*S,top+H*S))
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
