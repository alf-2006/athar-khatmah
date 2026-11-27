"""WCAG contrast check for the key text/background pairs in src/tokens.css.
Run: python brand/tools/check_contrast.py
Needs 4.5 for normal text, 3.0 for large text / UI components.
"""
import re
import pathlib

CSS = pathlib.Path(__file__).resolve().parents[2] / "src" / "tokens.css"
text = CSS.read_text(encoding="utf-8")


def block(selector):
    m = re.search(re.escape(selector) + r"\s*\{(.*?)\n\}", text, re.S)
    out = {}
    for name, val in re.findall(r"(--ath-[\w-]+)\s*:\s*([^;]+);", m.group(1)):
        out[name] = val.strip()
    return out


light = block(":root")
dark = {**light, **block('[data-theme="dark"]')}


def resolve(tokens, name, depth=0):
    v = tokens[name]
    m = re.fullmatch(r"var\((--ath-[\w-]+)\)", v)
    if m and depth < 8:
        return resolve(tokens, m.group(1), depth + 1)
    return v


def rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (f(x) for x in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = sorted((lum(rgb(a)), lum(rgb(b))), reverse=True)
    return (la + 0.05) / (lb + 0.05)


PAIRS = [
    # (foreground, background, label, needed)
    ("--ath-text", "--ath-bg", "نص أساسي على الخلفية", 4.5),
    ("--ath-text-strong", "--ath-bg", "عنوان على الخلفية", 4.5),
    ("--ath-text-muted", "--ath-bg", "نص ثانوي على الخلفية", 4.5),
    ("--ath-text-muted", "--ath-bg-band", "نص ثانوي على الشريط", 4.5),
    ("--ath-text", "--ath-surface", "نص على البطاقة", 4.5),
    ("--ath-accent-text", "--ath-bg", "نص ذهبي على الخلفية", 4.5),
    ("--ath-accent-text", "--ath-bg-band", "نص ذهبي على الشريط", 4.5),
    ("--ath-on-primary", "--ath-primary", "نص الزر الأساسي", 4.5),
    ("--ath-available-text", "--ath-available-bg", "حالة متاح", 4.5),
    ("--ath-reserved-text", "--ath-reserved-bg", "حالة محجوز", 4.5),
    ("--ath-done-text", "--ath-done-bg", "حالة مكتمل", 4.5),
    ("--ath-success-text", "--ath-success-bg", "رسالة نجاح", 4.5),
    ("--ath-warn-text", "--ath-warn-bg", "رسالة تحذير", 4.5),
    ("--ath-danger-text", "--ath-danger-bg", "رسالة خطأ", 4.5),
    ("--ath-on-hero", "--ath-hero", "نص الهيرو", 4.5),
    ("--ath-hero-muted", "--ath-hero", "نص الهيرو الثانوي", 4.5),
    ("--ath-hero-cta-text", "--ath-hero-cta-bg", "زر الهيرو", 4.5),
    ("--ath-on-footer", "--ath-footer", "نص الفوتر", 4.5),
    ("--ath-toast-text", "--ath-toast-bg", "التنبيه", 4.5),
    ("--ath-tint-fg", "--ath-tint-bg", "أيقونة القسم", 3.0),
    ("--ath-focus", "--ath-bg", "حلقة التركيز", 3.0),
]

bad = 0
for theme, toks in (("light", light), ("dark", dark)):
    print(f"\n== {theme} ==")
    for fg, bg, label, need in PAIRS:
        try:
            a, b = resolve(toks, fg), resolve(toks, bg)
            r = ratio(a, b)
        except Exception as e:  # alpha or unparsable
            print(f"  ?  {label}: {e}")
            continue
        ok = r >= need
        bad += not ok
        print(f"  {'OK ' if ok else 'FAIL'} {r:5.2f} (>= {need})  {label:28s} {a} on {b}")
print("\nfailures:", bad)
