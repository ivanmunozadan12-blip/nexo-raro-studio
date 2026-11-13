import json, re, time, requests
from io import BytesIO
from pathlib import Path
from PIL import Image

OUT = Path("public/assets")
OUT.mkdir(parents=True, exist_ok=True)
API = "https://commons.wikimedia.org/w/api.php"
HEADERS = {"User-Agent": "BehindDelMundoCinematicProof/1.0 (https://github.com/ivanmunozadan12-blip/nexo-raro-studio)"}
ASSETS = [
    ("scene-01.jpg", "Anticythera shipwreck. Standard diving dress.jpg"),
    ("scene-02.jpg", "The Antikythera Mechanism (3471161471).jpg"),
    ("scene-03.jpg", "Mecanismo de Anticitera detalle.JPG"),
    ("scene-04.jpg", "Rekonstrukce Antikythery.jpg"),
    ("scene-05.jpg", "Antikythera mechanism frontview, 1st-2nd century BC, Greece (model).jpg"),
    ("scene-06.jpg", "Antikythera Mechanism (NAMA) 2017.jpg"),
]
ALLOWED = ("cc by", "cc-by", "public domain", "cc0", "cc zero")

def get_with_retry(url, params=None, timeout=60):
    for attempt in range(6):
        response=requests.get(url,params=params,headers=HEADERS,timeout=timeout)
        if response.status_code != 429 and response.status_code < 500:
            response.raise_for_status()
            return response
        if attempt == 5:
            response.raise_for_status()
        wait=int(response.headers.get("Retry-After","0") or 0) or min(60,5*(2**attempt))
        print("HTTP",response.status_code,"esperando",wait,"s antes de reintentar",url)
        time.sleep(wait)
    raise RuntimeError("No se pudo descargar el recurso tras varios intentos")

def exact_asset(file_title):
    params={
        "action":"query","format":"json","titles":"File:"+file_title,
        "prop":"imageinfo","iiprop":"url|size|extmetadata"
    }
    response=get_with_retry(API,params=params)
    pages=list(response.json().get("query",{}).get("pages",{}).values())
    if not pages or "missing" in pages[0]:
        raise RuntimeError("No existe el archivo de Wikimedia: "+file_title)
    page=pages[0]
    info=(page.get("imageinfo") or [{}])[0]
    meta=info.get("extmetadata",{})
    license_name=re.sub("<[^>]+>","",meta.get("LicenseShortName",{}).get("value",""))
    if not any(term in license_name.lower() for term in ALLOWED):
        raise RuntimeError("Licencia no admitida para "+file_title+": "+license_name)
    width=int(info.get("width",0)); height=int(info.get("height",0))
    if width<1000 or height<600:
        raise RuntimeError("Resolución insuficiente para vídeo vertical: "+file_title)
    return {
        "title":page.get("title","File:"+file_title),
        "url":info.get("url"),
        "width":width,"height":height,
        "license":license_name,
        "artist":re.sub("<[^>]+>","",meta.get("Artist",{}).get("value","Unknown")),
        "license_url":meta.get("LicenseUrl",{}).get("value",""),
        "description":re.sub("<[^>]+>","",meta.get("ImageDescription",{}).get("value",""))[:500],
        "source_page":"https://commons.wikimedia.org/wiki/"+("File:"+file_title).replace(" ","_")
    }

credits=[]
used=set()
for filename, file_title in ASSETS:
    if file_title in used:
        raise RuntimeError("Se ha repetido una imagen: "+file_title)
    used.add(file_title)
    path=OUT/filename
    selected=exact_asset(file_title)
    time.sleep(2)
    data=get_with_retry(selected["url"],timeout=90)
    if len(data.content)<50000:
        raise RuntimeError("Imagen demasiado pequeña: "+file_title)
    try:
        image=Image.open(BytesIO(data.content)).convert("RGB")
        if image.width<1000 or image.height<600:
            raise RuntimeError("La imagen descargada no alcanza la resolución mínima: "+file_title)
        image.save(path,"JPEG",quality=94,optimize=True,progressive=True)
    except Exception as error:
        raise RuntimeError("No se pudo convertir la imagen "+file_title+": "+str(error))
    credits.append({"file":filename,**selected})
    print("Descargada y convertida:",filename,"<-",selected["title"],selected["license"],image.width,"x",image.height,path.stat().st_size,"bytes")
    time.sleep(2)

Path("public/credits.json").write_text(json.dumps(credits,ensure_ascii=False,indent=2))
print("Seis fotografías distintas y sus licencias guardadas en public/credits.json")
