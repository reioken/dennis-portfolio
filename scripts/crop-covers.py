from pathlib import Path
from PIL import Image

media = Path(r"C:\Users\denni\Projects\dennis-portfolio\public\media")

jobs = [
    # (src, dest, note)
    (media / "mina" / "mina-1.jpg", media / "mina" / "cover.jpg"),
    (media / "sportmueller" / "styleguide-1.jpg", media / "sportmueller" / "cover.jpg"),
    (media / "sportmueller" / "category-1.jpg", media / "sportmueller" / "gallery-1.jpg"),
    (media / "sportmueller" / "product-1.jpg", media / "sportmueller" / "gallery-2.jpg"),
]


def crop_top_16x10(src: Path, dest: Path, max_w=1600):
    im = Image.open(src).convert("RGB")
    # take top band at 16:10
    target_h = int(im.width * 10 / 16)
    if target_h > im.height:
        target_h = im.height
        target_w = int(target_h * 16 / 10)
        left = (im.width - target_w) // 2
        box = (left, 0, left + target_w, target_h)
    else:
        box = (0, 0, im.width, target_h)
    cropped = im.crop(box)
    cropped.thumbnail((max_w, int(max_w * 10 / 16)))
    dest.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(dest, "JPEG", quality=85, optimize=True)
    print(dest.name, cropped.size, dest.stat().st_size)


for src, dest in jobs:
    if src.exists():
        crop_top_16x10(src, dest)
    else:
        print("missing", src)

# Also render more mina pages cropped if we only got page 0 as one giant page
# Re-render mina with clip to first screenful using pymupdf
import fitz
from glob import glob

mina_pdf = glob(r"G:\My Drive\*Case Study*.pdf") or glob(r"G:\My Drive\*Mina*.pdf")
if mina_pdf:
    doc = fitz.open(mina_pdf[0])
    out_dir = media / "mina"
    for i in range(min(4, len(doc))):
        page = doc[i]
        # clip top 16:10 of page rect
        r = page.rect
        clip_h = r.width * 10 / 16
        clip = fitz.Rect(r.x0, r.y0, r.x1, min(r.y1, r.y0 + clip_h))
        # fit width 1600
        zoom = 1600 / clip.width
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip, alpha=False)
        out = out_dir / f"slide-{i + 1}.jpg"
        pix.save(str(out), output="jpg", jpg_quality=85)
        print("slide", out.name, pix.width, pix.height)
    doc.close()
