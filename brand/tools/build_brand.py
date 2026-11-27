# -*- coding: utf-8 -*-
"""
Athar brand asset builder.

Generates every logo / favicon / app-icon asset from code so the identity is
reproducible:  python brand/tools/build_brand.py [svg|png|all]

  svg  -> brand/logo/*.svg  and  public/*.svg
  png  -> public/favicon.ico, apple-touch-icon.png, icon-192/512, maskable,
          og-image.png, site.webmanifest  (rendered through headless Edge)

Wordmark and tagline are converted to outlines from Amiri (SIL OFL) with
HarfBuzz, so the logo never depends on an installed font.
"""
import math
import os
import struct
import subprocess
import sys
import tempfile
import json
from pathlib import Path

import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen, RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / "brand" / "tools" / "fonts"
LOGO_DIR = ROOT / "brand" / "logo"
PUBLIC = ROOT / "public"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

# ---------------------------------------------------------------- palettes
FOREST = "#173D34"
FOREST_DEEP = "#0F2A23"
GOLD = "#B8860B"
GOLD_LIGHT = "#D4AF37"
CREAM = "#F3EAD8"

PALETTES = {
    "color":      {"ink": FOREST, "gold": GOLD},
    "reversed":   {"ink": CREAM, "gold": GOLD_LIGHT},
    "mono":       {"ink": FOREST, "gold": FOREST},
    "mono-white": {"ink": "#FFFFFF", "gold": "#FFFFFF"},
}

TAGLINE = "خير يبقى وأثر لا ينقطع"
WORD = "أثر"


# ------------------------------------------------------------ text outlines
def _fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def shape_contours(fontfile, text):
    """Shape `text`, return (contours, advance). Contours are RecordingPen
    value lists in font units (y-up), tagged with their glyph index."""
    path = str(FONTS / fontfile)
    blob = hb.Blob.from_file_path(path)
    face = hb.Face(blob)
    font = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": True, "calt": True})
    ttf = TTFont(path)
    order = ttf.getGlyphOrder()
    gs = ttf.getGlyphSet()
    out = []
    x = 0
    for gi, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        gname = order[info.codepoint]
        rec = DecomposingRecordingPen(gs)
        gs[gname].draw(TransformPen(rec, (1, 0, 0, 1, x + pos.x_offset, pos.y_offset)))
        cur = []
        ci = 0
        for op, args in rec.value:
            cur.append((op, args))
            if op in ("closePath", "endPath"):
                out.append({"glyph": gi, "contour": ci, "ops": cur})
                cur = []
                ci += 1
        x += pos.x_advance
    return out, x


def bounds_of(contours):
    xs, ys = [], []
    for c in contours:
        for _, args in c["ops"]:
            for p in args:
                if p is None:
                    continue
                xs.append(p[0])
                ys.append(p[1])
    return min(xs), min(ys), max(xs), max(ys)


def contour_d(contour, s, tx, ty):
    pen = SVGPathPen(None, ntos=_fmt)
    rec = RecordingPen()
    rec.value = contour["ops"]
    rec.replay(TransformPen(pen, (s, 0, 0, -s, tx, ty)))
    return pen.getCommands()


class Text:
    """Pre-shaped outline text that can be placed anywhere."""

    def __init__(self, fontfile, text, gold_rule=None):
        self.contours, _ = shape_contours(fontfile, text)
        self.bounds = bounds_of(self.contours)
        self.gold_rule = gold_rule  # callable(contour)->bool

    def size(self, s):
        x0, y0, x1, y1 = self.bounds
        return (x1 - x0) * s, (y1 - y0) * s

    def svg(self, s, left, top, pal, gold_only=False):
        """Return <path> elements with the text's bounding box top-left at
        (left, top) and font-unit scale `s`."""
        x0, y0, x1, y1 = self.bounds
        tx = left - s * x0
        ty = top + s * y1
        ink, gold = [], []
        for c in self.contours:
            d = contour_d(c, s, tx, ty)
            if self.gold_rule and self.gold_rule(c):
                gold.append(d)
            else:
                ink.append(d)
        parts = []
        if ink:
            parts.append(f'<path fill="{pal["ink"]}" d="{" ".join(ink)}"/>')
        if gold:
            parts.append(f'<path fill="{pal["gold"]}" d="{" ".join(gold)}"/>')
        return "".join(parts)


# Thaa: contour 0 is the tooth/body; contours 1-2 are the three dots.
def thaa_dots(c):
    return c["glyph"] == 1 and c["contour"] >= 1


WORDMARK = Text("Amiri-Bold.ttf", WORD, gold_rule=thaa_dots)
TAG = Text("Amiri-Regular.ttf", TAGLINE)


# -------------------------------------------------------------------- mark
def mark_svg(pal, cx=100, cy=100, k=1.0, detail="full"):
    """The 'Ripple of Beads' mark, authored on a 200x200 grid centred (100,100).

    30 beads = 30 ajza' of the khatmah; the larger gold bead is the imam
    bead of a misbaha. Two concentric rings read as a ripple (the lasting
    athar); the diamond echoes the ornament used across the site.
    """
    ink, gold = pal["ink"], pal["gold"]
    g = []
    # beads
    n = 30
    for i in range(n):
        a = math.radians(-90 + i * 360 / n)
        x = 100 + 88 * math.cos(a)
        y = 100 + 88 * math.sin(a)
        if i == 0:
            g.append(f'<circle cx="{_fmt(x)}" cy="{_fmt(y)}" r="5.8" fill="{gold}"/>')
        else:
            g.append(f'<circle cx="{_fmt(x)}" cy="{_fmt(y)}" r="4.2" fill="{ink}"/>')
    # ripple rings
    g.append(f'<circle cx="100" cy="100" r="70" fill="none" stroke="{ink}" stroke-width="3"/>')
    g.append(f'<circle cx="100" cy="100" r="54" fill="none" stroke="{ink}" stroke-width="1.6" stroke-opacity=".55"/>')
    # diamond with a diamond-shaped opening (even-odd keeps it one colour)
    o, i_ = 32, 12
    d = (f"M100 {100-o}L{100+o} 100L100 {100+o}L{100-o} 100Z"
         f"M100 {100-i_}L{100-i_} 100L100 {100+i_}L{100+i_} 100Z")
    g.append(f'<path fill="{gold}" fill-rule="evenodd" d="{d}"/>')
    inner = "".join(g)
    t = f'translate({_fmt(cx - 100 * k)} {_fmt(cy - 100 * k)}) scale({_fmt(k)})'
    return f'<g transform="{t}">{inner}</g>'


def svg_doc(w, h, body, title="أثر", bg=None, extra=""):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_fmt(w)} {_fmt(h)}" '
            f'width="{_fmt(w)}" height="{_fmt(h)}" role="img" aria-label="{title}"{extra}>'
            f'<title>{title}</title>{rect}{body}</svg>')


# ---------------------------------------------------------------- lockups
def logo_mark(pal):
    return svg_doc(200, 200, mark_svg(pal))


def logo_wordmark(pal, with_tag=True):
    s = 0.16
    ww, wh = WORDMARK.size(s)
    if not with_tag:
        pad = 12
        body = WORDMARK.svg(s, pad, pad, pal)
        return svg_doc(ww + 2 * pad, wh + 2 * pad, body)
    ts = 0.034
    tw, th = TAG.size(ts)
    pad = 12
    W = max(ww, tw) + 2 * pad
    gap = 16
    H = wh + gap + th + 2 * pad
    body = WORDMARK.svg(s, (W - ww) / 2, pad, pal)
    body += TAG.svg(ts, (W - tw) / 2, pad + wh + gap, pal)
    return svg_doc(W, H, body)


def logo_horizontal(pal):
    """RTL lockup: mark on the right, wordmark + tagline on the left."""
    mark = 200
    pad = 8
    ws = 0.115
    ww, wh = WORDMARK.size(ws)
    ts = 0.031
    tw, th = TAG.size(ts)
    gap_t = 14
    block_w = max(ww, tw)
    block_h = wh + gap_t + th
    gap = 36
    W = pad + block_w + gap + mark + pad
    H = mark + 2 * pad
    bx = pad                               # text block left edge
    by = pad + (mark - block_h) / 2
    body = WORDMARK.svg(ws, bx + (block_w - ww) / 2, by, pal)
    body += TAG.svg(ts, bx + (block_w - tw) / 2, by + wh + gap_t, pal)
    body += mark_svg(pal, cx=pad + block_w + gap + mark / 2, cy=pad + mark / 2)
    return svg_doc(W, H, body)


def logo_stacked(pal):
    mark = 200
    pad = 12
    ws = 0.13
    ww, wh = WORDMARK.size(ws)
    ts = 0.036
    tw, th = TAG.size(ts)
    W = max(mark, ww, tw) + 2 * pad + 40
    y = pad
    body = mark_svg(pal, cx=W / 2, cy=y + mark / 2)
    y += mark + 20
    body += WORDMARK.svg(ws, (W - ww) / 2, y, pal)
    y += wh + 18
    body += TAG.svg(ts, (W - tw) / 2, y, pal)
    y += th + pad
    return svg_doc(W, y, body)


# ----------------------------------------------------------------- icons
def favicon_svg():
    """Simplified 32px-grid mark, legible at 16px: rounded forest square,
    one cream ring, the gold 'imam' bead on top and the gold diamond core.
    (The full 30-bead ring is kept for icons >= 180px.)"""
    g = [f'<rect width="32" height="32" rx="7" fill="{FOREST}"/>']
    g.append(f'<circle cx="16" cy="17" r="10" fill="none" stroke="{CREAM}" stroke-width="2.2"/>')
    g.append(f'<circle cx="16" cy="7" r="2.7" fill="{GOLD_LIGHT}" stroke="{FOREST}" stroke-width="1.2" paint-order="stroke"/>')
    g.append(f'<path fill="{GOLD_LIGHT}" d="M16 10.4L22.6 17L16 23.6L9.4 17Z"/>')
    return svg_doc(32, 32, "".join(g), extra="")


def app_icon_svg(size=512, frac=0.78, rounded=True, bg=FOREST):
    """Full-detail mark on forest. `frac` = share of the canvas used by the
    mark (use ~0.6 for maskable so it survives circular masks)."""
    rx = size * 0.2 if rounded else 0
    k = size * frac / 200
    body = f'<rect width="{size}" height="{size}" rx="{_fmt(rx)}" fill="{bg}"/>'
    body += mark_svg(PALETTES["reversed"], cx=size / 2, cy=size / 2, k=k)
    return svg_doc(size, size, body)


def og_svg():
    W, H = 1200, 630
    pal = PALETTES["reversed"]
    defs = (f'<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{FOREST}"/><stop offset="1" stop-color="{FOREST_DEEP}"/>'
            f'</linearGradient></defs>')
    body = defs + f'<rect width="{W}" height="{H}" fill="url(#bg)"/>'
    # inset frame with gold corner brackets
    m, L = 28, 46
    body += f'<rect x="{m}" y="{m}" width="{W-2*m}" height="{H-2*m}" fill="none" stroke="{GOLD_LIGHT}" stroke-opacity=".28" stroke-width="1.5"/>'
    for (x, y, sx, sy) in [(m, m, 1, 1), (W - m, m, -1, 1), (m, H - m, 1, -1), (W - m, H - m, -1, -1)]:
        body += (f'<path d="M{x} {y+sy*L}V{y}H{x+sx*L}" fill="none" stroke="{GOLD_LIGHT}" '
                 f'stroke-width="3" stroke-linecap="square"/>')
    # mark (right side - RTL) and text block (left)
    mk = 340
    body += mark_svg(pal, cx=W - 250, cy=H / 2, k=mk / 200)
    ws = 0.19
    ww, wh = WORDMARK.size(ws)
    ts = 0.058
    tw, th = TAG.size(ts)
    sub = Text("Amiri-Regular.ttf", "ختمة قرآنية جماعية")
    ss = 0.044
    sw, sh = sub.size(ss)
    block_w = max(ww, tw, sw)
    block_h = wh + 30 + th + 26 + sh
    cx = 380
    top = (H - block_h) / 2
    body += WORDMARK.svg(ws, cx - ww / 2, top, pal)
    body += TAG.svg(ts, cx - tw / 2, top + wh + 30, pal)
    body += sub.svg(ss, cx - sw / 2, top + wh + 30 + th + 26,
                    {"ink": GOLD_LIGHT, "gold": GOLD_LIGHT})
    return svg_doc(W, H, body, title="أثر — ختمة قرآنية جماعية")


def write(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    print("wrote", path.relative_to(ROOT))


def build_svg():
    for name, pal in PALETTES.items():
        write(LOGO_DIR / f"athar-mark-{name}.svg", logo_mark(pal))
        write(LOGO_DIR / f"athar-wordmark-{name}.svg", logo_wordmark(pal))
        write(LOGO_DIR / f"athar-horizontal-{name}.svg", logo_horizontal(pal))
        write(LOGO_DIR / f"athar-stacked-{name}.svg", logo_stacked(pal))
    # web copies
    write(PUBLIC / "favicon.svg", favicon_svg())
    write(PUBLIC / "logo-mark.svg", logo_mark(PALETTES["color"]))
    write(PUBLIC / "logo-mark-reversed.svg", logo_mark(PALETTES["reversed"]))
    write(PUBLIC / "logo-horizontal.svg", logo_horizontal(PALETTES["color"]))
    write(PUBLIC / "logo-horizontal-reversed.svg", logo_horizontal(PALETTES["reversed"]))
    write(LOGO_DIR / "athar-app-icon.svg", app_icon_svg(512, 0.78))
    write(LOGO_DIR / "athar-app-icon-maskable.svg", app_icon_svg(512, 0.58, rounded=False))
    write(LOGO_DIR / "athar-apple-touch.svg", app_icon_svg(180, 0.80, rounded=False))
    write(LOGO_DIR / "athar-og.svg", og_svg())


# ---------------------------------------------------------------- raster
def render(svg_path, out_png, w, h, transparent=True):
    """Rasterise an SVG with headless Edge at exactly w x h."""
    from PIL import Image
    svg_path = Path(svg_path).resolve()
    with tempfile.TemporaryDirectory() as td:
        html = Path(td) / "r.html"
        html.write_text(
            f'<!doctype html><meta charset="utf-8"><style>html,body{{margin:0;padding:0;'
            f'background:transparent;overflow:hidden}}img{{display:block;width:{w}px;height:{h}px}}</style>'
            f'<img src="{svg_path.as_uri()}">', encoding="utf-8")
        shot = Path(td) / "s.png"
        cmd = [EDGE, "--headless", "--disable-gpu", "--hide-scrollbars",
               "--force-device-scale-factor=1",
               "--default-background-color=00000000" if transparent else "--default-background-color=FFFFFFFF",
               f"--window-size={w},{h + 120}", f"--screenshot={shot}", html.as_uri()]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
        im = Image.open(shot).convert("RGBA").crop((0, 0, w, h))
        Path(out_png).parent.mkdir(parents=True, exist_ok=True)
        im.save(out_png)
        print("png", Path(out_png).relative_to(ROOT), im.size)
        return im


def write_ico(path, pngs):
    """Hand-roll an ICO with PNG-compressed entries (one real render per size)."""
    import io
    entries = []
    for im in pngs:
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        entries.append((im.width, im.height, buf.getvalue()))
    header = struct.pack("<HHH", 0, 1, len(entries))
    offset = 6 + 16 * len(entries)
    dirs, blobs = b"", b""
    for w, h, data in entries:
        dirs += struct.pack("<BBBBHHII", w % 256, h % 256, 0, 0, 1, 32, len(data), offset + len(blobs))
        blobs += data
    Path(path).write_bytes(header + dirs + blobs)
    print("ico", Path(path).relative_to(ROOT), [e[0] for e in entries])


def build_png():
    fav = PUBLIC / "favicon.svg"
    ico_imgs = [render(fav, ROOT / "brand" / "tools" / f"_fav{s}.png", s, s) for s in (16, 32, 48)]
    write_ico(PUBLIC / "favicon.ico", ico_imgs)
    for s in (16, 32, 48):
        (ROOT / "brand" / "tools" / f"_fav{s}.png").unlink(missing_ok=True)
    render(LOGO_DIR / "athar-apple-touch.svg", PUBLIC / "apple-touch-icon.png", 180, 180, transparent=False)
    render(LOGO_DIR / "athar-app-icon.svg", PUBLIC / "icon-192.png", 192, 192)
    render(LOGO_DIR / "athar-app-icon.svg", PUBLIC / "icon-512.png", 512, 512)
    render(LOGO_DIR / "athar-app-icon-maskable.svg", PUBLIC / "icon-maskable-512.png", 512, 512, transparent=False)
    render(LOGO_DIR / "athar-og.svg", PUBLIC / "og-image.png", 1200, 630, transparent=False)
    manifest = {
        "name": "أثر — ختمة قرآنية جماعية",
        "short_name": "أثر",
        "description": "ختمة قرآنية جماعية: احجز جزءك واقرأ وادعُ لأرواح الشهداء.",
        "lang": "ar",
        "dir": "rtl",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "background_color": "#FDFBF7",
        "theme_color": FOREST,
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
            {"src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml"},
        ],
    }
    write(PUBLIC / "site.webmanifest", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("svg", "all"):
        build_svg()
    if what in ("png", "all"):
        build_png()
