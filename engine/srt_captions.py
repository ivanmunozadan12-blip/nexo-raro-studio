import argparse,json,re
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--script',required=True);p.add_argument('--srt',required=True)
a=p.parse_args()
def sec(s):
 m=re.match(r'(\d+):(\d{2}):(\d{2}),(\d{3})',s)
 return int(m[1])*3600+int(m[2])*60+int(m[3])+int(m[4])/1000 if m else 0
items=[]
for block in re.split(r'\r?\n\s*\r?\n',Path(a.srt).read_text(encoding='utf-8')):
 lines=block.splitlines(); i=next((i for i,x in enumerate(lines) if '-->' in x),-1)
 if i<0: continue
 start,end=[x.strip() for x in lines[i].split('-->')]
 items.append({'start':sec(start),'end':sec(end),'text':' '.join(lines[i+1:])})
data=json.loads(Path(a.script).read_text(encoding='utf-8'));data['captions']=items
Path(a.script).write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
print(f'{len(items)} subtítulos sincronizados')
