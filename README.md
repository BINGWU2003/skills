# HJC Skills

个人 Agent Skills 聚合仓库。这里集中维护可复用的 Skill，并通过统一的
`skills/` 发布目录供 [`skills`](https://skills.sh/) CLI 发现和安装。

网站通过 Netlify 部署；首次发布后可将站点地址补充到这里。

## 可用 Skills

完整清单、用途及特殊安装要求见 [`SKILLS.md`](SKILLS.md)。

## 快速开始

先查看仓库中可安装的 Skill：

```bash
npx skills add BINGWU2003/skills --list
```

安装指定 Skill：

```bash
npx skills add BINGWU2003/skills --skill agent-git
```

默认安装到当前项目；如需安装到用户级目录，追加 `--global`。也可以把
`agent-git` 替换为 [`SKILLS.md`](SKILLS.md) 中的其他 Skill 名称。

## 本地开发

环境要求：Node.js `>=22.20.0`、pnpm `10.34.4`。

```bash
git clone --recurse-submodules https://github.com/BINGWU2003/skills.git
cd skills
pnpm install
```

如果克隆时没有初始化子模块，可稍后执行：

```bash
pnpm run sources:init
```

### 目录结构

```text
.
├── skills/                # 对外发布、可被 skills CLI 发现的 Skill
│   └── <skill-name>/
│       ├── SKILL.md       # Skill 入口
│       ├── references/    # 可选：详细参考资料
│       ├── scripts/       # 可选：可执行工具
│       └── assets/        # 可选：输出素材
├── sources/               # 通过 Git submodule 引用的 Skill 来源
├── scripts/               # 仓库维护脚本
├── site/                  # Astro 静态网站源码
├── skills.config.json     # 外部 Skill 的来源和同步路径
├── .gitmodules            # Git submodule 配置
└── AGENTS.md              # 仓库维护约定
```

`sources/` 只保存外部项目的子模块引用；真正供 CLI 发现和安装的内容始终位于
`skills/`。安装器通常不会递归拉取子模块，因此外部 Skill 也必须同步到发布目录。

## 添加 Skill

### 添加仓库内维护的 Skill

在 `skills/<skill-name>/` 下创建 `SKILL.md`。目录名和 frontmatter 中的 `name`
必须一致，并且只能使用小写字母、数字和连字符：

```yaml
---
name: example-skill
description: 简洁说明该 Skill 在什么情况下使用。
---
```

`SKILL.md` 应遵循 [Agent Skills 规范](https://agentskills.io/specification)。仓库内
自行维护的 Skill 可按需要使用规范支持的 frontmatter 字段；较长的说明、工具和
素材应分别放入 `references/`、`scripts/` 和 `assets/`。

### 添加外部 Skill

先把来源项目添加为子模块：

```bash
pnpm run sources:add -- <repository-url> sources/<project-name>
```

然后在 `skills.config.json` 中登记子模块路径和 Skill 在来源项目中的路径：

```json
{
  "example-skill": {
    "submodule": "sources/example-project",
    "skillPath": "path/to/example-skill"
  }
}
```

不要直接修改由外部来源同步生成的 `skills/<skill-name>/`；同步时保持上游目录和
frontmatter 原样。改动应先在来源项目中完成，再同步到本仓库。

## 同步与更新

把当前锁定的子模块版本同步到发布目录：

```bash
# 同步全部外部 Skills
pnpm run sync

# 只同步指定 Skill
pnpm run sync -- <skill-name>
```

拉取子模块 `main` 分支的最新提交并同步：

```bash
# 更新全部外部 Skills
pnpm run update

# 只更新指定 Skill
pnpm run update -- <skill-name>
```

更新完成后，需要同时提交子模块指针和对应的 `skills/<skill-name>/` 发布内容。

## 校验

提交前运行：

```bash
pnpm run check
```

该命令只检查 Skill 发现结果，不会修改文件。也可以使用以下命令单独查看结果：

```bash
pnpm run skills:list
```

## 网站开发

网站直接读取 Git 已跟踪的 `skills/*/SKILL.md`，并在构建时生成详情页、文件预览、
搜索索引和单 Skill ZIP，不需要数据库或后端服务。

```bash
# 启动本地开发服务器
pnpm run site:dev

# 完整执行 Skill、类型、构建和站内链接检查
pnpm run site:check
```

GitHub Actions 会在 push 和 PR 上执行构建校验；Netlify 连接仓库后根据根目录的
`netlify.toml` 构建并发布。外部 Skill 的安装依赖和运行要求使用
`skills.config.json` 中的可选 `skillDependencies` 与 `requirements` 字段维护。
