"""Import the supplied revised marketing set without recreating its content."""
from pathlib import Path
from PIL import Image
import shutil, json
root=Path(__file__).resolve().parents[2]
source=Path('C:/Users/denni/Projects/Spotify/design/marketing')
dest=root/'public/media/lowlight'
(dest/'shots').mkdir(parents=True,exist_ok=True)
(dest/'screens').mkdir(exist_ok=True)
files=['01-hero','02-album-colors','03-frosted-glass','04-adaptive-layouts','05-lyrics-and-visuals','06-playing']
for name in files:
    im=Image.open(source/'revised'/(name+'.png')).convert('RGB')
    im.save(dest/'shots'/(name+'.webp'),'WEBP',quality=93,method=6)
    im.save(dest/'shots'/(name+'.avif'),'AVIF',quality=85,speed=6)
    small=im.copy();small.thumbnail((960,600))
    small.save(dest/'shots'/(name+'@sm.webp'),'WEBP',quality=90,method=6)
    small.save(dest/'shots'/(name+'@sm.avif'),'AVIF',quality=85,speed=6)
    if name=='01-hero':
        im.save(dest/'cover.webp','WEBP',quality=93,method=6)
for name in ['wide-visualizer','lyrics-and-visuals','playing','landscape']:
    im=Image.open(source/'raw'/(name+'.png')).convert('RGBA')
    matte=Image.new('RGBA',im.size,'#0b0e14');matte.alpha_composite(im)
    matte.convert('RGB').save(dest/'screens'/(name+'.webp'),'WEBP',quality=93,method=6)
shutil.copyfile('C:/Users/denni/Projects/Spotify/src-tauri/icons/icon.svg',dest/'logo.svg')
(root/'.source-assets/polish-2026-09-11/lowlight-import.json').write_text(json.dumps({
    'source':str(source/'revised'),'screenshots':files,'screen_source':str(source/'raw'),
    'logo_source':'Spotify/src-tauri/icons/icon.svg','marketing_status':'staged frontend captures; glass effect illustrated'},indent=2))
print('Imported 6 marketing screenshots, 4 screen captures and the current Lowlight logo.')
