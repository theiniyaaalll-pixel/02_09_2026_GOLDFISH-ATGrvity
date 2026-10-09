# Visual 3 asset provenance

All new external model and texture assets listed here are offered under CC0.
No paid assets, account credentials or executable installers were used.

## Human assets

Innerscene models adapted from MakeHuman/MPFB CC0 bodies, rigs and skin assets:

- Sam locomotion collection: https://www.innerscene.com/tools/library/3d-parts/locomotion-collection-sam-3d-person-animated-dc23800f
- Maya locomotion collection: https://www.innerscene.com/tools/library/3d-parts/locomotion-collection-maya-3d-person-animated-1499b2fd
- Jordan relaxed walk: https://www.innerscene.com/tools/library/3d-parts/relaxed-walk-jordan-3d-person-animated-7ab9479d
- Initial Sam walking sample: https://www.innerscene.com/tools/library/3d-parts/brisk-walk-sam-3d-person-animated-bed03fa4 (not included in the runtime bundle).

Original downloads remain beside the optimized `*-web.glb` runtime files.
Runtime copies retain the skeletons, meshes and animations; texture dimensions
were capped at 1024 pixels. Opaque maps were compressed as JPEG, and maps used
by alpha materials retain PNG transparency. Optimization scripts and extracted
images are in `.preview/`.

Character proportions are normalized using the posed skeleton. Animation and
routes use the master's scene clock. Cycling uses a two-link IK solver for
hands and feet. Materials are cloned per resident for clothing variation.

These source characters are adults, not a complete Indian demographic asset
set. Children, region-specific clothing, additional ages and close-up face
quality need suitable character assets and further art review. No such missing
assets are substituted with cartoon figures or adult bodies scaled into children.

## Environment maps

- Asphalt 02, Rob Tuytel: https://polyhaven.com/a/asphalt_02
- Painted Plaster Wall, Amal Kumar: https://polyhaven.com/a/painted_plaster_wall
- License: https://polyhaven.com/license

Each uses 1K diffuse, OpenGL normal and roughness maps from Poly Haven's API.
The photographed tree geometry and textures are shared with visual 2; see
`../rural/README.md` for their provenance.

Street geometry, signs, bicycle/cart geometry, sky, fire/smoke shaders, wet-road
reflection pass and animation scheduling are authored in `visual3.js`.

## Build

Run `npm run build` (`npm.cmd run build` under PowerShell if script execution
policy blocks npm.ps1). The classic bundle embeds optimized models and maps
so local-file previews do not depend on fetching modules or models.

Three.js and its SkeletonUtils helper retain their MIT license in the bundle
and in `vendor/THREE-LICENSE.txt`.
