from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)


CONFIG_RELATIVE_PATH = Path(".codex") / "gitlab-url-guard.json"
RESOURCE_PATHS = {
    "mr": "merge_requests",
    "pipeline": "pipelines",
    "job": "jobs",
    "commit": "commit",
}
URL_PATTERN = re.compile(r"https?://[^\s<>()\[\]{}\"']+")
BARE_MR_PATTERN = re.compile(r"(?<![\w/])!(\d+)\b")


class GuardError(RuntimeError):
    pass


def run_git(arguments: list[str], *, cwd: Path | None = None) -> str:
    completed = subprocess.run(
        ["git", *arguments],
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if completed.returncode != 0:
        details = completed.stderr.strip() or completed.stdout.strip()
        raise GuardError(f"Git 命令失败：git {' '.join(arguments)}：{details}")
    return completed.stdout.strip()


def find_repo_root() -> Path:
    return Path(run_git(["rev-parse", "--show-toplevel"])).resolve()


def resolve_config_path(explicit: str | None, *, require_existing: bool) -> Path:
    if explicit:
        path = Path(explicit).resolve()
    else:
        path = find_repo_root() / CONFIG_RELATIVE_PATH
    if require_existing and not path.is_file():
        raise GuardError(
            f"未找到配置：{path}。请先执行 init --write，禁止猜测 GitLab 地址。"
        )
    return path


def normalize_project_url(value: str) -> str:
    raw = value.strip().rstrip("/")
    parsed = urlsplit(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise GuardError("projectUrl 必须是完整的 HTTP(S) GitLab 项目地址。")
    if parsed.username or parsed.password:
        raise GuardError("projectUrl 不得包含用户名或密码。")
    if parsed.query or parsed.fragment:
        raise GuardError("projectUrl 不得包含查询参数或锚点。")
    path = parsed.path.rstrip("/")
    if path.endswith(".git"):
        path = path[:-4]
    segments = [segment for segment in path.split("/") if segment]
    if len(segments) < 2 or "/-/" in f"{path}/":
        raise GuardError("projectUrl 必须指向 GitLab 项目主页，例如 /group/project。")
    return urlunsplit((parsed.scheme, parsed.netloc, "/" + "/".join(segments), "", ""))


def load_project(config_path: Path) -> tuple[str, str, str, str]:
    try:
        data = json.loads(config_path.read_text(encoding="utf-8"))
        version = data["version"]
        project_url = normalize_project_url(str(data["projectUrl"]))
    except (OSError, json.JSONDecodeError, KeyError, TypeError) as exc:
        raise GuardError(f"无法读取有效配置：{config_path}：{exc}") from exc
    if version != 1:
        raise GuardError(f"不支持的配置版本：{version}")
    if set(data) != {"version", "projectUrl"}:
        raise GuardError("配置只允许包含 version 和 projectUrl。")

    parsed = urlsplit(project_url)
    return parsed.scheme, parsed.netloc, parsed.hostname.lower(), project_url


def remote_names(repo_root: Path) -> list[str]:
    output = run_git(["remote"], cwd=repo_root)
    return [line.strip() for line in output.splitlines() if line.strip()]


def choose_remote(repo_root: Path, requested: str | None) -> str:
    remotes = remote_names(repo_root)
    if requested:
        if requested not in remotes:
            raise GuardError(f"Git remote 不存在：{requested}")
        return requested
    if "origin" in remotes:
        return "origin"
    if len(remotes) == 1:
        return remotes[0]
    if not remotes:
        raise GuardError("项目没有 Git remote，请使用 --project-url 指定地址。")
    raise GuardError("项目有多个 Git remote，请使用 --remote 或 --project-url 明确选择。")


def project_url_from_remote(repo_root: Path, remote: str) -> str:
    remote_url = run_git(["remote", "get-url", remote], cwd=repo_root)
    if not remote_url.startswith(("http://", "https://")):
        raise GuardError(
            f"remote {remote} 不是 HTTP(S) 地址，无法可靠推断 Web 协议和端口；"
            "请使用 --project-url。"
        )
    return normalize_project_url(remote_url)


def initialize_config(arguments: argparse.Namespace) -> None:
    repo_root = find_repo_root()
    config_path = resolve_config_path(arguments.config, require_existing=False)
    if config_path.exists():
        raise GuardError(f"配置已存在，禁止覆盖：{config_path}")

    project_url = (
        normalize_project_url(arguments.project_url)
        if arguments.project_url
        else project_url_from_remote(repo_root, choose_remote(repo_root, arguments.remote))
    )
    content = json.dumps(
        {"version": 1, "projectUrl": project_url},
        ensure_ascii=False,
        indent=2,
    ) + "\n"

    if not arguments.write:
        print(f"将创建：{config_path}")
        print(content, end="")
        print("当前为预览模式；确认后添加 --write。")
        return

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(content, encoding="utf-8", newline="\n")
    print(f"配置已创建：{config_path}")


def resource_url(project_url: str, kind: str, identifier: str) -> str:
    clean_identifier = identifier.strip()
    if kind != "commit" and not clean_identifier.isdigit():
        raise GuardError(f"{kind} ID 必须是数字：{identifier}")
    if kind == "commit" and not re.fullmatch(r"[0-9a-fA-F]{7,40}", clean_identifier):
        raise GuardError(f"提交 SHA 无效：{identifier}")
    return f"{project_url}/-/{RESOURCE_PATHS[kind]}/{clean_identifier}"


def strip_trailing_punctuation(url: str) -> tuple[str, str]:
    suffix = ""
    while url and url[-1] in ".,;:!?，。；：！？":
        suffix = url[-1] + suffix
        url = url[:-1]
    return url, suffix


def normalize_url(
    raw_url: str,
    *,
    scheme: str,
    host: str,
    hostname: str,
) -> str:
    url, suffix = strip_trailing_punctuation(raw_url)
    parsed = urlsplit(url)
    if (parsed.hostname or "").lower() != hostname:
        return raw_url
    normalized = urlunsplit((scheme, host, parsed.path, parsed.query, parsed.fragment))
    return normalized + suffix


def normalize_text(text: str, *, scheme: str, host: str, hostname: str, project_url: str) -> str:
    normalized = URL_PATTERN.sub(
        lambda match: normalize_url(
            match.group(0), scheme=scheme, host=host, hostname=hostname
        ),
        text,
    )
    return BARE_MR_PATTERN.sub(
        lambda match: resource_url(project_url, "mr", match.group(1)), normalized
    )


def validate_text(
    text: str,
    *,
    scheme: str,
    host: str,
    hostname: str,
    project_url: str,
) -> list[str]:
    errors: list[str] = []
    for match in URL_PATTERN.finditer(text):
        raw_url, _ = strip_trailing_punctuation(match.group(0))
        parsed = urlsplit(raw_url)
        if (parsed.hostname or "").lower() != hostname:
            continue
        if parsed.scheme != scheme or parsed.netloc != host:
            errors.append(
                f"GitLab URL 的协议或端口不匹配：{raw_url}；应以 {scheme}://{host} 开头"
            )
            continue
    bare_refs = sorted(set(BARE_MR_PATTERN.findall(text)), key=int)
    if bare_refs:
        errors.append("存在裸 MR 引用，必须展开成完整 URL：" + ", ".join(f"!{iid}" for iid in bare_refs))
    return errors


def read_text(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError) as exc:
        raise GuardError(f"无法读取 UTF-8 文本：{path}：{exc}") from exc


def write_text(path: str, content: str) -> None:
    try:
        Path(path).write_text(content, encoding="utf-8", newline="\n")
    except OSError as exc:
        raise GuardError(f"无法写入文件：{path}：{exc}") from exc


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="初始化、规范化并校验项目 GitLab URL。")
    parser.add_argument("--config", help="自定义配置路径")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init", help="初始化项目配置")
    init_parser.add_argument("--project-url", help="完整 GitLab 项目 Web 地址")
    init_parser.add_argument("--remote", help="用于推断地址的 Git remote 名称")
    init_parser.add_argument("--write", action="store_true", help="确认写入配置")

    url_parser = subparsers.add_parser("url", help="构造 GitLab 资源 URL")
    url_parser.add_argument("kind", choices=sorted(RESOURCE_PATHS))
    url_parser.add_argument("identifier")

    normalize_parser = subparsers.add_parser("normalize", help="规范化文本中的 GitLab URL")
    normalize_parser.add_argument("--input", required=True)
    normalize_parser.add_argument("--output", required=True)

    validate_parser = subparsers.add_parser("validate", help="严格校验文本中的 GitLab URL")
    validate_parser.add_argument("--input", required=True)
    return parser


def main() -> int:
    arguments = build_parser().parse_args()
    try:
        if arguments.command == "init":
            initialize_config(arguments)
            return 0

        config_path = resolve_config_path(arguments.config, require_existing=True)
        scheme, host, hostname, project_url = load_project(config_path)

        if arguments.command == "url":
            print(resource_url(project_url, arguments.kind, arguments.identifier))
            return 0

        text = read_text(arguments.input)
        if arguments.command == "normalize":
            normalized = normalize_text(
                text,
                scheme=scheme,
                host=host,
                hostname=hostname,
                project_url=project_url,
            )
            write_text(arguments.output, normalized)
            print(f"GitLab URL 已规范化：{arguments.output}")
            return 0

        errors = validate_text(
            text,
            scheme=scheme,
            host=host,
            hostname=hostname,
            project_url=project_url,
        )
        if errors:
            for error in errors:
                print(f"错误：{error}", file=sys.stderr)
            return 1
        print("GitLab URL 校验通过。")
        return 0
    except GuardError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
