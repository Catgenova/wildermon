# a sheet region at K x with a labelled grid every 10 sheet pixels (sheet coordinates)
import sys
from PIL import Image, ImageDraw
SHEET = __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '../../ref/leather-chest.png')
x0, y0, x1, y1 = map(int, sys.argv[1].split(',')); out = sys.argv[2]; K = int(sys.argv[3]) if len(sys.argv) > 3 else 4
im = Image.open(SHEET).convert('RGB').crop((x0, y0, x1, y1)).resize(((x1 - x0) * K, (y1 - y0) * K), Image.LANCZOS)
d = ImageDraw.Draw(im)
for x in range((x0 // 10 + 1) * 10, x1, 10):
    X = (x - x0) * K; d.line([(X, 0), (X, im.height)], fill=(0, 255, 255) if x % 50 == 0 else (90, 160, 160), width=1)
    d.text((X + 2, 2), str(x), fill=(255, 255, 0))
for y in range((y0 // 10 + 1) * 10, y1, 10):
    Y = (y - y0) * K; d.line([(0, Y), (im.width, Y)], fill=(0, 255, 255) if y % 50 == 0 else (90, 160, 160), width=1)
    d.text((2, Y + 2), str(y), fill=(255, 255, 0))
im.save(out)
