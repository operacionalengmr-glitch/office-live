"""
Cuts the character sprites out of the generated character sheets in `source folder/`
and writes one normalized sprite atlas per character to `assets/sprites/`.

    python tools/extract_sprites.py            # writes atlases + manifest.js
    python tools/extract_sprites.py --sheet    # also writes a contact sheet for review

Every frame goes into a fixed CELL_W x CELL_H cell with the feet on the same baseline,
so the game can draw any frame with the same anchor. Boxes below are (x, y, w, h) in
the source image; the background is keyed out by colour distance + hole filling.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'source folder')
OUT = os.path.join(ROOT, 'assets', 'sprites')

CELL_W, CELL_H, FOOT = 48, 64, 62   # FOOT: baseline row inside the cell
TARGET_H = 54                        # standing front sprite height in game pixels

# v2 sheets (all in Raffa's style), see source folder/v2/.
# group.png is a 13 x 6 grid: front, side, back, 3 turn poses, 7 walk frames (all side/walk face left).
GROUP_COLS = [75, 189, 302, 421, 542, 659, 779, 897, 1010, 1129, 1244, 1359, 1476]
GROUP_ROWS = {'raffael': (8, 163), 'math': (178, 346), 'paulo': (358, 514),
              'alex': (528, 684), 'guilherme': (697, 851), 'jaiane': (864, 1022)}


def group(cid):
    y0, y1 = GROUP_ROWS[cid]
    box = lambda c: (GROUP_COLS[c] - 56, y0, 112, y1 - y0)
    return dict(sheet='v2/group.png', thr=20, close=2, same_scale=True,
                front=box(0), side=box(1), back=box(2), side_left=True, walk_left=True,
                walk=[box(c) for c in range(6, 13)])


# sheet, threshold, stand boxes (front, side, back) as (x, y, w, h), side faces left?, optional walk boxes
CHARS = {cid: group(cid) for cid in GROUP_ROWS}
CHARS.update({
    'jose': dict(sheet='v2/jose.png', thr=22, close=2,
        front=(22, 2, 78, 200), side=(135, 2, 60, 200), back=(234, 2, 75, 200), side_left=True),
    'letticia': dict(sheet='v2/letticia.png', thr=22, close=2,
        front=(16, 33, 66, 135), side=(122, 33, 64, 135), back=(219, 33, 64, 135), side_left=True),
    'nathan': dict(sheet='v2/nathan.png', thr=22, close=2,
        front=(24, 33, 64, 140), side=(134, 33, 50, 140), back=(229, 33, 64, 140), side_left=True),
})


def bg_color(a):
    q = (a // 4).reshape(-1, 3)
    vals, counts = np.unique(q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2], return_counts=True)
    v = vals[counts.argmax()]
    return np.array([v // 4096, (v // 64) % 64, v % 64]) * 4 + 2


def cut(a, bg, box, thr, close=1):
    x, y, w, h = box
    p = 3
    x0, y0 = max(0, x - p), max(0, y - p)
    sub = a[y0:y + h + p, x0:x + w + p].astype(int)
    src = nd.median_filter(sub, size=(3, 3, 1)) if close > 1 else sub
    border = np.concatenate([src[0], src[-1], src[:, 0], src[:, -1]])
    bg = np.median(border, axis=0)
    d = np.sqrt(((src - bg) ** 2).sum(-1))
    m = d > thr
    m = nd.binary_closing(m, iterations=close) | m
    m = nd.binary_fill_holes(m)
    lab, n = nd.label(m)
    if n:
        sizes = nd.sum(m, lab, range(1, n + 1))
        objs = nd.find_objects(lab)
        # drop specks and thin separator lines between sheet rows
        keep = [i + 1 for i, s in enumerate(sizes) if s >= max(30, sizes.max() * 0.02)
                and objs[i][0].stop - objs[i][0].start > 4 and objs[i][1].stop - objs[i][1].start > 4]
        m = np.isin(lab, keep)
    ys, xs = np.nonzero(m)
    sub = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    rgba = np.zeros(sub.shape[:2] + (4,), np.uint8)
    rgba[..., :3] = sub
    rgba[..., 3] = m * 255
    return rgba


def downscale(rgba, f):
    h, w = rgba.shape[:2]
    nw, nh = max(1, round(w * f)), max(1, round(h * f))
    a = rgba.astype(float) / 255
    pre = a.copy(); pre[..., :3] *= a[..., 3:4]
    im = Image.fromarray((pre * 255).astype(np.uint8), 'RGBA')
    im = np.asarray(im.resize((nw, nh), Image.LANCZOS)).astype(float) / 255
    al = im[..., 3:4]
    rgb = np.where(al > 0.01, im[..., :3] / np.maximum(al, 1e-3), 0)
    out = np.zeros((nh, nw, 4), np.uint8)
    out[..., :3] = np.clip(rgb * 255, 0, 255)
    out[..., 3] = (al[..., 0] > 0.45) * 255
    return out


def anchor_x(rgba):
    """Horizontal anchor: centre of mass of the top half (head/torso), stable across walk frames."""
    al = rgba[..., 3] > 0
    top = al[: max(1, al.shape[0] // 2)]
    xs = np.nonzero(top)[1]
    return xs.mean() if len(xs) else rgba.shape[1] / 2


def place(rgba, flip=False):
    if flip:
        rgba = rgba[:, ::-1]
    cell = np.zeros((CELL_H, CELL_W, 4), np.uint8)
    h, w = rgba.shape[:2]
    ox = int(round(CELL_W / 2 - anchor_x(rgba)))
    oy = FOOT - h
    for yy in range(h):
        ty = oy + yy
        if not 0 <= ty < CELL_H: continue
        for_x0, for_x1 = max(0, -ox), min(w, CELL_W - ox)
        row = rgba[yy, for_x0:for_x1]
        dst = cell[ty, ox + for_x0: ox + for_x1]
        sel = row[..., 3] > 0
        dst[sel] = row[sel]
    return cell


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {'cellW': CELL_W, 'cellH': CELL_H, 'foot': FOOT, 'chars': {}}
    sheet_cells = []
    cache = {}
    for cid, c in CHARS.items():
        if c['sheet'] not in cache:
            a = np.asarray(Image.open(os.path.join(SRC, c['sheet'])).convert('RGB'))
            cache[c['sheet']] = (a, bg_color(a.astype(int)))
        a, bg = cache[c['sheet']]
        thr = c['thr']
        cl = c.get('close', 1)
        front = cut(a, bg, c['front'], thr, cl)
        f = TARGET_H / front.shape[0]
        frames, anims = [], {}

        def add(name, cells):
            anims[name] = list(range(len(frames), len(frames) + len(cells)))
            frames.extend(cells)

        side_flip = not c['side_left']
        add('front', [place(downscale(front, f))])
        add('side', [place(downscale(cut(a, bg, c['side'], thr, cl), f), side_flip)])
        add('back', [place(downscale(cut(a, bg, c['back'], thr, cl), f))])
        side_h = round(cut(a, bg, c['side'], thr, cl).shape[0] * f)
        if c.get('idle'):
            raw = [cut(a, bg, b, thr) for b in c['idle']]
            fi = TARGET_H / np.median([r.shape[0] for r in raw])
            add('idle', [place(downscale(r, fi)) for r in raw])
        if c.get('walk'):
            raw = [cut(a, bg, b, thr, cl) for b in c['walk']]
            fw = f if c.get('same_scale') else side_h / np.max([r.shape[0] for r in raw])
            # store everything facing left
            add('walk', [place(downscale(r, fw), not c.get('walk_left')) for r in raw])
        atlas = np.concatenate(frames, axis=1)
        Image.fromarray(atlas, 'RGBA').save(os.path.join(OUT, cid + '.png'), optimize=True)
        manifest['chars'][cid] = {'frames': len(frames), 'anims': anims}
        sheet_cells.append(atlas)
        print(cid, len(frames), 'frames', {k: len(v) for k, v in anims.items()})

    with open(os.path.join(OUT, 'manifest.js'), 'w') as fh:
        fh.write('// generated by tools/extract_sprites.py\nexport default ' + json.dumps(manifest, indent=1) + ';\n')

    if '--sheet' in sys.argv:
        wmax = max(s.shape[1] for s in sheet_cells)
        rows = [np.pad(s, ((0, 4), (0, wmax - s.shape[1]), (0, 0))) for s in sheet_cells]
        sheet = np.concatenate(rows, axis=0)
        bgc = np.zeros(sheet.shape[:2] + (3,), np.uint8); bgc[:] = (90, 100, 115)
        al = sheet[..., 3:4] / 255
        comp = (sheet[..., :3] * al + bgc * (1 - al)).astype(np.uint8)
        Image.fromarray(comp).resize((comp.shape[1] * 3, comp.shape[0] * 3), Image.NEAREST).save(
            os.path.join(sys.argv[sys.argv.index('--sheet') + 1] if len(sys.argv) > sys.argv.index('--sheet') + 1 else os.path.join(OUT, '_contact.png')))


if __name__ == '__main__':
    main()
