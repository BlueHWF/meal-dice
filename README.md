# 吃饭骰子

六面自定义餐食骰子，包含鸡腿饭、面条、米粉、猪脚饭、出去吃、凉拌鸡丝饭。

最简单的用法：直接双击上级目录的「吃饭骰子.html」，即可在浏览器使用。该单文件已包含五张默认照片，联网后可搜索新图片。

开发预览：运行 `node server.mjs`，浏览器打开 http://127.0.0.1:4173 。无需安装依赖。也可以在上级目录双击「启动吃饭骰子.cmd」，再打开上面的网址。

手机访问：手机与电脑连接同一个 Wi-Fi，启动后在手机浏览器中输入窗口显示的「手机打开」地址（例如 `http://192.168.1.10:4173`）。电脑和服务窗口需要保持运行。`127.0.0.1` 指手机自身，不能用来访问电脑。电脑局域网 IP 变化后，以启动窗口显示的新地址为准。网络的设备隔离设置或防火墙可能阻止连接；服务不会自动修改这些设置。

- 点击投掷按钮或空格，六面等概率随机。投掷中暂时锁定编辑，避免结果与菜单不一致。
- 点击菜名修改，停止输入约 0.9 秒后自动搜索；点击照片查看候选、来源与许可。
- 搜索使用 Wikimedia Commons 和中文 Wikipedia 的公开接口，不需要 API 密钥。网络不可达或冷门菜名缺少照片时显示明确提示；自动结果应人工确认。
- 五张默认照片保存在本地，断网可投掷。鸡腿饭因图片下载未完成使用图标。凉拌鸡丝饭使用鸡丝饭参考照片，来源未说明凉拌。
- 可上传 JPG、PNG、WebP、GIF（最大 8 MB）；上传图片缩放到最长边 900 像素后保存在当前浏览器，GIF 会变成静态图。
- 菜单存在当前浏览器 localStorage，不会跨浏览器、电脑或网址同步。清除浏览器数据会清除菜单。

测试：`node --test tests/*.test.mjs`。照片授权及作者见 `dist/defaults.json` 和页面换图弹窗。原照片按各自 CC 许可提供；页面使用裁切展示。

修改源码后运行 `node build-portable.mjs` 更新可双击打开的单文件版本。

网页为纯静态文件，`dist` 目录可部署到静态网站服务。

## 在线部署（GitHub Pages）

推送到 `main` 分支后，GitHub Actions 会自动把 `dist` 目录部署到 GitHub Pages，无需登录、无需电脑开机，任何人拿到链接即可用。

1. 在 GitHub 创建仓库 `meal-dice`（不要勾选 README / .gitignore）。
2. 仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。
3. 本地执行：
   ```
   git remote add origin https://github.com/<你的用户名>/meal-dice.git
   git push -u origin main
   ```
4. 等待 Actions 跑完，打开 `https://<你的用户名>.github.io/meal-dice/` 即可。
