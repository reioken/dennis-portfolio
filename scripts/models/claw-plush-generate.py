"""Claw-machine plush prizes: OpenAI reference image -> Meshy image-to-3D (textured, remeshed).
usage: MESHY_API_KEY=... python scripts/models/claw-plush-generate.py <name> [polycount]
Reads .source-assets/claw-plush/<name>.jpg (the PNG original downscaled: multi-megabyte data URIs are refused), keeps a resumable state-<name>.json (a finished or
running task is never requested twice) and downloads <name>.glb beside it. The key lives only
in the environment."""
import json, os, sys
from pathlib import Path
sys.path.insert(0, 'C:/Users/denni/Projects/survivorlike/tools')
from meshy import MeshyClient, image_data_uri, poll_task, ensure_balance

name = sys.argv[1]
polys = int(sys.argv[2]) if len(sys.argv) > 2 else 12000
key = os.environ.get('MESHY_API_KEY', '').strip()
if not key.startswith('msy_'):
    raise SystemExit('MESHY_API_KEY missing; nothing was requested.')
root = Path(__file__).resolve().parents[2] / '.source-assets' / 'claw-plush'
image, state_file, out = root / f'{name}.jpg', root / f'state-{name}.json', root / f'{name}.glb'
state = json.loads(state_file.read_text()) if state_file.exists() else {}
client = MeshyClient(key)
endpoint = 'image-to-3d'
if 'task' not in state:
    ensure_balance(client, 30, name)
    state['task'] = client.create(endpoint, {
        'image_url': image_data_uri(image), 'ai_model': 'meshy-7', 'model_type': 'standard',
        'should_texture': True, 'enable_pbr': True, 'image_enhancement': False,
        'should_remesh': True, 'topology': 'triangle', 'target_polycount': polys,
        'symmetry_mode': 'off', 'target_formats': ['glb'],
    })
    state_file.write_text(json.dumps(state, indent=2))
task = poll_task(client, endpoint, state['task'], 8, 1800, lambda t: None)
url = (task.get('model_urls') or {}).get('glb')
if not url:
    raise SystemExit('No GLB in the finished task.')
client.download(url, out)
state.update(status='SUCCEEDED', bytes=out.stat().st_size)
state_file.write_text(json.dumps(state, indent=2))
print('PLUSH', name, out.stat().st_size)
