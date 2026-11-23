"""Build public/og.png (the 1200×630 link preview) from a rendered trailer frame.

    node promo/render.mjs --stills 640 --out promo/out && python3 promo/og.py promo/out/frame-0640.png
"""
import sys
from PIL import Image, ImageDraw, ImageFont

src = sys.argv[1] if len(sys.argv) > 1 else 'promo/out/frame-0640.png'
im = Image.open(src).convert('RGB').crop((0, 36, 1920, 1044)).resize((1200, 630), Image.LANCZOS)
d = ImageDraw.Draw(im)
INK, PAPER, ACC = (18, 18, 17), (251, 251, 248), (217, 88, 26)
FONTS = '/usr/share/fonts/truetype/dejavu/'
mono = ImageFont.truetype(FONTS + 'DejaVuSansMono-Bold.ttf', 58)
small = ImageFont.truetype(FONTS + 'DejaVuSansMono.ttf', 22)

x0, y0, w, h = 700, 404, 460, 190
d.rectangle((x0 + 10, y0 + 10, x0 + w + 10, y0 + h + 10), fill=INK)
d.rectangle((x0, y0, x0 + w, y0 + h), fill=PAPER, outline=INK, width=4)
im.paste(Image.open('public/icons/icon-512.png').convert('RGB').resize((96, 96), Image.LANCZOS), (x0 + 18, y0 + 20))
d.text((x0 + 124, y0 + 34), 'STICK', font=mono, fill=INK)
d.text((x0 + 124, y0 + 92), 'HOOPS', font=mono, fill=INK)
d.line((x0 + 124, y0 + 160, x0 + w - 30, y0 + 158), fill=INK, width=5)

t = 'Pull back. Let go. Swish.'
tw = d.textlength(t, font=small)
bx, by = 36, 560
d.rectangle((bx + 6, by + 6, bx + tw + 42, by + 50), fill=INK)
d.rectangle((bx, by, bx + tw + 36, by + 44), fill=ACC, outline=INK, width=3)
d.text((bx + 18, by + 9), t, font=small, fill=INK)
im.save('public/og.png', optimize=True)
print('wrote public/og.png')
