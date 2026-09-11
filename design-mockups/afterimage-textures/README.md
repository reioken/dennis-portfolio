# Generated cabinet artwork

Original production artwork for all 15 active hall stations, generated with the built-in image generation tool on 10 September 2026. These are continuous portrait print/albedo illustrations, not screenshots or rendered photographs of cabinets. Each PNG original is retained here; its optimized WebP is consumed from `public/textures/cabinet-art/`.

Real project names and logos remain separate from the illustrations. Cabinet finish, roughness, normal detail and lighting are supplied by the renderer. The claw artwork contains no person or replacement puppet. The archived Angry machine has no newly generated artwork in this set.

| Station | Runtime asset | PNG source | Prompt manifest |
| --- | --- | --- | --- |
| Dennis / claw | [`kasse.webp`](../../public/textures/cabinet-art/kasse.webp) | [`kasse.png`](kasse.png) | [Remaining](remaining-art-prompts.json) |
| Riftback | [`riftback.webp`](../../public/textures/cabinet-art/riftback.webp) | [`riftback.png`](riftback.png) | [Desktop/audio](desktop-art-prompts.json) |
| Sauté Survivors | [`saute-survivors.webp`](../../public/textures/cabinet-art/saute-survivors.webp) | [`saute-survivors.png`](saute-survivors.png) | [Games](game-art-prompts.json) |
| Echo Frequency | [`echo-frequency.webp`](../../public/textures/cabinet-art/echo-frequency.webp) | [`echo-frequency.png`](echo-frequency.png) | [Echo](echo-art-prompts.json) |
| Essfreude | [`safeplate.webp`](../../public/textures/cabinet-art/safeplate.webp) | [`safeplate.png`](safeplate.png) | [Remaining](remaining-art-prompts.json) |
| NEXUS | [`nexus.webp`](../../public/textures/cabinet-art/nexus.webp) | [`nexus.png`](nexus.png) | [Desktop/audio](desktop-art-prompts.json) |
| Cab No. 9 | [`cab-no-9.webp`](../../public/textures/cabinet-art/cab-no-9.webp) | [`cab-no-9.png`](cab-no-9.png) | [Games](game-art-prompts.json) |
| Hookline | [`hookline.webp`](../../public/textures/cabinet-art/hookline.webp) | [`hookline.png`](hookline.png) | [Desktop/audio](desktop-art-prompts.json) |
| Berry | [`berry.webp`](../../public/textures/cabinet-art/berry.webp) | [`berry.png`](berry.png) | [Remaining](remaining-art-prompts.json) |
| Riftcast | [`riftcast.webp`](../../public/textures/cabinet-art/riftcast.webp) | [`riftcast.png`](riftcast.png) | [Desktop/audio](desktop-art-prompts.json) |
| Carillon | [`carillon.webp`](../../public/textures/cabinet-art/carillon.webp) | [`carillon.png`](carillon.png) | [Games](game-art-prompts.json) |
| Nocturne | [`nocturne.webp`](../../public/textures/cabinet-art/nocturne.webp) | [`nocturne.png`](nocturne.png) | [Desktop/audio](desktop-art-prompts.json) |
| Briefly | [`briefly.webp`](../../public/textures/cabinet-art/briefly.webp) | [`briefly.png`](briefly.png) | [Remaining](remaining-art-prompts.json) |
| Mina | [`mina.webp`](../../public/textures/cabinet-art/mina.webp) | [`mina.png`](mina.png) | [Remaining](remaining-art-prompts.json) |
| Contact / telephone | [`telefon.webp`](../../public/textures/cabinet-art/telefon.webp) | [`telefon.png`](telefon.png) | [Remaining](remaining-art-prompts.json) |

`safeplate` is the retained asset slug for the project now titled Essfreude. Riftback uses its actual gold League Classic reference identity; Hookline uses music-production artwork rather than the unrelated fishing imagery in early mockups.

## Provenance and reproduction

The four JSON manifests retain exact generation prompts and original generated-image paths. PNG copies in this folder are the portable source of record; runtime assets do not depend on files under `.codex/generated_images`. Sharp was used for WebP encoding, without repainting or compositing the illustrations. To revise the artwork, generate a new version from its recorded prompt and retain the previous source non-destructively.

The illustrations were visually inspected after generation. [Model verification](../../scripts/models/verify-afterimage.mjs) checks the required art slots and UVs separately. New integrated browser, transition and lighting QA is tracked by the implementation task; passing asset checks alone does not establish the final rendered appearance.
