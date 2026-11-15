# 星诞 · 全息生日祝福

一场可以分享的科幻生日祝福。打开页面，写下名字、放上一张肖像，生成一条链接。朋友打开链接时，会看到写着 TA 名字的全息蛋糕、环形星轨和圆形肖像，不需要服务器。

在线地址：**https://aultbyel.github.io/Birthday_Treat/**

聊天软件里的链接预览卡片是整站共用的，个性化的名字和肖像在打开页面之后才会出现。

## 本地运行

需要 Node.js 20 或更新版本。

```bash
npm install
npm run dev
```

开发地址是 [http://localhost:5173/Birthday_Treat/](http://localhost:5173/Birthday_Treat/)。项目站的 `base` 固定为 `/Birthday_Treat/`。

```bash
npm run build
npm run preview
```

预览构建结果： [http://localhost:4173/Birthday_Treat/](http://localhost:4173/Birthday_Treat/)。

## 分享是怎么工作的

页面只有一个地址，两种状态：

- 没有哈希：制作页。可以输入中文或英文名字、上传或拖入肖像、改一句祝福。留空祝福时，会使用一句默认的中文生日祝词。
- 带哈希：祝福页。打开后自动播放一段镜头，展示名字、肖像和祝福。

名字、祝福和肖像都放在 URL 哈希里，例如 `#p=...` 或更短的 `#z=...`。

肖像会在浏览器里裁成圆形，边长大约 160 像素，能再小就再小，并压成 WebP 或 JPEG。文本会和一份 [lz-string](https://github.com/pieroxy/lz-string) 压缩结果比较，取更短的那一种。照片本身已经压过，通常不会再被 lz-string 缩小，所以带肖像的链接走更紧凑的 base64url。

页面会尽量把整段链接控制在大约 6000 字符以内。如果做不到，会说明当前长度，并提供「改用更小的肖像」。链接不会悄悄失败。

拿到链接的人都能看到其中的名字、祝福和肖像。请只发给你愿意让对方看见照片的人。

声音默认关闭。打开右上角的「声音」才会播放一段用 Web Audio 合成的环境音，没有音频文件，也不会自动出声。

## 发布到 GitHub Pages

仓库里有 `.github/workflows/pages.yml`。它使用 `actions/upload-pages-artifact` 和 `actions/deploy-pages`，在推送到 `main` 时构建 `dist` 并部署。`public/.nojekyll` 会一并进构建结果。

如果 Actions 或 Pages 还没打开，需要在 GitHub 上做这一次设置：

1. 打开仓库 **Settings → Pages**。
2. 在 **Build and deployment** 里把 **Source** 选成 **GitHub Actions**。
3. 若 Actions 被禁用，到 **Settings → Actions → General**，允许本仓库运行 Actions。
4. 回到 **Actions**，运行 **Deploy GitHub Pages**，或再推一次 `main`。

完成后即可通过 <https://aultbyel.github.io/Birthday_Treat/> 访问。

## 画面与性能

场景使用 Three.js r187，程序化的蛋糕、台座、星环、能量丝带和粒子都在本地生成，不加载 HDRI。绽放和轻微胶片颗粒走后处理。`devicePixelRatio` 限制在约 1.5–1.75，并限制渲染长边，避免 4K 屏幕把分辨率拉得过高。粒子用实例化或着色器驱动，动画循环里不创建临时对象。切到后台时会暂停渲染。系统开启「减少动态」时，会跳过镜头飞入、放慢运动并减弱发光。
