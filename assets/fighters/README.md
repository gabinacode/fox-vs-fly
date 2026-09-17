# Fighter sprite source

`sprite-sheet.jpg` is the authored Fox/Fly reference atlas (labels excluded at extract time).

Regenerate public PNGs:

```bash
.venv/bin/python scripts/extract_fighter_sprites.py
```

Outputs land in `web/public/assets/fighters/{fox,fly}/` with a shared canvas size and feet-centered anchor per fighter.
