"""Blue v4: higher-quality model through Meshy. Resumable per stage; the credential comes from MESHY_API_KEY and is
never printed or saved.

  python generate.py images            image-to-image multi-view turnarounds from the reference (two image models)
  python generate.py text              text-to-3D preview, then refine with PBR 4k
  python generate.py mesh NAME a.png b.png [c.png d.png]   multi-image-to-3D (first image = front), meshy-7 ultra, quad 80k
"""
import sys, json, hashlib, os, time
from pathlib import Path
sys.path.insert(0, 'C:/Users/denni/Projects/survivorlike/tools')
from meshy import MeshyClient, image_data_uri, MeshyError, poll_task

ROOT = Path(__file__).resolve().parents[2] / '.source-assets/blue/v4'
REF = ROOT.parent / 'reference' / 'blue-standing-v1.png'
key = os.environ.get('MESHY_API_KEY', '').strip()
if not key.startswith('msy_'): raise SystemExit('MESHY_API_KEY missing; nothing was requested.')
client = MeshyClient(key)
# Text-to-3D lives under /openapi/v2; the adapter defaults to v1.
client_v2 = MeshyClient(key); client_v2._base = 'https://api.meshy.ai/openapi/v2'
stage = sys.argv[1] if len(sys.argv) > 1 else 'images'

DESCRIPTION = ('a stocky British Shorthair-type black cat with a broad round head, full round cheeks, a short muzzle, a small black nose, '
               'small rounded wide-set ears with pink inside, very large round amber-yellow eyes with big round dark pupils, dense short '
               'smooth black fur and a thick medium-length tail')
TURNAROUND = ('Clean character turnaround of this exact cat for 3D modelling: ' + DESCRIPTION + '. Standing squarely on all four legs '
              'in a neutral pose, legs slightly apart, head level and looking straight ahead, mouth closed, tail relaxed and slightly '
              'raised behind. Even soft studio lighting without cast shadows, plain light grey background, whole body in frame, the '
              'same cat in the same pose in every view.')
TEXT_PROMPT = ('A cute stylized black domestic cat: ' + DESCRIPTION + '. Standing naturally on all four legs, legs slightly apart, head '
               'up looking forward, mouth closed, tail relaxed behind. Clean symmetric character mesh for rigging, smooth fur volume, '
               'no base, no props.')
TEXTURE_PROMPT = ('dense short black fur with a soft velvet sheen, pink skin inside the ears, small black nose, large round amber-yellow '
                  'eyes with big round dark pupils and a small bright catchlight, dark paw pads, no white markings')

def state_file(name): return ROOT / f'state-{name}.json'
def load(name):
    f = state_file(name); return json.loads(f.read_text()) if f.exists() else {}
def save(name, data):
    f = state_file(name); tmp = f.with_suffix('.tmp'); tmp.write_text(json.dumps(data, indent=2)); tmp.replace(f)

def run_task(name, endpoint, payload, cost, api=None):
    """Create once (guarded by the state file), then poll to completion; returns the task object."""
    api = api or client
    st = load(name)
    if not st.get('task_id'):
        if st.get('submission_started'): raise MeshyError(f'{name}: an earlier submission is uncertain; inspect Meshy before retrying.')
        balance = client.balance(); print(f'{name}: balance {balance}, planned {cost}', flush=True)
        if balance < cost: raise MeshyError('insufficient credits')
        st.update(submission_started=True, endpoint=endpoint, balance_before=balance,
                  payload={k: (v if not (isinstance(v, str) and v.startswith('data:')) else '<data-uri>') for k, v in payload.items()} if not isinstance(payload.get('reference_image_urls'), list) else {**payload, 'reference_image_urls': ['<data-uri>'] * len(payload['reference_image_urls'])})
        if 'image_urls' in payload: st['payload']['image_urls'] = ['<data-uri>'] * len(payload['image_urls'])
        save(name, st)
        try:
            st['task_id'] = api.create(endpoint, payload)
        except MeshyError as error:
            # A 4xx here means nothing was created; leave the stage retryable.
            if 'Meshy API 4' in str(error): st['submission_started'] = False; save(name, st)
            raise
        save(name, st)
        print(f'{name}: submitted {st["task_id"]}', flush=True)
    def update(task):
        st['response'] = task; save(name, st)
    task = poll_task(api, endpoint, st['task_id'], 12, 3600, update)
    st['balance_after'] = client.balance(); save(name, st)
    print(f'{name}: done, consumed {task.get("consumed_credits")}', flush=True)
    return task

def download_images(task, prefix):
    out = []
    for i, url in enumerate(task.get('image_urls') or []):
        dest = ROOT / f'{prefix}-{i}.png'
        if not dest.exists(): client.download(url, dest)
        out.append(dest); print('saved', dest.name, flush=True)
    return out

def download_model(task, name):
    urls = task.get('model_urls') or {}
    for kind, suffix in (('glb', '.glb'), ('pre_remeshed_glb', '-pre.glb')):
        if urls.get(kind):
            dest = ROOT / f'{name}{suffix}'
            if not dest.exists(): client.download(urls[kind], dest)
            print('saved', dest.name, dest.stat().st_size, flush=True)
    for kind, url in (task.get('thumbnail_urls') or {}).items():
        dest = ROOT / f'{name}-thumb-{kind}.png'
        if not dest.exists(): client.download(url, dest)
    if task.get('thumbnail_url'):
        dest = ROOT / f'{name}-thumb.png'
        if not dest.exists(): client.download(task['thumbnail_url'], dest)

try:
    if stage == 'images':
        ref = image_data_uri(REF)
        for model in ('gpt-image-2', 'nano-banana-pro'):
            task = run_task(f'images-{model}', 'image-to-image', dict(ai_model=model, prompt=TURNAROUND, reference_image_urls=[ref],
                            generate_multi_view=True, remove_background=False), 12)
            download_images(task, f'turn-{model}')
    elif stage == 'text':
        preview = run_task('text-preview', 'text-to-3d', dict(mode='preview', prompt=TEXT_PROMPT, ai_model='latest', ultra_mode=True,
                           should_remesh=True, topology='quad', target_polycount=80000, art_style='realistic', target_formats=['glb'],
                           alpha_thumbnail=True), 25, api=client_v2)
        download_model(preview, 'text-preview')
        refine = run_task('text-refine', 'text-to-3d', dict(mode='refine', preview_task_id=preview['id'], enable_pbr=True,
                          texture_resolution='4k', texture_prompt=TEXTURE_PROMPT, target_formats=['glb'], alpha_thumbnail=True), 10, api=client_v2)
        download_model(refine, 'text-refine')
    elif stage == 'mesh':
        name = sys.argv[2]; images = [Path(p) for p in sys.argv[3:]]
        if not 1 <= len(images) <= 4: raise SystemExit('1-4 images')
        task = run_task(f'mesh-{name}', 'multi-image-to-3d', dict(image_urls=[image_data_uri(p) for p in images], ai_model='latest',
                        ultra_mode=True, should_texture=True, enable_pbr=True, texture_resolution='4k', texture_prompt=TEXTURE_PROMPT,
                        should_remesh=True, topology='quad', target_polycount=80000, save_pre_remeshed_model=True,
                        target_formats=['glb'], alpha_thumbnail=True, multi_view_thumbnails=True), 40)
        download_model(task, f'mesh-{name}')
    else:
        raise SystemExit('unknown stage')
except Exception as exc:
    print('Stopped:', str(exc).replace(key, '[REDACTED]'), flush=True); sys.exit(1)
