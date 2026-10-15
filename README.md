# dsh-open-native

点交付卡片 → 直接用**系统默认程序**打开文件（`.xlsx` 就是 WPS），不再跳进 DSH 右侧的
内置预览。

## 为什么需要它

DSH 的交付卡片（`present` 出来的文件那个卡片）把两件事刻意分开了：

- **点卡片本体** = 在右侧 Sidebar 内嵌预览。这是写死的，没有设置项能改。
- **用系统默认程序打开** = 卡片上另一个独立的分体按钮「打开（默认）」。

这个插件把第一件事改成第二件事。

> 注意：这个插件只负责「走哪条打开通道」。文件最终由哪个程序接管，仍然取决于
> Windows 对那个扩展名的默认程序关联。如果点开发现是微软 Office 而不是 WPS，
> 那是系统关联的问题（`FileExts\.xlsx\UserChoice` 的哈希失效），不是插件的问题。

## 怎么做的

改动全在浏览器端，不碰 DSH 本体（不改 `app.asar`，升级不会丢）。

- DSH 的卡片里那个铺满整块的预览按钮，`title` 属性上挂的就是解析后的绝对路径
  （`resolveWorkspacePath(cwd, file.path)`）。
- 原生打开的通道是宿主的 `session.openWorkspacePath({ path })`。
- 本插件在 `document` 的**捕获阶段**监听 `click`：命中 `[data-presented-file]` 卡片、
  且不是点在卡片右下角的动作按钮上时 → `preventDefault()` 掉原来的预览 →
  改调 `session.openWorkspacePath`。

## 保留原来的行为

**按住 Shift（或 Ctrl / Alt / Cmd）点卡片**，仍然走 DSH 内置的侧边栏预览。

## 安装

这是一个标准的 DSH 插件包（`dsh.bundle.patch` + `dsh.client`）：

```sh
dsh plugin --profile desktop add dsh-open-native
# 或者用本地打包好的文件：
dsh plugin --profile desktop add file:/绝对路径/dsh-open-native-1.1.0.tgz
```

装完在 DSH 可视化页面的「插件」面板里就能看到它（标题「原生打开」，带图标），
可随时启用/停用。

## 包装内容

| 文件 | 作用 |
|---|---|
| `lib/index.js` | 宿主半区：不注册任何服务，只为让 bundle 能被加载 |
| `lib/client.js` | 客户端半区：捕获阶段的点击拦截，真正干活的部分 |
| `cordis.patch.yml` | bundle 补丁，把本插件挂进 profile |
| `icon.svg` | 插件面板里的图标（`package.json` 的 `icon` 字段） |
| `locale/en.json`、`locale/zh.json`、`locale/zh-CN.json` | 面板里显示的名称与描述 |

`package.json` 里的 `dsh.engines.dsh` 声明了适用的 DSH 版本（`>=0.2.0-rc.2`），
是给插件市场做兼容判断用的元数据。

## 排错

按 F12 打开开发者工具，看 Console 里有没有 `[dsh-open-native]` 开头的警告：

- `宿主没有受理原生打开` → 宿主拒绝了这次调用（路径不在会话工作区内，或宿主没装
  原生打开能力）。
- 什么都没打出来 → 说明点击没被识别成卡片，多半是 DSH 改了卡片的 DOM 结构
  （见下）。

## 它可能在什么时候坏

插件靠两个 DOM 特征认卡片，DSH 大版本更新后可能要跟着调：

- 卡片容器：`[data-presented-file]`
- 预览按钮：`button` 的 class 里含 `cardPreview`

两处都在 `lib/client.js` 顶部的常量里。改完记得重新打包并向 profile 重装一次。

第二条有退路：类名对不上时，插件会退回「卡片里第一个 `title` 是绝对路径的按钮」，
所以 DSH 单纯重命名 CSS module 不会让它整个失效——**真正会一击致命的是卡片容器标记**。
另外路径必须长得像绝对路径（`C:\`、`\\`、`/` 开头）才会被打开，避免把 `title`
上的普通文案当成路径去调宿主。

## 版本

- **1.1.0** — 预览按钮识别加了退路；路径改为从「这一下真正点到的按钮」上取，
  卡片里出现多个文件时不会认错。
- **1.0.0** — 首个版本。
