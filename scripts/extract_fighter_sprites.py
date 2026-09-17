#!/usr/bin/env python3
"""Extract Fox/Fly fighter frames from the authored sprite sheet.

Uses content-detected column spans (not an equal grid). Hard cell edges are
gap midpoints so neighbors do not share pixels. Soft-keys near-black while
keeping dark chromatic boots; morphologically closes alpha to reconnect
JPEG-split limbs. Does not discard body parts via connected-components.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

FRAME_NAMES = [
    "idle",
    "walk-1",
    "walk-2",
    "walk-3",
    "walk-4",
    "jump-start",
    "jump-air",
    "jump-land",
    "attack-windup",
    "attack-strike",
    "attack-recover",
]

COLS = 11
FOX_BAND = (120, 234)
FLY_BAND = (358, 464)
PAD = 12
ALPHA_CUT = 18
EFFECT_LUMA = 200
EFFECT_CHROMA = 28


def luma(r: int, g: int, b: int) -> float:
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def chroma(r: int, g: int, b: int) -> int:
    return max(r, g, b) - min(r, g, b)


def is_body_rgb(r: int, g: int, b: int, thr: float = 18) -> bool:
    """Keep character/effect pixels; drop true black and faint gray captions."""
    y = luma(r, g, b)
    c = chroma(r, g, b)
    if y <= thr and c < 14:
        return False
    if 22 <= y < 105 and c < 20:
        return False
    return True


def key_black(rgb: Image.Image) -> Image.Image:
    rgba = rgb.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            yv = luma(r, g, b)
            c = chroma(r, g, b)
            if not is_body_rgb(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            elif yv < 28 and c < 16:
                a = int(255 * max(0.0, (yv - 10) / 18))
                px[x, y] = (r, g, b, max(0, min(255, a)))
    return rgba


def column_segments(sheet: Image.Image, y0: int, y1: int) -> list[tuple[int, int]]:
    w, _ = sheet.size
    px = sheet.load()
    counts = [0] * w
    for y in range(y0, y1 + 1):
        for x in range(w):
            r, g, b = px[x, y]
            if is_body_rgb(r, g, b):
                counts[x] += 1
    active = [c > 2 for c in counts]
    raw: list[tuple[int, int]] = []
    i = 0
    while i < w:
        if not active[i]:
            i += 1
            continue
        j = i
        while j < w and active[j]:
            j += 1
        if j - i >= 4:
            raw.append((i, j - 1))
        i = j
    merged: list[list[int]] = []
    for a, b in raw:
        if merged and a - merged[-1][1] <= 3:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    if len(merged) != COLS:
        raise RuntimeError(f"Expected {COLS} frames in band {y0}-{y1}, found {len(merged)}: {merged}")
    return [(a, b) for a, b in merged]


def cell_bounds(segments: list[tuple[int, int]], sheet_w: int) -> list[tuple[int, int]]:
    """Hard crop windows from gap midpoints."""
    out: list[tuple[int, int]] = []
    for i, (a, b) in enumerate(segments):
        if i == 0:
            left = max(0, a - 2)
        else:
            left = (segments[i - 1][1] + a) // 2 + 1
        if i == len(segments) - 1:
            right = min(sheet_w, b + 3)
        else:
            right = (b + segments[i + 1][0]) // 2
        out.append((left, right))
    return out


def scrub_crop_edges(im: Image.Image, pixels: int = 1) -> Image.Image:
    """Zero only extreme crop columns to kill neighbor tips; keep effect trails."""
    if pixels <= 0:
        return im
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(min(pixels, w)):
            px[x, y] = (0, 0, 0, 0)
        for x in range(max(0, w - pixels), w):
            px[x, y] = (0, 0, 0, 0)
    return im


def content_bbox(im: Image.Image, alpha_cut: int = ALPHA_CUT) -> tuple[int, int, int, int] | None:
    px = im.load()
    w, h = im.size
    min_x, min_y, max_x, max_y = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[x, y][3] >= alpha_cut:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x < 0:
        return None
    return min_x, min_y, max_x + 1, max_y + 1


def body_anchor_x(im: Image.Image, bbox: tuple[int, int, int, int]) -> float:
    px = im.load()
    x0, y0, x1, y1 = bbox
    mass = moment = 0.0
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if a < ALPHA_CUT:
                continue
            if luma(r, g, b) >= EFFECT_LUMA and chroma(r, g, b) <= EFFECT_CHROMA:
                continue
            weight = a / 255.0
            mass += weight
            moment += weight * (x + 0.5)
    if mass < 1e-3:
        return (x0 + x1) * 0.5
    return moment / mass


def close_alpha(im: Image.Image, radius: int = 1) -> Image.Image:
    """Morphological close on alpha to reconnect JPEG-split limbs."""
    w, h = im.size
    px = im.load()
    alpha = [[px[x, y][3] for x in range(w)] for y in range(h)]

    def dilate(src):
        out = [row[:] for row in src]
        for y in range(h):
            for x in range(w):
                if src[y][x] >= ALPHA_CUT:
                    continue
                hit = False
                for ny in range(max(0, y - radius), min(h, y + radius + 1)):
                    for nx in range(max(0, x - radius), min(w, x + radius + 1)):
                        if src[ny][nx] >= ALPHA_CUT:
                            out[y][x] = max(out[y][x], src[ny][nx])
                            hit = True
                            break
                    if hit:
                        break
        return out

    def erode(src):
        out = [row[:] for row in src]
        for y in range(h):
            for x in range(w):
                if src[y][x] < ALPHA_CUT:
                    continue
                for ny in range(max(0, y - radius), min(h, y + radius + 1)):
                    for nx in range(max(0, x - radius), min(w, x + radius + 1)):
                        if src[ny][nx] < ALPHA_CUT:
                            out[y][x] = 0
                            break
                    else:
                        continue
                    break
        return out

    closed = erode(dilate(alpha))
    for y in range(h):
        for x in range(w):
            if closed[y][x] >= ALPHA_CUT and px[x, y][3] < ALPHA_CUT:
                found = None
                for d in range(1, radius + 2):
                    for ny in range(max(0, y - d), min(h, y + d + 1)):
                        for nx in range(max(0, x - d), min(w, x + d + 1)):
                            if alpha[ny][nx] >= ALPHA_CUT:
                                found = px[nx, ny]
                                break
                        if found:
                            break
                    if found:
                        break
                if found:
                    px[x, y] = (found[0], found[1], found[2], min(200, found[3]))
            elif closed[y][x] < ALPHA_CUT:
                px[x, y] = (0, 0, 0, 0)
    return im


def extract_frames(sheet: Image.Image, fighter: str) -> list[Image.Image]:
    y0, y1 = FOX_BAND if fighter == "fox" else FLY_BAND
    segs = column_segments(sheet, y0, y1)
    bounds = cell_bounds(segs, sheet.size[0])
    frames: list[Image.Image] = []
    for i, (cx0, cx1) in enumerate(bounds):
        cell = key_black(sheet.crop((cx0, y0, cx1, y1 + 1)))
        cell = scrub_crop_edges(cell, pixels=1)
        cell = close_alpha(cell, radius=1)
        bbox = content_bbox(cell)
        if bbox is None:
            raise RuntimeError(f"No content in {fighter} frame {FRAME_NAMES[i]}")
        bx0, by0, bx1, by1 = bbox
        frames.append(cell.crop((bx0, by0, bx1, by1)))
        print(f"  {fighter}/{FRAME_NAMES[i]}: x={cx0}-{cx1} → {bx1 - bx0}x{by1 - by0}")
    return frames


def normalize(frames: list[Image.Image], fighter: str) -> tuple[list[Image.Image], dict]:
    metas = []
    for i, fr in enumerate(frames):
        ax = body_anchor_x(fr, (0, 0, fr.width, fr.height))
        metas.append({"w": fr.width, "h": fr.height, "ax": ax, "fy": fr.height, "name": FRAME_NAMES[i]})

    left = max(m["ax"] for m in metas)
    right = max(m["w"] - m["ax"] for m in metas)
    above = max(m["fy"] for m in metas)
    canvas_w = int(round(left + right)) + 2 * PAD
    canvas_h = int(round(above)) + 2 * PAD
    origin_x = PAD + left
    ground_y = PAD + above

    out: list[Image.Image] = []
    for fr, m in zip(frames, metas):
        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        x = int(round(origin_x - m["ax"]))
        y = int(round(ground_y - m["fy"]))
        canvas.alpha_composite(fr, (x, y))
        out.append(canvas)

    return out, {
        "fighter": fighter,
        "canvas": [canvas_w, canvas_h],
        "anchor": [round(origin_x, 2), round(ground_y, 2)],
        "frames": metas,
    }


def write_preview(frames: list[Image.Image], path: Path) -> None:
    gap = 10
    w = sum(f.width for f in frames) + gap * (len(frames) - 1)
    h = max(f.height for f in frames)
    sheet = Image.new("RGBA", (w, h), (32, 36, 34, 255))
    x = 0
    for fr in frames:
        sheet.alpha_composite(fr, (x, h - fr.height))
        x += fr.width + gap
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(path, quality=92)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sheet", type=Path, default=Path(__file__).resolve().parents[1] / "assets/fighters/sprite-sheet.jpg")
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "web/public/assets/fighters")
    args = ap.parse_args()
    sheet = Image.open(args.sheet).convert("RGB")
    print(f"sheet {sheet.size}")
    preview_dir = Path(__file__).resolve().parents[1] / "assets/fighters/previews"
    for fighter in ("fox", "fly"):
        print(f"extract {fighter}")
        crops = extract_frames(sheet, fighter)
        frames, info = normalize(crops, fighter)
        dest = args.out / fighter
        dest.mkdir(parents=True, exist_ok=True)
        for name, fr in zip(FRAME_NAMES, frames):
            fr.save(dest / f"{name}.png", optimize=True)
        write_preview(frames, preview_dir / f"{fighter}.jpg")
        write_preview(frames, preview_dir / f"{fighter}-qa.jpg")
        print(
            f"{fighter}: canvas {info['canvas'][0]}x{info['canvas'][1]} "
            f"anchor ({info['anchor'][0]}, {info['anchor'][1]}) → {dest}"
        )


if __name__ == "__main__":
    main()
