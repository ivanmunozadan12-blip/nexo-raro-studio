import json, os, re, time, requests
from pathlib import Path

OUT = Path("public/assets")
OUT.mkdir(parents=True, exist_ok=True)
API = "https://commons.wikimedia.org/w/api.php"
HEADERS = {"User-Agent": "BehindDelMundoCinematicProof/1.0 (educational video project)"}
QUERIES = [
    ("scene-01.jpg", "Antikythera shipwreck underwater archaeology diver"),
    ("scene-02.jpg", "Antikythera mechanism fragments museum"),
    ("scene-03.jpg", "Antikythera mechanism gears close up"),
    ("scene-04.jpg", "Antikythera mechanism reconstruction gears"),
    ("scene-05.jpg", "Antikythera mechanism astronomical reconstruction"),
    ("scene-06.jpg", "Antikythera mechanism National Archaeological Museum Athens"),
]
ALLOWED = ("cc by", "cc-by", "public domain", "cc0", "cc zero")

def search(query):
    params = {
        "action":"query", "format":"json", "generator":"search", "gsrnamespace":6,
        "gsrsearch":query, "gsrlimit":15, "prop":"imageinfo",
        "iiprop":"url|size|extmetadata", "iiurlwidth":1920
    }
    response = requests.get(API, params=params, headers=HEADERS, timeout=45)
    response.raise_for_status()
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
        url=info.get("thumburl") or info.get("url")
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
    candidates.sort(key=lambda x:(min(x["width"],x["height"]),x["width"]*x["height"]), reverse=True)
    return candidates

credits=[]
for filename, query in QUERIES:
    path=OUT/filename
    if path.exists() and path.stat().st_size > 50000:
        continue
    found=search(query)
    if not found:
        # Broader fallback search, still restricted to reusable licenses.
        found=search("Antikythera mechanism")
    if not found:
        raise RuntimeError("No se encontró una imagen con licencia reutilizable para "+filename+" ("+query+")")
    selected=found[0]
    data=requests.get(selected["url"],headers=HEADERS,timeout=90)
    data.raise_for_status()
    if len(data.content)<50000:
        raise RuntimeError("Imagen demasiado pequeña: "+selected["title"])
    path.write_bytes(data.content)
    credits.append({"file":filename,**selected})
    print("Descargada:",filename,"<-",selected["title"],selected["license"],len(data.content),"bytes")
    time.sleep(1)
# Include existing images in credits when the job is retried.
existing={x["file"] for x in credits}
credits_path=Path("public/credits.json")
if credits_path.exists():
    old=json.loads(credits_path.read_text())
    credits=old+credits
credits_path.write_text(json.dumps(credits,ensure_ascii=False,indent=2))
print("Créditos guardados:",credits_path)
