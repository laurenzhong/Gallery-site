# Photo Ingestion

把新照片从本地文件夹 → Sanity Studio → 网站可见的标准流程。

## 一张照片的生命周期

```
本地文件夹           Sanity 文档                网站
gallery-site/       photo.queenstown-dsc-NNNN  /photobalcony
Queenstown/  --->   isHidden=false (Studio 默认) --->  /journal
DSC_NNNN.JPG        sourceFilename=DSC_NNNN.JPG    /...
                    subjects=[mountain, landscape]
                    conditions=[sunset]
                    category=Queenstown (legacy display column, optional)
                    sortOrder=9000+NNN
                    dimensions={w,h}
```

Studio 批量导入使用“本批次默认信息”：一次选择共同主体标签和时间 / 天气标签，所有照片继承这些值，不需要逐张选择。没有主体标签的照片会自动 `isHidden=true`，进入“待分类”；补充标签后再批量公开。首页或影像阳台的具体位置仍由页面内容中的照片引用决定。

## 本地文件存放

约定：

```
gallery-site/<分类文件夹>/DSC_NNNN.JPG
```

- 文件夹名仍会作为旧版展示栏目 `category` 的建议值（脚本会自动按文件夹名查或建 category）；它不再代表照片主体
- 文件名建议保持相机原始 `DSC_NNNN.JPG` 格式（用于自动生成 `sortOrder = 9000 + NNN`）
- 嵌套子目录都会被扫到（递归）

可行的分类文件夹示例（项目根已有的）：

- 山野 / 建筑 / 日出日落 / 森林 / 河流 / 海洋 / 石塘度假区 / 花朵

## 上传流程

### 1. 准备

```bash
# 第一次或环境变更后
npm run cms:login                          # 浏览器登录 Sanity 账号
```

确认 `.env.local` 里有：

```env
SANITY_STUDIO_PROJECT_ID=...
SANITY_STUDIO_DATASET=production
SANITY_WRITE_TOKEN=...                     # 必须，发 token：sanity.io/manage -> API -> Tokens
```

注意：`SANITY_WRITE_TOKEN` 是 **write** 权限 token，不要 commit。在 Sanity 控制台 `Settings -> API -> Tokens -> Add API token`，选 `Editor` 权限。

### 2. Dry-run 先校验

```bash
npm run cms:upload-photos -- --dry-run --source .\海洋
```

输出会显示：

- `[5.7MB] DSC_5114.JPG -> would-create`
- `[3.5MB] DSC_0264.JPG -> exists existing=photo-dsc_0264-xxx`（脚本按 `sourceFilename` 去重）

### 3. 真传

```bash
npm run cms:upload-photos -- --source .\海洋 --concurrency 4
```

可调参数：

| 参数 | 说明 |
| --- | --- |
| `--source <dir>` | 必填（或单分类时自动选）。可传绝对或相对路径。 |
| `--concurrency N` | 并发上传数（默认 4；网络不好可降为 2） |
| `--limit N` | 只上传前 N 张（首次可先 `--limit 2` 试一张小图确认） |
| `--publish` | 允许上传后公开；如果没有传 `--subjects`，仍会保持隐藏，避免未分类照片出现在网站 |
| `--subjects a,b` | 为本批次照片写入主体标签，例如 `--subjects mountain,landscape` |
| `--conditions a,b` | 为本批次照片写入时间 / 天气标签，例如 `--conditions sunset,fog` |
| `--classify` | 上传完成后立即调用视觉模型生成 AI 分类建议（需要 `OPENAI_API_KEY`） |
| `--sort-offset N` | 默认 `100`。DSC 文件号会叠加成 `sortOrder`。新分类推荐 9000+ 避免和老数据穿插 |

> 默认行为是 **隐藏上传**，进 Studio 一张张挑着放行。这个流程最安全。

### 4. 回填 dimensions

新上传的照片 `dimensions.width/height` 会是 `null`。`upload-photos` 写时为节省本地内存不复读取（流式直接到 Sanity）。上传完跑一次回填：

```bash
npm run cms:backfill-dimensions
```

会从 `image.asset.metadata.dimensions` 读真实尺寸，写回 `photo.dimensions` 字段。

### 5. 在 Studio 中批量导入

也可以直接在在线 Studio 中完成批量导入，不需要运行命令行：

1. 打开 **照片库 → 导入照片**。
2. 在“本批次默认信息”中选择共同的主体标签；时间 / 天气标签按需选择。
3. 旧版展示栏目可以留空，不需要为新照片选择单一分类。
4. 将多张照片拖入导入区域，或点击选择文件。
5. 检查系统读取到的拍摄日期、相机、镜头、光圈、快门、ISO、焦距和 GPS 信息。
6. 点击 **导入**。

导入会根据文件名创建标题和 URL 标识，并自动上传图片资源、创建照片文档。批次默认标签会写入所有新照片；没有主体标签的照片自动隐藏并标记为待分类。重复的原始文件名会自动跳过。没有 EXIF 的字段可以在照片文档中手动补充。

### 6. 站点接线（人工部分）

进 `npm run cms:dev`：

1. **照片库 → 全部照片**，用“分类状态 → 待分类”筛选新照片
2. 选中同一批照片，在“批量添加标签”中追加主体或时间 / 天气标签
3. 需要公开时点击 **批量公开**；没有主体标签会出现确认提示
4. 若要进首页 / 影像阳台的具体位置 → 打开 **页面内容 → 首页** 或 **页面内容 → 影像阳台**，把照片添加到对应模块
5. 写 `title`、可选 `date` / `location` / 摄影参数

不做这些 → 照片仅在 Sanity 资产库存在，**不会出现在网站页面里**，但仍会保留在照片库中。

### 7. AI 分类建议

AI 分类脚本只写入 `aiClassification` 建议，不会直接修改正式主体标签，也不会自动公开照片。先在 `.env.local` 配置服务端密钥：

```env
OPENAI_API_KEY=...
OPENAI_VISION_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com
# 也可以直接配置完整的 Responses endpoint：
# OPENAI_API_ENDPOINT=https://api.openai.com/v1/responses
# 如果当前网络需要单独的代理：
# OPENAI_HTTPS_PROXY=http://127.0.0.1:7897
```

先用一张照片做 dry-run：

```bash
npm run cms:classify-photos -- --dry-run --limit 1
```

确认输出后再写入 Sanity：

```bash
npm run cms:classify-photos -- --limit 20
```

脚本会把结果写到照片的“AI 分类建议”字段。打开 **照片库 → 全部照片**，选中带有 AI 建议的照片，点击 **应用 AI 建议**。应用后照片仍保持原来的公开状态；待分类照片需要再点击 **批量公开**。

可用参数：

| 参数 | 说明 |
| --- | --- |
| `--dry-run` | 只调用模型并生成报告，不写入 Sanity |
| `--limit N` | 只处理前 N 张照片 |
| `--ids id1,id2` | 只处理指定照片文档 |
| `--force` | 忽略已有 AI 状态，重新分析 |
| `--concurrency N` | 并发数，范围 1–4，默认 2 |

### 8. 部署到生产

```bash
npm run deploy:trigger     # 触发 Vercel rebuild
```

或配置 Sanity Webhook 让 Studio publish 时自动重建：

```bash
npm run deploy:webhook
```

## 脚本清单

| 脚本 | 入口 |
| --- | --- |
| 上传 | `npm run cms:upload-photos -- --source <dir>` |
| AI 分类建议 | `npm run cms:classify-photos -- --limit <N>` |
| 回填 dimensions | `npm run cms:backfill-dimensions` |
| Studio 本地 | `npm run cms:dev` |
| Studio 在线 build | `npm run cms:build` |
| 部署 Studio | `npm run cms:deploy` |
| 状态检查 | `npm run cms:status` |

## 常见问题

### Q: 误传了，怎么撤回？
A: Sanity 没有批量 undo。建议在 Sanity Studio 里手删文档，已上传到 CDN 的 `image-xxx-...` asset 会保留（占存储但不展示）。清 asset 用 `npx sanity assets delete -y --id image-xxx` 或在 Studio asset 库手工操作。

### Q: 同名文件覆盖？
A: 不会，脚本按 `sourceFilename` 跳过。如果想替换图片资产，用 `--publish` 重新跑也只会新建文档；需要先在 Studio 删原文档。原 asset 仍在 CDN。

### Q: 跑一半断了怎么办？
A: 直接重跑。已经入库的会按 `sourceFilename` 跳过，剩下继续传。

### Q: 上传时网络卡住？
A: 脚本走 `https://127.0.0.1:7897` 系统代理（PowerShell 默认使用，Node fetch 通过 `undici ProxyAgent` 也使用）。如果你的代理地址不一样，设 `HTTPS_PROXY=http://host:port` 环境变量后再跑。

### Q: 我想加新的主体标签怎么做？
A: 在 `sanity/photoTaxonomy.ts` 中增加一项 `photoSubjectOptions`，然后重新构建 Studio。主体标签用于描述画面元素；地点、日出日落和首页专题分别填写地点、`conditions` 和页面内容，不要继续创建组合分类。

## 关键文件参考

- 通用上传脚本：`scripts/upload-photos.mjs`
- 回填脚本：`scripts/backfill-photo-dimensions.mjs`
- 旧版本 `cms:upload-assets`：scripts/upload-sanity-assets.mjs（按 manifest 上传到已有 photo 文档的 `image.asset`，配合 `cms:seed` 用）
- Studio schema：`sanity/schemaTypes/photo.ts`
- Studio 结构：`sanity/structure.ts`
