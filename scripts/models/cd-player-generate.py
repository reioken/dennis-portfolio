"""The CD player next to the claw machine: concept images and the Meshy model.
usage: MESHY_API_KEY=... python scripts/models/cd-player-generate.py image <name> "<prompt>" [aspect]
       MESHY_API_KEY=... python scripts/models/cd-player-generate.py edit <name> "<prompt>" <reference.png|jpg>
       MESHY_API_KEY=... python scripts/models/cd-player-generate.py model <name> <image.png|jpg> [polycount]
image: Meshy text-to-image with Google's nano-banana-pro (Gemini 3 Pro Image; the Gemini API key here is free tier, which
       has no image quota), downloads <name>-0.png ... into .source-assets/cd-player/. edit: the same through
       image-to-image, changing a reference picture.
model: Meshy image-to-3D (meshy-7, PBR, remeshed) from one picture (downscale it first: a multi-megabyte data URI is
       refused), downloads <name>.glb. Every task keeps a resumable state-<name>.json, so nothing is requested twice.
The key lives only in the environment."""
import json, os, sys
from pathlib import Path
sys.path.insert(0, 'C:/Users/denni/Projects/survivorlike/tools')
from meshy import MeshyClient, image_data_uri, poll_task, ensure_balance

mode, name = sys.argv[1], sys.argv[2]
key = os.environ.get('MESHY_API_KEY', '').strip()
if not key.startswith('msy_'):
    raise SystemExit('MESHY_API_KEY missing; nothing was requested.')
root = Path(__file__).resolve().parents[2] / '.source-assets' / 'cd-player'
root.mkdir(parents=True, exist_ok=True)
state_file = root / f'state-{name}.json'
state = json.loads(state_file.read_text()) if state_file.exists() else {}
client = MeshyClient(key)

if mode in ('image', 'edit'):
    # edit: image-to-image, the same object changed by the prompt (<name> "<prompt>" <reference.png|jpg>)
    prompt = sys.argv[3]
    aspect = sys.argv[4] if mode == 'image' and len(sys.argv) > 4 else '1:1'
    endpoint = 'text-to-image' if mode == 'image' else 'image-to-image'
    if 'task' not in state:
        ensure_balance(client, 12, name)
        state.update(endpoint=endpoint, prompt=prompt, balance_before=client.balance())
        payload = {'ai_model': 'nano-banana-pro', 'prompt': prompt}
        if mode == 'image':
            payload['aspect_ratio'] = aspect
            state['aspect'] = aspect
        else:
            payload['reference_image_urls'] = [image_data_uri(Path(sys.argv[4]))]
            state['reference'] = sys.argv[4]
        state['task'] = client.create(endpoint, payload)
        state_file.write_text(json.dumps(state, indent=2))
    task = poll_task(client, endpoint, state['task'], 5, 900, lambda t: None)
    urls = task.get('image_urls') or []
    if not urls:
        raise SystemExit('No image in the finished task.')
    for i, url in enumerate(urls):
        client.download(url, root / f'{name}-{i}.png')
    state.update(status='SUCCEEDED', images=len(urls), credits=task.get('consumed_credits'))
    state_file.write_text(json.dumps(state, indent=2))
    print('IMAGE', name, len(urls), 'credits', task.get('consumed_credits'))
elif mode == 'model':
    image = Path(sys.argv[3])
    polys = int(sys.argv[4]) if len(sys.argv) > 4 else 30000
    endpoint, out = 'image-to-3d', root / f'{name}.glb'
    if 'task' not in state:
        ensure_balance(client, 30, name)
        state.update(endpoint=endpoint, image=str(image), polycount=polys, balance_before=client.balance())
        state['task'] = client.create(endpoint, {
            'image_url': image_data_uri(image), 'ai_model': 'meshy-7', 'model_type': 'standard',
            'should_texture': True, 'enable_pbr': True, 'image_enhancement': False,
            'should_remesh': True, 'topology': 'triangle', 'target_polycount': polys,
            'symmetry_mode': 'auto', 'target_formats': ['glb'],
        })
        state_file.write_text(json.dumps(state, indent=2))
    task = poll_task(client, endpoint, state['task'], 8, 1800, lambda t: None)
    url = (task.get('model_urls') or {}).get('glb')
    if not url:
        raise SystemExit('No GLB in the finished task.')
    client.download(url, out)
    state.update(status='SUCCEEDED', bytes=out.stat().st_size, credits=task.get('consumed_credits'))
    state_file.write_text(json.dumps(state, indent=2))
    print('MODEL', name, out.stat().st_size, 'credits', task.get('consumed_credits'))
else:
    raise SystemExit('mode is image or model')
