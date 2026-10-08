# Median-filtered 2K copies of the Tripo colour maps (the remote's; the unit and the speaker are modelled now) for hifi_paint.py's classification (the AI paint is speckled at
# the texel; the filter keeps the regions and drops the flecks). Reads .source-assets/hifi/tex/<piece>-basecolor.png,
# the colour maps of the *-4k.glb exports (extracted with gltf-transform), writes <piece>-median.png beside them.
#   python scripts/models/hifi_median.py
from PIL import Image, ImageFilter
for n in ('remote',):
    im = Image.open(f'.source-assets/hifi/tex/{n}-basecolor.png').convert('RGB').resize((2048, 2048), Image.LANCZOS)
    im.filter(ImageFilter.MedianFilter(5)).save(f'.source-assets/hifi/tex/{n}-median.png')
    print(n)
