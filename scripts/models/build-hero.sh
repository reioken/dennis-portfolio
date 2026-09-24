#!/bin/sh
# Bake one hero machine end to end: recipe -> Blender bake -> attach mask -> optimize -> pack -> sha8.
# usage: sh scripts/models/build-hero.sh <name>    (BLENDER=<blender.exe> to override the Blender path)
set -e

BLENDER=${BLENDER:-/c/Program Files/Blender Foundation/Blender 5.2/blender.exe}
NAME="$1"
ATLAS_SIZE=1024

if [ -z "$NAME" ]; then
  echo "usage: sh scripts/models/build-hero.sh <name>"
  echo "  <name> is the output GLB name, e.g. mach-nexus-v2, cab-vgm-battle-v2, mach-riftback-v4,"
  echo "         and the three specials: claw-v2, phone-booth-v1, tv-rig-v1"
  echo "  If scripts/models/hero-recipes/<name>.json exists it is copied to"
  echo "  .source-assets/models-in/<name>/spec.json before the bake."
  echo "  Generator: hero_terminal_gen.py (default), hero_claw_gen.py (claw-v2),"
  echo "             hero_booth_gen.py (phone-booth-v1), hero_tv_gen.py (tv-rig-v1)."
  echo "  Blender: \$BLENDER, default $BLENDER"
  echo "  The bake uses the GPU - do not run it next to a headless capture."
  exit 2
fi

# repo root from this script's own location (scripts/models/build-hero.sh)
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
# absolute Windows-style root, Blender's args are not MSYS paths
if command -v cygpath >/dev/null 2>&1; then A=$(cygpath -m "$ROOT"); else A=$(pwd -W); fi

RECIPE="scripts/models/hero-recipes/$NAME.json"
IN=".source-assets/models-in/$NAME"
if [ -f "$RECIPE" ]; then
  ATLAS_SIZE=$(node -e 'const r=require("./"+process.argv[1]);const s=r.atlasSize??1024;if(![768,1024].includes(s))throw new Error("Invalid atlasSize");process.stdout.write(String(s))' "$RECIPE")
  mkdir -p "$IN"
  cp "$RECIPE" "$IN/spec.json"
fi

case "$NAME" in
  claw-v2)        GEN=hero_claw_gen.py;     SPEC=1 ;;
  phone-booth-v1) GEN=hero_booth_gen.py;    SPEC=0 ;;
  tv-rig-v1)      GEN=hero_tv_gen.py;       SPEC=0 ;;
  *)              GEN=hero_terminal_gen.py; SPEC=1 ;;
esac

if [ "$SPEC" = 1 ]; then
  "$BLENDER" --background --python "scripts/models/blender/$GEN" -- \
    --spec "$A/.source-assets/models-in/$NAME/spec.json" \
    --out "$A/.source-assets/models-in/$NAME/$NAME.glb" --size 1024 </dev/null 2>&1 \
    | grep -E "^\[hero\] .*tris|Error|Traceback|line [0-9]+" | tail -6
else
  "$BLENDER" --background --python "scripts/models/blender/$GEN" -- \
    --out "$A/.source-assets/models-in/$NAME/$NAME.glb" --size 1024 </dev/null 2>&1 \
    | grep -E "^\[hero\] .*tris|Error|Traceback|line [0-9]+" | tail -6
fi

node scripts/models/hero-attach-mask.mjs "$NAME" 2>&1 | tail -1 | cut -c1-60
node scripts/models/optimize.mjs --only "$NAME" --keep-attributes --size "$ATLAS_SIZE" 2>&1 | grep "models\]"
rm -f ".source-assets/models-original/$NAME.glb"
node scripts/models/pack-models.mjs --only "$NAME" 2>&1 | tail -1
# The hall loads the gzip twin: mask alpha lossy, Meshopt high, gzip -9. Prints the URL with its ?v= for hallScene.ts.
node scripts/models/gzip-models.mjs --only "$NAME" | head -1
