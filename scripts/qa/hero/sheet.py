#!/usr/bin/env python3
# Contact sheet of the 14 all-stations captures (7x2) to compare wear features side by side.
# usage: python scripts/qa/hero/sheet.py <all-stations-out-dir> <sheet.jpg>   (both outside the repo)
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))

if len(sys.argv) < 3:
    sys.exit("usage: python scripts/qa/hero/sheet.py <all-stations-out-dir> <sheet.jpg>")
src, out = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
if os.path.commonpath([out, ROOT]) == ROOT:
    sys.exit("refusing to write inside the project (%s).\nVite reloads the dev server on any file change under %s." % (out, ROOT))

cells = []
for i in range(1, 15):
    im = Image.open(os.path.join(src, "%02d-case.png" % i)).convert("RGB")
    cells.append(im.crop((100, 0, 800, 1000)).resize((420, 600), Image.LANCZOS))
sheet = Image.new("RGB", (420 * 7, 600 * 2), (8, 8, 10))
for i, im in enumerate(cells):
    sheet.paste(im, ((i % 7) * 420, (i // 7) * 600))
sheet.save(out, quality=90)
print("sheet", out)
