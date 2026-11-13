import argparse,json,re
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--script',required=True);p.add_argument('--srt',required=True)
a=p.parse_args()

def sec(s):
 m=re.match(r'(\d+):(\d{2}):(\d{2}),(\d{3})',s)
 return int(m[1])*3600+int(m[2])*60+int(m[3])+int(m[4])/1000 if m else 0

def phrases(text,max_words=6):
 result=[]
 for sentence in re.split(r'(?<=[,;.!?])\s+',text.strip()):
  words=sentence.split()
  while words:
   result.append(' '.join(words[:max_words]))
   words=words[max_words:]
 return [x for x in result if x]

items=[]
for block in re.split(r'\r?\n\s*\r?\n',Path(a.srt).read_text(encoding='utf-8')):
 lines=block.splitlines(); i=next((i for i,x in enumerate(lines) if '-->' in x),-1)
 if i<0: continue
 start,end=[x.strip() for x in lines[i].split('-->')]
 t0,t1=sec(start),sec(end)
 chunks=phrases(' '.join(lines[i+1:]))
 weights=[max(1,len(x.split())) for x in chunks]
 total=max(1,sum(weights));cursor=t0
 for n,(phrase,weight) in enumerate(zip(chunks,weights)):
  finish=t1 if n==len(chunks)-1 else cursor+(t1-t0)*weight/total
  items.append({'start':cursor,'end':max(cursor+.12,finish),'text':phrase})
  cursor=finish
if not items: raise SystemExit('No se encontraron subtítulos temporizados.')
data=json.loads(Path(a.script).read_text(encoding='utf-8'));data['captions']=items
Path(a.script).write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
print(f'{len(items)} frases cortas sincronizadas (máximo 6 palabras)')
