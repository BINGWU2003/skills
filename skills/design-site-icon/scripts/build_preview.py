#!/usr/bin/env python3

import argparse
import html
import os
from pathlib import Path
import re
import sys


HEX_COLOR = re.compile(r"^#[0-9a-f]{3,8}$", re.IGNORECASE)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="为动态 SVG 图标候选生成深浅背景对比页面。")
    parser.add_argument("--input", required=True, type=Path, help="候选 SVG 所在目录")
    parser.add_argument("--output", required=True, type=Path, help="输出 HTML 文件")
    parser.add_argument("--title", default="网站图标候选", help="预览页面标题")
    parser.add_argument("--theme", choices=("both", "dark", "light"), default="both")
    parser.add_argument("--dark-background", default="#050505", help="深色预览背景，使用十六进制颜色")
    parser.add_argument("--light-background", default="#fafafa", help="浅色预览背景，使用十六进制颜色")
    args = parser.parse_args()

    for option, value in (
        ("--dark-background", args.dark_background),
        ("--light-background", args.light_background),
    ):
        if not HEX_COLOR.fullmatch(value):
            parser.error(f"{option} 必须是十六进制颜色")

    return args


def extract_title(source: str, fallback: str) -> str:
    match = re.search(r"<title(?:\s[^>]*)?>([\s\S]*?)</title>", source, re.IGNORECASE)
    if not match:
        return fallback
    return re.sub(r"<[^>]+>", "", match.group(1)).strip() or fallback


def render_frame(relative_source: str, tone: str, label: str) -> str:
    source = html.escape(relative_source, quote=True)
    return f'''<figure class="frame {tone}">
    <img src="{source}" alt="" />
    <figcaption>{label}</figcaption>
  </figure>'''


def render_card(candidate: dict[str, str], theme: str) -> str:
    frames: list[str] = []
    if theme != "light":
        frames.append(render_frame(candidate["relative_source"], "dark", "深色背景"))
    if theme != "dark":
        frames.append(render_frame(candidate["relative_source"], "light", "浅色背景"))

    title = html.escape(candidate["title"])
    file_name = html.escape(candidate["file_name"])
    return f'''<article class="card">
    <h2>{title}</h2>
    <div class="frames">{chr(10).join(frames)}</div>
    <code>{file_name}</code>
  </article>'''


def build_preview(args: argparse.Namespace) -> int:
    input_directory = args.input.resolve()
    output_file = args.output.resolve()
    if not input_directory.is_dir():
        raise ValueError(f"候选目录不存在：{input_directory}")

    svg_files = sorted(
        (
            item
            for item in input_directory.iterdir()
            if item.is_file()
            and item.suffix.lower() == ".svg"
            and "preview" not in item.name.lower()
        ),
        key=lambda item: item.name.casefold(),
    )
    if not svg_files:
        raise ValueError(f"目录中没有 SVG：{input_directory}")

    candidates: list[dict[str, str]] = []
    for svg_file in svg_files:
        source = svg_file.read_text(encoding="utf-8")
        try:
            relative_source = Path(
                os.path.relpath(svg_file, output_file.parent)
            ).as_posix()
        except ValueError:
            relative_source = svg_file.as_uri()
        candidates.append(
            {
                "file_name": svg_file.name,
                "title": extract_title(source, svg_file.stem),
                "relative_source": relative_source,
            }
        )

    cards = "\n".join(render_card(candidate, args.theme) for candidate in candidates)
    page_title = html.escape(args.title)
    document = f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{page_title}</title>
  <style>
    :root {{ color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #09090b; color: #f4f4f5; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; padding: 40px; }}
    main {{ width: min(1180px, 100%); margin: 0 auto; }}
    h1 {{ margin: 0 0 28px; font-size: clamp(24px, 4vw, 42px); }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }}
    .card {{ padding: 18px; border: 1px solid #27272a; border-radius: 18px; background: #111113; }}
    h2 {{ margin: 0 0 14px; font-size: 18px; }}
    .frames {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(116px, 1fr)); gap: 10px; }}
    .frame {{ position: relative; display: grid; place-items: center; aspect-ratio: 1; margin: 0; border-radius: 12px; overflow: hidden; }}
    .frame.dark {{ background: {args.dark_background}; }}
    .frame.light {{ background: {args.light_background}; }}
    .frame img {{ width: 58%; height: 58%; object-fit: contain; }}
    figcaption {{ position: absolute; right: 8px; bottom: 7px; padding: 3px 6px; border-radius: 999px; background: rgb(0 0 0 / .62); color: #fff; font-size: 10px; }}
    code {{ display: block; margin-top: 12px; color: #a1a1aa; overflow-wrap: anywhere; }}
    @media (max-width: 600px) {{ body {{ padding: 20px; }} }}
  </style>
</head>
<body>
  <main>
    <h1>{page_title}</h1>
    <section class="grid">{cards}</section>
  </main>
</body>
</html>
'''

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(document, encoding="utf-8")
    print(f"已生成 {len(candidates)} 个候选的预览：{output_file}")
    return 0


def main() -> int:
    try:
        return build_preview(parse_args())
    except (OSError, UnicodeError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
