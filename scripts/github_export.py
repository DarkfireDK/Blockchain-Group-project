"""Export source files to the authenticated GitHub connector without credentials."""
import json, subprocess, pathlib, base64, sys
root=pathlib.Path(__file__).resolve().parents[1]
names=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=root).decode().split('\0')
entries=[]
for name in sorted(set(names)):
    p=root/name
    if not name or not p.is_file() or p.name=='.env' or (p.name.startswith('.env.') and p.name!='.env.example'):
        continue
    data=p.read_bytes()
    try:
        content=data.decode('utf-8'); encoding='utf-8'
    except UnicodeDecodeError:
        content=base64.b64encode(data).decode(); encoding='base64'
    entries.append(dict(path=name,content=content,encoding=encoding))
payload=json.dumps(entries,ensure_ascii=True)
if len(sys.argv)==1:
    print(json.dumps(dict(length=len(payload),chunks=(len(payload)+79999)//80000,files=len(entries))))
else:
    n=int(sys.argv[1]); print(payload[n*80000:(n+1)*80000],end='')
