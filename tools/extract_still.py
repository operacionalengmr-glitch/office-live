"""
Cuts a single front-facing character out of a picture with a busy background (bricks + floor) and writes it
as one 48x64 game cell, same scale and baseline as the team sprites.

    python tools/extract_still.py            # source folder/v2/anfitriao.webp -> assets/sprites/resenha_host.png

The Anfitrião reference has a brown brick wall, a maroon floor and a shadow under the feet: those are keyed out
by hue (bricks lean brown with blue < green, floor/shadow lean maroon with red >> green and blue > green); hair
and outlines lean slightly purple (blue >= green), so they survive. The name tag above the head is cropped off.
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as nd
from extract_sprites import ROOT, OUT, TARGET_H, downscale, place

SRC = os.path.join(ROOT, 'source folder', 'v2', 'anfitriao.webp')
DST = os.path.join(OUT, 'resenha_host.png')
CROP_TOP = 370  # below the "Anfitrião" name tag


def main():
    a = np.asarray(Image.open(SRC).convert('RGB')).astype(int)[CROP_TOP:]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = (r + g + b) / 3
    brick = (r > g) & (b < g - 2) & (lum > 18) & (lum < 85)
    floor = (r - g > 25) & (b - g > 4) & (r < 120)
    # only background-coloured areas connected to the picture's edges are background: the beard and the
    # mouth have brick/maroon-like colours too, but they're enclosed by the character
    lab, n = nd.label(brick | floor)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    m = ~np.isin(lab, list(edge))
    m = nd.binary_opening(m, iterations=2)
    lab, n = nd.label(m)
    sizes = nd.sum(m, lab, range(1, n + 1))
    m = nd.binary_fill_holes(lab == (int(np.argmax(sizes)) + 1))
    ys, xs = np.nonzero(m)
    a, m = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1], m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    rgba = np.zeros(a.shape[:2] + (4,), np.uint8)
    rgba[..., :3] = a
    rgba[..., 3] = m * 255
    cell = place(downscale(rgba, TARGET_H / rgba.shape[0]))
    Image.fromarray(cell, 'RGBA').save(DST, optimize=True)
    print('wrote', DST, 'from', rgba.shape[1], 'x', rgba.shape[0])


if __name__ == '__main__':
    main()
