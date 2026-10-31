# Sanity 内容控制改造任务文档

更新时间：2026-10-31

## 目标

把首页和 `/photobalcony` 改造成由 Sanity 驱动的内容页面。发布者可以在 Sanity 中修改文字、图片、模块显示状态、模块顺序和显示样式，不需要修改 React 代码，也不需要因为新增一个标题或图片组而推送 GitHub。

网站继续使用当前的中英文混合内容，不在本阶段加入多语言系统。

## 当前问题

- 首页的 `Landscape`、`City`、`Harbor` 等模块结构写在 React 组件中。
- `Harbor` 标题和部分图片位置是固定字段，不能在 Sanity 中创建任意新的内容模块。
- 很多页面标题、按钮文字、导航和辅助文字写在 JSX 中。
- 本地分类文件夹会生成 `src/data/photos.ts` 和 `public/photos/`，构成静态回退内容。
- 分类目录中的 `index.md` 没有被当前 React/Vite 应用读取，不作为新的内容模型延续。

## 本阶段范围

### 包含

- 首页 `/`
- 影像阳台 `/photobalcony`
- 首页和影像阳台的模块内容、模块排序和模块样式
- 页面标题、副标题、模块标题、说明文字、按钮文字、导航、页脚和照片元数据标签
- 现有照片、分类、Stories、Site Settings 与新布局模型的衔接
- Harbor 等现有固定模块迁移为通用模块
- 不依赖本地相册文件夹的生产构建

### 不包含

- 本阶段不重做网站视觉设计
- 本阶段不新增中英文切换
- 本阶段不把 Journal 和 About 改成完整的可拖拽页面编辑器；它们继续使用现有 CMS 内容模型，后续可接入同一套文案模型
- 本阶段不允许 CMS 任意写 HTML、CSS 或脚本

## 内容模型

### Site Settings

继续作为全站单例，补充或整理以下内容：

- 网站名称和默认描述
- 品牌文字
- 主导航项：文字、目标路径、是否显示、排序
- 页脚栏目标题和链接
- 联系信息、社交链接
- 全站默认的按钮和辅助文字

### Page Layout

创建每个页面一个布局文档：

- `pageKey: home`
- `pageKey: photobalcony`

每个页面包含可拖拽排序的 `sections[]`。每个 section 具有以下通用字段：

- `title`
- `eyebrow`
- `description`
- `isVisible`
- `style`
- `photos[]`
- `coverPhoto`
- `sourceMode`: 手动选择或按分类读取
- `category`
- `limit`
- `linkLabel`
- `linkTarget`
- `theme`
- `showTitle`

数组顺序就是页面显示顺序。模块隐藏时保留配置，不删除内容。

### Site Copy

创建一个全站文案单例，管理不属于具体模块的固定文字：

- Loading、Not Found、Back、Close、Previous、Next
- 图片详情和照片元数据标签
- Journal、Stories、About、Contact、Explore、Top 等固定标题
- 图片画廊和轮播的无障碍标签
- 空状态和错误提示

代码保留最低限度的默认回退值，正常生产环境优先使用 Sanity 文案。

### Photo、Category、Story

继续使用现有文档类型，并确保以下字段可由 Sanity 管理：

- 照片标题、替代文字、说明、署名和拍摄元数据
- 照片的分类、显示状态和排序值
- 分类标题、简介、封面、显示状态和排序
- Story 标题、摘要、正文、封面和关联照片

## 第一版显示样式

每个样式对应一个受控的 React 渲染器。CMS 选择样式，不能直接写页面代码。

- `hero`：一张全宽主视觉
- `featureCards`：两到三张特色卡片，可带链接
- `landscapeCarousel`：上方轮播、下方图片列表或缩略图
- `banner`：标题、说明和一张横幅图片
- `grid`：方格或响应式图片组
- `stack`：多张全宽纵向图片
- `split`：图片与文字并排

现有 Harbor 视觉会拆成一个或多个普通 section，例如 `banner`、`landscapeCarousel`、`grid` 和 `stack`，不再保留 Harbor 专用硬编码分支。

## 前端改造要求

1. 新增通用页面布局查询和类型定义。
2. 新增 section 解析器，根据 `style` 选择对应渲染器。
3. 所有渲染器只接收 section 数据，不依赖固定文件名来决定内容。
4. 移除首页和 Photobalcony 中依赖固定文件名、固定分类的内容回退逻辑；迁移期间可以保留回退，但 CMS 数据完整后应关闭。
5. 将 JSX 中的可见固定文字替换为 `Site Copy` 或页面/section 字段。
6. 保持照片链接、灯箱、Stories、EXIF 信息和响应式布局正常工作。
7. CMS 请求失败时显示可理解的状态，不因缺少本地图片文件而构建失败。

## 内容工作流

1. 在 Sanity 中上传或创建 Photo，并补全图片资源和元数据。
2. 创建或编辑 Category、Story 和 Site Settings。
3. 在 Page Layout 中新增 section，填写文字，选择样式和图片，拖动排序。
4. Publish 后，网站通过已存在的 Sanity 客户端读取最新内容；不需要修改代码或推送 GitHub。
5. 如需让 sitemap 等构建产物同步更新，再触发 Vercel 重建；页面内容本身不依赖 GitHub 推送。

## 迁移步骤

### 阶段 1：模型和 Studio

- 增加 `pageLayout` 和 `siteCopy` schema。
- 增加 Sanity Studio 的布局编辑入口、排序和内容校验。
- 增加缺图、缺标题、缺图片资源和空模块检查。

### 阶段 2：查询和前端渲染

- 增加页面布局和全站文案查询。
- 实现通用 section 类型和渲染器。
- 接入首页和 Photobalcony。
- 把当前首页与 Harbor 内容迁移为 Sanity sections。

### 阶段 3：文案迁移

- 迁移页面标题、模块标题、导航、页脚和操作文字。
- 逐项删除组件中的硬编码可见文字。
- 保留必要的技术默认值，避免 CMS 暂时不可用时页面崩溃。

### 阶段 4：照片资产切换

- 确认 Sanity 中所有照片都有 `image.asset`。
- 用无本地相册文件夹的副本执行生产构建和运行测试。
- 确认首页和 Photobalcony 不再依赖 `/photos/` 本地路径。
- 将本地相册文件夹保留在私有备份中，不再提交公开 Git 仓库。

## 验收标准

- 在 Sanity 中新增一个标题和图片组，可以选择现有样式并拖到任意位置，发布后网站显示，无需改代码。
- 在 Sanity 中隐藏一个 section，网站不显示它，但配置仍保留。
- 修改 `Landscape`、`Harbor` 或新建其他标题时，不需要修改 React 文件。
- 首页和 Photobalcony 的页面标题、模块标题、副标题、按钮、导航和主要辅助文字可以从 Sanity 修改。
- 同一张照片可以被多个 section 复用。
- 不存在本地相册文件夹时，生产构建通过，首页和 Photobalcony 仍能从 Sanity 显示图片。
- 图片灯箱、照片详情、Stories、轮播和移动端布局继续正常工作。
- Sanity 内容发布后，刷新页面即可看到更新；不需要 GitHub push。
- TypeScript、lint、生产构建和无本地照片构建检查通过。

## 当前决策

- 第一阶段页面：首页 + Photobalcony。
- 文案语言：保持当前中英文混合。
- 内容源：Sanity 为生产主源，本地静态数据只作为迁移或开发回退。
- 模块系统：有限的受控样式集合，不开放任意 HTML/CSS。
- Harbor：迁移为通用 section，不保留特殊模块身份。

## 执行状态（2026-10-31）

- 已完成 `pageLayout`、`siteCopy` schema、Studio 编辑入口和通用 section 渲染器。
- 已将首页与 Photobalcony 的基线内容写入当前 Sanity production dataset：
  `pageLayout-home`、`pageLayout-photobalcony`、`siteCopy-main`。
- 当前远端检查结果：178 张照片全部有 Sanity image asset，2 个页面布局和 1 个全站文案单例均可读取。
- 已加入 `npm run cms:page-content`（安全创建）和 `npm run verify:page-content`（发布前检查）。
- 已通过 TypeScript、lint、Vite production build；在本地相册目录和 `public/photos` 暂时不存在时，仍可完成无本地照片生产构建。
- 本地相册目录仍作为私有备份保留；代码中的 Git 删除和忽略变更需要在最终 Git 提交后才会从远程仓库的新版本移除。
- `SANITY_WRITE_TOKEN` 只保留内容写入权限；webhook 配置脚本现在会自动回退到已登录的 Sanity CLI 管理凭证。当前 Vercel webhook 已更新，过滤器包含 `pageLayout` 和 `siteCopy`。

