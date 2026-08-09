# Reusable Prompts

Replace bracketed fields before use. Keep the style block intact unless the product's existing design system requires a deliberate exception.

## 中文通用提示词

```text
你是一名资深产品设计师与前端工程师。请为[产品/功能]设计或实现[页面/流程]，帮助[目标用户]完成[核心任务]。

视觉方向采用“有趣但严谨的开发者工具风格”：把专业工具的精密、友好品牌的温度和编辑出版物的排版信心结合起来。界面必须实用、清晰、有辨识度，但不要直接复制任何现有品牌。

设计要求：
1. 使用中等信息密度。保留完成任务所需的上下文，但不要复制监控控制台的极限密度。
2. 先通过布局、间距、对齐、字体层级和分隔线组织内容；只在对象真正独立时使用卡片，禁止卡片套卡片。
3. 使用暖白或安静的中性色画布、接近画布的平面表面、清晰细边框、小圆角和极少阴影。
4. 使用一个主要强调色系列表达操作、状态或层级，避免渐变、玻璃效果、霓虹光晕和大面积装饰性色块。
5. 产品界面采用紧凑易读的无衬线字体；代码、标识符、时间戳或快捷键可使用等宽字体。不要在工作台里使用营销页尺寸的标题。
6. 优先使用列表、表格、分组行、分栏或详情面板，不要默认使用三列圆角卡片网格。
7. 每个主要视图加入一个克制而有记忆点的品牌细节，例如小型插画、不对称色块、机智微文案、粗分隔线或独特状态样式；不要让趣味元素影响任务完成。
8. 覆盖真实的空状态、加载、错误、选中、悬停、焦点和禁用状态，并考虑键盘操作、对比度和减少动态效果。
9. 响应式布局必须保留任务优先级。对于复杂表格、侧栏和详情面板，应使用抽屉、优先级重排、横向滚动或独立详情视图，不能只是把桌面内容全部垂直堆叠。

实现要求：
- 代码实现默认使用 Tailwind CSS，但必须沿用现有项目的 Tailwind 版本、构建方式、组件系统和 class 合并约定；不得为了本任务擅自升级。
- 新建且兼容的项目可使用 Tailwind CSS v4。
- 先定义 canvas、surface、ink、muted-ink、line、accent、state、radius 和 spacing 等语义化 Token，再映射为 Tailwind utilities。
- 避免散落的任意颜色和像素值；重复出现的任意值必须提升为 Token。
- 优先复用项目现有组件。没有组件系统时再使用无障碍的 headless primitives 或轻量本地组件。
- 可以使用 shadcn/ui，但必须重塑其默认视觉，避免大圆角、卡片堆叠和普通 SaaS 模板感。

现有约束与内容：[技术栈、品牌资产、现有组件、必须保留的内容或交互]

输出应先说明页面的核心层级和设计取舍，再提供完整成果。完成后按任务清晰度、信息密度、分组方式、品牌个性、交互状态、响应式、无障碍和 Tailwind 可维护性进行自检。
```

## English master prompt

```text
Act as a senior product designer and frontend engineer. Design or implement [surface/flow] for [product or feature] so [target user] can complete [primary task].

Use a precise-but-playful developer-tool visual language: combine the rigor of professional tools, the warmth of an approachable brand, and the typographic confidence of editorial design. The result must feel useful, clear, and authored without copying an existing brand.

Design requirements:
1. Use medium information density. Preserve the context required for real work without reproducing the maximum density of a monitoring console.
2. Organize content first through layout, spacing, alignment, typography, and dividers. Use cards only for genuinely independent objects; never nest cards.
3. Use a warm off-white or quiet neutral canvas, closely related flat surfaces, visible fine borders, small radii, and minimal shadow.
4. Use one primary accent family to communicate action, state, or hierarchy. Avoid decorative gradients, glassmorphism, neon glow, and large ornamental color washes.
5. Use compact, readable sans-serif typography for product UI. Reserve monospace for code, identifiers, timestamps, or shortcuts. Do not use marketing-scale headings inside operational screens.
6. Prefer lists, tables, grouped rows, split views, and detail panels over a default three-column rounded-card grid.
7. Add one restrained, memorable brand device per major view: a small illustration, asymmetric accent slab, witty microcopy, bold rule, or distinctive state treatment. Personality must never obscure task completion.
8. Include realistic empty, loading, error, selected, hover, focus, and disabled states. Address keyboard access, contrast, and reduced motion.
9. Preserve task priority responsively. Use drawers, prioritized reflow, horizontal scrolling, or dedicated detail views for sidebars, tables, and inspectors instead of blindly stacking the desktop layout.

Implementation requirements:
- Default code implementation to Tailwind CSS while preserving the project's existing Tailwind version, build setup, component system, and class-merging conventions. Never upgrade Tailwind merely for this task.
- For a new compatible project, Tailwind CSS v4 is preferred.
- Define semantic tokens for canvas, surface, ink, muted ink, line, accent, state, radius, and spacing before mapping them to Tailwind utilities.
- Avoid scattered arbitrary colors and pixel values. Promote repeated exceptions into tokens.
- Reuse existing components first. If none exist, use accessible headless primitives or small local components.
- shadcn/ui is allowed, but its default visual language must be retuned to avoid blanket large radii, nested cards, and generic SaaS styling.

Existing constraints and content: [stack, brand assets, existing components, content, and interactions to preserve]

Explain the primary hierarchy and key design tradeoffs briefly, then provide the complete result. Finish with a self-check covering task clarity, density, grouping, brand character, interaction states, responsiveness, accessibility, and maintainable Tailwind usage.
```

## Mode prefixes

Prepend one of these blocks to the master prompt.

### Design from scratch

```text
Create a new solution. Do not invent secondary features to fill the page. Establish the primary task and information architecture before selecting visual components.
```

### Restyle an existing interface

```text
Restyle the supplied interface while preserving its content, routes, functionality, and core interactions unless explicitly asked otherwise. Inventory the existing tokens and components first, then translate the interface through semantic tokens and shared primitives rather than isolated local overrides.
```

### Audit an interface

```text
Audit the supplied interface without changing it. Report evidence-based findings in priority order across task clarity, hierarchy, density, grouping, typography, color and state, brand character, responsive behavior, accessibility, and Tailwind maintainability. Tie every finding to a visible element and propose a concrete correction.
```
