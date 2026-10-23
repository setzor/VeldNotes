from PIL import Image, ImageDraw
import math

"""Generate the VeldNotes autumn-leaf icon set.

Usage: python3 src-tauri/icons/generate.py
Requires Pillow. Regenerates all PNGs, icon.ico, and icon.icns from the
1024px master rendered in-memory.
"""
S = 1024

def make_leaf(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size

    # kraft paper rounded square background
    bg = (246, 241, 231, 255)
    ring = (221, 210, 189, 255)
    m = int(s * 0.02)
    d.rounded_rectangle((m, m, s - m, s - m), radius=int(s * 0.22), fill=ring)
    i = int(s * 0.035)
    d.rounded_rectangle((i, i, s - i, s - i), radius=int(s * 0.21), fill=bg)

    # ---- leaf as parametric outline ----
    # axis from base to tip, tilted up-right
    cx, cy = s * 0.46, s * 0.60
    tilt = math.radians(52)  # degrees up from horizontal (positive = up-right)
    L = s * 0.52             # base -> tip length
    W = s * 0.155            # max half width

    base = (cx, cy)
    tip = (cx + L * math.cos(tilt), cy - L * math.sin(tilt))
    # unit vectors along axis and perpendicular
    ax, ay = math.cos(tilt), -math.sin(tilt)
    px, py = -ay, ax  # perpendicular (pointing up-left side)

    def blade(half):
        # half=+1 upper-left side, half=-1 lower-right side
        pts = []
        for k in range(41):
            t = k / 40
            # width profile: 0 at base, max at 40%, 0 at tip, slight asymmetric tip
            w = math.sin(t * math.pi) ** 0.85 * W * (1.0 if t < 0.5 else 0.9)
            # tiny point at the tip
            x = cx + ax * L * t + px * w * half
            y = cy + ay * L * t + py * w * half
            pts.append((x, y))
        return pts

    upper = blade(+1)
    lower = blade(-1)
    outline = upper + lower[::-1]  # upper base->tip, then tip->base on lower

    deep = (198, 128, 40, 255)
    gold = (232, 172, 62, 255)
    d.polygon(outline, fill=deep)

    # inner lighter blade for depth (same shape, slightly shrunk)
    def blade_inner(half, scale):
        pts = []
        for k in range(41):
            t = k / 40
            w = (math.sin(t * math.pi) ** 0.85) * W * scale * (1.0 if t < 0.5 else 0.9)
            # shift slightly toward base to keep tip highlighted
            x = cx + ax * L * t * 0.98 + px * w * half
            y = cy + ay * L * t * 0.98 + py * w * half
            pts.append((x, y))
        return pts
    inner = blade_inner(+1, 0.72) + blade_inner(-1, 0.72)[::-1]
    d.polygon(inner, fill=gold)

    # stem: short line from base going down-left
    stem_w = int(s * 0.030)
    sx2 = cx - s * 0.085
    sy2 = cy + s * 0.085
    d.line([base, (sx2, sy2)], fill=(150, 92, 26, 255), width=stem_w)
    # round stem cap
    r = stem_w // 2
    d.ellipse((sx2 - r, sy2 - r, sx2 + r, sy2 + r), fill=(150, 92, 26, 255))

    # midrib
    d.line([base, tip], fill=(150, 92, 26, 255), width=max(2, int(s * 0.016)))
    # side veins
    for frac in (0.28, 0.48, 0.68):
        mx = base[0] + (tip[0] - base[0]) * frac
        my = base[1] + (tip[1] - base[1]) * frac
        vl = s * 0.085 * (1.15 - frac)
        for sign in (-1, 1):
            # vein angle: spread from midrib
            va = tilt + sign * math.radians(50)
            ex = mx + math.cos(va) * vl
            ey = my - math.sin(va) * vl
            d.line([(mx, my), (ex, ey)], fill=(150, 92, 26, 255), width=max(2, int(s * 0.010)))

    return img

img = make_leaf(S)
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
img.save(os.path.join(HERE, "icon.png"))




