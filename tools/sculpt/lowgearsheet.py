# The long sword's views beside the reference sheet's (tools/sculpt/ref/long-sword-sunarc.png), at the same length:
#   python3 tools/sculpt/lowgearsheet.py <dir>   reads <dir>/sheet-views.png and sheet-hero.png (tools/sculpt/lowgearshot.mjs
#   --only sheet), writes <dir>/sword-sheet.png: the sheet's front, side, back, side over ours plain and enchanted, and the
#   sheet's big front view beside ours plain and enchanted.
import sys
from PIL import Image, ImageDraw
d = sys.argv[1]
ref = Image.open(__file__.rsplit('/', 1)[0] + '/ref/long-sword-sunarc.png').convert('RGB')
views = Image.open(d + '/sheet-views.png').convert('RGB')
hero = Image.open(d + '/sheet-hero.png').convert('RGB')
BG = (130, 153, 136)
def crop(cx, cy, w, h, f):
    # a box of w x h output px round (cx, cy) of the sheet scaled by f, padded with the sheet's ground
    W, H = round(w / f), round(h / f)
    out = Image.new('RGB', (W, H), BG)
    x0, y0 = round(cx - W / 2), round(cy - H / 2)
    out.paste(ref.crop((max(0, x0), max(0, y0), min(ref.width, x0 + W), min(ref.height, y0 + H))), (max(0, -x0), max(0, -y0)))
    return out.resize((w, h), Image.LANCZOS)
# the sheet's small views: point y 20, pommel y 497 (477 px), centres x 402, 519, 625, 724; ours 521 px in a 150 x 560 cell
f = 521 / 477
row = Image.new('RGB', (600, 560))
for i, cx in enumerate([402, 519, 625, 724]):
    row.paste(crop(cx, 258.5, 150, 560, f), (i * 150, 0))
# the hero: point y 15, pommel y 1484 (1469 px), centre x 166; ours 1040 px in a 400 x 1100 cell
fh = 1040 / 1469
href = crop(166, 749.5, 400, 1100, fh)
W = 600 + 30 + 3 * 400
out = Image.new('RGB', (W, 30 + 3 * 560), (40, 36, 38))
out.paste(row, (0, 30)); out.paste(views, (0, 30 + 560))
out.paste(href, (630, 30)); out.paste(hero, (1030, 30))
g = ImageDraw.Draw(out)
for x, y, t in [(4, 10, 'Sheet: front, side, back, side'), (4, 30 + 560 + 4, 'Ours, plain'), (4, 30 + 1120 + 4, 'Ours, enchanted'),
                (634, 10, 'Sheet: hero'), (1034, 10, 'Ours, plain'), (1434, 10, 'Ours, enchanted')]:
    g.text((x, y), t, fill=(250, 240, 230))
out.save(d + '/sword-sheet.png')
print('wrote', d + '/sword-sheet.png')
