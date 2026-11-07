# The leg sheets' silhouettes, per view, for tools/sculpt/lowlfit.mjs (tools/sculpt/LEGS_SPEC.md, LEGS_SPEC_FEMALE.md):
#
#   python3 tools/sculpt/lowlmask.py male out.json      # tools/sculpt/ref/legs-lowpoly-male.png and ref/body-male.png
#
# For each view (its box on the sheet, at the sheet's own size), the silhouette (every pixel that is not the background,
# the holes filled) at K sheet pixels a mask pixel, and what the fit leaves out: rows above 'top' (the belt and the waist
# above it: the legs' sheets start at the belt, the body is compared from the belt down) and the polygons 'cloth' (the
# loincloth, a separate layer: where it hides the body nothing is compared). The view 'body' is the full-body reference's
# front (ref/body-<who>.png); the arms and the hands beside the thighs are left out as the loincloth is.
# Written as JSON: { views: { name: { src, K, box, w, h, mask (rows of 0/1), top (sheet y), cloth: [[[x, y], ...]] } } }.
import json, sys
from PIL import Image

LEG_VIEWS = ['front', 'q3', 'profile', 'r3', 'back']
VIEWS = {
    'male': {
        'front': dict(box=(60, 64, 300, 375), top=88, cloth=[[(144, 80), (212, 80), (180, 168)]]),
        'q3': dict(box=(305, 40, 505, 375), top=70, cloth=[[(381, 55), (442, 55), (413, 156)]]),
        'profile': dict(box=(560, 40, 690, 375), top=66, cloth=[[(569, 55), (596, 55), (596, 135), (569, 135)], [(643, 55), (664, 55), (664, 146), (643, 146)]]),
        'r3': dict(box=(700, 40, 945, 375), top=66, cloth=[[(835, 55), (866, 55), (866, 138), (835, 138)]]),
        'back': dict(box=(945, 40, 1140, 375), top=66, cloth=[]),
        'body': dict(src='body', K=3, box=(100, 700, 772, 1745), top=794, cloth=[[(352, 760), (506, 760), (432, 1066)]],
                     hands=[[(100, 700), (236, 700), (236, 1085), (100, 1085)], [(640, 700), (772, 700), (772, 1085), (640, 1085)]]),
        # the topology panel's five views (its pelvis bare, cut flat at the waist)
        'tfront': dict(box=(945, 786, 1075, 1004), top=796, cloth=[]),
        'tq3': dict(box=(1078, 786, 1205, 1004), top=796, cloth=[]),
        'tprofile': dict(box=(1205, 786, 1282, 1004), top=796, cloth=[]),
        'tr3': dict(box=(1282, 786, 1395, 1004), top=796, cloth=[]),
        'tback': dict(box=(1398, 786, 1525, 1004), top=796, cloth=[]),
    },
    'female': {
        'front': dict(box=(60, 66, 262, 369), top=88, cloth=[[(129, 76), (186, 76), (156, 154)]]),
        'q3': dict(box=(270, 60, 470, 369), top=88, cloth=[[(360, 72), (411, 72), (386, 156)]]),
        'profile': dict(box=(500, 60, 640, 369), top=88, cloth=[[(591, 70), (609, 70), (609, 149), (591, 149)]]),
        'r3': dict(box=(660, 55, 890, 369), top=88, cloth=[[(767, 70), (803, 70), (803, 144), (767, 144)]]),
        'back': dict(box=(890, 55, 1070, 369), top=86, cloth=[]),
        'body': dict(src='body', K=3, box=(140, 700, 740, 1745), top=764, cloth=[[(390, 735), (526, 735), (445, 994)]],
                       hands=[[(140, 700), (252, 700), (252, 1040), (140, 1040)], [(628, 700), (740, 700), (740, 1040), (628, 1040)]]),
        'tfront': dict(box=(858, 778, 985, 1022), top=794, cloth=[[(899, 784), (939, 784), (920, 842)]]),
        'tq3': dict(box=(995, 778, 1105, 1022), top=794, cloth=[[(1047, 786), (1081, 786), (1065, 844)]]),
        'tprofile': dict(box=(1110, 778, 1195, 1022), top=794, cloth=[]),
        'tr3': dict(box=(1198, 778, 1305, 1022), top=794, cloth=[[(1259, 784), (1279, 784), (1279, 830), (1259, 830)]]),
        'tback': dict(box=(1310, 778, 1430, 1022), top=794, cloth=[]),
    },
}


def silhouette(px, box, K):
    x0, y0, x1, y1 = box
    w, h = (x1 - x0) // K, (y1 - y0) // K
    cs = [px[x, y0 + 2] for x in range(x0, x1, 4)] + [px[x0 + 2, y] for y in range(y0, y1, 4)] + [px[x1 - 3, y] for y in range(y0, y1, 4)]
    bg = [sorted(c[k] for c in cs)[len(cs) // 2] for k in range(3)]
    fg = [[sum(abs(px[x0 + i * K + K // 2, y0 + j * K + K // 2][k] - bg[k]) for k in range(3)) > 36 for i in range(w)] for j in range(h)]
    seen = [[False] * w for _ in range(h)]
    stack = [(i, 0) for i in range(w)] + [(i, h - 1) for i in range(w)] + [(0, j) for j in range(h)] + [(w - 1, j) for j in range(h)]
    while stack:
        i, j = stack.pop()
        if i < 0 or j < 0 or i >= w or j >= h or seen[j][i] or fg[j][i]:
            continue
        seen[j][i] = True
        stack += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]
    return w, h, [''.join('0' if seen[j][i] else '1' for i in range(w)) for j in range(h)]


def main(who, dst):
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    ims = {'legs': Image.open(os.path.join(here, 'ref', 'legs-lowpoly-%s.png' % who)).convert('RGB'),
           'body': Image.open(os.path.join(here, 'ref', 'body-%s.png' % who)).convert('RGB')}
    out = {'views': {}}
    for name, v in VIEWS[who].items():
        src, K = v.get('src', 'legs'), v.get('K', 1)
        w, h, mask = silhouette(ims[src].load(), v['box'], K)
        out['views'][name] = {'src': src, 'K': K, 'box': list(v['box']), 'w': w, 'h': h, 'mask': mask, 'top': v['top'], 'cloth': [[list(p) for p in c] for c in v['cloth'] + v.get('hands', [])]}
    json.dump(out, open(dst, 'w'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
