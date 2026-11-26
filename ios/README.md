# Gallery iPhone 实况照片上传

安装并配置一次后，在「Gallery 上传」中选一张实况照片即可发布。App 会从系统相册获取封面和视频，并将两者写入同一条 Sanity 照片记录。上传完成后可以直接打开公开的照片链接。归档页会在刷新 CMS 内容后显示新照片。

## 启用上传

1. 在 Vercel 服务端环境设置 `GALLERY_LIVE_UPLOAD_KEY` 为随机密钥，例如用 `openssl rand -hex 32` 生成。上传接口还使用已有的 Sanity 项目、数据集和服务端写入凭据 `SANITY_WRITE_TOKEN`。这些密钥不要添加到 `VITE_` 变量或提交到 Git。
2. 部署包含 `/api/live-photo` 和 Studio 实况字段的版本。App 默认使用 `https://www.queenstown.top/api/live-photo`。为测试站部署时，在 App 设置里填对应的 HTTPS 地址。
3. 在 Mac 上用 Xcode 16 或更新版本打开 `GalleryUploader.xcodeproj`，为 `GalleryUploader` 目标选择签名团队，然后连接一台运行 iOS 18 或更新版本的 iPhone 并点 Run。这里提供的是可以签名安装的工程源码。
4. 首次打开 App 时输入 Vercel 上设置的上传密钥。App 会把它保存在这台 iPhone 的钥匙串中。

## 真机验收

1. 在 App 里选一张包含声音的实况照片。确认它在 Sanity「全部照片」中只新增一条记录，该记录有图片和实况视频。
2. 打开 App 返回的链接，再打开归档里的同一张照片。「Live」按钮轻点会带声音播放，触屏按住可预览画面，松开后回到封面。切换到其他照片时应停止播放。
3. 从手机重复上传同一张照片。确认复用原来的公开链接和照片记录。

Web 版封面最长边为 2560 像素，视频会自动编码成兼容网页浏览器的 MP4。App 根据文件大小选择输出分辨率，以适配 Vercel 的默认请求大小限制。
