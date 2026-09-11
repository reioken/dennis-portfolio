"""Remove the approved portrait background locally without regenerating its RGB pixels."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from rembg import new_session, remove

root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'public/media/me/portrait-poster-1122.webp').convert('RGB')
session = new_session('birefnet-portrait', providers=['CPUExecutionProvider'])
mask = remove(source, session=session, only_mask=True)
alpha = np.array(mask)
alpha[alpha > 250] = 255
alpha[alpha < 3] = 0
mask = Image.fromarray(alpha, 'L')
rgba = source.convert('RGBA')
rgba.putalpha(mask)
out = root / '.source-assets/portrait-cutout-v3.png'
out.parent.mkdir(parents=True, exist_ok=True)
rgba.save(out)
for width in (1122, 640):
    image = rgba if width == rgba.width else rgba.resize((width, round(width * rgba.height / rgba.width)), Image.Resampling.LANCZOS)
    image.save(root / f'public/media/me/portrait-cutout-v3-{width}.webp', quality=94, method=6)
alpha = np.asarray(mask)
assert alpha[0, 0] == 0 and alpha[-1, alpha.shape[1] // 2] > 250
assert np.array_equal(np.asarray(rgba)[..., :3], np.asarray(source))
print(json.dumps({'output': str(out), 'transparentPixels': int((alpha == 0).sum()), 'softEdgePixels': int(((alpha > 0) & (alpha < 255)).sum()), 'originalRgbPreserved': True}))
