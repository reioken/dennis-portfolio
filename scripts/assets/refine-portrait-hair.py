from pathlib import Path
import sys
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'.source-assets/python-cutout'))
from PIL import Image, ImageDraw, ImageFilter, ImageChops
im=Image.open(root/'.source-assets/portrait-wide-cutout-matted.png').convert('RGBA')
assert im.size == (1145,1086), 'This correction is specific to the approved wide portrait.'
mask=Image.new('L',im.size);d=ImageDraw.Draw(mask)
# Background enclosed by individual curls, in the original 1145 x 1086 matte.
for polygon in [
 [(766,235),(773,237),(779,245),(783,252),(784,258),(777,265),(770,271),(767,278),(763,278),(761,271),(765,259),(764,247)],
 [(716,370),(724,366),(734,366),(739,371),(737,377),(727,379),(719,376)],
 [(726,452),(733,457),(738,465),(741,474),(741,480),(737,483),(730,484),(720,482),(726,474),(725,467),(721,461)],
 [(372,469),(379,465),(384,465),(387,469),(383,476),(378,481),(374,486),(370,484),(370,477)]
]: d.polygon(polygon,fill=255)
mask=mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.2))
im.putalpha(ImageChops.multiply(im.getchannel('A'),ImageChops.invert(mask)))
im.save(root/'.source-assets/portrait-wide-hair-clean.png')
plate=Image.new('RGBA',im.size,'#211e2b');plate.alpha_composite(im);plate.convert('RGB').save(root/'.source-assets/hair-clean-preview.jpg',quality=98)
for label,box in [('right',(680,160,840,540)),('left',(345,340,440,530))]:
 plate.crop(box).resize(((box[2]-box[0])*3,(box[3]-box[1])*3)).convert('RGB').save(root/f'.source-assets/hair-clean-{label}.jpg',quality=98)



# Versioned URLs invalidate previously cached cutouts at both responsive sizes.
for width in (1200,640):
    resized=im.resize((width,round(width*im.height/im.width)),Image.Resampling.LANCZOS)
    resized.save(root/f'public/media/me/portrait-wide-v2-{width}.webp',quality=94,method=6)
original=Image.open(root/'.source-assets/portrait-wide-cutout-matted.png').convert('RGBA')
assert ImageChops.difference(original.convert('RGB'),im.convert('RGB')).getbbox() is None
print('Hair alpha refined; all source RGB pixels preserved; exported 1200px and 640px WebP.')
