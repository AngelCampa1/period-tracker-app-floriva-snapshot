#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets" / "images"
SOURCE_PATH = ASSETS_DIR / "logo-source-approved.png"
IOS_ASSET_DIR = ROOT / "ios" / "Floriva" / "Images.xcassets"
ANDROID_RES_DIR = ROOT / "android" / "app" / "src" / "main" / "res"
BONE = (244, 236, 224, 255)
LIGHTER_BERRY = (146, 48, 48)
MOSS_CLAY = (90, 107, 77)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Floriva brand assets from the approved source logo.")
    parser.add_argument(
        "--source",
        type=Path,
        default=SOURCE_PATH,
        help="Path to the approved source PNG export.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ASSETS_DIR,
        help="Directory for shared Expo image assets.",
    )
    return parser.parse_args()


def load_source(path: Path) -> Image.Image:
    if not path.exists():
        raise FileNotFoundError(f"Approved logo source not found at {path}")
    image = Image.open(path).convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a < 10 or min(r, g, b) >= 240:
                pixels[x, y] = (255, 255, 255, 0)
                continue

            target = LIGHTER_BERRY if r > g + 30 else MOSS_CLAY
            pixels[x, y] = (*target, a)
    return image


def is_background_pixel(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    return a < 10 or min(r, g, b) >= 240


def detect_logo_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    pixels = image.load()
    min_x = image.width
    min_y = image.height
    max_x = -1
    max_y = -1

    for y in range(image.height):
        for x in range(image.width):
            if is_background_pixel(pixels[x, y]):
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

    if max_x < min_x or max_y < min_y:
        raise RuntimeError("Could not detect the approved logo bounds in the source image.")

    return (min_x, min_y, max_x + 1, max_y + 1)


def build_square_logo(image: Image.Image) -> Image.Image:
    left, top, right, bottom = detect_logo_bounds(image)
    cropped = image.crop((left, top, right, bottom))
    width, height = cropped.size
    max_side = max(width, height)
    padding = math.ceil(max_side * 0.34)
    canvas_size = max_side + padding * 2

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    offset_x = (canvas_size - width) // 2
    offset_y = (canvas_size - height) // 2
    canvas.alpha_composite(cropped, (offset_x, offset_y))
    return canvas


def render_mark(square_logo: Image.Image, size: int, background: tuple[int, int, int, int] | None) -> Image.Image:
    resized = square_logo.resize((size, size), Image.Resampling.LANCZOS)
    if background is None:
        return resized

    canvas = Image.new("RGBA", (size, size), background)
    canvas.alpha_composite(resized)
    return canvas


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def save_png(path: Path, image: Image.Image) -> None:
    ensure_parent(path)
    image.save(path, format="PNG")


def save_webp(path: Path, image: Image.Image) -> None:
    ensure_parent(path)
    image.save(path, format="WEBP", lossless=True, quality=100, method=6)


def save_shared_assets(square_logo: Image.Image, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    save_png(output_dir / "icon.png", render_mark(square_logo, 1024, BONE))
    save_png(output_dir / "adaptive-icon.png", render_mark(square_logo, 1024, None))
    save_png(output_dir / "splash-icon.png", render_mark(square_logo, 1024, None))
    save_png(output_dir / "favicon.png", render_mark(square_logo, 48, BONE))
    save_png(output_dir / "logo-mark.png", render_mark(square_logo, 1024, None))


def save_ios_assets(square_logo: Image.Image) -> None:
    app_icon = render_mark(square_logo, 1024, BONE)
    splash = render_mark(square_logo, 1024, None)

    save_png(IOS_ASSET_DIR / "AppIcon.appiconset" / "App-Icon-1024x1024@1x.png", app_icon)
    save_png(IOS_ASSET_DIR / "SplashScreenLegacy.imageset" / "image.png", splash)
    save_png(IOS_ASSET_DIR / "SplashScreenLegacy.imageset" / "image@2x.png", splash)
    save_png(IOS_ASSET_DIR / "SplashScreenLegacy.imageset" / "image@3x.png", splash)

    contents = {
        "colors": [
            {
                "color": {
                    "components": {
                        "alpha": "1.000",
                        "blue": "0.87843137254902",
                        "green": "0.92549019607843",
                        "red": "0.95686274509804",
                    },
                    "color-space": "srgb",
                },
                "idiom": "universal",
            }
        ],
        "info": {"version": 1, "author": "expo"},
    }
    colorset_path = IOS_ASSET_DIR / "SplashScreenBackground.colorset" / "Contents.json"
    ensure_parent(colorset_path)
    colorset_path.write_text(json.dumps(contents, indent=2) + "\n", encoding="utf-8")


def save_android_assets(square_logo: Image.Image) -> None:
    launcher_sizes = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    foreground_sizes = {
        "mdpi": 108,
        "hdpi": 162,
        "xhdpi": 216,
        "xxhdpi": 324,
        "xxxhdpi": 432,
    }
    splash_sizes = {
        "mdpi": 288,
        "hdpi": 432,
        "xhdpi": 576,
        "xxhdpi": 864,
        "xxxhdpi": 1152,
    }

    for density, size in launcher_sizes.items():
        icon = render_mark(square_logo, size, BONE)
        save_webp(ANDROID_RES_DIR / f"mipmap-{density}" / "ic_launcher.webp", icon)
        save_webp(ANDROID_RES_DIR / f"mipmap-{density}" / "ic_launcher_round.webp", icon)

    for density, size in foreground_sizes.items():
        foreground = render_mark(square_logo, size, None)
        save_webp(ANDROID_RES_DIR / f"mipmap-{density}" / "ic_launcher_foreground.webp", foreground)

    for density, size in splash_sizes.items():
        splash = render_mark(square_logo, size, None)
        save_png(ANDROID_RES_DIR / f"drawable-{density}" / "splashscreen_logo.png", splash)


def main() -> None:
    args = parse_args()
    square_logo = build_square_logo(load_source(args.source))
    save_shared_assets(square_logo, args.output_dir)
    save_ios_assets(square_logo)
    save_android_assets(square_logo)
    print(f"Generated Floriva brand assets from {args.source}")


if __name__ == "__main__":
    main()
