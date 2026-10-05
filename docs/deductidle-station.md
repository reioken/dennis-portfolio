# Deductidle station — 2026-10-04

Current release note: Ishikiri was added on October 5; the hall and physical marquee
now have 14 stations/keys. The 13-key count below records the earlier Deductidle
release. See [ishikiri-station.md](ishikiri-station.md).

Dennis confirmed: daily game, finished for now; original idea by Dennis, implementation with AI. Public product: https://deductidle.com/.

The project page uses three actual browser captures taken on October 4: the daily shapes puzzle, the hypothesis test dialog, and the interactive introduction. No account was used and no result was submitted. Captures live in `public/media/deductidle/shots/` with full and 720px WebP/AVIF variants. `logo.svg` is the product's original four-tile brand mark.

The cabinet follows the existing hero pipeline, with its own recipe (`cab-deductidle-v1.json`): 0.84m width, 16:9 recessed display, single joystick, coin door, hood speakers, dark forest-green paint and mint trim. A unique wear seed keeps its surface marks distinct from neighbouring machines. No top nameplate.

Side artwork: `public/textures/cabinet-art/quiet-v2/deductidle.webp`. Generated with the built-in image_gen tool, then encoded at the established 768×1152 production size. The exact prompt and tool provenance are in `scripts/assets/deductidle-side-art.json`. Geometric evidence forms interlock into one vertical ribbon in forest-charcoal, mint, cream and sparse amber.

Deductidle follows VGM Battle in the hall. Dennis subsequently removed Sauté Survivors from the hall (its project page remains), so the marquee retains 13 physical channel keys. Numbering and selected states come from the station list at runtime.

Snapsize now uses `mach-snapsize-v2`: one recessed 16:10 monitor, keyboard and trackball, preserving its violet brand. The four-screen layout override is removed. Its screen loop uses Devices, Breakpoints, Sweep and Compare product captures. Both updated machines have matching mobile posters.

Models: Deductidle 14,716 triangles / 395 KB gzip (`4fdf24aa`); Snapsize 15,958 triangles / 430 KB gzip (`381a7087`). Source recipes are committed; original high-resolution bake maps remain under `.source-assets/models-in/`.

On Windows, set `OPTIX_CACHE_PATH` and `CUDA_CACHE_PATH` to writable artifact directories before launching Blender. The default user-profile cache was denied in this sandbox, causing repeated shader compilation; the writable cache resolved it.
