# 首页改造任务切片与本地验收方案

更新时间：2026-11-03  
状态：已确认方向，准备进入实现

## 已确认的产品方向

首页采用“编辑型入口”结构：

- 首页使用根路径 `/`，承担网站定位、主视觉和精选入口。
- 完整摄影档案放到 `/photography`，不再让首页承载全部照片。
- 首页只放少量精选相册入口，不把所有分类长页面复制到首页。
- 地图暂缓，等照片的地点元数据覆盖更完整后再做地点探索。
- `/photography` 保留当前已经验证过的 Hero、GallerySections、灯箱和 CMS 编排；完整档案和筛选另行调研，不在本次首页改造中强行替换。
- 首页所有图片入口都可以进入相册或完整档案，图片悬停效果服务于“可点击”提示，不作为唯一交互方式。

## 页面职责

```text
/
├── Hero：摄影定位、主视觉、View Photography
├── Selected projects：2–3 个精选相册入口
├── Journal teaser：一条照片故事或创作手记
└── Explore：Photography、Balcony View、Journal、About

/photography
├── 当前 GallerySections 编排
├── CMS 可控的精选和分类模块
└── 点击照片打开现有灯箱
```

首页不加入 3D globe、无限滚动、自动播放有声视频和多个相互竞争的轮播。第一版动效只用于图片悬停、区块进入和轻量的页面状态变化。

## 组件来源与使用边界

Motion、React Bits、Univers、Anime.js、Aceternity UI 可以作为视觉和交互参考，但不默认把它们全部加入项目。当前项目是 React + Vite + 自定义 CSS + Sanity，不是 Tailwind/Next.js 项目，因此每个外部组件都要先通过以下检查：

1. 确认仓库或 npm 包的当前许可证和依赖要求。
2. 确认组件可以脱离原站的 Tailwind、Next.js、Framer Motion 或构建配置运行。
3. 确认组件不会替换现有灯箱、导航和图片加载策略。
4. 确认组件在键盘、触摸和 `prefers-reduced-motion` 下仍然可用。
5. 只有确实减少实现成本时才添加依赖；单一 hover 或淡入效果优先用现有 CSS。

候选使用方式：

| 来源 | 可能用途 | 当前决策 |
| --- | --- | --- |
| Motion | 精选卡片或区块的进入/退出过渡 | 先用 CSS 验证，出现连续状态动画需求时再评估 |
| React Bits | 图片卡片、光标和展示组件的视觉参考 | 只借鉴交互形态，逐个确认代码许可证后再考虑复用 |
| Univers | 首页构图、作品集叙事和排版参考 | 用作视觉参考，不直接复制页面结构 |
| Anime.js | 少量时间轴或标题拆分效果 | 第一版不需要；避免为了标题动画增加运行时 |
| Aceternity UI | 视差、背景和卡片效果参考 | 当前 CSS 已能覆盖的效果不引入 |

## 实施切片

### Slice 0：路由与内容契约

目标：先让 Home 与 Photography 有明确职责，不改变现有相册和灯箱行为。

工作内容：

- 根路径 `/` 渲染新的 Home 组件。
- `/photography` 渲染现有完整摄影内容。
- Header、Footer、sitemap 和页面标题区分 Home 与 Photography。
- 从照片灯箱返回时保留当前所在页面，不强制回到根路径。
- 保留 `/photos/:slug` 和 `/stories/:slug` 深链接。

验收：直接打开 `/`、`/photography`、`/photos/...` 和 `/stories/...`，页面职责和返回行为都正确。

### Slice 1：首页 Hero

目标：让第一次访问的人在首屏理解网站是什么，并能一次点击进入完整档案。

工作内容：

- 站点名、短摄影定位、代表性 Hero 图片。
- 唯一主按钮：`View Photography`。
- 次级入口：`Read Journal` 或 `About`。
- Hero 图片使用现有图片 URL 封装、`srcSet`、`sizes` 和尺寸预留。
- 主视觉失败时保留文字和入口，不阻塞页面使用。

验收：首屏只有一个主行动；主视觉可读；移动端不裁切主要主体；键盘可以到达两个入口。

### Slice 2：精选相册入口

目标：把“鼠标放在图片上可以打开相册”的体验转化为明确的站内入口。

工作内容：

- 展示 2–3 个精选项目，例如 Landscape、Harbor、Balcony View。
- 每张卡片包含代表照片、标题、简短说明和进入目标。
- 整张卡片是链接，悬停时显示轻量的 `Open series` 提示和图片状态变化。
- 不依赖 hover 才能理解可点击，触摸设备直接显示标题和入口。
- 卡片图片默认懒加载并声明宽高。

验收：桌面悬停有反馈；移动端没有隐藏文字；点击卡片能进入对应相册或摄影档案筛选视图；焦点状态清楚。

### Slice 3：Story teaser 与 Explore 收束

目标：让首页有持续更新感，同时把 Journal、About 等内容放到合适的位置。

工作内容：

- 从现有 `photoStories` 选择一条故事展示封面、标题和摘要。
- 链接到现有 `/stories/:slug` 或 `/journal`。
- 页面末尾提供 Photography、Balcony View、Journal、About 四个入口。
- 不加入客户 Logo、服务报价或联系表单等商业摄影模块。

验收：Sanity 故事为空时首页仍能显示 Hero 和精选入口；所有入口可用；没有重复的主按钮。

### Slice 4：Photography 页面保持稳定

目标：让首页改造不破坏现有摄影档案的视觉结构和编辑能力。

工作内容：

- `/photography` 使用原来的 Hero、`GallerySections` 和 Sanity `homepageLayout`。
- 保留现有横向轮播、Banner、堆叠图片和灯箱行为。
- 不在首页切片中强行加入新的 Masonry 或统一档案网格。
- 另开设计任务，重新调研“全部照片、地点地图、分类筛选”的视觉组织方式。

验收：打开 `/photography` 后仍能看到原有 Hero 和分类编排；灯箱深链接可用；移动端现有布局不回归。

### Slice 5：动效、可访问性与性能

目标：让视觉效果保持克制，并且不牺牲操作和加载体验。

工作内容：

- 第一版优先使用 CSS transform/opacity，不为简单淡入引入动画库。
- 所有动效在 `prefers-reduced-motion: reduce` 下关闭或降级。
- 交互目标至少 44px，按钮和卡片有可见焦点环。
- Hero 首图高优先级，其余图片懒加载；使用 `srcSet` 和尺寸预留。
- 不让悬停效果改变布局尺寸，不产生横向滚动。

验收：键盘操作完整；移动端点击反馈明确；慢网下文字和入口先可用；reduced-motion 下页面仍然清楚。

### Slice 6：本地构建与视觉检查

目标：在推送前确认页面可以构建、运行并适配主要视口。

本地命令：

```bash
npm run build
npm run dev -- --host 127.0.0.1
```

当前环境执行 `npm run build` 时会先打包 Sanity Studio；如果 Studio 构建因本机内存不足失败，可以先用下面两条命令验证前端改动：

```bash
npx tsc -b
npx vite build
```

完整 `npm run build` 仍需要在可完成 Studio 打包的环境中复核。

本地检查顺序：

1. 桌面端检查 `/`、`/photography`、`/journal`、`/about` 和照片详情。
2. 375px 移动端检查首页 Hero、精选卡片、Photography 原有布局、灯箱和 Footer。
3. 使用键盘完成导航、打开卡片、关闭灯箱和返回。
4. 开启 `prefers-reduced-motion`，确认没有不必要的移动效果。
5. 关闭或延迟图片请求，确认文字入口和布局仍然可用。
6. 检查浏览器控制台没有路由、资源或 React 错误。

## 推送门槛

本地构建和本地服务检查通过后，再整理变更并推送。推送前需要确认：

- 只包含首页、Photography 路由及其必要的导航、SEO 和文档变更。
- 未经确认的组件库代码和不必要的依赖没有进入提交。
- 首页主视觉、精选卡片和完整档案均有可回退内容。
- 需要外部组件时，提交中同时记录来源、版本和许可证。

如果本地预览需要调整布局，先在本地迭代，等视觉和交互确认后再创建最终提交。
