import os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))

# (source path relative to root, category folder, base name)
IMAGES = [
...
]

SIZES = [480, 960]

for src_rel, category, name in IMAGES:
    src = os.path.join(ROOT, src_rel)
    if not os.path.exists(src):
        print(f"MISSING: {src}")
        continue

    out_dir = os.path.join(ROOT, "media", "thumbs", category)
    os.makedirs(out_dir, exist_ok=True)

    img = Image.open(src).convert("RGB")

    for size in SIZES:
        thumb = img.copy()
        thumb.thumbnail((size, size), Image.LANCZOS)
        out_path = os.path.join(out_dir, f"{name}_{size}.webp")
        thumb.save(out_path, "webp", quality=82)
        print(f"wrote {out_path}")

print("Done.")