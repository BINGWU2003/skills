#!/usr/bin/env python3

from pathlib import Path
import re
import sys


def collect_svg_files(target: Path) -> list[Path]:
    resolved = target.resolve()
    if not resolved.exists():
        raise ValueError(f"路径不存在：{resolved}")
    if resolved.is_file():
        return [resolved] if resolved.suffix.lower() == ".svg" else []
    return sorted(
        (item for item in resolved.rglob("*") if item.is_file() and item.suffix.lower() == ".svg"),
        key=lambda item: str(item).casefold(),
    )


def add_issue(issues: list[tuple[str, str]], level: str, message: str) -> None:
    issues.append((level, message))


def inspect_svg(file_name: Path, source: str) -> list[tuple[str, str]]:
    issues: list[tuple[str, str]] = []
    favicon = "favicon" in file_name.name.lower()
    svg_tag = re.search(r"<svg\b([^>]*)>", source, re.IGNORECASE)

    if not svg_tag:
        add_issue(issues, "error", "缺少 <svg> 根元素")
        return issues

    view_box = re.search(r'''\bviewBox\s*=\s*["']([^"']+)["']''', svg_tag.group(1), re.IGNORECASE)
    if not view_box:
        add_issue(issues, "error", "缺少 viewBox")
    else:
        try:
            values = [float(value) for value in re.split(r"[\s,]+", view_box.group(1).strip())]
        except ValueError:
            values = []
        if len(values) != 4 or values[2] <= 0 or values[3] <= 0:
            add_issue(issues, "error", f"viewBox 无效：{view_box.group(1)}")
        elif abs(values[2] - values[3]) > 0.001:
            add_issue(issues, "warning", "图标 viewBox 不是正方形")

    if not re.search(r"<title(?:\s[^>]*)?>[\s\S]*?</title>", source, re.IGNORECASE):
        add_issue(issues, "error", "缺少 <title>")
    if not re.search(r"<desc(?:\s[^>]*)?>[\s\S]*?</desc>", source, re.IGNORECASE):
        add_issue(issues, "warning", "缺少 <desc>")
    if re.search(r"<script\b", source, re.IGNORECASE):
        add_issue(issues, "error", "包含脚本；生产图标必须自包含且无脚本")
    if re.search(r'''\b(?:href|xlink:href)\s*=\s*["'](?:https?:|//)''', source, re.IGNORECASE):
        add_issue(issues, "error", "包含外部网络资源")

    path_count = len(re.findall(r"<path\b", source, re.IGNORECASE))
    if path_count < 1:
        add_issue(issues, "error", "手写线性图标至少需要 1 条 path")
    elif path_count > 4:
        add_issue(issues, "error", f"包含 {path_count} 条 path；手写线性风格最多允许 4 条主要路径")

    if re.search(r"<(?:rect|circle|ellipse|polygon|polyline|line)\b", source, re.IGNORECASE):
        add_issue(issues, "error", "包含基础几何图元；请把图形重画为 1–4 条有机 path")
    if re.search(r"<(?:linearGradient|radialGradient|filter|mask|clipPath)\b", source, re.IGNORECASE):
        add_issue(issues, "error", "包含渐变、滤镜或遮罩；手写线性图标应保持简单描边")
    if not re.search(r'''stroke-linecap\s*=\s*["']round["']''', source, re.IGNORECASE):
        add_issue(issues, "error", '缺少 stroke-linecap="round"')
    if not re.search(r'''stroke-linejoin\s*=\s*["']round["']''', source, re.IGNORECASE):
        add_issue(issues, "error", '缺少 stroke-linejoin="round"')

    fill_values = re.findall(r'''\bfill\s*=\s*["']([^"']+)["']''', source, re.IGNORECASE)
    if not any(value.strip().lower() == "none" for value in fill_values):
        add_issue(issues, "error", '缺少 fill="none"；图标必须以描边为主体')
    if any(value.strip().lower() != "none" for value in fill_values):
        add_issue(issues, "error", "包含非 none 的填充；默认风格禁止大面积填充")

    colors = {color.lower() for color in re.findall(r"#[0-9a-f]{3,8}\b", source, re.IGNORECASE)}
    if len(colors) > 2:
        add_issue(issues, "error", f"包含 {len(colors)} 个十六进制颜色；默认只允许单色或明暗主题双色")

    animated = bool(
        re.search(r"@keyframes|\banimation\s*:|<animate(?:Transform|Motion)?\b", source, re.IGNORECASE)
    )
    if animated and not re.search(r"prefers-reduced-motion\s*:\s*reduce", source, re.IGNORECASE):
        add_issue(issues, "error", "包含动画但缺少 prefers-reduced-motion 静态降级")
    if favicon and animated:
        add_issue(issues, "error", "favicon 应保持静态")
    if favicon and not re.search(r"prefers-color-scheme|currentColor|#[0-9a-f]{3,8}", source, re.IGNORECASE):
        add_issue(issues, "warning", "favicon 没有可识别的主题或颜色设置")
    if re.search(r"stroke-dash(?:array|offset)", source, re.IGNORECASE) and not re.search(
        r'''pathLength\s*=\s*["']1["']''', source, re.IGNORECASE
    ):
        add_issue(issues, "warning", '描边动画未使用 pathLength="1" 统一路径长度')

    return issues


def validate(targets: list[str]) -> int:
    if not targets:
        print("用法: python validate_svg.py <SVG 文件或目录> [...]", file=sys.stderr)
        return 1

    files = sorted(
        {file for target in targets for file in collect_svg_files(Path(target))},
        key=lambda item: str(item).casefold(),
    )
    if not files:
        print("没有找到 SVG 文件", file=sys.stderr)
        return 1

    error_count = 0
    warning_count = 0
    for file in files:
        source = file.read_text(encoding="utf-8")
        issues = inspect_svg(file, source)
        try:
            display_name = file.relative_to(Path.cwd())
        except ValueError:
            display_name = file

        if not issues:
            print(f"PASS {display_name}")
            continue

        print(f"CHECK {display_name}")
        for level, message in issues:
            if level == "error":
                error_count += 1
            if level == "warning":
                warning_count += 1
            print(f"  {level.upper()}: {message}")

    print(f"检查完成：{len(files)} 个文件，{error_count} 个错误，{warning_count} 个警告")
    return 1 if error_count else 0


def main() -> int:
    try:
        return validate(sys.argv[1:])
    except (OSError, UnicodeError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
