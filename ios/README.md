# Gallery iPhone 实况照片上传

在「Gallery 上传」里选一张实况照片，App 会读取系统相册里的封面和配对视频，并将两者发布为同一条 CMS 照片记录。重复上传同一份原始素材会返回原来的链接。

## Windows 安装和首次授权

1. 在 GitHub Actions 的「Build Gallery iPhone uploader」构建中下载 GalleryUploader-iPhone，解压得到 GalleryUploader.ipa。适用于 iOS 18 及以上的 iPhone。
2. 用 USB 将 iPhone 连接到 Windows，并在手机上信任电脑。在爱思助手的「工具箱 → IPA 签名」中添加 IPA，使用自己的 Apple ID 和已连接的设备签名，再安装签名后的 IPA。按 iOS 提示启用开发者模式或信任开发者。免费个人签名通常有效 7 天，到期需要重新签名并安装。
3. 在手机上打开「Gallery 上传」，点「打开 CMS 授权这台 iPhone」。用 Gallery 的 CMS 管理员账号登录，核对 App 中的识别码并点「授权这台 iPhone」。返回 App，点「选择并上传实况照片」。

CMS 的「iPhone 上传」页面可以撤销单台设备。设备凭据保存在手机钥匙串内。服务端使用现有 Sanity 项目、数据集和写入凭据，轮换服务端写入凭据后需要重新授权设备。

## 真机验收

1. 选择一张在系统相册里播放时有声音的实况照片。上传成功后打开照片链接，点「Live」播放并确认声音，按住照片预览，松手后应回到封面。
2. 在 Sanity「全部照片」中确认照片同时有图片和实况视频，重复上传同一份素材应返回原链接。
3. 在 CMS 撤销这台设备的授权，返回 App 后应再次看到授权入口。

网页封面最长边为 2560 像素。App 根据文件大小选择视频输出分辨率，并导出 MP4 以适配 Vercel 请求大小限制。
