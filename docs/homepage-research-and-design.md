# 首页改造调研与设计决策

更新时间：2026-11-03
状态：调研完成，等待进入首页原型与实现阶段

## 目标

当前根路径直接打开摄影画廊。这个方式适合“只看照片”的访问者，但网站已经包含 Balcony View、Journal、About、Photo Stories，并且未来可能加入视频，因此需要判断是否建立一个真正的首页，再把照片档案变成独立入口。

本次调研回答四个问题：

1. 个人摄影师网站通常如何处理首页和作品档案的关系？
2. 哪些开源项目可以参考内容结构、图片性能和组件实现？
3. 哪些组件适合当前 React + Vite + Sanity 项目？
4. Queenstown.top 应该采用哪一种首页方向？

## 当前项目基线

当前项目已经具备以下能力：

- React 19 + Vite，前端是单页路由结构。
- Sanity 作为内容源，已经有受控的 `pageContent`、`homepageLayout` 和 `photobalconyLayout`。
- 根路径目前包含标题、主视觉图片和完整的 `GallerySections`。
- `GallerySections` 的主内容区使用 `id="photography"`，因此现在的 `Home`（`/#top`）和 `Photography`（`/#photography`）仍然属于同一个页面。
- 已经使用 `yet-another-react-lightbox`，不需要为了首页重新引入一套灯箱。
- 当前已有 `Journal`、`About`、`PhotoStory` 和 `BalconyView` 页面，可以组成清晰的内容层级。

当前最明显的信息架构问题是：菜单里已经出现了 Home 和 Photography，但两者没有真正不同的页面职责。访客会看到两个入口，却无法预期它们之间有什么区别。

## 真实网站参考

以下网站在 2026-11-03 访问了公开页面或公开仓库，重点记录它们的首页入口、内容层级和可借鉴部分。

### [Jp Valery](https://jpvalery.photo)

首页首屏先给出一句明确的摄影观点：`There’s a lot of beauty in ordinary things`，随后说明摄影师是谁、拍什么，再进入按章节组织的作品卡片。导航区分为 Chapters、Archive、Blog、About 和 Contact。

可以借鉴：

- 用一句有态度的短句说明摄影视角，而不是只写“Photography”。
- 首页展示作品系列或章节，档案页再承载全部照片。
- 首页既能让新访客理解作者，也能让熟悉的访客快速进入作品。
- 公开仓库 [jpvalery/portfolio](https://github.com/jpvalery/portfolio) 使用静态 Next.js、Markdown 内容、预生成图片变体和明确的图片性能检查，适合参考内容模型和图片管线。

不直接照搬：它的章节模型和 Cloudflare R2 图片管线比当前项目更偏静态档案，需要保留当前 Sanity 的内容编辑能力。

### [Agarun Photos](https://photos.agarun.com)

这是一个带有 galleries、tags、folders 和 globe 的个人摄影站点。公开仓库 [agarun/photos](https://github.com/agarun/photos) 使用 Next.js、Contentful、Justified Gallery、PhotoSwipe、Three.js 和 Globe.GL。

可以借鉴：

- 当照片数量增长后，首页可以成为“探索入口”，而不是承载全部照片。
- 标签、文件夹、系列和地点是摄影档案很自然的第二层导航。
- 地理信息或地图可以成为长期扩展方向。

不建议当前阶段采用：3D globe 和 Three.js 会增加首屏负担，也会让个人摄影网站从“观看照片”变成“操作可视化装置”。当前应优先建立清楚的首页和作品入口。

### [Typical Mitul](https://typicalmitul.com)

首页使用一个强烈的个人定位标题，然后在长页面中依次展开 About、Work 和 Contact，并加入服务范围、客户证明和联系表单。公开仓库 [mitul-s/typicalmitul.com](https://github.com/mitul-s/typicalmitul.com) 使用 Next.js、Tailwind CSS、Framer Motion 和 Radix Primitives。

可以借鉴：

- 如果未来要承接商业拍摄，首页可以先说明服务对象，再展示作品。
- About、Work、Contact 可以形成一条完整的叙事路径。
- 动效应该服务于区块进入、作品浏览和联系动作，而不是成为背景装饰。

不适合当前版本的部分：Queenstown.top 目前更像个人档案和视觉日记，而不是商业摄影工作室。客户 Logo、服务标签和询价表单可以保留为未来方向，不应成为第一版首页的主叙事。

### [Design Photography Portfolio](https://github.com/pysunday/DesignPhotographyPortfolio)

这是一个 Astro 摄影主题，公开说明包含桌面、移动端以及 light/dark mode 截图，并提供中英文文档。它适合作为布局和主题切换的参考。

需要注意：仓库根目录没有在本次调研中确认到明确的开源许可证，因此只能用于视觉和结构参考，不能直接复制代码或资源，直到许可证得到确认。

### [Immich Folio](https://github.com/ralksta/immich-folio)

这是一个 MIT 许可的自托管摄影门户，包含 hero、相册页面、masonry、showcase、filmstrip、editorial flow、journal、视频播放和页面构建器。

可以借鉴：

- 相册、故事、视频和首页模块可以作为同一个内容模型的不同入口。
- 页面构建器应只允许受控的模块类型，不应让内容编辑直接写 CSS 或任意 HTML。
- 视频、照片故事和相册都可以从首页以 teaser 形式出现，再进入独立页面。

不直接采用：它是面向自托管照片库的完整产品，包含管理后台、权限、proofing 和 Immich 代理，远超当前网站首页所需的范围。

## 开源项目和许可情况

| 项目 | 用途 | 技术栈 | 许可证情况 | 对当前项目的建议 |
| --- | --- | --- | --- | --- |
| [jpvalery/portfolio](https://github.com/jpvalery/portfolio) | 个人摄影档案和章节首页 | Next.js、Markdown、静态导出 | MIT | 参考内容模型、图片预生成和性能门禁 |
| [agarun/photos](https://github.com/agarun/photos) | 相册、标签、文件夹、地图/地球 | Next.js、Contentful、Three.js | 本次未确认根目录许可证 | 只参考档案结构，暂不复制代码 |
| [typicalmitul.com](https://github.com/mitul-s/typicalmitul.com) | 商业摄影师长页面 | Next.js、Tailwind、Framer Motion、Radix | GPL-3.0 | 参考叙事和区块节奏，不能直接移植为闭源模块 |
| [DesignPhotographyPortfolio](https://github.com/pysunday/DesignPhotographyPortfolio) | 摄影主题模板 | Astro、Tailwind、Alpine/React 集成 | 本次未确认许可证 | 参考响应式布局和明暗主题，先不复用代码 |
| [Immich Folio](https://github.com/ralksta/immich-folio) | 自托管摄影门户和页面构建器 | Next.js、YAML、Zod | MIT | 参考受控页面模块和视频/故事入口 |

许可结论：本项目可以直接使用 MIT 许可的思想和代码，但仍应保留许可证和版权说明；GPL 项目只适合作为设计参考，未确认许可证的项目只用于观察公开页面和记录交互模式。

## 当前项目可用的开源组件

### 继续使用

| 组件 | 许可 | 用途 | 决策 |
| --- | --- | --- | --- |
| [yet-another-react-lightbox](https://github.com/igordanchenko/yet-another-react-lightbox) | MIT | 照片灯箱、键盘和触摸浏览 | 保留，当前已经接入 |
| [@sanity/image-url](https://github.com/sanity-io/image-url) | MIT | Sanity 图片 URL 和裁剪 | 可按需统一图片参数，先不替换当前稳定的 `imageUrl` 封装 |

### 首页可能需要

| 组件 | 许可 | 适合做什么 | 当前判断 |
| --- | --- | --- | --- |
| [Embla Carousel](https://github.com/davidjerleke/embla-carousel) | MIT | 精确的触摸轮播和精选作品横向浏览 | 如果首页有一个精选系列轮播，可以使用；不要让整页变成多个轮播 |
| [Motion](https://github.com/motiondivision/motion) | MIT | React 区块进入、图片切换和轻量交互 | 可选；只用于 1–2 个关键动效，并支持 reduced motion |
| [react-photo-gallery](https://github.com/neptunian/react-photo-gallery) | MIT | 通用 justified gallery | 当前不需要，已有 CMS 编排和自定义画廊布局；只有在新增通用档案页时再评估 |
| [react-player](https://github.com/cookpete/react-player) | MIT | YouTube、Vimeo、Mux 和本地视频统一播放 | 只有在视频来源跨平台时使用；单一 MP4 优先使用原生 `<video>` |
| [Lenis](https://github.com/darkroomengineering/lenis) | MIT | 平滑滚动 | 第一版跳过，平滑滚动可能影响键盘、触摸和 reduced-motion 体验 |

组件原则：当前首页不需要为了“看起来像摄影网站”而增加依赖。最小方案是复用现有图片、Sanity、灯箱和页面模块，只在确实需要横向精选浏览或视频播放时引入组件。

## 三种首页方向

### 方案 A：编辑型入口（推荐）

首页是一个简短的“门厅”，作品档案是独立的“展厅”。

内容顺序：

1. 网站名、摄影观点、一张主视觉图。
2. `View Photography` 主按钮。
3. 2–3 个精选系列或当前项目。
4. 一条 Journal / Photo Story 预览。
5. 有合适素材时加入一条视频 teaser。
6. Balcony View、Journal、About 等入口。

优点：

- 解决 Home 和 Photography 的语义重复。
- 保留照片优先的气质，同时给文字、视频和个人信息留出位置。
- 与当前已有的 Sanity 受控 section 模型最匹配。
- 不需要一次性重做整个摄影画廊。

代价：首次访问照片需要多一次点击，因此首页必须在首屏保留一张有代表性的照片和清楚的作品入口。

### 方案 B：全屏沉浸式入口

首页打开就是全屏照片或无声视频，导航和一句短文叠在图像上，点击后进入 Photography。

优点：第一印象强，适合视觉品牌。

代价：信息密度低，SEO 和文字定位弱；移动端、慢网和视频加载更容易影响体验。它适合已经有成熟视觉品牌的摄影师，不适合作为当前第一版的信息架构。

### 方案 C：商业摄影落地页

首页先展示服务类别、客户、案例、报价或联系动作，再把个人档案放到 Work / Photography。

优点：适合以商业拍摄和获客为目标的网站。

代价：会改变 Queenstown.top 目前安静、档案化的气质，需要补充客户案例、服务文案和联系流程。当前没有足够内容支撑这个方向。

## 推荐决策

采用 **方案 A：编辑型入口**，并保持照片在首页首屏可见。

推荐的信息架构：

```text
/
├── 首页：定位、精选项目、故事/视频预览、入口导航
├── /photography：当前完整摄影画廊
├── /photobalcony：Balcony View 系列
├── /journal：照片故事和文字记录
└── /about：摄影师介绍、联系和社交链接
```

第一版首页不加入 globe、复杂 3D、自动播放声音、无限滚动或多个轮播。首页的职责是建立方向感并把访客送到合适的内容，而不是把所有模块都放在同一页。

## 建议的首页模块

### 1. Home Hero

- 站点名：Queenstown.top
- 一句可替换的摄影观点或介绍
- 一张主视觉照片
- 一个主按钮：`View Photography`
- 一个次级入口：`Read Journal` 或 `About`

主视觉图片需要保留宽高比、响应式 `srcset` 和尺寸预留，避免首页首屏发生布局跳动。

### 2. Featured Projects

2–3 张精选卡片，每张卡片包含：

- 项目标题
- 一句说明
- 一张代表照片
- 站内链接

候选内容可以是 Landscape、Harbor、Balcony View 或一个具体的旅行系列。卡片数量不超过 3 张，避免首页变成第二个画廊。

### 3. Story Teaser

从 Journal 或 Photo Stories 中选择一条内容，显示标题、短摘要和一张图，链接到完整故事。它能让首页拥有“最近发生了什么”的更新感，而不需要额外制作新闻模块。

### 4. Video Teaser（可选）

只有在视频本身有明确主题时加入，例如一次旅行、拍摄过程或一段地点记录。组件需要：

- poster 封面图
- 明确的播放按钮
- 默认静音
- 视频无法加载时仍显示封面和文字链接
- 提供字幕或文本说明
- 支持 `prefers-reduced-motion`

第一版建议只放一条视频，并放在精选项目或 Story 之后。

### 5. Explore / Footer Navigation

用简洁的入口链接收束页面：Photography、Balcony View、Journal、About。首页导航和页脚导航应保持同样的命名，不再用两个锚点表达 Home 与 Photography 的关系。

## CMS 方向

当前受控页面模型已经支持 hero、feature cards、gallery、banner、split 和 story teaser。首页可以先使用已有模块组合：

```text
pageContent-home
├── heroSection
├── featureCardsSection
├── storyTeaserSection
└── featureCardsSection / bannerSection（按内容需要）
```

视频需要新增一个受控的 `videoTeaserSection`，字段建议为：

- 标题和说明
- poster 图片
- 视频 URL 或媒体引用
- provider：`local`、`youtube`、`vimeo`、`mux`
- 是否显示字幕文本
- 站内或站外链接

Sanity 只负责内容和模块顺序，视频比例、播放器行为、加载策略和可访问性仍由 React 组件控制。

## 实施顺序

1. 新增首页路由和 Home 页面组件，不改动现有 GallerySections 的内部布局。
2. 将当前根路径的完整摄影内容迁移到 `/photography`，保留照片详情、灯箱和深链接行为。
3. 更新 Header、Footer、sitemap 和 SEO canonical，使 Home 与 Photography 成为两个真实页面。
4. 使用现有 Sanity `pageContent-home` 组合 Hero、精选项目和 Story teaser。
5. 在没有实际视频素材前，不实现视频模块；有素材后再增加 `videoTeaserSection`。
6. 通过桌面、375px 移动端、键盘操作、慢网图片加载和 reduced-motion 检查后再上线。

## 验收标准

- Home 和 Photography 在 URL、标题、导航状态和 SEO 上可以明确区分。
- 访客从首页首屏一次点击即可进入完整摄影档案。
- 首页不重复渲染整套长图库，也不出现多个相互竞争的主按钮。
- 主视觉和卡片图片声明尺寸或比例，非首屏资源延迟加载。
- 所有按钮和卡片链接可用键盘访问，焦点状态清楚，触控目标达到 44px 以上。
- 动效在 `prefers-reduced-motion: reduce` 下被削弱或关闭。
- 视频没有声音自动播放；加载失败时仍有可用的 poster 和文本入口。
- Sanity 请求失败时，首页和 Photography 都能回退到稳定静态内容。
- 移动端没有横向溢出，摄影档案仍可直接打开灯箱。

## 调研限制

个人摄影网站会持续更新，本文件记录的是 2026-11-03 的公开页面观察。GitHub 项目的 star 数、依赖版本和在线演示可能变化；真正复用代码前仍需再次确认许可证、依赖安全性、构建方式和图片资源版权。
