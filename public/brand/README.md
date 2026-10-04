# dennisbf. — Signature

Vector artwork follows Dennis's selected Signature concept (October 4, 2026).
All SVGs contain paths, with separate `wordmark` and `period` elements, and no fonts or embedded raster images.

- `signature.svg`: warm white lettering with lilac period for dark backgrounds.
- `signature-dark.svg`: dark lettering with purple period for light backgrounds.
- `signature-mono.svg`: single-colour white artwork for masks and fabrication.
- Matching transparent PNGs: 2680 × 620.
- `signature.webp`: lossless transparent 1340 × 310 export.

The animated site component is `src/components/brand/SignatureLogo.tsx`, using the shared vector paths in `src/assets/brand/signature-paths.json`. CSS exposes `--signature-ink` and `--signature-accent`. Its clipped sheen is independent of the base artwork and respects reduced motion. Keep the wordmark's proportions; the person's full name is separate header text.
