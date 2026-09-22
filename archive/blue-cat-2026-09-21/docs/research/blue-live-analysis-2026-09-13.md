# Blue — live analysis before the next round (2026-09-13)

Written after the deep-analysis brief in `HANDOVER-NEXT-AGENT.md`. Nothing in the site was changed for this document. Everything below was measured on the live deployment `a05c6a26` (build of `04bc0a4`) and, for per-frame numbers, on the dev server running the same commit.

## 1. Method

- **Live recordings.** Headless Chromium (Playwright, `--use-angle=d3d11`) on `https://www.dennisbf.design/` at 1440×900 and 390×844, CDP screencast at 60 fps, the cat located each 40 ms through the accessible pet button the runtime keeps over him. Sequences: hover wake, first roam, station change, head and body touch while seated, About from Riftback, ledge touch, climb-down, and About from a fresh home load on both viewports. Frame strips at 100–200 ms plus 50 ms and 16 ms strips of the turn, the walk, the sit and the jumps. No page errors, no failed requests; only CSS preload warnings.
- **Runtime traces.** On the dev server (`window.__hall.blue`), the render loop stopped and `update()` stepped at 1/60 s: turn to a goal 129° away, straight walk at 0.34 m/s, sit, jump onto the cabinet, jump down. Per frame: yaw, yaw rate, speed, world height of every paw, chest, pelvis and head.
- **Reference.** Dennis's photos in `.source-assets/blue/photos/` and a cited synthesis of feline gait and jump studies (pressure-walkway velocities, landing biomechanics; the turn and sit numbers in that synthesis are marked approximate, they come from video observation, not papers).
- **Evidence** (local, ignored): `.source-assets/blue/qa/live-analysis-2026-09-13/` — strips, tracks, close-ups, and the probe scripts (`live-strip.mjs`, `restrip.mjs`, `dense.mjs`, `live-about.mjs`, `dev-trace.mjs`, `dev-eyes.mjs`, `dev-trace.json`).

## 2. Findings, behaviour by behaviour

Numbers are measured unless marked *ref* (reference) or *approx*.

### Turn in place (Dennis: "he still just spins", "turns without an animation")

| | Blue live | Real cat (*ref, approx*) |
| --- | --- | --- |
| 90° turn duration | 2.1 s (4 beats × 0.37 s + 0.2 s lead-in + 0.4 s settle) | 0.4–0.8 s, one continuous motion |
| 129° turn duration | 3.45 s until the walk starts (90° clip ×1.25, dead settle 0.5 s, then a 45° clip ×0.36 with its own 0.2 s lead-in and 0.4 s settle) | ≈0.8 s |
| Yaw profile | six equal jerks of 28° (16° in the second clip), each 0.25 s at a 150–170°/s peak, full stop between jerks | head first (0.1–0.2 s ahead), body follows in one decelerating sweep |
| Body during the turn | chest dips 6 mm per step; no weight shift readable at 110 px | visible lean onto the planted diagonal |

The stepped choreography works as authored (paws do lift 5 cm and the yaw does advance only while a pair is airborne), but the rhythm is a metronome: equal angles, equal pauses, a half-second of nothing at the end, and a second clip glued on for the remainder. At 60 fps this reads as a turntable that ticks. The frame-exact strip (`B-roam-dense-8.95-9.45.png`) shows one tick: 28° inside 0.25 s, then a hold.

### Walk (Dennis: "robotic", "not dynamic")

| | Blue live at 0.34 m/s | Real slow walk (*ref*) |
| --- | --- | --- |
| Cadence | 1.47 strides/s | 1.1–1.3 strides/s at 0.55–0.65 m/s |
| Stride length | 23 cm (fixed by `STRIDE_SPEED` 0.19 m/s × 1.2 s cycle; the clip is sped up to match speed) | ≈45–55 cm |
| Trunk bob | 1.2 cm peak-to-peak | 0.5–1.5 cm (*approx*) |
| Head bob | 1.2 cm, identical phase to the trunk (rigid with it) | 2–3 cm with its own timing (*approx*) |
| Paw lift | 4.5 cm front, 3.8 cm hind | similar |

The walk therefore takes short, quick steps under a body that moves as one piece: mincing rather than prowling. The side view at 50 ms (`G-climb-down-dense-4.0-5.2.png`) shows the back line, head height and hooked tail unchanged for the whole cycle while the legs cycle underneath.

### Sit

Duration 1.8 s (*ref* 0.7–0.9 s). The pelvis drops 11.5 cm in 0.75 s, then the tail takes another second to lie down, the head hardly moves (3 cm), and the body keeps rotating slowly during the whole clip because `arrive()` lets the settle, sit and perch clips absorb up to 11.5° of heading at ≤14°/s. That slow residual rotation is the "turns without an animation" Dennis saw.

### Jump onto the cabinet

Trace (`dev-trace.json`, `jumpup`): crouch 0.15–0.45 s (chest down 4.4 cm), then the body rises 2.1 m in 0.45 s with no forward travel, travels forward 0.6 m in 0.3 s at the top, and both paw pairs land together at 1.15–1.2 s with no landing crouch (the chest keeps rising). Between 0.75 and 0.85 s the rise slows to 0.9 m/s and then speeds up to 3–4 m/s again: every `track()` key in `blue_animate.py` is a smoothstep boundary with zero velocity, so the flight hitches at each key. *Ref*: ballistic rise to 1.9 m needs ≥0.62 s and decelerates continuously; forepaws hook the edge at 70–80 % of the flight and the hind legs follow 0.2–0.4 s later.

### Jump down

Push-off 0.4–0.55 s, then 1.9 m in 0.40 s (free fall alone would take 0.62 s), a 2 cm landing crouch recovered in 0.3 s, and immediately a 110° stepped turn of 3 s. *Ref*: forelimbs first, hind paws 30–80 ms later, a deep crouch for 0.25–0.4 s.

### Wake

Head up at 0.6 s, standing at 1.4 s: the timing is fine. There is no stretch, and the eyes never read as closed (next point), so the "eyes open first" beat is invisible.

### Eyes and lids (Dennis: "he needs his eyelids and big black eyes", "not cute")

Two causes, one of them a defect:

1. **The eyeballs never move.** `blueCat.ts:231` looks up `Eye.L`/`Eye.R`, but three's `GLTFLoader` sanitizes node names and strips dots (`PropertyBinding.sanitizeNodeName`), so the nodes are called `EyeL`/`EyeR` in the scene and `this.eyeballs` stays empty (`dev-eyes.mjs` printed `eyeballs: []`). The retraction on a blink (`blueCat.ts:1014`) has never run on the site. The ear lookup two lines below already carries the `EarL` fallback; the eyes do not. Sleeping, blinking and purring Blue therefore always shows open amber eyes.
2. **Even retracted, the lids do not cover the eye.** With the eyeballs pushed 17 mm and 30 mm back on the dev server the amber ring stays visible: the blink morph squashes the rim of the old eye island, it never closes a lid over the opening. The Meshy head has no lid geometry to close.

On top of that the pupil covers most of the eyeball cap, so from the hall camera the eye is a thin amber ring around black-on-black: it reads as a hollow ring, not as a big wet eye. In Dennis's photos the eyes are large, bright yellow-amber ovals with a clearly visible dark pupil and a catchlight, set in a broad, flat-cheeked face.

### The About choreography is mostly out of frame

- Desktop 1440×900, About opened from home (cat asleep): the pet button was hidden from 0 to 9.8 s after the click. The About camera frames the cabinet from the marquee down to the coin door; the floor in front of it, where the walk-up and the take-off happen, is below the viewport. Blue appears at 10 s as a black shape at the top-left of the marquee, seen from behind, turns 180° in stepped beats until 14.6 s, stands for a second and starts lying down at 15.6 s. What Dennis asked for (walk up, jump, look down) is invisible; what is visible is his rear and a three-second turn.
- Desktop, About opened from Riftback: hidden 0.4–11.7 s (trot back plus the same jump), same arrival.
- Phone 390×844: the cat is behind the About panel for 11.5 s, then a roughly 40 px dark shape on the marquee.

### Station change

Desktop: the camera pans, Blue walks the lane at 0.34 m/s and sits after 5 s; from 6.3 s he is a static frontal loaf. Phone: he is out of frame from 0.15 to 7.05 s, appears from the left and sits by 9 s. The seated pose is symmetrical (front legs parallel, head centred, tail hidden behind), and the tail stays hooked up during the whole sit-down.

### Touch reactions

Seated or on the ledge, a click on the head and a click on the body produce the same reaction: a 3 cm head push and a slow blink (`blueCat.ts:578`). At 110 px this is invisible; the head-touch and body-touch strips are indistinguishable. Distinct reactions exist only while standing (`arch`) and for the tail (`flick`).

### Phone wake

Hover does not exist on a phone, so Blue sleeps until the visitor taps him or changes station (14 s asleep in the phone recording with the pointer over him).

### The mesh, at the size it is seen

At 2× (`closeup-perched.png`, `closeup-awake.png`) the head is a sphere with two rings for eyes, no nose, no muzzle, no cheeks; the neck is long, the legs are straight cylinders, the body a smooth pear, the ears tall triangles. Blue in the photos is a stocky cat with a broad flat face, full cheeks, small wide-set ears, a short muzzle with a clear black nose, short legs and big paws. The coat now reads as an even velvet, which is right; the shape does not read as Blue.

## 3. What this means

- The procedural pipeline was never tuned against a reference. The gross timings are 2–5× off (turn 3.45 s instead of ≈0.8 s, sit 1.8 s instead of ≈0.8 s, cadence 1.47 Hz instead of ≈1 Hz at that speed, a jump that rises like a lift and slides forward at the top). Those are numbers, not taste, and they are fixable inside the current pipeline.
- Two things are defects, not ceilings: the eyeballs never retract (name lookup), and the About choreography plays outside the frame on every viewport.
- Two things are ceilings of the current asset: the face (no lid geometry, no muzzle, spherical head) and the silhouette. No clip or texture fixes them. "Cute" needs a different head.
- Verification so far was numeric and Blender-side. A 60 fps strip of the live runtime shows each of the points above in seconds. Every future round must end with such strips before Dennis sees it.

## 4. Options

| | A. New base mesh and rig | B. Real motion data on the current rig | C. Retime and fix the current pipeline |
| --- | --- | --- | --- |
| Answers | face, lids, silhouette ("cute", "Blue") | rhythm of walk, turn, sit | timing errors, both defects, framing, touch, phone |
| Does not answer | motion by itself | face, silhouette, framing, defects | face, silhouette |
| Path | buy a Rigify cat with lids and hand-keyed clips (BlenderKit "Black Cat Animated": 24 clips incl. walk, run, idle, sit, sleep variants, jump, stand up; commercial use allowed, no redistribution of the raw files) or commission a stylised Blue; reshape to Blue's proportions; retexture black + amber; re-fit `blue_animate.py` (positions-first on named joints) or use the asset's clips where they are better | Truebones ZOO cat capture (advertised royalty-free; licence to be archived and verified) retargeted per the report's method to the 26-joint rig, contacts cleaned by hand | eyes: fix lookup, smaller pupil, catchlight; turn: one continuous 0.6–0.9 s sweep with the head 0.15 s ahead, angle-warped, no chained clip, no dead settle; walk: stride 40 cm and ≈1 Hz at 0.34 m/s, head with its own bob; sit 0.9 s with the tail wrapping; jump: parabola with the forepaws hooking first and a real landing crouch, `curve()` instead of `track()`; About: take-off inside the About frame or the camera lowered while he climbs; seated/ledge touches with visible, different reactions; tap-to-wake hint on phones |
| Cost | asset €20–60 (BlenderKit plan) or €800–3,000 commissioned with 2–5 weeks lead; my work 4–7 days after a half-day evaluation render that Dennis vetoes first | 5–10 days plus the licence check; retargeting quality is the risk | 2–3 days, one deploy, each item verified by a live strip |
| Expected result | the only path to a cat that looks like Blue; motion quality depends on the asset's clips | walk and turn would carry real weight and timing; everything he dislikes about the look stays | removes the mechanical tells and the two defects; still the Meshy cat |
| Risk | asset quality unknown until rendered; reshaping a purchased mesh to Blue takes sculpt work | licence, retarget artefacts, no lids either | ceiling: it will move better and still not be cute |

**Recommendation:** C first as a short round (2–3 days, one deploy) because it fixes defects and measurable timing errors that have never been right and gives a clean baseline; then A for the head and body, with a rendered evaluation of the candidate mesh before any integration. B only if, after A, the walk and turn still do not read; the retimed procedural clips may already be enough on a good mesh. Not C alone: Dennis has judged the current cat five times, and its face is a ceiling.

## 5. Decisions for Dennis

1. Order: C then A (recommended), A only, or C only.
2. Mesh source for A: a purchased Rigify cat reshaped to Blue (fast, €20–60, look uncertain until rendered) or a commissioned stylised Blue (weeks, €800–3,000, highest ceiling).
3. About framing: should Blue already be on the marquee when the panel opens (skip the invisible climb), or should the take-off move to a spot inside the About frame so the jump is seen, or should the camera dip for the climb?
4. Phone: wake him on the first tap anywhere in the hall, or keep tap-on-cat only.
5. Eyes: big round pupil with an amber margin and a catchlight (matches the dim hall and the photos) or the narrower slit look.
