import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=JSON.parse(await readFile(path.join(root,'scripts','columbus-test-script.json'),'utf8'));
const work=path.join(root,'.artifacts','columbus-visual-test');
await mkdir(work,{recursive:true});
await run('npx',['esbuild','scripts/scene-engine.js','--bundle','--format=iife','--minify','--outfile='+path.join(work,'scene-engine.bundle.js')],root);
const engineTag='<script src="scene-engine.bundle.js"></script>';
const duration=4.5;
const escape=value=>String(value||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clips=fixture.scenes.map((scene,index)=>{
 const start=index*duration;
 const data=escape(JSON.stringify({title:fixture.title,visual:scene.visual,setting:scene.setting,action:scene.action,camera:scene.camera,continuity:scene.continuity,characters:scene.characters,props:scene.props,objects:scene.objects,type:scene.scene_type,index,start,duration,storyId:'columbus-1492'}));
 return '<section id="scene-'+(index+1)+'" class="clip scene" data-start="'+start+'" data-duration="'+duration+'" data-scene="'+data+'"><div class="brand-mark">BEHIND <i>DEL MUNDO</i></div><div class="scene-copy"><h1>'+escape(scene.overlay)+'</h1></div></section>';
}).join('');
const total=duration*fixture.scenes.length;
const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=1080,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#9ac9df;font-family:Arial,sans-serif}#root{position:relative;width:1080px;height:1920px}.scene{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;isolation:isolate;z-index:2;background:transparent}.world-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0}.brand-mark{position:absolute;z-index:4;top:82px;left:70px;font:900 25px Arial;letter-spacing:5px;color:white;text-shadow:0 3px 12px #16334f}.brand-mark i{font-style:normal;color:#ffcf54}.scene-copy{position:absolute;z-index:4;left:70px;right:70px;top:270px}.scene h1{font-size:76px;line-height:1.02;font-weight:950;color:white;-webkit-text-stroke:2px #172b42;text-shadow:0 5px 0 #172b42,0 9px 24px #102a43}</style></head><body><div id="root" data-composition-id="columbus-3d-preview" data-start="0" data-duration="'+total+'" data-width="1080" data-height="1920"><canvas id="world-canvas" class="world-canvas"></canvas>'+clips+'<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script><script>const tl=gsap.timeline({paused:true});document.querySelectorAll(".scene").forEach((e,i)=>{tl.fromTo(e,{opacity:0},{opacity:1,duration:.35},Number(e.dataset.start));tl.to(e,{opacity:0,duration:.25},Number(e.dataset.start)+Number(e.dataset.duration)-.25);if(i>0){tl.to("#world-canvas",{opacity:0,duration:.12},Number(e.dataset.start)-.12);tl.to("#world-canvas",{opacity:1,duration:.18},Number(e.dataset.start));}});tl.set({}, {},'+total+');window.__timelines={"columbus-3d-preview":tl};</script>'+engineTag+'</div></body></html>';
async function run(bin,args,cwd){await new Promise((resolve,reject)=>{const p=spawn(bin,args,{cwd,stdio:'inherit'});p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(bin+' exited '+code)));});}
const lintDir=path.join(work,'lint-check');await mkdir(lintDir,{recursive:true});
await writeFile(path.join(lintDir,'index.html'),html.replace(engineTag,''));
await run('npx',['--yes','hyperframes@0.9.37','lint'],lintDir);
await writeFile(path.join(work,'index.html'),html);
const output=path.join(work,'columbus-3d-preview.mp4');
await run('npx',['--yes','hyperframes@0.9.37','render','-c','index.html','-o',output,'--fps','24','--quality','standard','--workers','1'],work);
await run('ffmpeg',['-y','-i',output,'-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',output+'.tmp.mp4'],work);
await run('node',['-e',`const {execFileSync}=require('node:child_process');const p=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',process.argv[1]],{encoding:'utf8'}));const v=p.streams.find(x=>x.codec_type==='video');if(!v||v.width!==1080||v.height!==1920||Number(p.format.duration)<30)process.exit(2);console.log('QC visual OK:',p.format.duration,'s',v.width+'x'+v.height);`,'--',output+'.tmp.mp4'],work);
await (await import('node:fs/promises')).rename(output+'.tmp.mp4',output);
console.log('Columbus 3D preview ready:',output);
