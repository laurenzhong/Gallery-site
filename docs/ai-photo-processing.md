# AI Photo Processing

这份文档定义照片导入后的 AI 处理合同。实现完成后，导入页、服务端任务和照片库必须遵守这里的输入、输出与状态规则。

## 目标

一次视觉模型调用处理一张照片，返回：

- 主体标签 `subjects`；
- 时间 / 天气标签 `conditions`；
- 照片标题 `title`；
- 替代文本 `altText`；
- 图片说明 `caption`；
- 可选的第一人称手记 `story`。

照片、EXIF、本批次地点、具体拍摄点和用户填写的提示词一起作为模型输入。提示词可以为空；为空时，模型根据图片、EXIF、地点信息和现有手记样例写作。

模型内容不使用固定句式限制。程序只要求模型返回可解析的结构化 JSON，避免标签和正文无法写入 Sanity。

## 任务流程

```text
Studio 上传照片
  -> 创建 photo 文档
  -> aiClassification.status = queued
  -> 服务端任务读取图片、EXIF、地点和提示词
  -> 一次模型调用返回标签、标题、说明和可选手记
  -> 写回 photo 与 story
  -> 导入页显示完成或失败
```

模型调用必须在服务端完成。`OPENAI_API_KEY`、`SANITY_WRITE_TOKEN`、`AI_WEBHOOK_SECRET` 和代理配置不能使用 `VITE_` 前缀，也不能进入浏览器 bundle。Sanity webhook 通过 `npm run deploy:ai-webhook` 配置到 `/api/photo-ai`。

## 输入

每个任务至少包含：

```text
photoId
imageUrl
sourceFilename
date / camera / lens / aperture / shutter / iso / focalLength
place.title              # 宽泛地点，例如“麦理浩径”
spot                     # 具体拍摄点，例如“破边洲”
prompt                   # 可选的手记提示词
styleExamples             # 当前手记的少量示例或已缓存的风格摘要
```

地点标签用于照片库筛选，具体拍摄点用于标题和手记叙述。模型不能仅凭画面猜测具体城市；没有 EXIF GPS 或批次地点时，地点可以留空。

## 输出

```json
{
  "subjects": [{"value": "ocean", "confidence": 0.94}],
  "conditions": [{"value": "sunrise", "confidence": 0.88}],
  "primarySubject": "ocean",
  "title": "破边洲的风",
  "altText": "海岸和远处山体在晨光中的景象",
  "caption": "……",
  "story": {
    "title": "破边洲的风",
    "excerpt": "……",
    "body": ["……", "……", "……"]
  }
}
```

`story` 仅在导入任务勾选“生成手记”时写入。第一版默认每张照片生成一篇手记；照片批次合写一篇手记作为后续扩展。

## 写回规则

- 新照片可以自动采用 AI 标题；`sourceFilename` 永远保留原始文件名。
- AI 不自动修改已有照片的稳定 `slug`。
- `subjects` 和 `conditions` 写入正式字段，同时保留置信度和模型原始结果在 `aiClassification`。
- AI 生成的手记直接创建为普通 Sanity 文档，不需要隐藏。
- 手记公开显示还要满足照片未隐藏、发布时间已到，并且封面照片被公开页面实际使用。
- 手记应关联封面照片和本批次相关照片，生成来源、模型和提示词写入可审计字段。

## 状态与重试

照片任务状态：

```text
queued -> processing -> approved
                   -> error
```

任务必须支持幂等重试。重复运行不能重复创建手记，也不能无限追加重复标签。失败任务保留错误信息、模型和处理时间，Studio 提供重试入口。

单张失败不应阻塞同一批次其他照片。关闭浏览器后，已经创建的 `queued` 任务仍可由服务端继续处理。

## 风格参考

模型可以参考现有手记的共同特征：第一人称、具体时间和地点、现场观察、拍摄决定、器材参数和拍摄后的回想。示例应控制数量和长度，避免每次请求携带整份历史内容。

## 配置

项目根目录的 `.env.local` 是本地开发和脚本的配置来源。相关脚本会自动读取它，不需要把密钥复制到命令行、源码或这份文档中。当前项目实际使用的字段包括：

```text
SANITY_STUDIO_PROJECT_ID
SANITY_STUDIO_DATASET
SANITY_WRITE_TOKEN
VITE_SANITY_PROJECT_ID
VITE_SANITY_DATASET
OPENAI_API_KEY
OPENAI_API_ENDPOINT
OPENAI_VISION_MODEL
```

其中 `VITE_*` 只用于浏览器端的 Sanity 公开读取配置；`OPENAI_API_KEY`、`SANITY_WRITE_TOKEN` 和 webhook 密钥只允许留在服务端环境。

首次启用 Sanity AI webhook 时，再在同一个 `.env.local` 中补充 `AI_WEBHOOK_URL` 和 `AI_WEBHOOK_SECRET`，然后运行 `npm run deploy:ai-webhook`。本地脚本会继续从 `.env.local` 读取这些值；部署到 Vercel 时，需要在 Vercel 项目环境变量中使用相同的变量名，因为 `.env.local` 不会上传到生产环境。

模型名称、处理时间和错误信息写入任务或照片文档，方便之后追踪成本与质量。

## 验收标准

- 导入页可以在不选择主体 / 天气标签的情况下导入。
- 处理完成后照片自动拥有 AI 标签和标题。
- 勾选生成手记时，一次模型调用同时完成照片识别和手记生成。
- 未被公开页面使用的照片，其手记不会出现在网站。
- 照片被公开页面使用后，关联手记自动出现。
- 单张模型失败可以重试，其他照片不受影响。
- 浏览器端看不到模型和 Sanity 写入密钥。
- Sanity webhook 使用独立随机密钥，未携带密钥的请求被拒绝。
