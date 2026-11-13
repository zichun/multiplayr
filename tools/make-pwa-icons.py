"""Generate the PWA icons in src/client/static/icons/ from the Multiplayr favicon marks.

The logo is the four header marks (coral square, teal circle, mustard triangle,
navy square) drawn on a 32x32 grid, the same shapes as the inline SVG favicon in
src/client/static/*.html. Re-run after changing the logo:

    python tools/make-pwa-icons.py
"""
import os
from PIL import Image, ImageDraw

BG = (0xEC, 0xE4, 0xD3, 255)
CORAL = (0xE1, 0x55, 0x3A, 255)
TEAL = (0x1C, 0x8C, 0x7D, 255)
MUSTARD = (0xE3, 0xA8, 0x1E, 255)
NAVY = (0x33, 0x50, 0x7A, 255)

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'client', 'static', 'icons')
SUPERSAMPLE = 4


def draw_marks(draw, ox, oy, size):
    """Draw the 32-unit logo grid scaled to `size` pixels at (ox, oy)."""
    u = size / 32.0

    def p(x, y):
        return (ox + x * u, oy + y * u)

    draw.rectangle([p(1, 1), p(15, 15)], fill=CORAL)
    draw.ellipse([p(17, 1), p(31, 15)], fill=TEAL)
    draw.polygon([p(8, 17.5), p(15, 31), p(1, 31)], fill=MUSTARD)
    draw.rectangle([p(17, 17), p(31, 31)], fill=NAVY)


def make_icon(size, maskable):
    s = size * SUPERSAMPLE
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if maskable:
        # Full-bleed background; logo inside the 80% safe-zone circle.
        draw.rectangle([0, 0, s, s], fill=BG)
        logo = s * 0.52
    else:
        draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.18, fill=BG)
        logo = s * 0.68
    off = (s - logo) / 2
    draw_marks(draw, off, off, logo)
    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (192, 512):
        make_icon(size, False).save(os.path.join(OUT, 'icon-%d.png' % size), optimize=True)
    make_icon(512, True).save(os.path.join(OUT, 'icon-maskable-512.png'), optimize=True)
    make_icon(180, True).save(os.path.join(OUT, 'apple-touch-icon.png'), optimize=True)
    print('Wrote icons to', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
