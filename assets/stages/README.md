# Stage map source

## Platform plate

`clearing-source.png` is the authored floating-platform plate for The Clearing.

Runtime asset (near-black keyed to alpha):

```bash
.venv/bin/python - <<'PY'
from PIL import Image
import numpy as np
src=Image.open('assets/stages/clearing-source.png').convert('RGBA')
arr=np.array(src)
lum=arr[:,:,:3].max(axis=2)
alpha=np.where(lum<=22,0,np.clip((lum.astype(np.float32)-22)*255/18,0,255).astype(np.uint8))
arr[:,:,3]=np.minimum(arr[:,:,3],alpha)
Image.fromarray(arr,'RGBA').save('web/public/assets/stages/clearing.png',optimize=True)
PY
```

Walkable top surface pixels (inclusive) are encoded in `web/src/render/stage.ts` as `STAGE_SURFACE` and aligned to sim `STAGE` half-width (±68). Collision is unchanged.

## Background

`clearing-background-source.jpg` is the authored arena backdrop (nebula / low-poly horizon).

```bash
.venv/bin/python - <<'PY'
from PIL import Image
Image.open('assets/stages/clearing-background-source.jpg').convert('RGB').save(
  'web/public/assets/stages/clearing-background.jpg',quality=88,optimize=True)
PY
```

The canvas draws it screen-space with object-fit cover behind the platform and fighters.
