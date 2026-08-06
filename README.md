# HJC Skills

个人 Agent Skills 聚合仓库。

## 目录结构

```text
.
├── skills/                # 对外发布、可被 skills CLI 发现的 Skill
│   └── <skill-name>/
│       └── SKILL.md
├── sources/               # 通过 Git submodule 引用的其他项目
├── scripts/               # Skill 同步脚本
├── .gitmodules            # 子模块来源配置
├── skills.config.json     # 外部 Skill 同步配置
├── package.json           # 项目命令入口
├── pnpm-lock.yaml         # pnpm 依赖锁文件
└── AGENTS.md              # 仓库维护约定
```

## 初始化

```bash
pnpm install
```

## 添加项目来源

```bash
pnpm run sources:add -- <repository-url> sources/<project-name>
pnpm run sources:init
```

`.gitmodules` 用于聚合其他项目的 Skill 源码。需要通过 `skills` CLI
发布的 Skill，应同步到主仓库的 `skills/<skill-name>/` 并提交；安装器通常不会递归拉取子模块。

## 同步外部 Skills

外部 Skill 的子模块和源路径统一配置在 `skills.config.json`，发布副本位于
`skills/<skill-name>`。

同步所有 Skill 的当前锁定版本：

```bash
pnpm run sync
```

更新所有子模块到 `main` 的最新提交并同步：

```bash
pnpm run update
```

只处理指定 Skill 时，在命令后传入名称：

```bash
pnpm run sync -- <skill-name>
pnpm run update -- <skill-name>
```

更新后需要同时提交子模块指针和对应 `skills/<skill-name>` 的内容。

## 检查与安装

```bash
# 检查 Skill 发现结果，不修改文件
pnpm run check

# 仅查看能够发现的 Skill
pnpm run skills:list

# 从当前仓库安装指定 Skill
pnpm run skills:install -- --skill <skill-name>

# 从其他仓库安装 Skill
pnpm run skills:add -- <owner>/<repo> --skill <skill-name>
```

每个 Skill 至少包含：

```text
skills/<skill-name>/SKILL.md
```

`SKILL.md` 的 YAML frontmatter 必须包含 `name` 和 `description`。
