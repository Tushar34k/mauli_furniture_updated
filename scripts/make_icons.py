from PIL import Image, ImageDraw
from pathlib import Path

OR, MA, YE, WH = (232, 103, 27), (122, 31, 31), (245, 184, 0), (255, 250, 245)


def mark(size, bleed=False):
    s = size / 64
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bleed:
        d.rectangle([0, 0, size, size], fill=OR)
        s2, off = s * 0.72, size * 0.14
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=16 * s, fill=OR)
        s2, off = s, 0

    def R(x, y, w, h, r, c):
        d.rounded_rectangle([off + x * s2, off + y * s2, off + (x + w) * s2, off + (y + h) * s2], radius=r * s2, fill=c)
    d.ellipse([off + 28 * s2, off + 8 * s2, off + 36 * s2, off + 16 * s2], fill=YE)
    R(16, 22, 32, 16, 5, WH)
    R(9, 30, 11, 16, 5, MA)
    R(44, 30, 11, 16, 5, MA)
    R(18, 36, 28, 10, 3, WH)
    R(13, 46, 4, 7, 1, MA)
    R(47, 46, 4, 7, 1, MA)
    return im


pub = Path("/app/frontend/public")
(pub / "icons").mkdir(exist_ok=True, parents=True)
Path("/app/backend/assets").mkdir(exist_ok=True)
mark(512).save("/app/backend/assets/logo.png")
for n in (192, 512):
    mark(n).save(pub / "icons" / f"icon-{n}.png")
mark(512, bleed=True).save(pub / "icons" / "maskable-512.png")
mark(192, bleed=True).save(pub / "icons" / "maskable-192.png")
mark(180, bleed=True).convert("RGB").save(pub / "icons" / "apple-touch-icon.png")
mark(64).save(pub / "favicon.png")
print("icons ok")
