import * as THREE from 'three';
import { directScene, animateEntities, createProceduralEntity, detectEnvironment } from './procedural-engine.js';

const MAT = (color, roughness=0.9) => new THREE.MeshStandardMaterial({ color, roughness, flatShading:true });
const box = (g,x,y,z,sx,sy,sz,color) => { const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),MAT(color));m.position.set(x,y,z);g.add(m);return m; };
const sphere = (g,x,y,z,sx,sy,sz,color,detail=1) => { const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,detail),MAT(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m; };
const cyl = (g,x,y,z,r1,r2,h,color,segments=8) => { const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),MAT(color));m.position.set(x,y,z);g.add(m);return m; };
const rod = (g,a,b,r,color,segments=6) => { const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),segments),MAT(color));m.position.copy(new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());g.add(m);return m; };
const plane = (g,x,y,z,w,h,color) => { const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),MAT(color));m.position.set(x,y,z);g.add(m);return m; };
function person(g,x,z,kind='crew',scale=1){
 const p=new THREE.Group();p.position.set(x,0,z);p.scale.setScalar(scale);g.add(p);
 const royal=kind==='king'||kind==='queen',local=kind==='lucayan',sailor=kind==='columbus'||kind==='crew';
 const cloth=MAT(local?'#b28b62':royal?(kind==='queen'?'#7f263d':'#263e68'):kind==='columbus'?'#75472f':'#31536c'),skin=MAT('#d6a27e'),leather=MAT('#40342e');
 // boots and legs
 for(const side of [-1,1]){box(p,side*.14,.17,0,.18,.34,.28,local?'#76543b':'#40342e');rod(p,[side*.14,.28,0],[side*.14,.72,0],.095,local?'#a47a51':royal?'#b58b45':sailor?'#6c5039':'#544b42');}
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
 if(local){sphere(p,0,1.91,0,.24,.09,.23,'#29251f',1);box(p,0,1.38,.02,.46,.08,.32,'#b68d5f');}else if(kind==='columbus'){sphere(p,0,1.56,.17,.13,.075,.06,'#754b36',1);sphere(p,0,1.9,0,.24,.12,.23,'#75472f',1);cyl(p,0,1.98,0,.24,.24,.05,'#d0ad72',8);}
 else if(sailor){sphere(p,0,1.91,0,.24,.09,.23,'#4b392d',1);cyl(p,0,1.96,0,.25,.25,.045,'#d1b37d',8);}
 else {sphere(p,0,1.91,0,.24,.12,.22,kind==='queen'?'#3d2836':'#4a342b',1);if(royal){cyl(p,0,2.04,0,.22,.26,.12,'#d5ad47',8);for(let k=0;k<5;k++)sphere(p,Math.sin(k*1.256)*.2,2.13,Math.cos(k*1.256)*.2,.045,.13,.045,'#f0d16b',1);}}
 // arms with sleeves, forearms and hands
 p.userData.arms=[];for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.25,1.27,0);rod(arm,[0,0,0],[side*.17,-.31,.05],.105,royal?'#b58b45':cloth.color);rod(arm,[side*.17,-.31,.05],[side*.23,-.52,.15],.075,cloth.color);sphere(arm,side*.23,-.57,.17,.075,.08,.07,'#d6a27e',1);p.add(arm);p.userData.arms.push({arm,side});if(kind==='columbus'&&side===1)arm.rotation.z=-.32;arm.userData.baseRotation=arm.rotation.z;}
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
 box(g,0,1.02,-1.4,2.4,.025,1.05,'#d6c08e');box(g,0,1.055,-1.4,1.35,.025,.72,'#e8d7ad');for(let i=0;i<5;i++)rod(g,[-.9+i*.4,1.08,-1.8],[-.6+i*.35,1.08,-1],.012,'#80623c');sphere(g,.48,1.12,-1.32,.12,.035,.12,'#a72d35',1);rod(g,[.85,1.1,-1.5],[.08,1.55,-1.42],.018,'#e1d2ad');
 for(let x of [-5,5]){cyl(g,x,.55,-1,.22,.25,1.1,'#74563c');cyl(g,x,1.18,-1,.45,.45,.12,'#a88a62');}
}
function ship(g,x,z,index=0){
 const root=new THREE.Group();root.position.set(x,.48,z);root.userData.baseX=x;root.userData.baseZ=z;root.userData.baseY=.48;if(index===0)root.scale.set(1.18,1.08,1.18);g.add(root);
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
  const sailShape=new THREE.Shape();sailShape.moveTo(-.68,.1);sailShape.quadraticCurveTo(-.8,h*.22,0,h*.42);sailShape.quadraticCurveTo(.8,h*.22,.68,.1);sailShape.closePath();const sg=new THREE.ShapeGeometry(sailShape,8);const sm=new THREE.Mesh(sg,sail);sm.position.set(0,h*.27,mz+.045);root.add(sm);root.userData.sails=root.userData.sails||[];root.userData.sails.push(sm);
  for(let k=0;k<4;k++)rod(root,[0,.2,mz],[(-.8+k*.53),h*.65,mz],.012,'#b7a17c',4);
  rod(root,[0,h,mz],[0,h+.32,mz],.025,dark,5);
 });
 // bowsprit, flag, anchor, rudder
 rod(root,[0,.25,2.15],[0,1.3,3.35],.055,dark,6);const flag=plane(root,0,4.5,-1.25,.72,.36,index===1?'#b52f3a':'#e2c66c');flag.rotation.y=Math.PI/2;root.userData.flag=flag;
 rod(root,[0,.2,-2.3],[0,-.55,-2.9],.09,dark);return root;
}
function harbor(g){
 // La ciudad ocupa tierra firme al fondo; el agua queda separada detrás del muelle.
 box(g,0,-.35,4,28,.6,18,'#b5a078');
 const waterGeo=new THREE.PlaneGeometry(30,18,40,28);waterGeo.rotateX(-Math.PI/2);
 const water=new THREE.Mesh(waterGeo,MAT('#267fa0'));water.position.set(0,-.08,-10);g.add(water);
 // Casas apoyadas sobre el terreno, nunca sobre la superficie del agua.
 for(let i=0;i<8;i++){const x=-10+i*2.8,h=2.8+(i%3)*.7;box(g,x,h/2,7,2.3,h,2,'#d4b88f');const roof=new THREE.Mesh(new THREE.ConeGeometry(1.75,.9,4),MAT(i%2?'#a34d3b':'#76503c'));roof.position.set(x,h+.35,7);roof.rotation.y=Math.PI/4;g.add(roof);for(let y=1;y<h-.2;y+=1.1)for(let side of [-1,1])box(g,x+side*.55,y,8.03,.36,.55,.08,'#314b60');}
 // Muelle de madera en la línea de costa.
 box(g,0,.1,-1.2,25,.45,2.2,'#79563a');for(let x=-11;x<=11;x+=2){cyl(g,x,.45,-.2,.12,.12,.9,'#5b402e');cyl(g,x,.9,-.2,.16,.16,.12,'#a67b4e');}
 for(let i=0;i<10;i++){const x=-10+i*2.1;box(g,x,.42,-2.35,.65,.75,.65,i%2?'#9a7047':'#775436');cyl(g,x+.55,.4,-1.95,.28,.28,.8,'#8b5a37',10);for(let y of [.12,.68])cyl(g,x+.55,y,-1.95,.29,.29,.06,'#b48a5d',10);}
 for(let x of [-8,-3,3,8]){rod(g,[x,.2,-1.2],[x,3,-1.2],.07,'#6b4b32');rod(g,[x,3,-1.2],[x+1.1,2.4,-1.2],.06,'#6b4b32');}
 // Tres naves amarradas y claramente separadas del muelle.
 const fleet=[ship(g,-5,-8,0),ship(g,0,-9.5,1),ship(g,5,-8,2)];
 return fleet;
}
function ocean(g,night=false){
 const waterGeo=new THREE.PlaneGeometry(34,38,50,55);waterGeo.rotateX(-Math.PI/2);const water=new THREE.Mesh(waterGeo,MAT(night?'#173d59':'#287f9a'));water.position.set(0,-.12,-2);g.add(water);
 const positions=waterGeo.attributes.position;const base=Float32Array.from(positions.array);
 for(let i=0;i<30;i++){const x=(i%6-2.5)*4,z=-14+Math.floor(i/6)*5;sphere(g,x,.2,z,.8,.07,.22,night?'#3c7187':'#5eb1ba',1);}
 return t=>{for(let i=0;i<positions.count;i++){const x=base[i*3],z=base[i*3+2];positions.setY(i,base[i*3+1]+Math.sin(x*.55+t*1.4)*.11+Math.cos(z*.42+t*1.1)*.09);}positions.needsUpdate=true;waterGeo.computeVertexNormals();};
}
function coast(g,night=false){
 box(g,0,-.55,3,34,.7,22,'#d5bd8d');const shoreWaterGeo=new THREE.PlaneGeometry(34,18,40,28);shoreWaterGeo.rotateX(-Math.PI/2);const shoreWater=new THREE.Mesh(shoreWaterGeo,MAT('#247e9b'));shoreWater.position.set(0,-.12,-14);g.add(shoreWater);
 for(let i=0;i<12;i++){const x=-15+i*2.7,h=1.5+(i%4)*.55;const cliff=new THREE.Mesh(new THREE.ConeGeometry(1.9,h,5),MAT(i%2?'#8d9a70':'#a7a07b'));cliff.position.set(x,h/2,-17);g.add(cliff);}
 // palms, rocks, driftwood
 for(let x of [-13,-10,10,13]){rod(g,[x,0,0],[x+.3,3,0],.13,'#79533a');for(let k=0;k<6;k++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.22,2.1,5),MAT('#4d8055'));leaf.position.set(x+.3+Math.sin(k*Math.PI/3)*.85,3.3,Math.cos(k*Math.PI/3)*.85);leaf.rotation.z=Math.PI/2-.45;leaf.rotation.y=k*Math.PI/3;g.add(leaf);}}
 for(let i=0;i<18;i++)sphere(g,(i%6-2.5)*3,.25,1-Math.floor(i/6)*1.5,.3,.22,.4,'#807b70',0);
}
function buildScene(renderer,d){
 const scene=new THREE.Scene();scene.background=new THREE.Color(d.index===5?'#26394e':'#9ac9df');scene.fog=new THREE.Fog(scene.background,24,65);
 scene.add(new THREE.HemisphereLight('#fff4df','#596a68',2.05));const sun=new THREE.DirectionalLight('#ffe4b7',2.2);sun.position.set(-9,15,8);scene.add(sun);
 if(d.index===5)scene.fog.color.set('#26394e');const world=new THREE.Group();scene.add(world);const people=[],ships=[];let animateWater=()=>{};
 const idx=d.index,words=(d.title+' '+d.visual+' '+d.setting+' '+d.action+' '+(d.props||[]).join(' ')).toLowerCase();
 if(idx===0||idx===1){scene.background.set('#b9a78d');scene.fog.color.set('#b9a78d');hall(world);if(idx===0){people.push(person(world,-2.25,1.1,'columbus',1.05),person(world,-.1,-4.3,'king',1.12),person(world,2.15,-4.2,'queen',1.12));person(world,-4,-1.2,'crew',.9);person(world,4,-1.2,'crew',.9);}else{people.push(person(world,-.55,1.1,'columbus',1.05),person(world,-2.2,-4.3,'king',1.12),person(world,2.2,-4.2,'queen',1.12),person(world,4,-1.2,'crew',.88));}}
 else if(idx===2){const fleet=harbor(world);ships.push(...fleet);for(let i=0;i<12;i++)people.push(person(world,-10+(i%6)*4.1,-1.4+Math.floor(i/6)*1.3,'crew',.78));}
 else if(idx===3){const fleet=harbor(world);ships.push(...fleet);}
 else if(idx===4){animateWater=ocean(world,false);ships.push(ship(world,-4,-3,0),ship(world,0,-7,1),ship(world,4,-4,2));people.push(person(world,-3,0,'columbus',.95));}
 else if(idx===5){animateWater=ocean(world,true);coast(world,true);ships.push(ship(world,-3,-8,0),ship(world,2,-10,1));const lookout=person(world,-4,1.5,'crew',.7);lookout.position.y=3.6;people.push(lookout,person(world,-2,0,'columbus',.95));}
 else {coast(world);const landing=ship(world,-6,-7,0);landing.scale.set(.38,.38,.48);ships.push(landing);for(let i=0;i<5;i++)people.push(person(world,-4+i*1.7,-1+i*.15,i===0?'columbus':'crew',.85));for(let x of [-5,0,5]){const hut=new THREE.Mesh(new THREE.ConeGeometry(1.7,1.2,7),MAT('#a98251'));hut.position.set(x,1.8,1);world.add(hut);box(world,x,0,1,2.3,1.4,1.8,'#9b7954');box(world,x,1,1.92,.65,1.3,.08,'#4d3c2d');}for(let i=0;i<4;i++)people.push(person(world,-5+i*2.2,-.4,'lucayan',.82));}
 // Camera direction and scene-specific motion; every shot has its own establishing move.
 const camera=new THREE.PerspectiveCamera(62,1080/1920,.1,160);const duration=Math.max(1,Number(d.duration)||8);
 return t=>{const sceneStart=Number(d.start||0);if(t<sceneStart||t>=sceneStart+duration)return;const local=Math.max(0,t-sceneStart);const p=Math.min(1,local/duration),ease=p*p*(3-2*p);if(idx===0){camera.position.set(8-5*ease,5.2+Math.sin(p*Math.PI)*.6,14-7*ease);camera.lookAt(0,2,-3);}
 else if(idx===1){camera.position.set(1.5-1.2*ease,3.1,9-2*ease);camera.lookAt(0,1,-1.3);}
 else if(idx===2){camera.position.set(-9+18*ease,11,24-3*ease);camera.lookAt(0,1,-5);}
 else if(idx===3){camera.position.set(0,13,27-3*ease);camera.lookAt(0,1,-8);ships.forEach((s,i)=>{s.position.y=s.userData.baseY+.035*Math.sin(local*1.4+i);s.position.z=s.userData.baseZ-local*.22;s.position.x=s.userData.baseX+(i-1)*local*.035;});}
 else if(idx===4){camera.position.set(7*Math.sin(p*1.3),10,25-2*ease);camera.lookAt(0,1,-5);ships.forEach((s,i)=>{s.position.y=s.userData.baseY+.035*Math.sin(local*1.4+i);s.position.z=s.userData.baseZ+Math.sin(local*.65+i)*.08;s.rotation.z=Math.sin(local*.7+i)*.035;});}
 else if(idx===5){camera.position.set(7-5*ease,9,24-4*ease);camera.lookAt(0,1,-8);ships.forEach((s,i)=>{s.position.y=s.userData.baseY+.035*Math.sin(local*1.4+i);s.position.z=s.userData.baseZ+local*.13;s.rotation.y=.08*Math.sin(local+i);});}
 else {camera.position.set(-10+12*ease,9,20-3*ease);camera.lookAt(0,1,-3);}
 people.forEach((p,i)=>{p.rotation.y=.08*Math.sin(local*1.2+i);p.position.y=.025*Math.sin(local*2+i);(p.userData.arms||[]).forEach(({arm,side})=>{arm.rotation.z=arm.userData.baseRotation+side*.045*Math.sin(local*1.8+i+side);});});ships.forEach((s,i)=>{(s.userData.sails||[]).forEach((sail,j)=>{sail.rotation.y=.045*Math.sin(local*1.4+i+j);});if(s.userData.flag)s.userData.flag.rotation.y=Math.PI/2+.12*Math.sin(local*2+i);});
 animateWater(local);renderer.render(scene,camera);};
}

function buildGenericScene(renderer,d){
 const scene=new THREE.Scene(),world=new THREE.Group();scene.add(world);scene.background=new THREE.Color('#9ac9df');scene.fog=new THREE.Fog('#9ac9df',24,65);scene.add(new THREE.HemisphereLight('#fff', '#65766c',2));const sun=new THREE.DirectionalLight('#fff0ce',2.3);sun.position.set(-8,14,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.near=.5;sun.shadow.camera.far=60;sun.shadow.bias=-.00015;scene.add(sun);
 const words=d.title+' '+d.visual+' '+d.setting+' '+d.action+' '+(d.props||[]).join(' ')+' '+(d.objects||[]).join(' ')+' '+JSON.stringify(d.entities||[]);const {water,space,historic,forest,science}=detectEnvironment(words,d.type);
 const groundColor=space?'#263b6a':forest?'#557b4c':historic?'#9a8b75':science?'#647b83':'#9b9a83';
 if(space){scene.background.set('#111d3a');for(let i=0;i<130;i++){const x=Math.sin(i*9)*22,y=Math.cos(i*3)*13,z=-18+(i%7)*1.5;sphere(world,x,y,z,.025,.025,.025,'#fff',0);}}
 if(water){box(world,0,-.5,-11,28,1,10,groundColor);const waterMesh=new THREE.Mesh(new THREE.PlaneGeometry(30,25,40,40),MAT('#247f9e'));waterMesh.rotation.x=-Math.PI/2;waterMesh.position.set(0,-.08,3);world.add(waterMesh);}
 else if(!space) box(world,0,-.5,-3,28,1,30,groundColor);
 if(forest){for(let i=0;i<12;i++){const x=(i%4-1.5)*5.4,z=-12+Math.floor(i/4)*5;createProceduralEntity(world,{id:'background-tree-'+i,type:'tree',name:'Árbol tropical',position:[x,0,z],scale:.9+(i%3)*.18},i);}}
 if(historic){for(const side of [-1,1])createProceduralEntity(world,{id:'background-house-'+side,type:'building',name:'Casa medieval de piedra',position:[side*7,0,-13],scale:.72},side+2);box(world,0,.02,-5,18,.08,3,'#8a7c69');}
 if(science){cyl(world,0,-.08,-6,4.8,5.2,.28,'#68767c',48);cyl(world,0,.08,-6,3.8,4.1,.08,'#9ca8a9',48);for(let i=0;i<8;i++){const a=i*Math.PI/4;const light=cyl(world,Math.cos(a)*4.4,.18,-6+Math.sin(a)*4.4,.13,.13,.16,i%2?'#d8a44d':'#6ba4b3',12);light.material.emissive=new THREE.Color(i%2?'#80501d':'#174b5d');light.material.emissiveIntensity=.3;}}
 const entities=directScene(world,d);
 // En escenas acuáticas, edificios y vegetación permanecen en la franja de costa firme.
 if(water){entities.forEach(entity=>{const type=entity.userData.entity?.type;const support=String(entity.userData.entity?.support||'').toLowerCase();if(type==='building'||type==='tree'||support.includes('tierra')||support.includes('suelo firme')){entity.position.x=Math.max(-10,Math.min(10,entity.position.x));entity.position.z=Math.min(-11,entity.position.z);entity.position.y=0;entity.userData.basePosition.copy(entity.position);}});}
 const camera=new THREE.PerspectiveCamera(56,1080/1920,.1,180);const duration=Math.max(1,Number(d.duration)||8);
 const cameraPlan=String(d.camera||'').toLowerCase();
 // Microcortes cada 2,55 s: alterna distancia, altura y ángulo dentro de cada plano.
 return t=>{const sceneStart=Number(d.start||0);if(t<sceneStart||t>=sceneStart+duration)return;const local=Math.max(0,t-sceneStart),p=Math.min(1,local/duration),ease=p*p*(3-2*p);
  const shotIndex=Math.floor(local/2.55),shotProgress=(local%2.55)/2.55,shotEase=shotProgress*shotProgress*(3-2*shotProgress);
  animateEntities(entities,local);
  const targetId=String(d.camera_target||'');const targetEntity=entities.find(e=>e.userData.entity?.id===targetId);
  const subjects=entities.filter(e=>['human','animal','vehicle','ship','celestial'].includes(e.userData.entity?.type));
  const points=targetEntity?[targetEntity]:subjects.length?subjects:entities;
  const target=points.reduce((sum,e)=>sum.add(e.position),new THREE.Vector3()).multiplyScalar(1/Math.max(1,points.length));target.y+=1.05;
  const orbitAngle=(shotIndex%4)*Math.PI*.5+shotEase*.28+Math.sin(local*1.15)*.035;
  const distance=[12,8.5,14,9.5][shotIndex%4],height=[4.5,2.8,6.2,3.4][shotIndex%4];
  if(/cenital|aereo|desde arriba|vista superior/.test(cameraPlan)){camera.position.set(target.x+Math.cos(orbitAngle)*2.2,17+shotEase,target.z+Math.sin(orbitAngle)*7);}
  else if(/orbita|rode|gira alrededor|circular/.test(cameraPlan)){camera.position.set(target.x+Math.cos(orbitAngle)*distance,target.y+height,target.z+Math.sin(orbitAngle)*distance);}
  else if(/primer plano|detalle|acercamiento|zoom/.test(cameraPlan)){camera.position.set(target.x+Math.cos(orbitAngle)*6,target.y+1.3+shotEase*.5,target.z+Math.sin(orbitAngle)*6);}
  else {camera.position.set(target.x+Math.cos(orbitAngle)*distance,target.y+height+Math.sin(local*1.2)*.16,target.z+Math.sin(orbitAngle)*distance);}
  camera.lookAt(target);renderer.render(scene,camera);};
}
window.__renderReady = new Promise((resolve,reject)=>{window.__resolveSceneReady=resolve;window.__rejectSceneReady=reject;});
try {
 const canvas=document.querySelector('#world-canvas');
 if(!canvas) throw new Error('No se encontró el canvas compartido del motor 3D.');
 // HyperFrames captura el canvas después del repintado del navegador. Sin
 // preserveDrawingBuffer, WebGL puede descartar el framebuffer antes de la captura,
 // dejando el fondo HTML y los rótulos pero ninguna geometría 3D en el MP4.
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.setSize(1080,1920,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 const nodes=[...document.querySelectorAll('.scene')];
 const renderers=nodes.map((node,index)=>{
   const data=JSON.parse(node.dataset.scene);
   const entityCount=Array.isArray(data.entities)?data.entities.length:0;
   if(entityCount<2) throw new Error('La escena '+(index+1)+' no contiene suficientes entidades 3D: '+entityCount);
   const render=data.storyId==='columbus-1492'?buildScene(renderer,data):buildGenericScene(renderer,data);
   console.info('[BDM-3D] escena preparada',index+1,'entidades',entityCount,'inicio',data.start,'duración',data.duration);
   return render;
 });
 const timeline=window.__timelines?.['behind-del-mundo']||window.__timelines?.['columbus-3d-preview']||Object.values(window.__timelines||{})[0];
 const renderAt=time=>{renderers.forEach(render=>render(time));};
 window.__renderSceneAt=renderAt;
 if(!timeline) throw new Error('No se encontró la línea de tiempo GSAP; no se puede garantizar el movimiento de las escenas.');
 timeline.eventCallback('onUpdate',()=>renderAt(timeline.time()));
 // QC real del motor: fuerza el render de cada plano y exige geometría dibujada.
 // Así el trabajo no puede quedar verde si solo se exportan los rótulos HTML.
 const sceneDiagnostics=[];
 nodes.forEach((node,index)=>{
   const data=JSON.parse(node.dataset.scene);
   const sampleTime=Number(data.start||0)+Math.min(.8,Math.max(.25,Number(data.duration||1)*.2));
   renderAt(sampleTime);
   const triangles=Number(renderer.info.render.triangles||0);
   const calls=Number(renderer.info.render.calls||0);
   if(triangles<100||calls<2) throw new Error('QC 3D fallido en escena '+(index+1)+': solo '+triangles+' triángulos en '+calls+' llamadas de dibujo.');
   sceneDiagnostics.push({scene:index+1,entities:data.entities.length,triangles,calls});
 });
 window.__sceneDiagnostics=sceneDiagnostics;
 console.info('[BDM-3D-QC] todos los planos dibujados',JSON.stringify(sceneDiagnostics));
 renderAt(0);
 window.__playerReady=Promise.resolve();
 window.__resolveSceneReady();
} catch(error) {
 window.__renderError=String(error?.stack||error);
 window.__rejectSceneReady(error);
 throw error;
}
