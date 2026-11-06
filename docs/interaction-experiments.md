# 交互实验页

更新时间：2026-11-04

这些页面用于在不改变首页和 `/photography` 页面职责的前提下，单独验证复杂交互。它们不是当前信息架构的一部分，也不会加入 sitemap。

## 入口

- `/experiments`：实验页索引
- `/experiments/journey-map`：滚动叙事 + 路线地图
- `/experiments/metro`：列表 / 网格档案切换
- `/experiments/reference-archive`：基于 MIT 开源摄影项目结构参考的章节式档案页
- `/experiments/photography-archive`：Photography 页面改造实验，验证章节入口、完整 contact sheet 和 Journal 入口的关系
- `/experiments/sasha-kurmaz`：参考 Sasha Kurmaz 的固定署名、粉色纸张和双栏图像索引的 Photography demo
- `/experiments/agarun-atlas`：相册、标签和地点入口的轻量 Atlas 原型
- `/experiments/look-but-no-stopping`：基于 MIT 开源 `newfoundland` 项目的分层开场、滚动叙事和路线联动实验

## Reference archive

这个版本优先参考 MIT 许可的 [jpvalery/portfolio](https://github.com/jpvalery/portfolio) 和 [Immich Folio](https://github.com/ralksta/immich-folio) 的公开结构：章节入口、contact sheet、journal / field notes，以及受控的图片布局。页面保留当前 Sanity、响应式图片和现有灯箱，不复制 GPL 项目或未确认许可项目的代码。

## Journey map

参考 [Look but no stopping](https://lookbutnostopping.com/) 的核心机制：图片章节垂直排列，右侧固定的抽象地图随当前章节更新。地图点位可以点击跳转，图片点击复用现有灯箱。

2026-11-04 复核了该站公开仓库 [jpvalery/newfoundland](https://github.com/jpvalery/newfoundland)：仓库代码使用 MIT License，站内照片、文字和插画资源仍受版权保护。本页直接复制 MIT 许可的 canvas-map、路径计算和 Canvas 绘制源码到 `src/lib/lookbut/`，使用本项目自己的照片和文案，并用 OpenStreetMap 的香港真实地理轮廓生成底图；原站照片、文字和 Newfoundland 地图素材仍未复制。

另有 `/experiments/look-but-no-stopping-fvm` 对照页，使用 FreeVectorMaps 的香港区划底图版本作为原样背景，路线仍由独立 Canvas 图层绘制，并在页脚提供 `Map by FreeVectorMaps.com` 署名链接。该页用于比较素材视觉，不替换 OSM 版本。

### Hero 实现记录

这一版 hero 作为后续摄影专题页的可复用参考，保留了“先进入氛围，再进入标题，再进入正文”的三段式节奏：

1. **分层开场**：`journey-parallax` 使用 6 张当前图库照片作为叠层，结合不同透明度、缩放和垂直位移，形成类似暗房叠印的景观入口。图片只作为视觉氛围，不承载地点信息。
2. **引导语**：开场中央使用一句短引文和向下箭头，帮助用户理解这是一个需要继续向下阅读的叙事页面。
3. **标题 Hero**：深蓝色整屏标题区将 `Follow the` 与衬线体 `weather` 分开排版，形成无衬线信息层和衬线情绪层的对比；副标题和返回入口保持较低视觉权重。
4. **进入正文**：标题区之后用一条简短的移动端提示把用户带入章节滚动，桌面端则直接进入左文右图的路线叙事。

实现位置：

- 结构与内容：[src/components/JourneyMapExperiment.tsx](../src/components/JourneyMapExperiment.tsx)
- 视觉与响应式规则：[src/styles/global.css](../src/styles/global.css) 中的 `journey-reference`、`journey-parallax` 和 `journey-reference__hero` 规则

复用时保留以下约束：hero 图片使用 `sizedImageUrl` 和 `srcSet`，首张图 `eager`、其余图 `lazy`；所有可点击元素保留键盘焦点样式；`prefers-reduced-motion` 下隐藏视差层并保留静态标题；移动端标题必须避免横向溢出，使用较小字号和更紧的字距。

当前版本使用现有照片和抽象路径点位，不把照片的分类当作真实 GPS 数据。迁移到正式页面前，需要决定：

- 是否拥有足够完整的地点元数据；
- 地图是使用真实地理底图、手绘 SVG，还是仅保留路线图形；
- 滚动叙事是否比普通地点筛选更适合首页。

## Archive in motion

参考 [Montreal in Motion](https://typicalmitul.com/montreal-in-motion) 的核心机制：同一组照片可在 List 和 Grid 两种模式之间切换，列表负责定位，网格负责浏览，点击图片进入现有灯箱。

当前版本用现有照片生成临时的线路和站点标签。迁移到正式页面前，需要决定：

- “站点”应对应地点、时间、项目还是主题；
- 是否需要把布局偏好写入 URL 或本地存储；
- 是否要增加项目说明弹窗、筛选和键盘方向键导航。

## Agarun atlas

`photos.agarun.com` 的公开仓库 [agarun/photos](https://github.com/agarun/photos) 提供了清晰的相册数据模型：地点型相册、自定义相册、标签、文件夹和坐标。核查 GitHub API 时该仓库的 `license` 字段为 `null`，仓库中也没有确认到许可证文件，因此本项目没有直接复制其代码或组件。

新原型只参考公开的信息架构，使用当前照片数据和自绘 SVG Atlas：点击集合点位会更新预览，右侧列表支持 Places / Studies 筛选，图片继续使用现有灯箱。它刻意没有引入 `react-globe.gl`、Three.js 或 Contentful，以便先判断这个交互是否值得进入正式页面。

如果需要体验 Agarun 的原始实现，已将公开仓库隔离克隆到 `D:/Gallery/agarun-reference`。它使用原仓库的 Next.js、Globe.GL、Three.js 和 Masonic 依赖；因为原仓库没有确认许可证，这个目录只作为本地参考运行源，不属于 `gallery-site` 的应用代码。当前本地使用从公开页面提取的相册和照片元数据作为 mock，因此不需要 Contentful 凭据；相册详情页也可以直接体验瀑布流和 PhotoSwipe 灯箱。

## 边界

- Look but no stopping 实验页新增 GSAP，仅用于复制的 canvas-map 滚动缓动；不引入地图 SDK。
- 实验页不改变 Home、Photography、Journal 和 Balcony View 的内容模型。
- 通过 `onOpen` 复用现有照片灯箱，关闭灯箱后返回实验页。
- 如果最终采用其中一种交互，再单独抽取数据契约和可访问性规则接入正式页面。





