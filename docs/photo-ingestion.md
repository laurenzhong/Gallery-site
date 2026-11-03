# Photo Ingestion

把新照片从本地文件夹或 Sanity Studio → AI 处理 → 照片库 → 网站可见的标准流程。

## 一张照片的生命周期

```
本地文件夹           Sanity 文档                网站
gallery-site/       photo.queenstown-dsc-NNNN  /photobalcony
Queenstown/  --->   isHidden=false (Studio 默认) --->  /journal
DSC_NNNN.JPG        sourceFilename=DSC_NNNN.JPG    /...
                    subjects=[mountain, landscape]
                    conditions=[sunset]
                    place=麦理浩径
                    spot=破边洲
                    category=Queenstown (legacy, optional)
                    aiClassification.status=approved
                    sortOrder=9000+NNN
                    dimensions={w,h}
```

新流程不要求人工选择主体标签或时间 / 天气。模型根据图片、EXIF、地点信息和可选提示词一次性写入标签、标题、替代文本、图片说明和可选手记。照片是否出现在网站，仍由照片公开状态和页面引用决定。

## 本地文件存放

约定：

```
gallery-site/<分类文件夹>/DSC_NNNN.JPG
```

- 文件夹名可以继续作为旧版 `category` 的兼容值，但不再代表照片主体或新的地点筛选
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
| `--publish` | 兼容旧命令，当前上传默认公开 |
| `--subjects a,b` | 兼容旧命令；新 Studio 流程由 AI 写入主体标签 |
| `--conditions a,b` | 兼容旧命令；新 Studio 流程由 AI 写入时间 / 天气 |
| `--classify` | 上传完成后立即调用视觉模型生成 AI 分类建议（需要 `OPENAI_API_KEY`） |
| `--sort-offset N` | 默认 `100`。DSC 文件号会叠加成 `sortOrder`。新分类推荐 9000+ 避免和老数据穿插 |

> 默认行为是 **公开上传**；照片主体标签可以稍后批量补充或由 AI 自动写入。

### 4. 回填 dimensions

新上传的照片 `dimensions.width/height` 会是 `null`。`upload-photos` 写时为节省本地内存不复读取（流式直接到 Sanity）。上传完跑一次回填：

```bash
npm run cms:backfill-dimensions
```

会从 `image.asset.metadata.dimensions` 读真实尺寸，写回 `photo.dimensions` 字段。

### 5. 在 Studio 中批量导入

也可以直接在在线 Studio 中完成批量导入，不需要运行命令行：

1. 打开 **照片库 → 导入照片**。
2. 将多张照片拖入导入区域，或点击选择文件。
3. 可选填写本批次的宽泛地点，例如“麦理浩径”。
4. 可选填写具体拍摄点，例如“破边洲”。
5. 可选勾选 **生成手记** 并填写提示词；提示词为空时，模型仍根据照片、EXIF 和现有手记风格写作。
6. 检查系统读取到的拍摄日期、相机、镜头、光圈、快门、ISO、焦距和 GPS 信息。
7. 点击 **导入并开始 AI 处理**。

导入会先根据文件名创建稳定的 URL 标识，再上传图片资源并创建照片文档。AI 会随后写入标题、标签、替代文本、图片说明和可选手记；不会自动修改已有稳定 URL。重复的原始文件名会自动跳过。没有 EXIF 的字段可以在照片文档中手动补充。

### 6. 照片库与网站使用

进 `npm run cms:dev`：

1. **照片库 → 全部照片**，使用主体标签、时间 / 天气或地点多选筛选结果。
2. 检查 AI 标题、标签、说明和手记，需要时直接编辑照片或手记。
3. 需要进入网站时，将照片加入 **页面内容 → 首页**、**页面内容 → 影像阳台** 或其他公开模块。
4. 照片必须未隐藏且被公开页面使用，关联手记才会显示在网站。
5. 地点标签用于筛选；具体拍摄点用于照片标题和手记叙述。

未被公开页面使用的照片仍保留在 Sanity 和照片库中，但不会出现在网站页面或其手记列表中。

### 7. AI 处理

AI 处理同时完成主体标签、时间 / 天气、标题、替代文本、图片说明和可选手记。服务端任务的输入输出、状态和重试规则见 [ai-photo-processing.md](ai-photo-processing.md)。先在 `.env.local` 配置服务端密钥：

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

`--dry-run` 只调用模型并生成报告，不会写入照片文档。确认模型输出后，去掉 `--dry-run` 才会写入正式主体 / 条件标签和 `aiClassification`。Studio 导入流程使用同一套服务端处理规则。

确认输出后再写入 Sanity：

```bash
npm run cms:classify-photos -- --limit 20
```

脚本会直接把结果写入正式主体 / 条件标签、替代文本和“AI 分类记录”，并将照片保持公开。手记是否显示由照片的公开状态和页面使用情况决定。打开 **照片库 → 全部照片** 即可查看和修正结果。

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

AI 处理 webhook 需要单独配置一次：

```bash
npm run deploy:ai-webhook
```

它会把照片进入 `aiClassification.status = queued` 后的任务发送到 `/api/photo-ai`。任务在服务端继续执行，关闭 Studio 页面不会取消已经排队的照片。

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
| AI webhook | `npm run deploy:ai-webhook` |

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
