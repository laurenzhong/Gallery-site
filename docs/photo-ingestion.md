# Photo Ingestion

把新照片从本地文件夹 → Sanity Studio → 网站可见的标准流程。

## 一张照片的生命周期

```
本地文件夹           Sanity 文档                网站
gallery-site/       photo.queenstown-dsc-NNNN  /photobalcony
Queenstown/  --->   isHidden=true (默认)  --->  /journal
DSC_NNNN.JPG        sourceFilename=DSC_NNNN.JPG    /...
                    category=Queenstown
                    sortOrder=9000+NNN
                    dimensions={w,h}
```

入站默认 `isHidden=true`，必须在 Studio 里手动改成 `false` 才会出现在公开网站。layout 编辑完全独立于 visibility。

## 本地文件存放

约定：

```
gallery-site/<分类文件夹>/DSC_NNNN.JPG
```

- 文件夹名 = 未来的 Sanity category `title`（脚本会自动按文件夹名查或建 category）
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
npm run cms:upload-photos -- --dry-run --source gallery-site/Queenstown
```

输出会显示：

- `[5.7MB] DSC_5114.JPG -> would-create`
- `[3.5MB] DSC_0264.JPG -> exists existing=photo-dsc_0264-xxx`（脚本按 `sourceFilename` 去重）

### 3. 真传

```bash
npm run cms:upload-photos -- --source gallery-site/Queenstown --concurrency 4
```

可调参数：

| 参数 | 说明 |
| --- | --- |
| `--source <dir>` | 必填（或单分类时自动选）。可传绝对或相对路径。 |
| `--concurrency N` | 并发上传数（默认 4；网络不好可降为 2） |
| `--limit N` | 只上传前 N 张（首次可先 `--limit 2` 试一张小图确认） |
| `--publish` | **取消默认的 isHidden=true**，上传完即 `isHidden=false`，会立即出现在公开网站 |
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
2. 选择照片分类。
3. 将多张照片拖入导入区域，或点击选择文件。
4. 检查系统读取到的拍摄日期、相机、镜头、光圈、快门、ISO、焦距和 GPS 信息。
5. 点击 **导入**。

导入会根据文件名创建标题和 URL 标识，并自动上传图片资源、创建照片文档。新照片默认处于隐藏状态；重复的原始文件名会自动跳过。没有 EXIF 的字段可以在照片文档中手动补充。

### 6. 站点接线（人工部分）

进 `npm run cms:dev`：

1. **照片库 → 需要补全** 查看新上传后缺少必要字段的照片
2. 选要展示的 → 取消勾 **从网站隐藏**（`isHidden=false`）
3. 若要进首页 / 影像阳台的具体位置 → 打开 **页面内容 → 首页** 或 **页面内容 → 影像阳台**，把照片添加到对应模块
4. 写 `title`、可选 `date` / `location` / 摄影参数

不做这些 → 照片仅在 Sanity 资产库存在，**不会出现在网站页面里**，但仍会保留在照片库中。

### 6. 部署到生产

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

### Q: 我想加新的顶层分类怎么做？
A: 创建 `gallery-site/<新分类名>/DSC_NNNN.JPG`，上传时传 `--source gallery-site/<新分类名>`，脚本会自动查 / 建同名 category。

## 关键文件参考

- 通用上传脚本：`scripts/upload-photos.mjs`
- 回填脚本：`scripts/backfill-photo-dimensions.mjs`
- 旧版本 `cms:upload-assets`：scripts/upload-sanity-assets.mjs（按 manifest 上传到已有 photo 文档的 `image.asset`，配合 `cms:seed` 用）
- Studio schema：`sanity/schemaTypes/photo.ts`
- Studio 结构：`sanity/structure.ts`
