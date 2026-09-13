# Cohesive sprite pass

The mole, minecart, lantern support, loose lantern and both backpack views are unchanged. Their muted timber, blue-grey iron and plum outlines define the rest of the set.

## Artwork

- New angular bedrock: broad flat faces replace the fine speckle and oversized scratched slabs. A minimum-error overlapping seam joins original pixels without reflection, stretching or blur. The resulting 320 × 192 material repeats in world coordinates at any screen size.
- Recessed cave wall: the same rock drawing in four quiet plum shades, keeping the character and discoveries in front visually.
- New shaft entrance and ladder: sturdy wood, matching iron fittings, complete feet and native repeating rung sockets.
- New track: a horizontal travel plane with shallow diagonal sleepers. Native 14-pixel rail sockets join continuously; the wheels still contact the steel rail.
- New open molehill shelter: a low earth roof, three stones, small moss tuft and open room, grounded on the same surface as the mole. Removed the synthetic rectangle behind this self-contained sprite so it cannot protrude beyond the roof. The outdoor pile and height ruler retain their positions and unlimited progression.
- New stone, gold, amethyst and cyan crystal: a shared outline and compact facets. Each has a transparent safety margin. The same artwork appears in the cart, backpack, spills, home pile and welcome practice.

PixelLab Pro and Pro Flash generated the artwork. Aseprite production files retain native pixels, palette cleanup, transparent margins and socket/anchor assembly. A shared 18-colour material palette plus small treasure ramps removes the hundreds of near-duplicate colours in the raw generations. Raw candidates are retained separately; only selected production PNGs are shipped.

## Prompt record

Shared prop reference: the existing `v5/support.png`; terrain references the existing `v5/cart.png`. Copy the outline, detail and shading. Generate a flat side elevation, crisp native pixels, muted taupe timber, cool grey iron, plum outlines, sparse highlights, transparent margins, no backdrop, no character and no text.

Final rock prompt: “A single CONTINUOUS original patch of rough natural bedrock, straight side-on cross section inside a cozy pixel-art mine. Opaque rock covers entire canvas. Many unique irregular jagged polygonal fractures; medium angular rock plates interlock like a broken cliff face, dimensions vary from 10 to 45 pixels, a few longer striations. NOT rounded pebbles, NOT masonry, NOT cobblestone, NOT a grid. Every part of this wide image is DIFFERENT; do not duplicate or mirror portions and do not present a tile sheet. Warm muted sandstone taupe (#806954 #665044 #9b8062), dark plum cracks #392e38. Crisp controlled one-pixel clusters, broad flat planes, no noise, no grain, no dithering, no tiny scratches. Just 2-3 quiet shades per rock, compact outlines and occasional short pale chipped edge. No sky or scenery, no objects or gems or plants or ore. Match clean miniature game prop aesthetic of the reference. Low-medium contrast, many organic silhouettes with breathing space on each stone face.”

Shelter: 96 × 80. A low lumpy earth mound with a little moss and three stones, held by sturdy timber posts and iron straps. Wide empty open room, no door or window, small stool at the far right, tiny lantern at left, thin flat foundation. Final edit: keep the footprint and room, replace mottled roof grain with three or four broad taupe planes, retain stones and moss, no dithering or gradients.

Entrance: 64 × 48. Broad timber uprights, chipped crossbeam, iron brackets and a small central pulley. Empty opening, stone feet on a common baseline. No rope across the opening, roof, ladder, scenery or character.

Ladder: 32 × 64. Straight parallel timber uprights, sturdy horizontal rungs, dark iron caps, beige highlights and plum outlines. No taper, perspective, missing wood or background. Native socket assembly uses the generated nine-pixel rung interval.

Track: 96 × 48. Two straight horizontal steel rails, six pixels apart, with chunky diagonally receding sleepers, subdued pale upper edges, dark outlines and small bolts. Transparent background; no ballast, buffers, cart or scenery. Production crops and caps the repeat socket without resizing.

Treasure: four 16 × 16 sprites with transparent margins, one-pixel plum outlines and broad flat facets. An angular taupe-grey shale fragment; an irregular honey-gold nugget; three violet amethyst points; a wide-topped pointed cyan diamond. No pedestals, background squares or detached sparkles. Production adds a one-pixel transparent gutter at native scale.

Generation IDs: rock `4c0e3812-fd8f-42bc-bd0b-aab594a5f10f`; shelter `eabace56-4cd1-4da0-aba5-99e597f7c84e`, roof cleanup `18425f31-8702-4d39-b2b6-1a3451d603c3`; entrance `2385b4aa-0274-4845-acdd-3055a813068c`; ladder `f1df7811-07a6-4274-a596-c5ef12f8b35e`; tracks `c2e9517d-d809-45ad-b8c2-b948a684690d`; stone `f8e1f291-6add-45d4-bb90-22857d7d683a`; gold `4d4eba13-405d-4e93-b7e0-ede905c0411d`; amethyst `29fe2dee-b775-4666-a35f-5c1ab9e0425b`; crystal `9aa0afbf-41ef-4e7a-956b-8c4782e45941`.

Rejected: the first rock generation repeated a small cobblestone pattern too visibly; the separate cave generation had too much fine fracture detail.

## Verification

`test-art-cohesion.mjs`: approved sprites and animation frames unchanged; editable Aseprite sources; no partial-alpha pixels or clipped outer prop/loot margins; entrance, shelter and ladder feet; world texture coverage across negative coordinates and repeated rows/columns; texture joins within normal neighbouring-pixel contrast; continuous rail sockets and wheel contact.

Existing hillside layout, home-scene and burrow-growth checks pass against the v11 manifest, covering 320–2560px layouts, camera resizing, cart-to-pack transfer, rear/side carrying, reduced-motion deposit and pile growth through one billion points.

Browser evidence is saved under `research/screenshots/sprites-v11-*`. Mobile light/dark digging, successive finds, banking and the outdoor pile are checked in the actual canvas renderer. Gameplay rules and saved-progress schemas are unchanged.

Sources: `assets/one-more-swing/v11/`. Production assembly: `.rarer-tools/finish-art11-terrain.lua` and `.rarer-tools/finish-art11-props.lua`.
