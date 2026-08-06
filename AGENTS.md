# Skills 仓库维护约定

## 目标

本仓库聚合个人项目中的 Agent Skills，并提供可被 `skills` CLI 直接发现的发布目录。

## 目录职责

- `sources/`：其他项目的 Git submodule，只作为 Skill 来源。
- `skills/`：最终发布内容，每个一级目录对应一个 Skill。
- 不把构建产物、依赖目录或与 Skill 无关的项目源码复制进 `skills/`。

## Skill 规范

- 路径使用 `skills/<skill-name>/SKILL.md`。
- Skill 名称仅使用小写字母、数字和连字符，并与目录名一致。
- `SKILL.md` 遵循 [Agent Skills 规范](https://agentskills.io/specification)；仓库内自行维护的 Skill 可按需使用规范支持的 frontmatter 字段。
- `SKILL.md` 保持精简；详细资料放入 `references/`，可执行工具放入 `scripts/`，输出素材放入 `assets/`。
- 修改后运行 `pnpm run check` 检查 Skill 发现结果；该命令不得修改文件。

## 子模块

- 使用 `pnpm run sources:add -- <url> sources/<project-name>` 添加来源。
- 不直接修改 `sources/` 中属于子模块的内容；修改应在对应项目仓库完成。
- 子模块中的 Skill 需要同步到 `skills/` 后再从本仓库发布。
- 同步外部 Skill 时保持上游目录和 frontmatter 原样，不做格式清洗或字段删减。
- 外部 Skill 的子模块和源路径统一登记在 `skills.config.json`。
- 对外部 Skill，运行 `pnpm run sync -- <skill-name>` 或 `pnpm run update -- <skill-name>`，不直接修改生成内容。

## Git 提交

- 默认使用简体中文提交信息。
- 使用 Conventional Commits 时保留英文类型前缀，例如：`feat: 添加项目发布 Skill`。
