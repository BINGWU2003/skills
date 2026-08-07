# SVG 动效与生产约束

## 目录

- 外链 SVG
- 描边绘制
- 呼吸与变换
- 减少动态效果
- favicon
- 性能与无障碍

## 外链 SVG

网站通常通过 HTML 图片元素外链 Logo。SVG 内嵌的 `<style>` 和 CSS 动画可以运行，但不能依赖父页面的 CSS 变量、类名或 `currentColor`。生产 Logo 应写入在目标背景上可见的明确颜色。

不要使用外部字体、远程图片、JavaScript 或运行时请求。保持 SVG 自包含。

## 描边绘制

对需要依次出现的路径使用统一长度：

```svg
<path class="stroke stroke-1" pathLength="1" d="..." />
```

```css
.stroke {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 4.8s cubic-bezier(.65, 0, .35, 1) infinite;
}
```

让图形在循环的中段完整停留，避免用户只能看到半成品。多路径动画使用少量递增延迟，完整图形的等待时间应长于绘制时间。

## 呼吸与变换

呼吸动画幅度应小。推荐透明度变化不超过约 25%，位移不超过 viewBox 高度的 1–2%。设置明确的 `transform-origin`；需要时增加 `transform-box: fill-box`。

动效应该服从隐喻：组装可以依次绘制，连接可以点亮节点，打开可以轻微展开。避免与含义无关的持续旋转、弹跳或闪烁。

## 减少动态效果

所有动态 Logo 都必须提供静态降级：

```css
@media (prefers-reduced-motion: reduce) {
  .mark,
  .stroke {
    animation: none;
  }

  .stroke {
    opacity: 1;
    stroke-dashoffset: 0;
  }
}
```

降级后的首帧必须是完整 Logo，不能留下隐藏路径。

## favicon

favicon 保持静态。重新调整路径和描边，不要直接缩小动态 Logo。可在内部使用：

```css
:root { color: #111827; }
@media (prefers-color-scheme: dark) { :root { color: #f5f5f5; } }
```

浏览器对 favicon 动画和主题更新的行为不一致，不要依赖它们表达品牌信息。

## 性能与无障碍

- 优先动画 `opacity` 和 `transform`；描边动画只用于少量路径。
- 避免滤镜、巨大模糊、遮罩链和高频关键帧。
- 独立展示的 SVG 添加 `<title>` 和 `<desc>`。
- 页面中已有可访问名称时，把装饰性 Logo 的 `<img alt="">`。
- 确保没有动画时图形仍然完整、清楚并且可识别。
