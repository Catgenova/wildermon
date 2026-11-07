# The wrist's bend, reference against ours (tools/sculpt/ARM_SPEC.md): per arm view of each sheet and the full body's front,
# the forearm's axis (a line through its outline's middles), the hand's (from the wrist's middle to the finger mass's),
# in degrees (+ leaning to the viewer's right going down), and the bend between them.
#
#   node tools/sculpt/lowarmshot.mjs --who male --out <dir> --ids; (and female); python3 tools/sculpt/lowawrist.py <dir> <scratch>
#
# <scratch>: where lowamask.py wrote aref-<who>.json.
import sys, json, numpy as np
from PIL import Image
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lowamask import ARM_BOXES
T=os.path.dirname(os.path.abspath(__file__))+'/'
S=sys.argv[2].rstrip('/')+'/'
d=sys.argv[1]
BANDS={'male':((285,392),(398,408),(470,505)),'female':((258,325),(328,338),(380,412))}
BODY={'male':((745,860),(868,882),(985,1035)),'female':((715,845),(848,862),(945,985))}
VIEWS=['front','q3','profile','r3','back']
def runs(row):
    xs=np.nonzero(row)[0]
    if not len(xs): return []
    br=np.nonzero(np.diff(xs)>1)[0]; st=np.r_[xs[0],xs[br+1]]; en=np.r_[xs[br],xs[-1]]
    return list(zip(st,en))
def mids(M,a,b,widest=False,first=False):
    out=[]
    for y in range(a,b):
        r=runs(M[y])
        if not r: continue
        if widest: s,e=max(r,key=lambda t:t[1]-t[0])
        elif first: s,e=r[0]
        else: s,e=r[0][0],r[-1][1]
        out.append((y,(s+e)/2))
    return np.array(out)
def angles(M,B,first=False):
    f=mids(M,*B[0],first=first); k=np.polyfit(f[:,0],f[:,1],1)[0]
    w=mids(M,*B[1],first=first).mean(0); h=mids(M,*B[2],widest=True).mean(0)
    fa=np.degrees(np.arctan(k)); ha=np.degrees(np.arctan2(h[1]-w[1],h[0]-w[0]))
    return fa,ha,ha-fa
res={}
for who in ['male','female']:
    ref=np.asarray(Image.open(T+f'ref/arm-lowpoly-{who}.png').convert('RGB')).astype(int)
    fg=np.abs(ref-ref[8,700]).sum(2)>40
    ids=np.frombuffer(open(f'{d}/ids-arm-{who}.bin','rb').read(),dtype=np.int16).reshape(10,1024,1536)
    for vi,v in enumerate(VIEWS):
        x0,y0,x1,y1=ARM_BOXES[who][v]
        R=np.zeros_like(fg); R[:,x0:x1]=fg[:,x0:x1]; O=np.zeros_like(fg); O[:,x0:x1]=ids[vi][:,x0:x1]>=0
        a=angles(R,BANDS[who]); b=angles(O,BANDS[who])
        print(f'{who:6} {v:8} forearm ref {a[0]:6.1f} ours {b[0]:6.1f} | hand ref {a[1]:6.1f} ours {b[1]:6.1f} | wrist bend ref {a[2]:6.1f} ours {b[2]:6.1f}  diff {b[2]-a[2]:6.1f}')
    # body: ref and ours body images, the arm only (left of the cut)
    A=json.load(open(S+f'aref-{who}.json'))['views']['body']; K=2
    rb=np.asarray(Image.open(T+f'ref/body-{who}.png').convert('RGB')).astype(int); ob=np.asarray(Image.open(f'{d}/body-arm-{who}.png').convert('RGB')).astype(int)
    def bm(im):
        m=np.abs(im-im[20,20]).sum(2)>40; out=np.zeros_like(m)
        bx=A['box']
        for j,c in enumerate(A['cut']):
            for yy in (bx[1]+j*K,bx[1]+j*K+1): out[yy,bx[0]:bx[0]+c*K]=m[yy,bx[0]:bx[0]+c*K]
        return out
    a=angles(bm(rb),BODY[who],first=True); b=angles(bm(ob),BODY[who],first=True)
    print(f'{who:6} {"body":8} forearm ref {a[0]:6.1f} ours {b[0]:6.1f} | hand ref {a[1]:6.1f} ours {b[1]:6.1f} | wrist bend ref {a[2]:6.1f} ours {b[2]:6.1f}  diff {b[2]-a[2]:6.1f}')
