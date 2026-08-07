# 手写 SVG 动效约束

## 目录

- 外链 SVG
- 书写循环
- 多笔画顺序
- 呼吸与变换
- 减少动态效果
- favicon
- 性能与无障碍

## 外链 SVG

网站通常通过 HTML 图片元素外链 Logo。SVG 内嵌的 `<style>` 和 CSS 动画可以运行，但不能依赖父页面的 CSS 变量、类名或 `currentColor`。生产 Logo 应写入适合目标背景的明确颜色。

不要使用外部字体、远程图片、JavaScript 或运行时请求。

## 书写循环

默认总时长使用 6–8 秒，并按以下比例组织：

- 约 0–35%：逐笔写入；
- 约 35–80%：完整停留；
- 约 80–100%：淡出并在不可见时复位。

```css
.stroke {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: write 7.2s cubic-bezier(.65, 0, .35, 1) infinite;
}

@keyframes write {
  0% { opacity: 0; stroke-dashoffset: 1; }
  5% { opacity: 1; }
  35%, 80% { opacity: 1; stroke-dashoffset: 0; }
  96% { opacity: 0; stroke-dashoffset: 0; }
  100% { opacity: 0; stroke-dashoffset: 1; }
}
```

每条动态路径使用 `pathLength="1"`，避免依赖真实路径长度。

## 多笔画顺序

按照真实书写顺序设置少量延迟，通常每条相差 0.12–0.22 秒。延迟只表达先后，不要让后续路径在主体已经淡出后才完成。

1–4 条路径应形成连续笔势；不要通过大量碎片路径制造绘制效果。

## 呼吸与变换

呼吸只作为辅助。位移不得超过 viewBox 高度的 1%，透明度变化不超过约 15%。禁止持续旋转、弹跳、发光和缩放脉冲。

动画应强化“正在书写”的感觉，而不是模拟加载状态。

## 减少动态效果

所有动态 Logo 必须提供完整静态降级：

```css
@media (prefers-reduced-motion: reduce) {
  .signature,
  .stroke {
    animation: none;
  }

  .stroke {
    opacity: 1;
    stroke-dashoffset: 0;
  }
}
```

## favicon

favicon 保持静态并沿用定稿笔势。可以加粗、减少路径和扩大负空间，但不要切换成另一套填充图标。

可使用主题自适应单色：

```css
:root { color: #111827; }
@media (prefers-color-scheme: dark) { :root { color: #f5f5f5; } }
```

## 性能与无障碍

- 只动画少量路径的描边、透明度和微小位移。
- 避免滤镜、模糊、复杂遮罩和高频关键帧。
- 独立 SVG 添加 `<title>` 和 `<desc>`。
- 页面已有可访问名称时，装饰性 Logo 使用空替代文本。
- 无动画时图形必须完整、清楚并可识别。
