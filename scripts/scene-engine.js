import * as THREE from 'https://esm.sh/three@0.160.0';

const MAT = (color, roughness=0.9) => new THREE.MeshStandardMaterial({ color, roughness, flatShading:true });
const box = (g,x,y,z,sx,sy,sz,color) => { const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),MAT(color));m.position.set(x,y,z);g.add(m);return m; };
const sphere = (g,x,y,z,sx,sy,sz,color,detail=1) => { const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,detail),MAT(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m; };
const cyl = (g,x,y,z,r1,r2,h,color,segments=8) => { const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),MAT(color));m.position.set(x,y,z);g.add(m);return m; };
const rod = (g,a,b,r,color,segments=6) => { const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),segments),MAT(color));m.position.copy(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());g.add(m);return m; };
const plane = (g,x,y,z,w,h,color) => { const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),MAT(color));m.position.set(x,y,z);g.add(m);return m; };
function person(g,x,z,kind='crew',scale=1){
 const p=new THREE.Group();p.position.set(x,0,z);p.scale.setScalar(scale);g.add(p);
 const royal=kind==='king'||kind==='queen',sailor=kind==='columbus'||kind==='crew';
 const cloth=MAT(royal?(kind==='queen'?'#7f263d':'#263e68'):kind==='columbus'?'#75472f':'#31536c'),skin=MAT('#d6a27e'),leather=MAT('#40342e');
 // boots and legs
 for(const side of [-1,1]){box(p,side*.14,.17,0,.18,.34,.28,'#40342e');rod(p,[side*.14,.28,0],[side*.14,.72,0],.095,royal?'#b58b45':sailor?'#6c5039':'#544b42');}
 // tailored torso and shoulders
 const torso=new THREE.Mesh(new THREE.CylinderGeometry(.22,.31,.72,9),cloth);torso.position.y=1.05;p.add(torso);
 sphere(p,0,1.36,0,.33,.16,.22,royal?'#d2b15e':cloth.color,1);
 // collar, belt, tunic hem
 cyl(p,0,1.38,0,.22,.25,.11,royal?'#e2c46e':'#d3c4a4',8);
 box(p,0,.77,0,.53,.1,.34,royal?'#b58b45':'#5a4031');
 // head and face
 sphere(p,0,1.72,0,.22,.27,.2,'#d6a27e',2);
 sphere(p,-.085,1.77,.17,.025,.035,.018,'#342b27',1);sphere(p,.085,1.77,.17,.025,.035,.018,'#342b27',1);
 sphere(p,0,1.69,.195,.035,.045,.025,'#b9795d',1);
 if(kind==='columbus'){sphere(p,0,1.56,.17,.13,.075,.06,'#754b36',1);sphere(p,0,1.9,0,.24,.12,.23,'#75472f',1);cyl(p,0,1.98,0,.24,.24,.05,'#d0ad72',8);}
 else if(sailor){sphere(p,0,1.91,0,.24,.09,.23,'#4b392d',1);cyl(p,0,1.96,0,.25,.25,.045,'#d1b37d',8);}
 else {sphere(p,0,1.91,0,.24,.12,.22,kind==='queen'?'#3d2836':'#4a342b',1);if(royal){cyl(p,0,2.04,0,.22,.26,.12,'#d5ad47',8);for(let k=0;k<5;k++)sphere(p,Math.sin(k*1.256)*.2,2.13,Math.cos(k*1.256)*.2,.045,.13,.045,'#f0d16b',1);}}
 // arms with sleeves, forearms and hands
 for(const side of [-1,1]){rod(p,[side*.25,1.27,0],[side*.42,.96,.05],.105,royal?'#b58b45':cloth.color);rod(p,[side*.42,.96,.05],[side*.48,.75,.15],.075,cloth.color);sphere(p,side*.48,.7,.17,.075,.08,.07,'#d6a27e',1);}
 if(kind==='columbus'){rod(p,[.48,.76,.17],[.58,.58,.22],.025,'#8a795d');}
 return p;
}
function hall(g){
 // stone floor and high walls
 box(g,0,-.22,0,20,.35,22,'#a89a83');
 for(let x=-9;x<=9;x+=2)for(let z=-9;z<=9;z+=2)box(g,x,-.025,z,1.92,.025,1.92,(Math.abs(x/2+z/2)%2)?'#c9bda7':'#b9aa92');
 box(g,0,5,-10,20,10,.7,'#b5a58e');box(g,-10,5,0,.7,10,20,'#aa9a84');box(g,10,5,0,.7,10,20,'#aa9a84');
 // timber ceiling beams
 for(let z=-8;z<9;z+=4)box(g,0,9,z,20,.3,.35,'#5a4636');
 // tall Gothic arches and columns
 for(let x of [-7,-3,3,7]){cyl(g,x,3.8,-5,.32,.42,7.6,'#d2c3a8',8);cyl(g,x,7.65,-5,.52,.52,.3,'#806d56',8);const arch=new THREE.Mesh(new THREE.TorusGeometry(2.1,.25,7,16,Math.PI),MAT('#d2c3a8'));arch.position.set(x,6.2,-9.55);arch.rotation.z=Math.PI;g.add(arch);}
 // stained glass windows and banners
 for(let x of [-7,0,7]){box(g,x,5.1,-9.58,1.7,3.2,.08,'#31526d');for(let k=-1;k<=1;k++)box(g,x+k*.5,5.1,-9.48,.08,3,.08,'#d6bd8c');box(g,x,5.1,-9.45,1.65,.08,.08,'#d6bd8c');}
 for(let x of [-8,8]){box(g,x,6.2,-8.9,.9,2.4,.12,'#8d2f3e');sphere(g,x,6.25,-8.78,.28,.42,.06,'#d7b14c',1);}
 // thrones, table, parchment, chairs
 for(let x of [-2.3,2.3]){box(g,x,.65,-5,1.15,.22,.9,'#613a2c');box(g,x,1.55,-5.38,1.15,1.8,.2,'#7f293d');for(let side of [-1,1]){box(g,x+side*.57,1.05,-5,.14,.9,.85,'#d3ad58');cyl(g,x+side*.48,2.52,-5.3,.09,.09,.28,'#e3c05e');}}
 box(g,0,.9,-1.4,3.4,.2,1.6,'#6e4b34');for(let x of [-1.4,1.4])for(let z of [-2,-.8])box(g,x,.42,z,.14,.8,.14,'#593d2c');
 box(g,0,1.02,-1.4,2.4,.025,1.05,'#d6c08e');for(let i=0;i<5;i++)rod(g,[-.9+i*.4,1.05,-1.8],[-.6+i*.35,1.05,-1],.012,'#80623c');
 for(let x of [-5,5]){cyl(g,x,.55,-1,.22,.25,1.1,'#74563c');cyl(g,x,1.18,-1,.45,.45,.12,'#a88a62');}
}
function ship(g,x,z,index=0){
 const root=new THREE.Group();root.position.set(x,0,z);root.userData.baseX=x;root.userData.baseZ=z;if(index===0)root.scale.set(1.18,1.08,1.18);g.add(root);
 const wood=MAT('#68442d'),dark=MAT('#493426'),sail=MAT(index===1?'#eee5cd':'#dfd2b4'),rope=MAT('#a88a5e');
 // tapered hull mesh, bow at +z, stern at -z
 const verts=[],inds=[];const sections=[[-2.9,.12,.08],[-2.2,.65,.02],[-1,.82,-.08],[1,.78,-.1],[2.2,.57,.05],[2.9,.08,.32]];
 for(let i=0;i<sections.length;i++){const [z,w,y]=sections[i];verts.push(-w,y-.45,z,w,y-.45,z,-w*.82,y+.15,z,w*.82,y+.15,z);}
 for(let i=0;i<sections.length-1;i++){const a=i*4,b=(i+1)*4;inds.push(a,b,a+2,b,b+2,a+2,a+1,b+1,a+3,b+1,b+3,a+3,a,a+1,b,b,a+1,b+1,a+2,b+2,a+3,b+2,b+3,a+3);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(inds);geo.computeVertexNormals();const hull=new THREE.Mesh(geo,wood);root.add(hull);
 // gunwale, deck planks, raised forecastle and sterncastle
 for(let side of [-1,1]){rod(root,[side*.7,-.05,-2.5],[side*.82,.18,2.2],.055,dark);for(let z=-2.1;z<2.2;z+=.45)rod(root,[side*.73,.02,z],[side*.73,.02,z+.02],.018,rope);}
 box(root,0,.03,0,1.35,.12,4.8,'#9a7046');
 box(root,0,.35,-2.25,1.2,.65,.8,'#8a5a39');box(root,0,.65,-2.55,1.35,.08,.5,'#b68c59');
 box(root,0,.32,2.05,1.1,.65,.8,'#8b5d3e');box(root,0,.72,2.15,1.25,.08,.7,'#b68c59');
 // railings and tiny cannon ports
 for(let side of [-1,1]){for(let z=-1.6;z<=1.6;z+=.42){rod(root,[side*.69,.08,z],[side*.72,.48,z],.025,'#b18a5d');}rod(root,[side*.72,.48,-1.6],[side*.72,.48,1.6],.035,'#b18a5d');for(let z=-1.2;z<1.5;z+=.9){sphere(root,side*.78,-.05,z,.07,.07,.07,'#292b2c',1);}}
 // three masts, yards, shaped billowing sails and rigging
 const mastZ=[-1.25,0,1.25],mastH=[2.8,4.2,3.2];
 mastZ.forEach((mz,i)=>{const h=mastH[i];rod(root,[0,.12,mz],[0,h,mz],.075,dark,7);rod(root,[-.8,h*.68,mz],[.8,h*.68,mz],.045,dark,6);
  const sailShape=new THREE.Shape();sailShape.moveTo(-.68,.1);sailShape.quadraticCurveTo(-.8,h*.22,0,h*.42);sailShape.quadraticCurveTo(.8,h*.22,.68,.1);sailShape.closePath();const sg=new THREE.ShapeGeometry(sailShape,8);const sm=new THREE.Mesh(sg,sail);sm.position.set(0,h*.27,mz+.045);root.add(sm);
  for(let k=0;k<4;k++)rod(root,[0,.2,mz],[(-.8+k*.53),h*.65,mz],.012,'#b7a17c',4);
  rod(root,[0,h,mz],[0,h+.32,mz],.025,dark,5);
 });
 // bowsprit, flag, anchor, rudder
 rod(root,[0,.25,2.15],[0,1.3,3.35],.055,dark,6);const flag=plane(root,0,4.5,-1.25,.72,.36,index===1?'#b52f3a':'#e2c66c');flag.rotation.y=Math.PI/2;
 rod(root,[0,.2,-2.3],[0,-.55,-2.9],.09,dark);return root;
}
function harbor(g){
 box(g,0,-.35,-2,28,.6,25,'#b5a078');box(g,0,-.05,-8,28,.18,10,'#267fa0');
 // waterfront houses with roofs, shutters and chimneys
 for(let i=0;i<8;i++){const x=-10+i*2.8,h=2.8+(i%3)*.7;box(g,x,h/2,-10,2.3,h,2,'#d4b88f');const roof=new THREE.Mesh(new THREE.ConeGeometry(1.75,.9,4),MAT(i%2?'#a34d3b':'#76503c'));roof.position.set(x,h+.35,-10);roof.rotation.y=Math.PI/4;g.add(roof);for(let y=1;y<h-0.2;y+=1.1)for(let side of [-1,1])box(g,x+side*.55,y,-8.97,.36,.55,.08,'#314b60');}
 // quay, mooring posts, ropes, crates and barrels
 box(g,0,.1,-3,25,.45,2.2,'#79563a');for(let x=-11;x<=11;x+=2){cyl(g,x,.45,-2.2,.12,.12,.9,'#5b402e');cyl(g,x,.9,-2.2,.16,.16,.12,'#a67b4e');}
 for(let i=0;i<10;i++){const x=-10+i*2.1;box(g,x,.42,-4.3,.65,.75,.65,i%2?'#9a7047':'#775436');cyl(g,x+.55,.4,-3.9,.28,.28,.8,'#8b5a37',10);for(let y of [.12,.68])cyl(g,x+.55,y,-3.9,.29,.29,.06,'#b48a5d',10);}
 for(let x of [-8,-3,3,8]){rod(g,[x,.2,-3],[x,3,-3],.07,'#6b4b32');rod(g,[x,3,-3],[x+1.1,2.4,-3],.06,'#6b4b32');}
 // three persistent caravels
 const fleet=[ship(g,-5,-5,0),ship(g,0,-6,1),ship(g,5,-5,2)];
 fleet.forEach((s,i)=>{const mastTop= i===1?4.2:3.2;});
 return fleet;
}
function ocean(g,night=false){
 const waterGeo=new THREE.PlaneGeometry(34,38,50,55);waterGeo.rotateX(-Math.PI/2);const water=new THREE.Mesh(waterGeo,MAT(night?'#173d59':'#287f9a'));water.position.set(0,-.12,-2);g.add(water);
 const positions=waterGeo.attributes.position;const base=Float32Array.from(positions.array);
 for(let i=0;i<30;i++){const x=(i%6-2.5)*4,z=-14+Math.floor(i/6)*5;sphere(g,x,.2,z,.8,.07,.22,night?'#3c7187':'#5eb1ba',1);}
 return t=>{for(let i=0;i<positions.count;i++){const x=base[i*3],z=base[i*3+2];positions.setY(i,base[i*3+1]+Math.sin(x*.55+t*1.4)*.11+Math.cos(z*.42+t*1.1)*.09);}positions.needsUpdate=true;waterGeo.computeVertexNormals();};
}
function coast(g,night=false){
 box(g,0,-.55,-3,34,.7,34,'#d5bd8d');box(g,0,-.12,-12,34,.18,12,'#247e9b');
 for(let i=0;i<12;i++){const x=-15+i*2.7,h=1.5+(i%4)*.55;const cliff=new THREE.Mesh(new THREE.ConeGeometry(1.9,h,5),MAT(i%2?'#8d9a70':'#a7a07b'));cliff.position.set(x,h/2,-17);g.add(cliff);}
 // palms, rocks, driftwood
 for(let x of [-13,-10,10,13]){rod(g,[x,0,-5],[x+.3,3,-5],.13,'#79533a');for(let k=0;k<6;k++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.22,2.1,5),MAT('#4d8055'));leaf.position.set(x+.3+Math.sin(k*Math.PI/3)*.85,3.3,-5+Math.cos(k*Math.PI/3)*.85);leaf.rotation.z=Math.PI/2-.45;leaf.rotation.y=k*Math.PI/3;g.add(leaf);}}
 for(let i=0;i<18;i++)sphere(g,(i%6-2.5)*3,.25,-2-Math.floor(i/6)*3,.3,.22,.4,'#807b70',0);
}
function buildScene(canvas,d){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(1);renderer.setSize(1080,1920,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene();scene.background=new THREE.Color(d.index===3?'#6c91a8':'#9ac9df');scene.fog=new THREE.Fog(scene.background,24,65);
 scene.add(new THREE.HemisphereLight('#fff4df','#596a68',2.05));const sun=new THREE.DirectionalLight('#ffe4b7',2.2);sun.position.set(-9,15,8);scene.add(sun);
 const world=new THREE.Group();scene.add(world);const people=[],ships=[];let animateWater=()=>{};
 const idx=d.index,words=(d.title+' '+d.visual+' '+d.setting+' '+d.action+' '+(d.props||[]).join(' ')).toLowerCase();
 if(idx===0){scene.background.set('#b9a78d');scene.fog.color.set('#b9a78d');hall(world);people.push(person(world,-2.25,1.1,'columbus',1.05),person(world,-.1,-4.3,'king',1.12),person(world,2.15,-4.2,'queen',1.12));person(world,-4,-1.2,'crew',.9);person(world,4,-1.2,'crew',.9);}
 else if(idx===1){const fleet=harbor(world);ships.push(...fleet);for(let i=0;i<12;i++)people.push(person(world,-10+(i%6)*4.1,-1.4+Math.floor(i/6)*1.3,'crew',.78));}
 else if(idx===2){const fleet=harbor(world);ships.push(...fleet);world.children.filter(o=>o!==fleet[0]&&o!==fleet[1]&&o!==fleet[2]).forEach(o=>{if(o.position.z<-7)o.visible=false;});}
 else if(idx===3){animateWater=ocean(world,true);ships.push(ship(world,-4,-3,0),ship(world,0,-7,1),ship(world,4,-4,2));}
 else if(idx===4){animateWater=ocean(world,false);coast(world);ships.push(ship(world,-3,-8,0),ship(world,2,-10,1));people.push(person(world,-3,0,'columbus',.95));}
 else if(idx===5){coast(world);ships.push(ship(world,-6,-9,0));for(let i=0;i<5;i++)people.push(person(world,-4+i*1.7,-1+i*.15,i===0?'columbus':'crew',.85));}
 else {coast(world);ships.push(ship(world,-8,-9,0),ship(world,7,-10,1));for(let i=0;i<8;i++)people.push(person(world,-6+(i%4)*3.4,-.8+Math.floor(i/4)*1.4,i===0?'columbus':'crew',.82));}
 // Camera direction and scene-specific motion; every shot has its own establishing move.
 const camera=new THREE.PerspectiveCamera(42,1080/1920,.1,120);const duration=Math.max(1,Number(d.duration)||8);
 return t=>{const local=Math.max(0,t-Number(d.start||0));const p=Math.min(1,local/duration),ease=p*p*(3-2*p);if(idx===0){camera.position.set(8-5*ease,5.2+Math.sin(p*Math.PI)*.6,14-7*ease);camera.lookAt(0,2,-3);}
 else if(idx===1){camera.position.set(-12+20*ease,7.5,12-5*ease);camera.lookAt(0,1,-4);}
 else if(idx===2){camera.position.set(0,8,16-5*ease);camera.lookAt(0,1,-4);ships.forEach((s,i)=>{s.position.z=s.userData.baseZ-local*.22;s.position.x=s.userData.baseX+(i-1)*local*.035;});}
 else if(idx===3){camera.position.set(9*Math.sin(p*1.3),7,16-3*ease);camera.lookAt(0,1,-4);ships.forEach((s,i)=>{s.position.z=s.userData.baseZ+Math.sin(local*.65+i)*.08;s.rotation.z=Math.sin(local*.7+i)*.035;});}
 else if(idx===4){camera.position.set(10-8*ease,6,15-6*ease);camera.lookAt(0,1,-8);ships.forEach((s,i)=>{s.position.z=s.userData.baseZ+local*.13;s.rotation.y=.08*Math.sin(local+i);});}
 else if(idx===5){camera.position.set(8-9*ease,5,13-4*ease);camera.lookAt(0,1,-3);ships.forEach(s=>{s.position.z=s.userData.baseZ+local*.1;});}
 else {camera.position.set(-12+14*ease,8,17-5*ease);camera.lookAt(0,1,-7);}
 people.forEach((p,i)=>{p.rotation.y=.08*Math.sin(local*1.2+i);p.position.y=.025*Math.sin(local*2+i);});
 animateWater(local);renderer.render(scene,camera);};
}

function buildGenericScene(canvas,d){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(1);renderer.setSize(1080,1920,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),world=new THREE.Group();scene.add(world);scene.background=new THREE.Color('#9ac9df');scene.fog=new THREE.Fog('#9ac9df',24,65);scene.add(new THREE.HemisphereLight('#fff', '#65766c',2));const sun=new THREE.DirectionalLight('#fff0ce',2);sun.position.set(-8,14,9);scene.add(sun);
 const words=(d.title+' '+d.visual+' '+d.setting+' '+d.action+' '+(d.props||[]).join(' ')).toLowerCase(),water=/mar|oceano|agua|rio|barco|ballena|coral/.test(words)||d.type==='ocean',space=/espacio|planeta|luna|estrella|orbita|galax/.test(words)||d.type==='space',historic=d.type==='history'||/antigu|romano|egipto|medieval|castillo|imperio/.test(words),forest=/bosque|selva|arbol|jungla/.test(words),science=d.type==='science'||/laboratorio|experimento|motor|maquina|ciencia/.test(words);
 const groundColor=water?'#277f9e':space?'#263b6a':forest?'#557b4c':historic?'#9a8b75':science?'#647b83':'#9b9a83';box(world,0,-.5,-3,28,1,30,groundColor);
 if(water){const waterMesh=new THREE.Mesh(new THREE.PlaneGeometry(30,30,40,40),MAT('#328ba8'));waterMesh.rotation.x=-Math.PI/2;waterMesh.position.y=.04;world.add(waterMesh);}
 if(space){scene.background.set('#17294d');for(let i=0;i<100;i++)sphere(world,(Math.sin(i*9)*.5)*24,Math.cos(i*3)*10,-10,.035,.035,.035,'#fff',0);sphere(world,0,2,-7,3,3,3,'#d69b59',2);}
 if(forest){for(let i=0;i<20;i++){const x=(i%5-2)*4,z=-10+Math.floor(i/5)*4;rod(world,[x,0,z],[x,.9,z],.18,'#745036');sphere(world,x,1.6,z,1,1.2,1,'#4e965b',1);}}
 if(historic){for(let i=0;i<4;i++){box(world,(i-1.5)*5,1.8,-7,3.4,3.6,2.5,'#c5b391');for(let x of [-1,1])box(world,(i-1.5)*5+x,2.2,-5.7,.45,1.4,.1,'#4a5360');}}
 if(science){box(world,0,1,-6,8,2.2,3,'#a5b6b8');for(let i=0;i<4;i++){cyl(world,-3+i*2,.6,-4,.25,.25,1.1,['#4e9ab4','#b77a54','#6b9a71','#a38ac3'][i],10);}}
 (d.characters||[]).slice(0,6).forEach((c,i)=>person(world,(i-2.5)*1.8,1,String(c.role||'crew').toLowerCase().includes('rey')?'king':'crew',.9));
 (d.props||[]).slice(0,8).forEach((p,i)=>{const n=String(p).toLowerCase(),x=(i-3.5)*2.1;if(/barco|carabela|navio/.test(n))ship(world,x,-4,i%3);else if(/arbol|palmera/.test(n)){rod(world,[x,0,-3],[x,2,-3],.14,'#765033');sphere(world,x,2.6,-3,.9,1,.9,'#4c985b',1);}else if(/edificio|casa|templo|castillo/.test(n))box(world,x,1.5,-5,1.8,3,1.8,'#c7b18e');else if(/persona|soldado|marinero/.test(n))person(world,x,0,'crew',.9);else sphere(world,x,.8,-2,.65,.8,.65,['#c89b64','#5b9fb0','#a85e54','#7c9c65'][i%4],1);});
 const camera=new THREE.PerspectiveCamera(42,1080/1920,.1,120);const duration=Math.max(1,Number(d.duration)||8);
 return t=>{const p=Math.min(1,Math.max(0,(t-Number(d.start||0))/duration));camera.position.set(8-5*p,5+Math.sin(p*Math.PI),15-4*p);camera.lookAt(0,1,-4);renderer.render(scene,camera);};
}
const nodes=[...document.querySelectorAll('.world-canvas')];const renderers=nodes.map(node=>{const data=JSON.parse(node.dataset.scene);if(data.storyId!=='columbus-1492')return buildGenericScene(node,data);return buildScene(node,data);});
const timeline=window.__timelines?.['behind-del-mundo'];if(timeline){timeline.eventCallback('onUpdate',()=>{const t=timeline.time();renderers.forEach(render=>render(t));});renderers.forEach(render=>render(0));}
