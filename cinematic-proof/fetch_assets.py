import json, os, re, time, requests
from pathlib import Path

OUT = Path("public/assets")
OUT.mkdir(parents=True, exist_ok=True)
API = "https://commons.wikimedia.org/w/api.php"
HEADERS = {"User-Agent": "BehindDelMundoCinematicProof/1.0 (https://github.com/ivanmunozadan12-blip/nexo-raro-studio)"}
QUERIES = [
    ("scene-01.jpg", "Anticythera shipwreck Standard diving dress 1901"),
    ("scene-02.jpg", "Antikythera mechanism museum fragments bronze"),
    ("scene-03.jpg", "Antikythera mechanism gears detail close up"),
    ("scene-04.jpg", "Antikythera mechanism reconstruction model gears"),
    ("scene-05.jpg", "Antikythera mechanism astronomical dial reconstruction"),
    ("scene-06.jpg", "Antikythera mechanism National Archaeological Museum Athens display"),
]
ALLOWED = ("cc by", "cc-by", "public domain", "cc0", "cc zero")

def get_with_retry(url, params=None, timeout=45):
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

def search(query):
    params = {
        "action":"query", "format":"json", "generator":"search", "gsrnamespace":6,
        "gsrsearch":query, "gsrlimit":15, "prop":"imageinfo",
        "iiprop":"url|size|extmetadata", "iiurlwidth":1920
    }
    response = get_with_retry(API, params=params, timeout=45)
    pages = list(response.json().get("query",{}).get("pages",{}).values())
    candidates=[]
    for page in pages:
        info=(page.get("imageinfo") or [{}])[0]
        meta=info.get("extmetadata",{})
        license_name=re.sub("<[^>]+>","",meta.get("LicenseShortName",{}).get("value",""))
        if not any(term in license_name.lower() for term in ALLOWED):
            continue
        width=int(info.get("width",0)); height=int(info.get("height",0))
        if width < 1000 or height < 600:
            continue
        url=info.get("url") or info.get("thumburl")
        if not url or not url.lower().split("?")[0].endswith((".jpg",".jpeg",".png",".webp")):
            continue
        candidates.append({
            "title":page.get("title",""),"url":url,"width":width,"height":height,
            "license":license_name,
            "artist":re.sub("<[^>]+>","",meta.get("Artist",{}).get("value","Unknown")),
            "license_url":meta.get("LicenseUrl",{}).get("value",""),
            "description":re.sub("<[^>]+>","",meta.get("ImageDescription",{}).get("value",""))[:500]
        })
    # Prefer landscape, large and relevant title matches.
    terms=[w.lower() for w in re.findall(r"[a-zA-Z]{4,}",query) if w.lower() not in {"mechanism","antikythera","standard","dress"}]
    def relevance(item):
        hay=(item["title"]+" "+item["description"]).lower()
        return sum(1 for term in terms if term in hay)
    candidates.sort(key=lambda x:(relevance(x),min(x["width"],x["height"]),x["width"]*x["height"]), reverse=True)
    return candidates

credits=[]
used_titles=set()
for filename, query in QUERIES:
    path=OUT/filename
    if path.exists() and path.stat().st_size > 50000:
        continue
    found=[item for item in search(query) if item["title"] not in used_titles]
    if not found:
        # Broader fallback search, still restricted to reusable licenses.
        found=[item for item in search("Antikythera mechanism museum gears") if item["title"] not in used_titles]
    if not found:
        raise RuntimeError("No se encontró una imagen con licencia reutilizable para "+filename+" ("+query+")")
    selected=found[0]
    used_titles.add(selected["title"])
    time.sleep(3)
    data=get_with_retry(selected["url"],timeout=90)
    if len(data.content)<50000:
        raise RuntimeError("Imagen demasiado pequeña: "+selected["title"])
    path.write_bytes(data.content)
    credits.append({"file":filename,**selected})
    print("Descargada:",filename,"<-",selected["title"],selected["license"],len(data.content),"bytes")
    time.sleep(3)
# Include existing images in credits when the job is retried.
existing={x["file"] for x in credits}
credits_path=Path("public/credits.json")
if credits_path.exists():
    old=json.loads(credits_path.read_text())
    credits=old+credits
credits_path.write_text(json.dumps(credits,ensure_ascii=False,indent=2))
print("Créditos guardados:",credits_path)
