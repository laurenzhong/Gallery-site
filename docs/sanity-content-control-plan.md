# Sanity 内容控制方案（受控组件编排版）

更新时间：2026-10-31

## 目标

让日常内容维护尽可能不需要修改 React 代码，同时保证网站的视觉、交互、响应式和性能由代码稳定控制。

内容编辑者可以在 Sanity 中完成以下工作：

- 修改页面标题、副标题、说明和按钮文字
- 更换主视觉、卡片和画廊照片
- 隐藏、显示和重新排序页面模块
- 调整模块使用的照片、分类来源和数量
- 编辑导航、页脚、照片信息和 Stories
- 在已有模块类型允许的范围内组合页面

新增一种视觉模块、改变设计系统或改变交互行为仍然需要代码变更。完成一次组件开发后，该组件可以长期由 Sanity 编辑和复用。

## 核心原则

Sanity 是内容源和页面编排工具，React 是受控的页面渲染器。

React 负责：

- 页面结构和路由
- 受控的组件类型和组件变体
- CSS、字体、颜色、间距和响应式断点
- 图片加载、灯箱、无障碍和交互行为
- 数据异常时的静态回退和错误状态

Sanity 负责：

- 文案、图片、分类、Stories 和元数据
- 页面模块的顺序和显示状态
- 模块引用哪些照片或分类
- 受控字段中的链接、数量和标题

Sanity 不允许直接写 HTML、CSS、脚本、任意 className 或任意样式值。

## 旧方案的处理

上一版方案把 `sections[]`、`style`、`theme`、`columns` 等页面表现字段直接交给 Sanity，并让前端根据这些字段选择渲染器。这样会让 CMS 文档成为页面渲染 API，内容数据一旦变化就可能改变整页的视觉结构。

上一版 `pageLayout` 模型作为过渡数据保留，但不作为当前生产前端的数据源。现有的 `pageLayout-home` 和 `pageLayout-photobalcony` 不删除，也不使用 `--replace` 重新覆盖。待新模型和适配层完成后，再决定迁移或废弃这些文档。

当前线上版本保持稳定的旧版页面渲染器。本文档描述的是下一阶段的实现目标，不代表功能已经在生产启用。

## 内容控制边界

| 内容 | Sanity 可编辑 | 代码控制 |
| --- | --- | --- |
| 页面标题、副标题、说明 | 是 | 默认回退值 |
| 主视觉和照片 | 是 | 图片比例和加载策略 |
| 模块顺序和显示状态 | 是 | 可用模块类型 |
| 卡片、画廊和 Stories 内容 | 是 | 组件结构和交互 |
| 分类来源和显示数量 | 是 | 最大数量和查询规则 |
| 导航、页脚和操作文字 | 是 | 路由和安全链接规则 |
| 模块的视觉变体 | 只能选择固定枚举 | 变体实现和设计令牌 |
| CSS、字体、间距、断点 | 否 | 是 |
| 任意 HTML、脚本和 className | 否 | 是 |
| 新页面类型或新交互 | 否 | 是 |

## 受控页面模型

新模型暂定使用 `pageContent` 文档。它描述页面内容，不描述 CSS。

```text
pageContent
├── pageKey: home | photobalcony
├── title
├── subtitle
├── hero
└── sections[]
    ├── heroSection
    ├── featureCardsSection
    ├── gallerySection
    ├── bannerSection
    ├── splitSection
    └── storyTeaserSection
```

每一种 section 都是一个有明确字段的 Sanity object，而不是一个包含大量可选字段的通用 object。

### 允许的 section 类型

- `heroSection`：主视觉图片、标题、说明和安全链接
- `featureCardsSection`：两到三张卡片，每张卡片包含图片、标题、说明和站内链接
- `gallerySection`：手动照片或分类来源、数量、标题和固定的 `carousel`、`grid` 或 `stack` 变体
- `bannerSection`：标题、说明和一张横幅图片
- `splitSection`：固定的图文并排结构
- `storyTeaserSection`：从已发布 Stories 中选择或按规则读取

变体是受控枚举，只能选择代码已经实现的值。例如 `gallerySection.presentation` 可以是 `carousel`、`grid` 或 `stack`，但不能填写任意 CSS 值。

## 适配层

前端不直接把 Sanity 响应传给组件，而是经过以下链路：

```text
Sanity query
  -> schema/query validation
  -> CMS adapter
  -> normalized PageModel
  -> existing React components
```

适配层负责：

- 将照片引用转换为现有 `Photo` 类型
- 将分类来源转换为受控的照片列表
- 丢弃缺少必要图片或引用失效的模块
- 校验模块类型、变体、数量和链接
- 为缺失字段补充安全默认值
- 在数据不完整时保留稳定的静态模块回退

组件只接收经过校验的 `PageModel`，不读取 Sanity 原始字段，也不根据未知字段动态改变页面结构。

## 编辑和发布流程

1. 编辑者在 Studio 修改草稿内容。
2. Studio 的校验提示缺图、缺标题、无效引用和不允许的链接。
3. Presentation Preview 在预览环境显示草稿结果。
4. 发布前运行内容契约检查和页面视觉检查。
5. 发布 Sanity 文档。
6. 浏览器读取已发布内容；需要更新 sitemap 或静态回退时，再由 webhook 触发 Vercel 构建。

普通内容修改不需要 GitHub push。新组件、新视觉变体和新路由仍然需要代码发布。

## 安全回退和缓存

- 当前稳定页面继续作为 fallback。
- Sanity 请求失败时不得把页面变成空白，也不得切换到未知布局。
- CMS 缓存必须包含 schema 版本和最大有效时间。
- 页面模型发生不兼容变化时必须自动丢弃旧缓存。
- 结构性变更首次上线时，优先禁用本地布局缓存，确认稳定后再启用短期缓存。
- 每次发布都可以通过 feature flag 回到稳定渲染器。

## 实施阶段

### 阶段 0：稳定当前生产

- 保持当前线上旧版渲染器。
- 不让现有 `pageLayout` 文档影响生产页面。
- 标记旧文档为过渡数据，不执行生产数据替换。

### 阶段 1：建立模型和适配层

- 新增受控 section schema。
- 新增 `pageContent` 查询和 adapter。
- 增加内容契约检查。
- 只读取并生成对比结果，不改变当前页面渲染。

### 阶段 2：首页 Preview 灰度

- 已从当前正在使用的 `homepageLayout` 和 `siteSettings.heroPhoto` 生成 `pageContent-home`，没有从旧的通用 `pageLayout` 复制内容。
- 已在带有 `?page-content-preview=1` 的 Preview 路径接入 adapter；默认生产路径仍不读取新模型。
- 已完成首页桌面端、移动端、灯箱、链接、首屏图片和 Sanity CDN 图片加载对比。
- 稳定版和受控版的模块结构、照片数量、页面高度和交互检查通过；等待正式 Preview 部署复核。

### 阶段 3：Photobalcony Preview 灰度

- 已从当前正在使用的 `photobalconyLayout` 迁移到受控 section，保留主视觉、标题、轮播、网格和堆叠照片。
- 已完成桌面端、移动端、轮播切换、灯箱和 Sanity CDN 图片加载检查。
- 仍需在正式 Vercel Preview 部署中复核；生产读取尚未启用。

### 阶段 4：清理过渡模型

- 在生产灰度完成前，继续保留并读取旧 `homepageLayout` 和 `photobalconyLayout` 作为稳定回退源。
- 生产稳定运行后，才停止读取旧 `pageLayout`、`homepageLayout` 和 `photobalconyLayout`。
- 保留一次可恢复的 Sanity 数据快照。
- 更新 Studio 导航、文档和发布检查。
- 在确认新模型稳定后再归档旧文档。

## 发布门禁

当前稳定版本发布前必须通过：

```bash
npm run lint
npm run build
npm run cms:status
npm run verify:production
```

阶段 1 完成后新增受控页面契约检查；在该检查实现前，不把旧的
`verify-page-content.mjs` 当作新模型的验证依据。

阶段 1 的本地验证命令为：

```bash
npm run verify:page-content-adapter
npm run verify:page-content-contract
```

开始迁移 `pageContent` 文档后，发布门禁改用：

```bash
npm run verify:page-content-contract -- --require
```

此外必须在 Preview 中检查：

- 首页和 Photobalcony 的桌面端与移动端视觉
- 首屏主视觉和图片加载
- 模块顺序、显示状态和链接
- 灯箱、照片详情、Stories、导航和页脚
- Sanity 请求失败时的静态回退

只通过 HTTP 状态检查不能作为页面发布依据。

## 验收标准

- 修改现有标题、图片、文案、顺序和显示状态不需要改代码。
- 新增一个已有 section 类型的内容模块不需要改代码。
- CMS 数据不会改变 CSS、字体、断点或组件结构。
- 缺图、无效引用和网络失败不会导致空白页面。
- 首页和 Photobalcony 在 Preview 中与当前稳定版本保持一致。
- 新增一种视觉模块时，代码发布后即可在 Sanity 中长期复用。
- 发布可回退，且不会依赖客户端旧缓存。

## 当前状态（2026-11-01）

- 线上稳定版本为回退后的旧版页面渲染器。
- Sanity 照片、分类、Stories、Site Settings 和图片资源保持可用。
- 旧 `pageLayout` 文档仍存在，但当前前端不读取它们。
- 本文档已改为受控组件编排方案。
- 本地 Studio 已加入受控 `pageContent` schema 和导航；`pageContent-home`、`pageContent-photobalcony` 已安全写入 production。
- 基线迁移脚本以当前 `homepageLayout`、`photobalconyLayout` 和 `siteSettings` 为来源，不再使用旧 `pageLayout` 生成页面内容。
- 已加入 `pageContent` 查询、adapter、契约检查和 feature flag 读取路径；删除 Production flag 后即可回到稳定渲染器。
- 已配置 `VITE_PAGE_CONTENT_MODE=preview` 到 Vercel Preview 和 Production 环境；Production 灰度 deployment 已为 `Ready` 并绑定正式域名。
- `SANITY_WRITE_TOKEN` 已轮换，旧 token 已撤销；本地契约验证、构建、桌面/移动视觉回归和灯箱/轮播交互均已通过。
- Vercel Preview 部署 `gallery-site-riycwqis3-zjk159357s-projects.vercel.app` 已为 `Ready`，但该部署受 Vercel 登录保护，当前会话无法直接进行无认证浏览器验收；不能把 HTTP 200 登录页当作页面验收证据。
- 生产灰度前的稳定 deployment 已保留；灰度 deployment 无查询参数时已确认实际请求 `pageContent`，并通过首页与 Photobalcony 的桌面端、移动端、Sanity CDN 图片、模块结构、灯箱、首页 Harbor 轮播和浏览器错误检查。
- Sanity webhook 已包含 `pageContent`；临时更新 `pageContent-home` 后实际触发了新的 Vercel Production deployment，并在恢复字段后再次部署成功。测试字段已恢复为空。
- 生产前台读取已切换到 Sanity CDN 查询端点；正式域名实测收到 `pageContent` 查询和全部 200 响应，首页 59 张、Photobalcony 18 张图片均来自 `cdn.sanity.io`，没有本地 `/photos/` 回退。
- Production 已进入受控 `pageContent` 灰度；Sanity 请求失败时仍回退到稳定数据。若观察期出现异常，删除 Production 的 `VITE_PAGE_CONTENT_MODE` 并重新部署即可回到 stable。旧布局数据暂不归档，待观察期结束后再处理。
