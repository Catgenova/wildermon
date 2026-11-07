# Overlay sheets for the low-poly heads: each of the seven views of our sheet over the reference's, at 50%, beside the
# two outlines (the reference's red, ours cyan), so a fit can be judged view by view.
#
#   python3 tools/sculpt/lowoverlay.py tools/sculpt/ref/head-lowpoly.png <dir>/sheet-male.png <dir>/overlay-male.png
import sys
from PIL import Image, ImageChops
sys.path.insert(0, __import__('os').path.dirname(__file__))
from lowmask import views, BOXES, K

def outline(v):
    w, h, m = v['w'], v['h'], v['mask']
    o = Image.new('L', (w, h), 0)
    for j in range(1, h - 1):
        for i in range(1, w - 1):
            if m[j][i] == '1' and (m[j][i - 1] == '0' or m[j][i + 1] == '0' or m[j - 1][i] == '0' or m[j + 1][i] == '0'):
                o.putpixel((i, j), 255)
    return o.resize((w * K, h * K), Image.NEAREST)

def main(ref, ours, dst):
    r = Image.open(ref).convert('RGB').resize((1536, 1024)); m = Image.open(ours).convert('RGB').resize((1536, 1024))
    rv, mv = views(ref), views(ours)
    tiles = []
    for name, box in BOXES.items():
        a, b = r.crop(box), m.crop(box)
        blend = Image.blend(a, b, 0.5)
        lines = Image.blend(a, Image.new('RGB', a.size, (20, 18, 20)), 0.7)
        red, cyan = outline(rv['views'][name]), outline(mv['views'][name])
        lines.paste((255, 70, 60), (0, 0), red.crop((0, 0) + a.size))
        lines.paste((60, 230, 255), (0, 0), cyan.crop((0, 0) + a.size))
        tile = Image.new('RGB', (a.width * 2 + 4, a.height), (255, 255, 255))
        tile.paste(blend, (0, 0)); tile.paste(lines, (a.width + 4, 0))
        tiles.append(tile)
    W = max(t.width for t in tiles)
    out = Image.new('RGB', (W * 4 + 12, max(t.height for t in tiles) * 2 + 4), (255, 255, 255))
    for i, t in enumerate(tiles):
        out.paste(t, ((i % 4) * (W + 4), (i // 4) * (out.height // 2 + 2)))
    out.save(dst)

if __name__ == '__main__':
    main(*sys.argv[1:4])
