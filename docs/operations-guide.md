# 网站运营指南

## 一、工具说明

### Sanity Studio（内容后台）

**是什么**：你的内容管理系统，所有照片、手记、分类、站点设置都存这里。相当于 WordPress 后台，但是给你定制的。

**怎么打开**：
```
cd D:\Gallery\gallery-site
npm run cms:dev
```
然后浏览器打开 `http://localhost:3333`

**能做什么**：

| 操作 | 位置 | 步骤 |
|---|---|---|
| **换 hero 图** | Photos → 找到一张图点进去 | 勾选 `Homepage Hero` → Publish。旧 hero 图也要进去**取消勾选** → Publish |
| **写摄影手记** | Stories → Create new | 填 Title / Excerpt / 选 Cover Photo / 写 Body → Publish |
| **隐藏/显示某张图** | Photos → 打开图 | 勾选 `Hidden` → Publish（隐藏后首页不显示，但数据还在） |
| **改 About 页** | Site Settings | 改名字、地点、个人介绍、器材列表、社交链接 |
| **调整图片排序** | Photos | 改 `Sort Order` 数字（小的排前面，100 是默认） |
| **调整分类排序** | Categories | 改 `Sort Order`，取消 `Visible` 可以隐藏整个分类 |

### Vercel（网站部署）

**是什么**：自动把代码变成线上网站。每次你 `git push` 到 GitHub，Vercel 自动拉新代码、跑 `npm run build`、部署到 `gallery-site-sandy.vercel.app`。

**部署流程**：
```
你改代码 → git commit → git push → Vercel 自动检测 → 构建 → 上线
你改 CMS 内容 → Sanity 即时生效 → 不需要 push
```

**关键区别**：
- 改代码（App.tsx、CSS 等）→ 需要 push 才能上线
- 改内容（Photo info、Story、Settings）→ Sanity 里改完 Publish 就**立刻上线**，不需要 push

---

## 二、日常操作速查

| 想做什么 | 去哪做 | 要 push 吗 |
|---|---|---|
| 换首页大图 | Sanity Studio → Site Settings → 主视觉照片 | 不需要；发布后前台读取 Sanity 内容 |
| 写新手记 | Sanity Studio → Stories → Create | 不需要 |
| 改 About 页文字 | Sanity Studio → Site Settings | 不需要 |
| 加新照片 | 把 JPG 放进 `gallery-site/分类名/` → `npm run build` | 需要 |
| 改网站样式 | 改 `src/styles/global.css` | 需要 |
| 改页面布局 | 改 `src/components/*.tsx` | 需要 |
| 隐藏某张图 | Sanity Studio → Photos → 勾 Hidden | 不需要 |
| 改网站标题 | Sanity Studio → Site Settings | 不需要 |

---

## 三、明天要做的事

1. **确认线上正常**：打开 `https://gallery-site-sandy.vercel.app`，检查 hero、手记、About 都显示正确
2. **push 今天的改动**：`cd D:\Gallery\gallery-site && git push origin master`（网络通的时候）
3. **改 About 页**：进 Sanity Studio → Site Settings，把名字、地点、器材、社交链接换成自己的真实信息
4. **写 About 的个人介绍**：在 Site Settings 的 `About Bio` 里写几段自我介绍
5. **选不选自定义域名**：如果你想用 `queenstown.top` 或自己的域名而不是 `vercel.app`，告诉我，20 分钟配好

---

## 四、后续注意事项

1. **Sanity 免费额度**：你现在是 30 天试用。到期后免费计划：每月 1 万 API 请求、100GB 带宽。你现在 73 张图用了 860MB 带宽，够用
2. **图片压缩**：加了新图后别忘记跑 `npm run build`，Vercel 部署后用户看到的就是缩放版
3. **预加载**：生产构建会尝试为当前主视觉生成预加载链接；Sanity 暂时不可用时会跳过预加载，但不会阻止构建。普通内容发布不需要 push。
4. **备份**：Sanity 数据在他们云上，不会丢。代码在 GitHub 上，不会丢。唯一需要备份的是 `gallery-site/` 里的源照片文件夹
5. **加新功能**：你有新想法随时告诉我，比如评论、搜索、照片下载、密码保护等
