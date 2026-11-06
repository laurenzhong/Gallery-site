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

## 补充参考网站

以下站点在 2026-11-04 复核了公开页面，用来补足首页的个人定位、档案索引、图文叙事和视频入口研究。它们只作为视觉与信息架构参考，不直接复制页面代码或素材。

### [Alex Strohl Studio](https://www.alexstrohl.com)

适合参考个人摄影师如何把个人品牌、代表性项目和商业合作放在同一个入口中。首页的项目展示很直接，客户信息被放在较低层级，不会抢走作品的主导地位。

### [Josef Chladek](https://www.josefchladek.com)

适合参考极简档案和书籍索引。页面几乎不依赖装饰，依靠作品名称、列表层级和封面图建立浏览路径，可帮助我们控制首页文字量和视觉噪声。

### [Martin Parr](https://www.martinparr.com)

适合参考成熟摄影师的作品档案入口、导航和系列组织方式。它更偏“档案馆”而不是营销首页，可用于思考首页与完整作品档案之间的职责划分。

### [Ryan McGinley](https://www.ryanmcginley.com)

适合参考强图像、低文字的项目导向首页。它可以帮助评估 Queenstown.top 是否需要保留一条更沉浸式的视觉入口，但不建议直接照搬为当前首页的信息架构。

### [Little Brown Mushroom](https://littlebrownmushroom.com)

适合参考摄影项目、出版物和短文本如何组成编辑型叙事。它对首页的启发是：精选照片可以和项目背景、出版信息或 Journal teaser 形成连续的阅读节奏。

### [Magnum Photos](https://www.magnumphotos.com)

适合参考摄影师、项目、故事和专题档案之间的分类关系。它能帮助我们继续整理 Photography、Photo Stories 和 Journal 的入口命名，但当前首页不需要复制其大型机构网站的复杂导航。

### [IGNANT](https://www.ignant.com)

适合参考图片主导的编辑型首页：大图、短标题、不同内容类型混排，以及首页如何持续更新。可借鉴其卡片节奏，但 Queenstown.top 应保持更安静、更少栏目。

### [NOWNESS](https://www.nowness.com)

适合参考视频 teaser、封面图和编辑内容之间的关系。如果之后加入旅行或拍摄过程视频，可以借鉴它的封面与标题组织方式；不建议采用其高密度媒体首页。

### [National Geographic Photography](https://www.nationalgeographic.com/photography)

适合参考摄影专题、故事和图片报道的入口关系。它可以帮助我们判断 Story teaser 的信息量和标题写法，但首页视觉密度应明显低于媒体型网站。

## 四个重点站点的拆解结论

| 参考站 | 值得提取的模式 | 首页采用方式 | 当前应避免的部分 |
| --- | --- | --- | --- |
| [Alex Strohl Studio](https://www.alexstrohl.com) | 个人观点、项目入口、Photo / Motion / Writing 分层 | Hero 中放一句摄影观点，下面接 2–3 个精选项目 | 不把商业客户信息放在首屏主叙事中 |
| [Josef Chladek](https://www.josefchladek.com) | 极简档案、索引和可持续浏览 | 在 Photography 页面增加清晰的系列/档案索引 | 不在首页复制虚拟书架等高交互装置 |
| [Little Brown Mushroom](https://littlebrownmushroom.com) | 照片、项目背景、出版物和短文本的编辑节奏 | 增加一条 Story / Journal teaser，让首页不只有图片卡片 | 不让说明文字变成长篇介绍 |
| [NOWNESS](https://www.nowness.com) | 视频封面、标题和编辑内容的视觉入口 | 只放一个带 poster 的 Video teaser，点击后进入观看 | 不自动播放声音，也不把首页做成高密度媒体流 |

### 对 Queenstown.top 首页的直接决策

1. **Hero**：采用 Alex Strohl 的“个人观点 + 主视觉”方式。文案保持一句话，主按钮只保留 `View Photography`。
2. **精选项目**：采用 Photo / Motion / Writing 的分层思路，但压缩成 `Photography`、`Balcony View`、`Journal` 三个入口。
3. **故事入口**：采用 Little Brown Mushroom 的编辑型 teaser，显示一张图、标题和两行摘要即可。
4. **档案入口**：吸收 Josef Chladek 的索引思路，把完整照片浏览放在 `/photography`，首页只展示少量精选内容。
5. **视频入口**：采用 NOWNESS 的 poster + 标题形式；没有合适视频时隐藏整个模块，不使用占位视频。

这四个站点共同支持“编辑型入口”方案：首页负责建立方向感和内容选择，Photography 页面负责完整浏览，Journal 和 Video 负责补充时间性与叙事性。

## 个人摄影师网站参考（重新筛选）

考虑到首页方向需要更接近“摄影师自己的作品网站”，以下站点在 2026-11-04 复核了公开页面。它们比媒体、机构和开源模板更适合作为 Queenstown.top 的直接参照。

### [Nadav Kander](https://www.nadavkander.com)

导航将 `Studio Feed`、`Works in Series`、`Portraits`、`Film`、`Archive` 和 `Monographs` 分开，适合参考个人摄影师如何同时组织新作、系列、档案和出版物。Queenstown.top 可以借鉴“精选动态 + 完整档案”的双层入口。

### [Sally Mann](https://www.sallymann.com)

使用 `Selected Works`、`Books`、`Other Media`、`About` 等清楚的个人作品结构，文字克制但作者身份明确。适合参考首页如何让作品、书籍和个人介绍保持平衡。

### [Joel Sternfeld](https://www.joelsternfeld.net)

以 `Bodies of Work` 作为核心入口，再连接 Writings、Press 和 Contact。它适合参考系列优先、档案安静、导航层级清楚的个人摄影网站。

### [Daniel Kordan](https://www.danielkordan.com)

这是与 Queenstown.top 的自然风景方向最接近的一类个人摄影网站，首页直接进入 Gallery，并把 Prints 和 Workshops 放在次级层级。可参考“作品先行、商业信息后置”的顺序。

### [Joost Vandebrug](https://www.joostvandebrug.com)

以个人项目为单位组织 `Moment in Time`、`Not Yet The Image`、`Pillow Book`、Video Installations 和故事页面。适合参考摄影、视频和项目叙事如何共存于一个个人站点。

### [Andrew Zuckerman](https://www.andrewzuckerman.com)

按照 Creature、Bird、Flower、Ocean、Human 等主题建立清晰的视觉分类，并区分 Photography、Video、Books 和 Music。可参考图片分类和跨媒介入口，但当前首页应减少分类数量。

### [Erwin Olaf](https://www.erwinolaf.com)

将 artworks、exhibitions、channel、commissioned 和 project 分层，适合参考摄影师同时拥有艺术项目、委托项目和影像内容时的导航设计。

### [Joe Pugliese](https://www.joepug.com)

页面更接近简洁的个人作品集，图片承担主要表达，导航和联系信息保持轻量。适合参考 Queenstown.top 想进一步降低文字密度时的首页比例。

### [Stephen Wilkes](https://www.stephenwilkes.com)

以摄影项目和系列图像作为主要入口，适合观察商业摄影师如何让首页保持作品主导，同时把摄影项目作为可持续更新的内容单元。

## 全球个人摄影师参考

为扩大视觉样本，以下站点来自不同国家和地区，仍然只选择摄影师个人拥有或主导的作品网站。

| 摄影师 | 地区 | 可参考方向 |
| --- | --- | --- |
| [Hiroshi Sugimoto](https://www.sugimotohiroshi.com) | 日本 | artworks、site-specific arts、video、Biography 的跨媒介导航 |
| [Rinko Kawauchi](https://rinkokawauchi.com) | 日本 | Works、Publications、Articles 的安静作品档案 |
| [Wolfgang Tillmans](https://www.tillmans.co.uk) | 英国 / 德国 | 作品、展览、出版物、文字和日历的长期档案 |
| [Andreas Gursky](https://www.andreasgursky.com) | 德国 | Selected Works、Exhibitions、Publications 的清晰层级 |
| [Nick Brandt](https://nickbrandt.com) | 英国 / 东非 | 按项目章节、影像、文章和长期主题组织内容 |
| [Tim Walker](https://www.timwalkerphotography.com) | 英国 | Selected Work、Stories、Moving Image、Books 的个人品牌结构 |
| [Graciela Iturbide](https://www.gracielaiturbide.org) | 墨西哥 | 旅行笔记、系列作品和多语言入口 |
| [Edward Burtynsky](https://www.edwardburtynsky.com) | 加拿大 | Projects、About、Shop 的作品与出版物结构 |
| [Ragnar Axelsson](https://rax.is) | 冰岛 | Books、Prints、Bio 和新闻订阅的摄影师档案模型 |
| [Pieter Hugo](https://pieterhugo.com) | 南非 | 作品系列和个人艺术家身份的强视觉入口 |
| [Alec Soth](https://alecsoth.com) | 美国 | 个人作品、出版项目、写作和外部项目的轻量连接 |

其中更适合 Queenstown.top 进一步研究的是 **Rinko Kawauchi、Nick Brandt、Tim Walker、Graciela Iturbide、Ragnar Axelsson**：它们都能提供“个人作者 + 摄影系列 + 地域或旅行感”的参考，而不会把首页带向机构型媒体网站。

## 地图与照片互动参考

以下站点专门用于补充地图、照片位置和地点叙事方向。它们与 Agarun Photos、Look But No Stopping 的关系更直接，重点是观察“地图如何成为照片浏览入口”。

### 最接近个人旅行照片网站

- [Shoot Planet — My Global Travel Map](https://shootplanet.com/my-travel-map/)：专业旅行摄影师把全球地点、照片画廊和旅行范围放在一张地图上，适合参考个人网站的地图入口。
- [SunnyShot](https://www.sunnyshot.com/)：个人旅行照片首页、相册和交互地图结合，适合参考“首页先讲旅程，再进入相册”的结构。
- [Way Out Photography — Interactive Map](https://wayoutphotography.com/interactive-map/)：以摄影地图作为独立入口，适合观察地图与照片预览的并置方式。
- [The Photos — Photo Map](https://www.thephotos.co/map)：地图点位可以预览照片，并继续查看地点和拍摄信息，适合参考 pin、预览卡片和详情页的关系。

### 地图优先的照片浏览

- [loc.alize.us](https://loc.alize.us/)：把大量照片铺在全球地图上，适合研究缩放、聚合点位和地图作为主导航的体验。
- [Flickr Map](https://www.flickr.com/map)：成熟的地图照片档案，适合参考地图筛选、地点浏览和照片集合之间的关系。
- [Mapillary](https://www.mapillary.com/)：街景照片和地图结合，适合研究连续地点浏览、方向感和街道级照片序列。
- [Atlas Photo](https://atlasphoto.app/)：以摄影地点和拍摄建议为核心，适合参考地点卡片、地图筛选和旅行规划信息。

### 适合研究数据和内容模型

- [maps.photography](https://maps.photography/)：由摄影师提供真实拍摄地点和精确坐标，适合参考照片、地点、坐标和权限字段如何组织。
- [PhotoHound](https://www.photohound.co/)：摄影地点数据库和社区照片结合，适合研究地点标签、照片样例和地图详情面板。
- [Interactive Photo Maps](https://interactivephotomaps.com/)：把旅行照片转换成地图故事，适合参考路线、照片序列和地点说明的组合方式。

### 对 Queenstown.top 的地图方向建议

最值得优先体验的是 **Shoot Planet、SunnyShot、The Photos、loc.alize.us**。它们分别覆盖个人旅行地图、首页与地图结合、点位预览和全球地图探索四种模式。

当前项目可以先做一个轻量的 `/map` 页面：地图显示照片点位，点击点位打开照片预览，再进入现有灯箱或 `/photography` 的对应系列。地图应作为第二种浏览方式，不取代首页的个人介绍和摄影系列入口。

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

## 地图照片标注调研与独立实验

更新时间：2026-11-04
状态：已完成开源工具调研，已加入独立实验页 `/experiments/photo-map`

### 需求定义

地图功能的目标是把照片位置作为摄影档案的第二种索引。访客可以从地图上的照片缩略图开始浏览，按地点筛选，再进入现有照片灯箱；它不替代首页 Hero，也不替代 `/photography` 的完整画廊。

### 开源工具结论

| 工具 | 许可证 | 适用范围 | 当前判断 |
| --- | --- | --- | --- |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | BSD-3-Clause | 矢量地图、地图样式、较多点位 | 未来正式地图页的首选 |
| [Leaflet](https://github.com/Leaflet/Leaflet) | BSD-2-Clause | 二维地图、Marker、Popup | 独立原型和快速落地的首选 |
| [OpenLayers](https://github.com/openlayers/openlayers) | BSD-2-Clause | GeoJSON、坐标编辑、GIS 操作 | 只有后台编辑需求变复杂时再采用 |
| [Supercluster](https://github.com/mapbox/supercluster) | ISC | 大量照片点聚合 | 与 MapLibre 或 Leaflet 配合 |
| [Leaflet-Geoman](https://github.com/geoman-io/leaflet-geoman) | MIT | 拖拽和修正地图点位 | 适合后续 Sanity 编辑器 |
| [exifr](https://github.com/MikeKovarik/exifr) | MIT | 从图片 EXIF 读取 GPS | 当前项目已经安装并在导入页使用 |
| [PMTiles](https://github.com/protomaps/PMTiles) | BSD-3-Clause | 自托管地图切片 | 生产环境需要避免依赖公共瓦片服务器时采用 |
| [Leaflet.GeotagPhoto](https://github.com/nypl-spacetime/Leaflet.GeotagPhoto) | MIT | 相机位置、目标点和视野角度 | 功能贴近摄影，但最后发布较早，只作参考 |
| [PhotoPrism](https://github.com/photoprism/photoprism) / [Immich](https://github.com/immich-app/immich) | AGPL-3.0 | 完整自托管照片库和地图 | 用于参考内容模型，不直接嵌入首页 |

截至本次调研，MapLibre GL JS、OpenLayers、Leaflet、Supercluster、Leaflet-Geoman 和 exifr 的 npm 版本与许可证已经核对。地图底图和瓦片服务需要单独处理：OpenStreetMap 数据采用 ODbL，公共瓦片服务器只适合轻量开发验证，生产流量应使用合规服务或自托管 PMTiles。

### 当前项目的接入判断

当前项目已经在 [package.json](../package.json) 中使用 `exifr`。导入逻辑在 [PhotoImportDashboard.tsx](../sanity/components/PhotoImportDashboard.tsx) 读取 GPS，但目前将经纬度折叠为 `location` 文本；照片 schema 在 [photo.ts](../sanity/schemaTypes/photo.ts) 中也只有字符串地点字段。正式接入地图前，建议增加独立坐标对象：

```ts
geo?: {
  lat: number;
  lng: number;
  source: "exif" | "manual" | "estimated";
  accuracyM?: number;
  isPublic?: boolean;
}
```

这样可以区分 EXIF 自动位置和人工修正，并能对私人照片只公开模糊位置或区域中心。前端应把有 `geo` 的照片转换成 GeoJSON FeatureCollection，地图负责点位、聚合和筛选，现有 Lightbox 负责查看大图。

### 独立实验页

已新增 `/experiments/photo-map`，使用 Leaflet 和 OpenStreetMap 瓦片完成一版可交互原型：

- 每个地图 Marker 使用照片缩略图，而不是通用图钉；
- 点击 Marker 或右侧地点列表会同步地图焦点；
- 右侧面板支持地点筛选，并可直接打开现有照片灯箱；
- 桌面端为地图 + 索引面板，移动端改为上下堆叠；
- 提供缩放、回到全域和键盘可操作的列表入口；
- 原型使用香港的演示坐标，页面明确标注需要替换为 EXIF / Sanity 坐标字段；
- 实验入口已加入 `/experiments` 索引，但没有修改正式首页或现有 Journey Map。

地图的可拖拽范围不应永久写死为香港。Photo Map 现在通过 `getPhotoMapBounds(stops)` 根据所有照片坐标计算最小包围盒，并按经纬度跨度增加边距，再通过 `map.setMaxBounds()` 更新 Leaflet 的可拖拽范围。照片集中在一个城市时，地图范围会较小；照片覆盖多个省份时，范围会自动扩大。`minZoom` 需要允许降到 3，才能容纳跨省照片；当没有有效坐标时再回退到香港 Demo 范围。筛选地点只改变 Marker 和列表，不应缩小全局地图边界，除非产品明确需要“筛选后聚焦”。

另新增 `/experiments/photo-map-maplibre` 作为同数据对比页。它使用 MapLibre GL JS，保留相同的照片点位、筛选、地图焦点和灯箱联动，但加入了 MapLibre 的地图样式、倾斜和旋转参数。当前为了无 API Key 先使用 OSM raster source；如果正式采用 MapLibre，下一步应替换为矢量瓦片或 PMTiles，才能充分发挥它的样式和大量点位性能优势。

### 当前决策

对比 Leaflet 和 MapLibre 实验页后，当前正式方向优先采用 Leaflet。两版使用同一套 OSM raster 底图和同样的图片 Marker，因此 MapLibre 在当前数据量下没有带来可感知的功能收益；Leaflet 版的底图色彩、照片图钉和整体画廊气质更符合当前首页改造方向。MapLibre 保留为后续大量点位、矢量瓦片或地图样式系统需求出现时的备选技术。

地图应优先成为独立 `/map` 或 `/experiments/photo-map` 入口，暂不直接放进 Home 首屏。

## 徒步 / 登山路线叙事 Demo

更新时间：2026-11-04
状态：已完成 Leaflet 独立实验页 `/experiments/trail-route`，当前示例为麦理浩径第二段

照片地图适合做长期档案索引，但一次徒步或登山旅行需要另一种节奏：路线是主线，照片、时间、海拔和沿途文字随着路线推进逐步出现。当前 Demo 以麦理浩径第二段（浪茄湾—西湾—咸田湾—大浪村—赤径—北潭凹）为主题，路线几何来自公开 GPX 轨迹，而不是手工连接地标坐标。

### 交互模型

- 左侧按时间顺序展示 6 个路线章节，滚动时以视口焦点位置主动计算当前站点；
- 右侧 Leaflet 地图固定显示路线、编号标记和当前已走的红色路线；
- 红色路线不是按章节瞬间跳接，而是把每个章节内的滚动进度映射到路线几何，沿轨迹逐点增长；
- 当前点在章节内移动时，地图中心和缩放也同步插值，已走点、当前点和未到点使用不同状态；
- 点击地图标记或右侧站点列表，会滚动到对应章节并更新地图焦点；
- 当前站点同时显示时间、距离、海拔和照片入口；
- 海拔曲线用轻量 SVG 表达路线起伏，不引入额外图表依赖；
- 照片继续复用现有 Lightbox，移动端改为地图在上、章节在下；
- 支持 `prefers-reduced-motion`，地图动画和章节过渡会被削弱。

### 与 `look-but-no-stopping` 的区别

`look-but-no-stopping` 更接近连续滚动的地点浏览；路线 Demo 把一次旅行明确切成“出发、上升、山脊、下降、抵达”几个段落，让地图承担方向和进度，照片承担每一站的记忆。它更适合发布一条完整的徒步记录，也比把大量照片同时铺在地图上更容易控制叙事节奏。

### 实现和数据备注

- 使用 Leaflet + OpenStreetMap raster 底图，保持与当前照片地图实验一致；
- 路线数据来自 [Hong-Kong-Trails-GPX-KML](https://github.com/nicholas-fong/Hong-Kong-Trails-GPX-KML) 的 [MacLehose Trail GPX track](https://raw.githubusercontent.com/nicholas-fong/Hong-Kong-Trails-GPX-KML/main/MacLehose-Trail/GPX-Track/MacLehose-Trail-track.gpx)。该仓库声明为 CC0；Demo 将完整轨迹中 Section 2 与 Section 3 航点之间的 741 个轨迹点切出，保存为 `public/routes/maclehose-trail-section-2.geojson`，并将章节标记吸附到轨迹点上；使用时仍保留仓库链接和 CC0 说明；
- 另一个可交叉核对的开源来源是 [OpenStreetMap](https://www.openstreetmap.org/) 中标记为 `MacLehose Trail Section 2` 的 footway 数据，许可证为 ODbL 1.0；它适合后续做路线更新和地图数据校验；
- 动画模型参考 [jpvalery/newfoundland](https://github.com/jpvalery/newfoundland)、[Animated Map Path for Interactive Storytelling](https://tympanus.net/codrops/2015/12/16/animated-map-path-for-interactive-storytelling/) 和 [Gatsby-Firewatch-Parallax](https://github.com/iammatthias-archive/Gatsby-Firewatch-Parallax)：滚动进度驱动路径长度、镜头位置和站点状态；
- 路线点可以继续扩展为 Sanity 中的 `route`、`stops` 和 `track` 字段，照片通过引用关系绑定到站点；
- 当前页面保持独立实验，不改变 `/experiments/look-but-no-stopping`，也不把地图放入首页首屏；
- 如果未来需要大量照片点位、矢量样式或离线地图，再评估 MapLibre GL JS + PMTiles；当前路线叙事的点位数量和视觉方向更适合 Leaflet。

### 可复用实现方案

这类页面应被当作“滚动叙事引擎 + 路线配置”来实现。地图、进度计算和动画只实现一次；每条徒步路线、旅行记录或城市漫游只提供自己的轨迹文件、章节和照片绑定。这样可以复用交互节奏，同时避免把麦理浩径的地标、文案和坐标写死在组件中。

#### 1. 统一数据模型

路线数据建议拆成三个层次：原始文件、归一化轨迹和叙事站点。

```ts
type RouteCoordinate = [lat: number, lng: number];

type RouteStop = {
  id: string;
  title: string;
  localTitle?: string;
  coordinate: RouteCoordinate; // 必须吸附到 track 上或经过人工校验
  trackIndex: number;          // 在 track 中的最近点索引
  distanceKm?: number;
  time?: string;
  elevationM?: number;
  note?: string;
  photoIds?: string[];
};

type StoryRoute = {
  id: string;
  title: string;
  subtitle?: string;
  track: RouteCoordinate[];
  stops: RouteStop[];
  bounds?: [[number, number], [number, number]];
  source?: {
    url: string;
    license: string;
    retrievedAt: string;
  };
};
```

`trackIndex` 是关键字段。它把“第几个章节”与“轨迹上的第几个点”分开，路线可以有数百或数千个 GPS 点，而页面只展示 5—10 个叙事站点。原始 GPX、KML 或 OSM 数据应先转换为 GeoJSON，再生成轻量的 TypeScript 数据模块；页面运行时不需要解析 GPX XML。

当前麦理浩径数据对应：

- 原始文件：[MacLehose-Trail-track.gpx](https://raw.githubusercontent.com/nicholas-fong/Hong-Kong-Trails-GPX-KML/main/MacLehose-Trail/GPX-Track/MacLehose-Trail-track.gpx)；
- 页面使用的切片：[maclehose-trail-section-2.geojson](../public/routes/maclehose-trail-section-2.geojson)；
- 前端归一化数据：[maclehoseTrailSection2.ts](../src/data/maclehoseTrailSection2.ts)。

#### 2. 把滚动转换为连续路线进度

每个章节对应一个进度区间。视口焦点落在第 `i` 个章节时，进度由整数段号和章节内的小数部分组成：

```ts
routeProgress = chapterIndex + chapterLocalProgress;
// 例如 1.35 表示从第 2 个站点向第 3 个站点走了 35%
```

实现时不要使用章节之间的瞬间切换，也不要直接把所有站点坐标连成一条简化线。应当按站点设置轨迹断点：

```ts
const breakpoints = stops.map((stop) => stop.trackIndex);
```

`getVisitedTrack(progress)` 在两个断点之间做线性插值：先取出已经经过的完整 GPS 点，再把当前段的最后一个点插入插值坐标，最后通过 `Polyline.setLatLngs()` 更新红色已走线。未来路线可以不绘制，或只用极低透明度显示；当前页面选择不绘制完整未来线，避免用户误以为已经走完全部路线。

#### 3. Leaflet 图层职责

地图实例只初始化一次，图层按职责拆开：

1. `tileLayer`：底图和 OSM attribution；
2. `visitedLine`：唯一由滚动进度更新的红色路线；
3. `markerLayer`：站点 Marker，依据 `activeIndex` 切换 `is-active`、`is-past` 和未到达状态；
4. 相机：根据当前站点和下一站点做中心点、缩放级别插值。

滚动时只更新 `visitedLine`、Marker HTML 和 `map.setView()`，不要销毁并重新创建 Leaflet 地图。章节数据更新后要重新获取最新 DOM 节点，不能只依赖 `stops.length`；照片或 CMS 数据异步替换时，旧章节引用可能已经脱离文档，导致进度跳到最后一个站点。

#### 4. 推荐的组件边界

当前 [TrailRouteExperiment.tsx](../src/components/TrailRouteExperiment.tsx) 已验证交互，但仍把路线配置、照片选择和地图逻辑放在一个文件中。后续复用时建议拆成：

- `StoryRoutePage`：页面骨架、Hero、章节列表和照片 Lightbox；
- `StoryRouteMap`：Leaflet 初始化、轨迹绘制、Marker 和相机；
- `useStoryRouteProgress`：章节测量、滚动监听、`routeProgress` 计算；
- `routeGeometry.ts`：`getVisitedTrack()`、断点插值和轨迹校验；
- `routes/*.ts`：每条路线的 `StoryRoute` 配置；
- `routeSources/*.geojson`：经过许可确认的原始或归一化路线文件。

页面只需要传入配置：

```tsx
<StoryRoutePage
  route={maclehoseSection2}
  photos={photos}
  onOpenPhoto={openLightbox}
  mapTheme="leaflet-paper"
/>
```

#### 5. 新路线接入流程

1. 找到 GPX、GeoJSON 或 OSM 路线来源，记录原始 URL、许可证和抓取日期；
2. 统一坐标顺序为 `[lat, lng]`，删除明显异常点，检查轨迹是否穿过海面或道路之外；
3. 计算每个叙事站点在轨迹上的最近点，保存 `trackIndex`，不要直接凭地图视觉输入坐标；
4. 生成路线 GeoJSON 和前端轻量数据模块；
5. 为每个站点绑定照片、时间、距离、海拔和文案；
6. 设置 `bounds`，在桌面和移动端分别检查地图是否能完整看到当前段；
7. 检查从第 1 站滚动到第 2 站时只出现第 1—2 站之间的线，再检查最后一站和返回顶部；
8. 在 `prefers-reduced-motion` 下关闭平滑相机和章节动画，但保留路线状态更新。

#### 6. 数据与交互验收标准

- 每个站点 Marker 位于路线轨迹附近，误差超过 50 米时必须人工复核；
- 路线进度只能单调跟随滚动，不得在章节更新或图片加载后跳到最后；
- 当前章节显示的已走线只覆盖当前进度，未来站点不能出现红色连接线；
- 点击 Marker 或列表项后，章节和地图状态在滚动结束后保持一致；
- 路线文件的许可证和来源在数据文件与调研文档中都可追溯；
- 地图底图 attribution 始终显示，生产环境不直接依赖公共 OSM 瓦片服务；
- 键盘用户可以通过站点列表操作，图片入口和 Marker 都有可读名称。

#### 7. 适合复用的场景

同一引擎可以用于：一条徒步路线的照片记录、城市建筑步行路线、旅行中的多日路线、摄影师的取景路线，以及首页中一段有限长度的“从地点 A 到地点 B”叙事。变化只应体现在 `track`、`stops`、照片绑定和视觉主题；滚动进度、路径插值、地图生命周期和无障碍行为保持共用。
