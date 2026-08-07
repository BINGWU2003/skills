# 风格锚点

这些锚点用于校准个人审美，不是可复制素材。不要下载、内嵌或改写其 SVG 路径。

## Antfu

- 网站：https://antfu.me/
- 源码：https://github.com/antfu/antfu.me
- 许可：MIT License
- 观察对象：`src/components/Logo.vue`、`src/components/LogoStroke.vue` 和 `public/favicon.svg`

可提炼特征：

- 单条连续路径形成紧凑的纵向签名；
- 细描边、圆头、圆角连接，依靠曲率而不是规则几何形成结构；
- 动态版本使用约 10 秒书写循环，绘制完成后长时间停留；
- 深浅主题只改变单色线条，不增加装饰；
- favicon 是静态简化结果，保留原始签名轮廓。

不要复制其字母组合、纵向长笔画、中央回环、遮罩或具体路径。

## Hujiacheng

- 网站：https://hujiachengme.netlify.app/
- 源码：https://github.com/BINGWU2003/hujiacheng.me
- 许可：MIT License
- 观察对象：`public/logo.svg`、`public/logo-dark.svg` 和 `public/favicon.svg`

可提炼特征：

- 4 条视觉连贯的曲线组成横向签名，主笔与弱化收笔有粗细差异；
- 使用 512 × 512 viewBox、圆头和圆角连接；
- 描边书写与轻微呼吸同时存在，路径按书写顺序错峰出现；
- Logo 保持透明背景和单色，favicon 使用同一笔势的静态版本；
- 曲线经过整理但保留轻微不对称，不模拟纸笔噪点。

不要复制其首字母组合、长上行笔画、右侧回环、底部扫线或具体动画延迟。

## 综合风格指纹

本 Skill 固定采用：

- 单色透明背景；
- 1–4 条有机曲线路径；
- 圆头与圆角连接；
- 流畅但非机械对称的贝塞尔曲线；
- 静态轮廓优先；
- 缓慢书写、长时间停留、轻微呼吸；
- favicon 继承同一笔势。

这些原则可以复用，任何具体轮廓都必须重新设计。
