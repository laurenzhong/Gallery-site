# 当前网站内容与组件清单

更新时间：2026-10-31

本文档记录当前线上稳定版本的真实页面结构。它是新 Sanity schema 和 adapter 的输入，不代表当前页面已经由新模型驱动。

## 照片 AI 与地点扩展（实施基线）

新的照片导入流程使用 AI 处理照片，但不再要求导入者人工选择主体标签或时间 / 天气。一次多模态模型调用可以同时返回主体标签、时间 / 天气、标题、替代文本、图片说明和可选的第一人称手记。

照片地点分为两个层级：

- `place`：用于照片库筛选的宽泛地点，例如“麦理浩径”；
- `spot`：用于照片标题和手记的具体拍摄点，例如“破边洲”。

`category` 是旧版展示兼容字段。新增照片不应依赖它作为主体或地点筛选；在旧版页面迁移完成前保留现有数据和读取逻辑。

AI 任务必须在服务端执行。浏览器只创建照片文档、提交任务和读取进度，不接触模型密钥或 Sanity 写入 Token。任务要支持 queued、processing、approved、error 状态和幂等重试。

## 手记公开规则

手记可以直接作为普通 Sanity 文档创建，不要求隐藏。但前端查询必须同时检查：

1. 手记未隐藏；
2. 发布时间已到；
3. 封面照片未隐藏；
4. 封面照片被首页、影像阳台、站点设置或其他公开页面实际引用。

照片只存在于照片库而没有公开页面引用时，关联手记保留在 Sanity，但不出现在网站。

## 当前实现边界

- `/` 和 `/photos/*` 使用 `App` + `GallerySections`。
- `/photobalcony` 使用 `App` + `BalconyView`。
- `/journal`、`/about`、`/photostory` 继续使用现有内容组件，本阶段不改成自由编排页面。
- 页面 CSS 和模块顺序目前完全由 React 组件决定。
- Sanity 当前提供照片、Stories、Site Settings，以及旧的 `homepageLayout` / `photobalconyLayout` 数据。
- 新的 `pageLayout` 文档目前不被前端读取。

## 首页 `/`

首页的顺序是固定的，内容编辑应当修改每个位置的数据，而不是创建任意渲染器。

| 顺序 | 现有组件 | 视觉行为 | 目标可编辑内容 |
| --- | --- | --- | --- |
| 1 | feature cards | 三张横向卡片；第一张可链接到 `/photobalcony` | 每张卡片的标题、照片、站内链接 |
| 2 | `LandscapeSection` | 横向照片轮播和照片列表 | 标题、照片或分类来源、数量 |
| 3 | `GalleryRail` | 方形照片横向滚动 | 标题、照片或分类来源、数量 |
| 4 | `BannerImage` | 单张全宽横幅图片 | 图片、替代文本、链接（如需要） |
| 5 | `LandscapeSection` | 城市照片横向轮播和列表 | 标题、照片或分类来源、数量 |
| 6 | Harbor reference layout | Harbor 标题、主图、横向轮播、特色图、纵向堆叠、方格照片 | 每个照片槽位和标题文案 |

### 首页当前字段

当前 `HomepageLayout` 类型包含以下可配置槽位：

- `featureCards[]`
- `landscapePhotos[]`
- `quietPhotos[]`
- `bannerOnePhoto`
- `cityPhotos[]`
- `plantsHeroPhoto`
- `plantsCarouselPhotos[]`
- `plantsFeaturePhoto`
- `plantsStackPhotos[]`
- `plantsSquarePhotos[]`

当前 fallback 还会根据以下规则生成内容：

- `山野`、`日出日落`、`河流`、`海洋` 组成 Landscape 候选集
- `石塘度假区`、`建筑` 组成 City 候选集
- `harbor`、`Harbor`、`海洋`、`石塘度假区` 组成 Harbor 候选集
- `花朵`、`森林` 作为旧版 Harbor fallback
- 照片宽高比决定 landscape、portrait 和 square 集合
- 缺少明确主视觉时，优先使用 `siteSettings.heroPhoto`，再回退到 `DSC_0638.JPG`、`isHero` 或 `DSC_0257.JPG`

新 adapter 必须保留这些 fallback 的结果，不应在第一次接入时改变首页视觉。

## Photobalcony `/photobalcony`

Photobalcony 是固定的时间段页面，不应在 CMS 中开放任意 section 类型。编辑者应当修改每个时间段的标题和照片集合。

| 顺序 | 现有组件 | 视觉行为 | 目标可编辑内容 |
| --- | --- | --- | --- |
| 1 | balcony hero | 全宽主视觉 | 主视觉照片 |
| 2 | May / 2026 carousel | 单图轮播，支持箭头和触摸滑动 | 标题、照片集合 |
| 3 | Jul 2026 portraits | 竖幅照片行 | 标题、照片集合 |
| 4 | Jul 2026 wide carousel | 单图轮播，支持箭头和触摸滑动 | 照片集合 |
| 5 | May - Jun 2026 carousel | 单图轮播 | 标题、照片集合 |
| 6 | Apr 2026 grid | 方格照片 | 标题、照片集合 |
| 7 | Mar 2026 wide grid | 宽幅方格，第一张占满宽度 | 标题、照片集合 |
| 8 | Jan - Feb 2026 stack | 纵向堆叠，第一张使用大尺寸样式 | 标题、照片集合 |

### Photobalcony 当前字段

当前 `PhotobalconyLayout` 类型包含：

- `heroPhoto`
- `mayTitle`、`marchTitle`、`februaryTitle`、`januaryTitle`、`winterTitle`、`summerTitle`
- `mayPhotos[]`
- `marchPortraitPhotos[]`
- `marchWidePhotos[]`
- `februaryPhotos[]`
- `januaryPhotos[]`
- `winterPhotos[]`
- `summerPhotos[]`

当某个字段没有配置时，页面使用代码中的固定照片名单作为 fallback。新 adapter 必须保留“整组缺失时 fallback，组内已配置时使用配置”的行为，并防止空数组导致页面模块消失。

## 共享内容和交互

### Photo

页面组件依赖以下照片字段：

- `id`、`src`、`title`、`slug`
- `category`、`filename`
- `width`、`height`
- `isHero`

照片详情和 Stories 还使用日期、地点、相机、镜头、光圈、快门、ISO、焦段、替代文本、说明和署名等元数据。

### Lightbox 和路由

- 点击首页或 Photobalcony 的照片打开 `AdvancedPhotoLightbox`。
- 照片详情使用 `/photos/:slug`。
- 浏览器前进、后退和关闭灯箱必须保持当前页面路径。
- Photobalcony 的灯箱集合按当前时间段建立，不能错误地混入其他时间段。

### Site Settings 和 Stories

- `siteSettings.heroPhoto` 是首页主视觉的首要来源。
- Site Settings 还提供 About 页面资料、器材和联系方式。
- Stories 通过照片关联，显示在 Journal、Photo Story 和照片详情中。
- Sanity 请求失败时，About、Stories 和照片元数据都必须使用静态 fallback。

## 目标 Sanity 适配模型

新模型要表达“页面槽位”和“内容来源”，而不是直接表达 CSS。

建议的受控对象：

- `pageContent-home`
- `pageContent-photobalcony`
- `heroSlot`
- `featureCardsSlot`
- `gallerySlot`
- `bannerSlot`
- `balconyPeriodSlot`

每种对象只包含该组件真正需要的字段。Harbor 由一个 `bannerSlot`（标题和主图）以及独立的 `gallerySlot`（轮播、纵向堆叠、方格）组成；这些照片模块不再嵌套在 Harbor 对象中。`gallerySlot` 可以选择手动照片或分类来源，并填写数量和固定 presentation；不能填写任意主题、className 或布局参数。

## 接入前必须保留的行为

- Sanity 加载完成前不闪现错误的主视觉。
- Sanity 返回空数据时保留当前稳定页面。
- 缺失单张照片时不影响其他照片和模块。
- 旧缓存不会覆盖新的内容模型。
- 页面结构、CSS class、图片比例和断点保持当前版本不变。

## 验收基准

新 adapter 在 Preview 接入前，必须用当前静态数据生成与线上版本一致的页面。对比范围包括：

- 首页模块顺序和每个模块的照片数量
- Harbor 主图、轮播、纵向堆叠和方格四个独立模块
- Photobalcony 的 7 组内容和标题
- 移动端布局、触摸滑动和灯箱
- 首页主视觉初次加载和 Sanity 请求失败 fallback
