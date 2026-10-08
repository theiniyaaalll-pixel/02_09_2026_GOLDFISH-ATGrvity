# Rural landscape assets

- Tree Small 02, Rico Cilliers, Poly Haven: https://polyhaven.com/a/tree_small_02
- Aerial Grass Rock, Rob Tuytel, Poly Haven: https://polyhaven.com/a/aerial_grass_rock

Poly Haven assets are CC0: https://polyhaven.com/license

`tree/tree-web.gltf` and `tree/tree-web.bin` are locally optimized versions of
Tree Small 02. The original 95 MB source model is not needed at runtime.

Run `npm run build` after editing the landscape, its dependencies or these
assets. This creates `visual2.bundle.js`, a classic script containing Three.js,
the rural scene, and the optimized model and textures. Keep that generated file
next to `index.html` when publishing. The scene does not fetch separate model
files or ES modules at runtime.

Three.js is MIT licensed; see `../../vendor/THREE-LICENSE.txt`.
