#!/usr/bin/env python3
"""Daily editorial generation, Spanish narration, animated render and private delivery."""
import os, sys, json, re, subprocess, urllib.request, urllib.parse, datetime, pathlib, shutil, unicodedata
from zoneinfo import ZoneInfo

ROOT=pathlib.Path(__file__).resolve().parents[1]
API=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GROQ=os.environ["GROQ_API_KEY"]
MODEL=os.getenv("GROQ_MODEL","openai/gpt-oss-120b")
if urllib.parse.urlparse(API).hostname.split(".")[0]!="fnivzsazuovldhbkxrqv":
    raise SystemExit("SUPABASE_URL no corresponde al proyecto configurado de BEHIND DEL MUNDO.")
HEAD={"apikey":KEY,**({"Authorization":"Bearer "+KEY} if not KEY.startswith("sb_secret_") else {}),"Content-Type":"application/json","Prefer":"return=representation"}
def request(url,method="GET",body=None,headers=None):
    data=body if isinstance(body,(bytes,bytearray)) else (json.dumps(body).encode() if body is not None else None)
    req=urllib.request.Request(url,data=data,method=method,headers={**HEAD,**(headers or {})})
    with urllib.request.urlopen(req,timeout=90) as r:
        raw=r.read()
        return json.loads(raw) if raw else []
def db(table,query="",method="GET",body=None):
    return request(f"{API}/rest/v1/{table}{query}",method,body)
def run(args):
    subprocess.run(args,cwd=ROOT,check=True)
def slug(s):
    s=unicodedata.normalize("NFD",s.lower())
    s="".join(c for c in s if unicodedata.category(c)!="Mn")
    return re.sub(r"[^a-z0-9]+","-",s).strip("-")
def groq(messages):
    payload={"model":MODEL,"messages":messages,"temperature":0.72,"max_tokens":6500,"response_format":{"type":"json_object"}}
    req=urllib.request.Request("https://api.groq.com/openai/v1/chat/completions",data=json.dumps(payload).encode(),headers={"Authorization":"Bearer "+GROQ,"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=120) as r: data=json.loads(r.read())
    content=data["choices"][0]["message"]["content"].strip()
    content=re.sub(r"^\s*```(?:json)?|\s*```$","",content).strip()
    return json.loads(content)

now=datetime.datetime.now(ZoneInfo("Europe/Madrid"))
today=now.strftime("%Y-%m-%d")
slot=os.getenv("VIDEO_SLOT","how-it-works")
slots={
 "how-it-works":("07:30","Cómo funciona","Explica cómo funciona un objeto, mecanismo, tecnología o fenómeno que usamos o vemos a diario."),
 "inside":("14:30","Por dentro","Entra visualmente en el interior de un lugar, instalación, edificio, transporte o infraestructura y explica su funcionamiento."),
 "curiosities":("20:30","Curiosidades","Resuelve una pregunta sorprendente, un porqué poco conocido o un dato contraintuitivo con rigor.")
}
if slot not in slots: raise SystemExit("VIDEO_SLOT inválido: "+slot)
clock,category,angle=slots[slot]
settings=db("channel_settings","?brand_slug=eq.nexo-raro&select=id,user_id,channel_name,require_approval,auto_publish_enabled&limit=1")
if not settings: raise SystemExit("No hay un canal configurado en el estudio.")
user=settings[0]["user_id"]
memory=db("editorial_memory","?user_id=eq."+user+"&select=topic,angle,summary,memory_status&order=created_at.desc&limit=80")
excluded=[{"tema":x["topic"],"enfoque":x.get("angle") or ""} for x in memory if x["memory_status"] in ("produced","rejected")]
series=db("series","?user_id=eq."+user+"&is_active=eq.true&select=id,slug,title")
series_slug={"how-it-works":"nadie-te-lo-explica","inside":"detras-de-la-puerta","curiosities":"como-es-posible"}[slot]
series_row=next((x for x in series if x["slug"]==series_slug),series[0] if series else None)
# Local slot is the idempotency key; the offset is resolved by Python's timezone database.
local_slot=datetime.datetime.combine(now.date(),datetime.time.fromisoformat(clock),tzinfo=ZoneInfo("Europe/Madrid"))
scheduled=local_slot.isoformat()
existing=db("production_jobs","?user_id=eq."+user+"&scheduled_for=eq."+urllib.parse.quote(scheduled,safe="")+"&select=id,status,script_id&limit=1")
if existing and existing[0]["status"]=="ready":
    print("Este espacio diario ya tiene un vídeo terminado. No se duplica."); sys.exit(0)
if existing and existing[0]["status"] in ("queued","voicing","rendering"):
    raise SystemExit("Ya existe un render activo para este espacio diario.")
if existing:
    job=db("production_jobs","?id=eq."+existing[0]["id"],"PATCH",{"status":"voicing","attempt_count":1,"started_at":now.isoformat(),"completed_at":None,"error_message":None})[0]
else:
    job=db("production_jobs","", "POST",{"user_id":user,"scheduled_for":scheduled,"status":"voicing","attempt_count":1,"started_at":now.isoformat()})[0]
script_id=None; storage_path=None
work=ROOT/"renders"/(today+"-"+slot)
work.mkdir(parents=True,exist_ok=True)
try:
    prompt=f"""Eres director editorial de BEHIND DEL MUNDO. Crea UN vídeo de divulgación visual en español de España para el espacio {clock} ({category}). Enfoque: {angle}
Duración 60–72 segundos; narración de 125–155 palabras; gancho inmediato, explicación progresiva, una revelación y cierre memorable. Voz: narrador masculino de España, cercano, curioso y cinematográfico. No hay presentador ni personaje recurrente.
No repitas estos temas o enfoques ya cubiertos/excluidos: {json.dumps(excluded[:55],ensure_ascii=False)}
Elige un tema concreto, no genérico, interesante para público amplio. No inventes datos. Crea 8 escenas en orden, cada una ilustra literalmente el fragmento de voz correspondiente. El vídeo se dibuja mediante Python/Pillow como animación vectorial, NO fotografías ni slideshow. visual_type debe ser uno de: illustration,machine,object_cutaway,interior,building_cutaway,facility,molecule,science,process,diagram,timeline,history,fact,number,stat,map,location,abstract. Usa variedad visual y composición.
Cada escena lleva headline (máx 6 palabras), subtitle, visual_type, narration_excerpt (fragmento literal), callout, labels (2–5 etiquetas), accent (hex). Para fact/number/stat incluye metric {{"value":"...","label":"...","detail":"..."}}.
Incluye 3 fuentes fiables con title y URL HTTPS real. No uses URLs inventadas.
Devuelve SOLO JSON: {{"title":"...","hook":"...","category":"{slot}","narration":"...","caption":"...","sources":[{{"title":"...","url":"https://..."}}],"scenes":[{{"headline":"...","subtitle":"...","visual_type":"...","narration_excerpt":"...","callout":"...","labels":["..."],"accent":"#62d9cf","metric":{{"value":"...","label":"...","detail":"..."}}}}]}}"""
    script=groq([{"role":"system","content":"Devuelve exclusivamente JSON válido. Prioriza exactitud factual; si no conoces una cifra, no la inventes."},{"role":"user","content":prompt}])
    if len(script.get("scenes",[]))!=8: raise ValueError("El guion debe contener exactamente 8 escenas.")
    words=len(script["narration"].split())
    if not 110<=words<=175: raise ValueError(f"Narración fuera de rango: {words} palabras.")
    if len({s.get("visual_type") for s in script["scenes"]})<4: raise ValueError("Las escenas no tienen variedad visual suficiente.")
    if len(script.get("sources",[]))<3: raise ValueError("Faltan tres fuentes documentales.")
    if any(not s.get("narration_excerpt") or s["narration_excerpt"] not in script["narration"] for s in script["scenes"]): raise ValueError("Los fragmentos de escena deben aparecer literalmente en la narración.")
    script["category"]=slot
    script_row=db("scripts","", "POST",{"user_id":user,"series_id":series_row["id"] if series_row else None,"title":script["title"],"hook":script.get("hook",""),"narration":script["narration"],"visual_plan":{"scenes":script["scenes"]},"source_notes":script["sources"],"target_seconds":66,"status":"in_production"})[0]
    script_id=script_row["id"]
    db("production_jobs","?id=eq."+job["id"],"PATCH",{"script_id":script_id})
    voice=work/"voice.mp3"; srt=work/"voice.srt"
    run(["python","-m","edge_tts","--voice","es-ES-AlvaroNeural","--rate=+5%","--text",script["narration"],"--write-media",str(voice),"--write-subtitles",str(srt)])
    if voice.stat().st_size<1500: raise ValueError("La pista de voz está vacía.")
    voice_duration=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(voice)],text=True))
    if not 40<=voice_duration<=71: raise ValueError(f"Duración de voz no válida: {voice_duration:.1f}s.")
    def secs(v):
        m=re.match(r"(\d+):(\d{2}):(\d{2}),(\d{3})",v)
        return int(m[1])*3600+int(m[2])*60+int(m[3])+int(m[4])/1000 if m else 0
    captions=[]
    for block in re.split(r"\r?\n\s*\r?\n",srt.read_text()):
        lines=block.splitlines(); ix=next((i for i,x in enumerate(lines) if "-->" in x),-1)
        if ix>=0:
            a,b=[x.strip() for x in lines[ix].split("-->")]
            captions.append({"start":secs(a),"end":secs(b),"text":" ".join(lines[ix+1:])})
    if not captions: raise ValueError("No se recibieron subtítulos temporizados.")
    script["captions"]=captions
    script_json=work/"script.json"; script_json.write_text(json.dumps(script,ensure_ascii=False),encoding="utf-8")
    music=work/"music.wav"; silent=work/"silent.mp4"; final=work/"behind-del-mundo.mp4"
    duration=max(60,int(voice_duration+1.999))
    run(["python","engine/audio_bed.py","--duration",str(duration),"--output",str(music)])
    db("production_jobs","?id=eq."+job["id"],"PATCH",{"status":"rendering"})
    run(["python","engine/render_video.py","--script",str(script_json),"--voice",str(voice),"--output",str(silent)])
    run(["ffmpeg","-y","-v","error","-i",str(silent),"-i",str(voice),"-i",str(music),"-filter_complex",f"[1:a]volume=1.0[v];[2:a]volume=0.22,afade=t=in:st=0:d=2,afade=t=out:st={max(0,voice_duration-3)}:d=3[m];[v][m]amix=inputs=2:duration=longest:dropout_transition=2[a]","-map","0:v:0","-map","[a]","-c:v","copy","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart",str(final)])
    probe=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration:stream=codec_type,width,height","-of","json",str(final)],text=True))
    actual=float(probe["format"]["duration"]); video=next((x for x in probe["streams"] if x["codec_type"]=="video"),{})
    if video.get("width")!=1080 or video.get("height")!=1920 or not any(x["codec_type"]=="audio" for x in probe["streams"]) or not 60<=actual<=72: raise ValueError("El control de calidad del MP4 no se ha superado.")
    storage_path=f"{user}/{today}/{today.replace('-','')}-{slot}.mp4"
    data=final.read_bytes()
    request(API+"/storage/v1/object/nexo-videos/"+"/".join(urllib.parse.quote(x,safe="") for x in storage_path.split("/")),"POST",data,{"Content-Type":"video/mp4","x-upsert":"true"})
    video_row=db("videos","", "POST",{"user_id":user,"job_id":job["id"],"script_id":script_id,"storage_path":storage_path,"duration_seconds":actual,"width":1080,"height":1920,"mime_type":"video/mp4","quality_check":{"passed":True,"has_audio":True,"voice":"es-ES-AlvaroNeural","background_audio":True,"renderer":"Python Pillow + NumPy + FFmpeg","scene_count":8,"source_count":len(script["sources"]),"word_count":words}})[0]
    db("editorial_memory","", "POST",{"user_id":user,"script_id":script_id,"topic":script["title"],"topic_key":slug(script["title"]),"angle":script.get("hook",category),"summary":script["narration"][:1200],"source_urls":script["sources"],"memory_status":"produced"})
    db("scripts","?id=eq."+script_id,"PATCH",{"status":"completed"})
    db("social_posts","", "POST",[{"user_id":user,"video_id":video_row["id"],"platform":p,"caption":script.get("caption",script["title"]),"status":"draft"} for p in ("youtube","tiktok")])
    db("production_jobs","?id=eq."+job["id"],"PATCH",{"status":"ready","completed_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"error_message":None})
    print(f"VÍDEO LISTO: {script['title']} · {actual:.1f}s · {storage_path}. Queda privado para revisión; no se publica automáticamente.")
except Exception as e:
    message=str(e)[:1600]
    if storage_path:
        try: request(API+"/storage/v1/object/nexo-videos/"+"/".join(urllib.parse.quote(x,safe="") for x in storage_path.split("/")),"DELETE",headers={"apikey":KEY,**({"Authorization":"Bearer "+KEY} if not KEY.startswith("sb_secret_") else {})})
        except Exception: pass
    if script_id:
        try: db("scripts","?id=eq."+script_id,"PATCH",{"status":"approved"})
        except Exception: pass
    db("production_jobs","?id=eq."+job["id"],"PATCH",{"status":"failed","error_message":message,"completed_at":datetime.datetime.now(datetime.timezone.utc).isoformat()})
    raise
finally:
    shutil.rmtree(work,ignore_errors=True)
