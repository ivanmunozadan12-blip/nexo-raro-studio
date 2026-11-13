import React from "react";
import {
  AbsoluteFill, Img, Sequence, useCurrentFrame, interpolate, staticFile
} from "remotion";

const scenes = [
  { image:"scene-01.jpg", kicker:"MAR EGEO · 1901", title:"UN SECRETO\nBAJO EL MAR", sub:"En 1901, unos buceadores hallaron un pecio.", align:"left", zoom:1.12, x:-2, y:1 },
  { image:"scene-02.jpg", kicker:"EL HALLAZGO", title:"EL FRAGMENTO\nDE BRONCE", sub:"Frente a Anticitera apareció un fragmento de bronce.", align:"right", zoom:1.18, x:3, y:-1 },
  { image:"scene-03.jpg", kicker:"MÁS DE 2.000 AÑOS", title:"ENGRANAJES\nDIMINUTOS", sub:"Dentro había engranajes diminutos.", align:"left", zoom:1.22, x:-3, y:2 },
  { image:"scene-04.jpg", kicker:"UNA CALCULADORA ASTRONÓMICA", title:"SEGUÍA\nEL CIELO", sub:"La máquina seguía los ciclos del cielo.", align:"right", zoom:1.16, x:2, y:0 },
  { image:"scene-05.jpg", kicker:"CICLOS Y ECLIPSES", title:"ANTICIPABA\nECLIPSES", sub:"También anticipaba eclipses.", align:"left", zoom:1.14, x:-2, y:-1 },
  { image:"scene-06.jpg", kicker:"EL MECANISMO DE ANTICITERA", title:"UNA IDEA\nADELANTADA", sub:"Dos mil años después, aún asombra.", align:"center", zoom:1.2, x:0, y:0 }
];

const Grain: React.FC = () => (
  <AbsoluteFill style={{ opacity:0.09, pointerEvents:"none", mixBlendMode:"soft-light",
    backgroundImage:"url('data:image/svg+xml,%3Csvg viewBox=%270 0 180 180%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27 opacity=%270.45%27/%3E%3C/svg%3E')" }}
  />
);

const Gear: React.FC<{size:number;top:string;left:string;delay?:number;opacity?:number}> = ({size,top,left,delay=0,opacity=.42}) => {
  const f=useCurrentFrame();
  const rotation=(f+delay)*0.55;
  return <div style={{position:"absolute",top,left,width:size,height:size,borderRadius:"50%",
    border:"12px solid rgba(208,164,91,.8)", opacity, transform:"perspective(900px) rotateX(58deg) rotate("+rotation+"deg)",
    boxShadow:"0 0 36px rgba(201,155,78,.24), inset 0 0 25px rgba(201,155,78,.16)"}}>
    <div style={{position:"absolute",inset:"18%",border:"8px solid rgba(208,164,91,.72)",borderRadius:"50%"}}/>
    <div style={{position:"absolute",inset:"42%",background:"rgba(224,185,117,.85)",borderRadius:"50%"}}/>
    {Array.from({length:12}).map((_,i)=><div key={i} style={{position:"absolute",width:"13%",height:"23%",left:"43.5%",top:"-13%",background:"linear-gradient(90deg,#76552d,#e3bd79,#76552d)",transform:"rotate("+i*30+"deg)",transformOrigin:"50% 280%"}}/>)}
  </div>;
};

const Scene: React.FC<{data:typeof scenes[number];index:number;duration:number}> = ({data,index,duration}) => {
  const f=useCurrentFrame();
  const local=f;
  const isFirst=index===0;
  const isLast=index===scenes.length-1;
  const enter=isFirst?1:interpolate(local,[0,18],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const exit=isLast?1:interpolate(local,[duration-18,duration],[1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const zoom=interpolate(local,[0,duration],[data.zoom,data.zoom+0.1]);
  const drift=interpolate(local,[0,duration],[-18,18]);
  const textY=interpolate(local,[12,36],[55,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
  const isCenter=data.align==="center";
  const left=data.align==="right"?"auto":"8%";
  const right=data.align==="right"?"8%":"auto";
  return <AbsoluteFill style={{opacity:Math.min(enter,exit),backgroundColor:"#05090e",overflow:"hidden"}}>
    <Img src={staticFile("assets/"+data.image)} style={{width:"100%",height:"100%",objectFit:"cover",
      transform:"scale("+zoom+") translate("+ (data.x+drift/20) +"%, "+data.y+"%)",
      filter:"brightness(.84) contrast(1.08) saturate(.92)"}} />
    <AbsoluteFill style={{background:"linear-gradient(180deg,rgba(2,7,12,.06) 0%,rgba(2,7,12,.02) 35%,rgba(2,7,12,.76) 100%)"}}/>
    <AbsoluteFill style={{background:"linear-gradient(90deg,rgba(3,8,14,.62),transparent 72%)",opacity:data.align==="right"?.35:.75}}/>
    {index===2 || index===3 ? <><Gear size={360} top="10%" left={index===2?"-8%":"60%"} delay={index*40} opacity={.34}/><Gear size={210} top="33%" left={index===2?"63%":"-5%"} delay={90} opacity={.4}/></>:null}
    <div style={{position:"absolute",top:"8%",left:"8%",right:"8%",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{fontFamily:"Arial,sans-serif",fontSize:23,fontWeight:800,letterSpacing:5,color:"#f1d6a2"}}>BEHIND DEL MUNDO</div>
      <div style={{width:66,height:3,background:"#d7ad6c"}}/>
    </div>
    <div style={{position:"absolute",left:isCenter?"8%":left,right:isCenter?"8%":right,bottom:"17%",
      textAlign:isCenter?"center":data.align==="right"?"right":"left",transform:"translateY("+textY+"px)",maxWidth:"84%"}}>
      <div style={{fontFamily:"Arial,sans-serif",fontSize:22,fontWeight:700,letterSpacing:5,color:"#e2bd7c",marginBottom:24}}>{data.kicker}</div>
      <div style={{fontFamily:"Arial Black,Arial,sans-serif",fontSize:76,fontWeight:900,lineHeight:.99,letterSpacing:-2,
        whiteSpace:"pre-line",color:"#fff",textShadow:"0 8px 35px rgba(0,0,0,.7)"}}>{data.title}</div>
      <div style={{width:110,height:4,background:"#d9ad6e",margin:isCenter?"28px auto":"28px 0"}}/>
      <div style={{fontFamily:"Arial,sans-serif",fontSize:31,lineHeight:1.35,fontWeight:500,color:"rgba(255,255,255,.92)",textShadow:"0 3px 18px #000"}}>{data.sub}</div>
    </div>
    <div style={{position:"absolute",left:"8%",right:"8%",bottom:"7%",height:3,background:"rgba(255,255,255,.24)"}}>
      <div style={{height:"100%",width:(local/duration*100)+"%",background:"#d9ad6e"}}/>
    </div>
    <div style={{position:"absolute",right:"8%",bottom:"8.5%",fontSize:20,letterSpacing:3,color:"rgba(255,255,255,.65)"}}>0{index+1} / 06</div>
    <Grain/>
  </AbsoluteFill>;
};

export const AntikytheraFilm: React.FC = () => (
  <AbsoluteFill style={{background:"#05090e"}}>
    {scenes.map((scene,index)=>{
      const start=index*84;
      const duration=index===scenes.length-1?120:102;
      return <Sequence key={scene.image} from={start} durationInFrames={duration}>
        <Scene data={scene} index={index} duration={duration}/>
      </Sequence>;
    })}
  </AbsoluteFill>
);
