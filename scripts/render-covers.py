import fitz
from glob import glob
from pathlib import Path

dest = Path(r"C:\Users\denni\Projects\dennis-portfolio\public\media")


def render_pdf(pdf_path, out_dir, prefix, pages=(0, 1, 2), zoom=1.5, max_w=1600):
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    written = []
    for i in pages:
        if i >= len(doc):
            break
        page = doc[i]
        scale = zoom
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        if pix.width > max_w:
            scale = zoom * (max_w / pix.width)
            pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        out = out_dir / f"{prefix}-{i + 1}.jpg"
        pix.save(str(out), output="jpg", jpg_quality=82)
        written.append((out.name, pix.width, pix.height, out.stat().st_size))
    doc.close()
    return written


def find_one(pattern):
    hits = glob(pattern)
    return hits[0] if hits else None


jobs = []
mina = find_one(r"G:\My Drive\*Mina*.pdf") or find_one(r"G:\My Drive\*Case Study*.pdf")
print("MINA", mina)
if mina:
    jobs.append((mina, dest / "mina", "mina", (0, 1, 2, 3)))

style = find_one(r"G:\My Drive\Sport*Styleguide*.pdf")
print("STYLE", style)
if style:
    jobs.append((style, dest / "sportmueller", "styleguide", (0, 1, 2)))

cat = find_one(r"G:\My Drive\Sport*Kategorie*.pdf")
print("CAT", cat)
if cat:
    jobs.append((cat, dest / "sportmueller", "category", (0,)))

prod = find_one(r"G:\My Drive\Sport*Produkt*.pdf")
print("PROD", prod)
if prod:
    jobs.append((prod, dest / "sportmueller", "product", (0,)))

for pdf, out, prefix, pages in jobs:
    try:
        print("OK", prefix, render_pdf(pdf, out, prefix, pages))
    except Exception as e:
        print("FAIL", prefix, e)

try:
    from PIL import Image

    forever = dest / "forever"
    for name in [
        "product-1.jpg",
        "product-2.jpg",
        "flyer.png",
        "flyer-2.png",
        "banner-1.png",
        "banner-2.png",
    ]:
        p = forever / name
        if not p.exists():
            continue
        im = Image.open(p).convert("RGB")
        im.thumbnail((1600, 1600))
        out = forever / f"{p.stem}-web.jpg"
        im.save(out, "JPEG", quality=82, optimize=True)
        print("WEB", out.name, out.stat().st_size)
except Exception as e:
    print("PIL", e)

# Floordirekt branded cover from logo if needed
try:
    from PIL import Image, ImageDraw

    logo = dest / "floordirekt" / "studio-lockup.png"
    if logo.exists():
        canvas = Image.new("RGB", (1600, 1000), (18, 22, 28))
        mark = Image.open(logo).convert("RGBA")
        mark.thumbnail((900, 320))
        x = (1600 - mark.width) // 2
        y = (1000 - mark.height) // 2
        canvas.paste(mark, (x, y), mark)
        out = dest / "floordirekt" / "cover.jpg"
        canvas.save(out, "JPEG", quality=88)
        print("FD", out)
except Exception as e:
    print("FD", e)
