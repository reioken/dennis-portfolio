# Dark interface brainstorm — 10 September 2026

## User brief

The user rejected the cream/olive retro signage direction and the earlier generic dark UI. The new direction must stay dark and feel modern, sleek, fitting, futuristic and creative. This document records a three-agent brainstorm and cross-critique. It is a design proposal; no site implementation was changed during the brainstorm.

## Team perspectives

Three agents independently reviewed the existing code and recent changes: spatial art direction, digital visual identity, and interaction/composition. The spatial and visual agents then challenged their initial proposals for distinctiveness.

Their first proposals independently converged on a dark gallery, large typography, a restrained accent seam and fewer controls. The cross-critique identified a weakness: black surfaces and a fine light seam are supporting design details, not a sufficiently original concept. The stronger proposals below change the actual composition.

## Diagnosis

The rejected pass introduced paper, olive enamel, bevelled keys and offset shadows. These were incompatible with the requested direction. The original dark UI repeated the same small rounded containers and metadata treatments across unrelated functions.

The larger problem is competing structure: header readout, station dots, role badge, project selector, side arrows, bottom plaque, large station number and instructions all claim attention. Gallery navigation is repeated across the screenshot, side rail, physical controls and tags. A new palette alone cannot resolve that hierarchy.

## Direction A — Afterimage: the project becomes architecture

Recommended foundation.

### Recognisable still image

The selected project name spans a rear-wall plane at architectural scale. The cabinet sits in front of it and naturally occludes parts of its letters. One outer edge of the word may crop beyond the composition. The title is restrained in luminance: graphite/silver with a limited project-colour contribution, without a broad neon halo. The machine and its actual screen remain the foreground subject.

This is the signature: typography, object and depth form one composed image. Black panels, fine highlights and typography precision support it.

Keep the overhead TV as a secondary preview. Establish its brightness and placement so it does not compete equally with the selected cabinet, title and primary action.

### Hall composition

A quiet top navigation contains identity, Work, About, Contact and language. One compact bottom control strip contains previous, current project name, next, Explore project and access to the complete project list. A short project proposition can sit above the strip, aligned to the composition. Remove the separate selector badge, duplicate numbered plaque and competing navigation rows.

### Opening a project

The cabinet screen is the visual origin of the transition. Its screenshot expands into the primary viewing area while the cabinet shifts toward the outside edge. Once expanded, the content is normal sharp HTML and images. A short dark editorial column supplies title, proposition and primary action; deeper story content follows in the reading view.

The transition should preserve a clear relationship to the cabinet while allowing immediate interaction. It is not a requirement to render body copy inside a tilted 3D screen.

### Project and reading views

Use a continuous charcoal surface with large titles, comfortable body copy and aligned facts. Minimise nested boxes and badges. Reading mode expands the same dark surface. Screenshots lead the content hierarchy; role, scope and year form a quiet secondary row.

### Risks and adaptations

- Long names need curated line breaks and bounded scale, not a universal giant font setting.
- Wall type must be crisp, depth-correct and free of subpixel shimmer. A single scene texture is a possible implementation approach; confirm quality on actual camera angles before adopting it.
- Overhead TV, cabinet marquee and large title need deliberate brightness hierarchy.
- Mobile needs an intentional crop and stacked composition; unreadable miniature 3D type cannot be the only project identifier.
- Reduced motion uses an immediate spatial handoff.

## Direction B — Dark contact sheet: an editorial composition of work and object

The bolder alternative, with more emphasis on the portfolio work than the room.

A real project screenshot occupies about two-thirds of the view and deliberately crops at an outer edge. The selected cabinet overlaps a lower corner. A very large two-line title occupies the adjoining negative space. Narrow previews of adjacent projects appear at the opposite edge, with readable names and selectable targets.

The visual signature is scale, overlap and cropping: screenshot, cabinet and typography become a designed composition. The controls remain plainly named. This provides a stronger static image than another floating panel treatment and makes the work immediately legible.

The tradeoff is a larger departure from the current walk-through arcade. Adjacent previews also need restraint to avoid competing with the primary screenshot. On mobile, use one dominant screenshot followed by a clearly labelled next-project affordance.

## Shared visual rules

- Large surfaces remain neutral near-black: proposed starting points #07090D, #0C1016 and #151B24.
- Primary text is cool off-white, with readable muted body text. Final colours must be checked on their actual surfaces.
- Project colour identifies selection, focus and a limited number of interactive details. It does not tint every panel or create a rainbow navigation row.
- Strong scale contrast: a distinctive project title, legible 16–18px body copy, quiet metadata. Monospace is reserved for meaningful counts or keyboard hints.
- Remove the cream palette, olive surfaces, physical key bevels and hard offset shadows.
- Avoid decorative telemetry, fake system labels, incessant shimmer, glowing grids, busy corner brackets and universal glass cards.
- Keep clear action labels and usable targets even when the surrounding composition is experimental.

## Shared interaction model

One action has one permanent visual home. The bottom control strip owns previous/next and the primary action. Physical cabinet controls provide alternate input, with local illumination and one action label on hover or focus. Remove persistent duplicate tags and the large auxiliary remote-control card.

The gallery uses one transport strip: back, previous, count, next, fullscreen. Group selection sits next to this strip; CRT effects belong in secondary options.

Gallery → project → hall preserves the selected project, screenshot and reading position. Mobile uses normal 44px-or-larger controls rather than relying on projected miniature cabinet buttons.

Keep the completed functional fixes: control bounds include the ball/shaft/caps, neighbouring targets do not overlap, TV illumination inherits the physical assembly, and navigation is not held for camera movement.

Proposed timing budget: immediate visual acknowledgement, 80–120ms control feedback, 120–160ms menus, 160–200ms content transitions, and roughly 240–300ms camera travel. These are design targets, not a newly measured performance result. Camera motion should accept interruption; a new input must not queue behind a decorative sequence.

## Recommended next design step

Develop high-fidelity compositions for Direction A using an actual project, plus one competing Direction B still. Include hall, project, gallery and phone layouts. Judge the static composition before adding motion.

Acceptance questions:

1. Is the interface unmistakably dark in every mode?
2. Does the still image have a recognisable, bespoke composition?
3. Can a visitor immediately identify the selected project and primary action?
4. Does the interface give the actual work enough space?
5. Are all controls readable and usable without discovering hidden hotspots?
6. Does each transition have one clear origin and destination?
7. Does the phone layout feel intentionally designed?

After choosing the visual composition, rebuild the affected interface structure rather than stacking another override stylesheet on the current one.
