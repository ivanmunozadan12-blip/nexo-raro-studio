#!/usr/bin/env python3
"""Optional automatic publishing to YouTube and TikTok after MP4 quality checks."""
import argparse, datetime, json, os, pathlib, time, urllib.parse, urllib.request, urllib.error

API=os.environ.get("SUPABASE_URL","").rstrip("/")
KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","")
HEAD={"apikey":KEY,"Authorization":"Bearer "+KEY,"Content-Type":"application/json","Prefer":"return=representation"}

def http(url, method="GET", body=None, headers=None, timeout=120):
    data=body if isinstance(body,(bytes,bytearray)) else (json.dumps(body).encode() if body is not None else None)
    req=urllib.request.Request(url,data=data,method=method,headers=headers or {})
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status,r.headers, r.read()
    except urllib.error.HTTPError as e:
        return e.code,e.headers,e.read()

def db_patch(video_id, platform, status, external_id=None, error=None):
    if not API or not KEY: return
    query="?video_id=eq."+urllib.parse.quote(video_id)+"&platform=eq."+platform
    payload={"status":status,"error_message":error}
    if external_id: payload["external_post_id"]=external_id
    if status=="published": payload["published_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
    http(API+"/rest/v1/social_posts"+query,"PATCH",payload,HEAD)

def google_token():
    cid=os.environ["YOUTUBE_CLIENT_ID"]; secret=os.environ["YOUTUBE_CLIENT_SECRET"]; refresh=os.environ["YOUTUBE_REFRESH_TOKEN"]
    form=urllib.parse.urlencode({"client_id":cid,"client_secret":secret,"refresh_token":refresh,"grant_type":"refresh_token"}).encode()
    code,_,raw=http("https://oauth2.googleapis.com/token","POST",form,{"Content-Type":"application/x-www-form-urlencoded"})
    data=json.loads(raw or b"{}")
    if code!=200 or not data.get("access_token"): raise RuntimeError("YouTube OAuth: "+str(data)[:500])
    return data["access_token"]

def youtube_upload(path,title,caption):
    token=google_token(); size=path.stat().st_size
    metadata={"snippet":{"title":title[:100],"description":(caption+"\n\n#BehindDelMundo #Curiosidades #ComoFunciona")[:5000],"categoryId":"27","tags":["Behind del Mundo","curiosidades","cómo funciona","divulgación"]},"status":{"privacyStatus":os.getenv("YOUTUBE_PRIVACY","public"),"selfDeclaredMadeForKids":False}}
    code,headers,raw=http("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status","POST",metadata,{"Authorization":"Bearer "+token,"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":"video/mp4","X-Upload-Content-Length":str(size)})
    upload_url=headers.get("Location")
    if code not in (200,201) or not upload_url: raise RuntimeError("No se pudo iniciar la subida a YouTube: "+raw.decode(errors="replace")[:500])
    chunk=8*1024*1024; sent=0
    with path.open("rb") as f:
        while sent<size:
            data=f.read(min(chunk,size-sent)); end=sent+len(data)-1
            code,_,raw=http(upload_url,"PUT",data,{"Content-Type":"video/mp4","Content-Length":str(len(data)),"Content-Range":f"bytes {sent}-{end}/{size}"},timeout=300)
            if code not in (200,201,308): raise RuntimeError("Error subiendo a YouTube: "+raw.decode(errors="replace")[:500])
            sent=end+1
            if code in (200,201):
                result=json.loads(raw or b"{}")
                return {"url":"https://www.youtube.com/watch?v="+result.get("id",""),"external_id":result.get("id",""),"status":"published"}
    raise RuntimeError("YouTube no confirmó el vídeo.")

def tiktok_token():
    # Keep rotated TikTok tokens in a private service-role-only table.
    user=os.getenv("CHANNEL_USER_ID","")
    saved=None
    if API and KEY and user:
        query="?user_id=eq."+urllib.parse.quote(user)+"&platform=eq.tiktok&select=access_token,refresh_token,expires_at&limit=1"
        _,_,raw=http(API+"/rest/v1/social_connections"+query,"GET",headers=HEAD)
        rows=json.loads(raw or b"[]"); saved=rows[0] if rows else None
    access=(saved or {}).get("access_token") or os.getenv("TIKTOK_ACCESS_TOKEN","")
    refresh=(saved or {}).get("refresh_token") or os.getenv("TIKTOK_REFRESH_TOKEN","")
    expiry=(saved or {}).get("expires_at")
    expired=not access or not expiry or datetime.datetime.fromisoformat(expiry.replace("Z","+00:00"))<datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=5)
    if expired and refresh:
        client=os.environ["TIKTOK_CLIENT_KEY"]; secret=os.environ["TIKTOK_CLIENT_SECRET"]
        form=urllib.parse.urlencode({"client_key":client,"client_secret":secret,"grant_type":"refresh_token","refresh_token":refresh}).encode()
        code,_,raw=http("https://open.tiktokapis.com/v2/oauth/token/","POST",form,{"Content-Type":"application/x-www-form-urlencoded"})
        data=json.loads(raw or b"{}")
        if code!=200 or data.get("error"): raise RuntimeError("TikTok OAuth: "+str(data)[:500])
        access=data["access_token"]; refresh=data.get("refresh_token",refresh)
        expires=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=int(data.get("expires_in",86400)))).isoformat()
        if API and KEY and user:
            payload={"user_id":user,"platform":"tiktok","access_token":access,"refresh_token":refresh,"expires_at":expires}
            _,_,raw=http(API+"/rest/v1/social_connections?on_conflict=user_id,platform","POST",payload,{**HEAD,"Prefer":"resolution=merge-duplicates,return=minimal"})
    if not access: raise RuntimeError("Falta TIKTOK_ACCESS_TOKEN o una conexión TikTok.")
    return access

def tiktok_upload(path,title):
    token=tiktok_token()
    code,_,raw=http("https://open.tiktokapis.com/v2/post/publish/creator_info/query/","POST",{},{"Authorization":"Bearer "+token,"Content-Type":"application/json; charset=UTF-8"})
    info=json.loads(raw or b"{}")
    if code!=200 or info.get("error",{}).get("code")!="ok": raise RuntimeError("TikTok creator info: "+str(info)[:500])
    options=info.get("data",{}).get("privacy_level_options",[])
    privacy=os.getenv("TIKTOK_PRIVACY","PUBLIC_TO_EVERYONE")
    if privacy not in options: privacy="SELF_ONLY" if "SELF_ONLY" in options else (options[0] if options else "")
    if not privacy: raise RuntimeError("TikTok no devolvió opciones de privacidad.")
    size=path.stat().st_size; chunk=10*1024*1024
    count=(size+chunk-1)//chunk
    payload={"post_info":{"title":title[:2200],"privacy_level":privacy,"disable_duet":False,"disable_comment":False,"disable_stitch":False,"is_aigc":True},"source_info":{"source":"FILE_UPLOAD","video_size":size,"chunk_size":chunk,"total_chunk_count":count}}
    code,_,raw=http("https://open.tiktokapis.com/v2/post/publish/video/init/","POST",payload,{"Authorization":"Bearer "+token,"Content-Type":"application/json; charset=UTF-8"})
    init=json.loads(raw or b"{}")
    if code!=200 or init.get("error",{}).get("code")!="ok": raise RuntimeError("TikTok no aceptó la publicación: "+str(init)[:700])
    upload=init["data"]["upload_url"]; publish_id=init["data"]["publish_id"]
    sent=0
    with path.open("rb") as f:
        while sent<size:
            data=f.read(min(chunk,size-sent)); end=sent+len(data)-1
            code,_,raw=http(upload,"PUT",data,{"Content-Type":"video/mp4","Content-Length":str(len(data)),"Content-Range":f"bytes {sent}-{end}/{size}"},timeout=300)
            if code not in (200,201,206): raise RuntimeError("Error transfiriendo vídeo a TikTok: "+raw.decode(errors="replace")[:500])
            sent=end+1
    data={}
    for attempt in range(10):
        code,_,raw=http("https://open.tiktokapis.com/v2/post/publish/status/fetch/","POST",{"publish_id":publish_id},{"Authorization":"Bearer "+token,"Content-Type":"application/json; charset=UTF-8"})
        status=json.loads(raw or b"{}")
        if code!=200 or status.get("error",{}).get("code")!="ok": raise RuntimeError("No se pudo consultar el estado TikTok: "+str(status)[:500])
        data=status.get("data",{})
        if data.get("status") in ("PUBLISH_COMPLETE","FAILED"): break
        time.sleep(8)
    state=data.get("status","PROCESSING_UPLOAD")
    if state=="FAILED": raise RuntimeError("TikTok no pudo procesar el vídeo: "+str(data.get("fail_reason","error desconocido")))
    return {"url":"TikTok publish_id="+publish_id+" · "+str(state)+" · privacidad "+privacy,"external_id":publish_id,"status":"published" if state=="PUBLISH_COMPLETE" else "publishing"}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--file",required=True); p.add_argument("--title",required=True); p.add_argument("--caption",default=""); p.add_argument("--video-id",default="")
    a=p.parse_args(); path=pathlib.Path(a.file); results={}
    if os.getenv("YOUTUBE_CLIENT_ID") and os.getenv("YOUTUBE_CLIENT_SECRET") and os.getenv("YOUTUBE_REFRESH_TOKEN"):
        try: results["youtube"]=youtube_upload(path,a.title,a.caption)
        except Exception as e: results["youtube"]={"status":"failed","error":str(e)[:1200]}
    else: results["youtube"]={"status":"not_configured","error":"Faltan credenciales OAuth de YouTube."}
    if os.getenv("TIKTOK_CLIENT_KEY") and os.getenv("TIKTOK_CLIENT_SECRET") and (os.getenv("TIKTOK_REFRESH_TOKEN") or os.getenv("TIKTOK_ACCESS_TOKEN")):
        try: results["tiktok"]=tiktok_upload(path,a.title)
        except Exception as e: results["tiktok"]={"status":"failed","error":str(e)[:1200]}
    else: results["tiktok"]={"status":"not_configured","error":"Faltan credenciales de Content Posting API."}
    if a.video_id:
        for platform,result in results.items():
            if result["status"] in ("published","publishing","failed"):
                try: db_patch(a.video_id,platform,result["status"],result.get("external_id"),result.get("error"))
                except Exception as e: print("No se pudo actualizar el estado social:",str(e))
    print(json.dumps(results,ensure_ascii=False))
if __name__=="__main__": main()
