# MouseClick

Windows 鼠标动作录制 / 回放工具（Tauri 2 + React + MUI）。

## 功能

### 录制
- 全局录制：轨迹、单击/双击、右键、中键、侧键、滚轮
- **覆盖 / 追加** 两种录制模式
- **录制倒计时**（0–10 秒）
- **暂停 / 继续** 录制（F11）
- 停止后可选 **自动保存**

### 播放
- 按时间轴回放，支持 **循环次数 / 无限循环**
- **播放速度** 0.25× – 4×
- **播放前延迟**、**循环间隔**
- 播放进度与当前循环显示

### 宏管理
- 多宏列表：新建、重命名、**复制**、删除
- 打开 / 保存 / 另存为 `*.mouseclick.json`
- **最近打开** 文件列表

### 事件编辑
- 删除单条事件、**插入延迟**、清空
- **撤销 / 重做**
- **隐藏移动事件**（精简视图）
- 宏统计：时长、移动/点击/滚轮数量

### 快捷键（可自定义）
| 默认键 | 功能 |
| --- | --- |
| F9 | 开始录制 |
| F10 | 停止录制 |
| F11 | 暂停 / 继续录制 |
| F8 | 播放 / 停止 |
| Esc | **紧急停止**（录制与播放） |

### 其他
- **系统托盘**：可在设置中开启「关闭窗口时最小化到托盘」；关闭时默认直接退出
- **单实例运行**：不允许同时打开多个窗口，重复启动会聚焦已有窗口并提示
- 管理员权限运行（UAC），便于全局输入注入
- 设置持久化到本地

## 环境要求

- Windows 10/11
- [Node.js LTS](https://nodejs.org/)
- [Rust](https://rustup.rs/) stable
- Visual Studio **使用 C++ 的桌面开发** 工作负载
- WebView2 Runtime（通常已自带）

## 开发运行

```powershell
cd D:\MouseClick
npm install
npm run tauri dev
```

## 生产构建

```powershell
npm run tauri build
```

产物：`src-tauri\target\release\mouse-click.exe`  
安装包：`src-tauri\target\release\bundle\`

## 发布到 GitHub Release

项目已配置 [`.github/workflows/release.yml`](.github/workflows/release.yml)：推送 `v*` 标签后，GitHub Actions 会自动在 Windows 上构建，并把 **exe / msi / setup.exe** 上传到对应 Release。

### 首次上传代码

```powershell
cd D:\MouseClick
git init
git add .
git commit -m "Initial commit: MouseClick"
git branch -M main
git remote add origin https://github.com/Leeable/-.git
git push -u origin main
```

> 建议将 GitHub 仓库名从 `-` 改为 `MouseClick`，URL 会更清晰。

### 创建 Release（自动构建并上传安装包）

1. 在 `src-tauri/tauri.conf.json` 中更新 `version`（如 `0.1.0` → `0.2.0`）
2. 提交并推送代码
3. 打标签并推送：

```powershell
git add .
git commit -m "chore: bump version to 0.1.0"
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

4. 打开 GitHub 仓库 → **Actions**，等待 `Release` 工作流完成
5. 打开 **Releases** 页面，即可看到自动上传的：
   - `MouseClick_*_x64-setup.exe`
   - `MouseClick_*_x64_en-US.msi`
   - `mouse-click.exe`

标签名必须与 `v` 开头（如 `v0.1.0`），才会触发构建。

## 宏文件格式

```json
{
  "version": 1,
  "name": "宏 1",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "events": [
    { "t": 0, "type": "move", "x": 100, "y": 200 },
    { "t": 50, "type": "down", "button": "left", "x": 100, "y": 200 },
    { "t": 120, "type": "up", "button": "left", "x": 100, "y": 200 },
    { "t": 500, "type": "delay", "ms": 380 }
  ],
  "loop": { "mode": "count", "count": 1 }
}
```

## 使用建议

1. 首次运行允许 UAC 提权
2. 录制前在 **设置 → 录制** 选择覆盖或追加，配置倒计时
3. 尽量用 **F9/F10** 控制录制，避免把 UI 点击录进去
4. 播放前在 **设置 → 播放** 调整速度与延迟
5. 遇到异常按 **Esc** 紧急停止
