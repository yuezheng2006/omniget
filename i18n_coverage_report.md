# OmniGet 多语言覆盖检查报告

**检查时间**: 2026-06-19  
**上游版本**: v0.7.0  
**检查范围**: 全部 10 种语言，共 3424 个翻译键

---

## 📊 统计摘要

| 语言 | 覆盖率 | 已翻译 | 待翻译 | 状态 |
|------|--------|--------|--------|------|
| **ru** (俄语) | 95.71% | 3277/3424 | 147 | ✅ 优秀 |
| **pt** (葡萄牙语) | 90.36% | 3094/3424 | 330 | ✅ 良好 |
| **es** (西班牙语) | 86.01% | 2945/3424 | 479 | ✅ 良好 |
| **zh** (简体中文) | 53.48% | 1831/3424 | **1593** | ⚠️ 需要改进 |
| **zh-TW** (繁体中文) | 53.39% | 1828/3424 | 1596 | ⚠️ 需要改进 |
| **ja** (日语) | 53.27% | 1824/3424 | 1600 | ⚠️ 需要改进 |
| **el** (希腊语) | 52.45% | 1796/3424 | 1628 | ⚠️ 需要改进 |
| **it** (意大利语) | 51.55% | 1765/3424 | 1659 | ⚠️ 需要改进 |
| **fr** (法语) | 50.88% | 1742/3424 | 1682 | ⚠️ 需要改进 |
| **en** (英语) | 0.23% | 8/3424 | 3416 | ⚠️ 基准语言 |

---

## 🎯 中文 (zh) 详细分析

### 待翻译模块分布

| 模块 | 待翻译数量 | 优先级 |
|------|-----------|--------|
| **study** (学习模式) | 1392 | 🔴 高 - 新功能 |
| **settings** (设置) | 127 | 🔴 高 - 核心功能 |
| **downloads** (下载) | 18 | 🔴 高 - 核心功能 |
| **command_palette** (命令面板) | 11 | 🟡 中 - 新功能 |
| **platforms** (平台) | 9 | 🟡 中 |
| **omnibox** (输入框) | 6 | 🔴 高 - 核心功能 |
| **nav** (导航) | 5 | 🟡 中 |
| **home** (首页) | 5 | 🔴 高 - 核心功能 |
| 其他模块 | 20 | 🟢 低 |

---

## 🔥 高优先级待翻译列表

### 1. 命令面板 (command_palette) - 11 项

```json
{
  "command_palette.open": "Search",  // 建议: "搜索"
  "command_palette.placeholder": "Go to page or run an action…",  // 建议: "跳转页面或执行操作…"
  "command_palette.empty": "No results",  // 建议: "无结果"
  "command_palette.navigate": "navigate",  // 建议: "导航"
  "command_palette.select": "select",  // 建议: "选择"
  "command_palette.close": "close",  // 建议: "关闭"
  "command_palette.group_nav": "Navigate",  // 建议: "导航"
  "command_palette.group_action": "Actions",  // 建议: "操作"
  "command_palette.action_paste": "Paste URL from clipboard",  // 建议: "从剪贴板粘贴链接"
  "command_palette.action_downloads": "Open downloads",  // 建议: "打开下载列表"
  "command_palette.action_settings": "Open settings"  // 建议: "打开设置"
}
```

### 2. 首页 (home) - 5 项

```json
{
  "home.mode_url": "URL",  // 建议: "链接"
  "home.mode_batch": "Batch",  // 建议: "批量"
  "home.mode_torrent": "Torrent",  // 建议: "种子"
  "home.mode_p2p": "P2P",  // 保持原样
  "home.inspector_title": "Download options"  // 建议: "下载选项"
}
```

### 3. 下载页面 (downloads) - 关键 18 项

```json
{
  "downloads.clear_confirm": "Clear all finished downloads?",  // 建议: "清除所有已完成的下载？"
  "downloads.open_in_study": "Watch in Study",  // 建议: "在学习模式中观看"
  "downloads.sw.save_ass": "Save .ass",  // 建议: "保存 .ass 文件"
  "downloads.sw.autofix": "Auto-fix issues",  // 建议: "自动修复问题"
  "downloads.sw.grammar": "AI grammar fix",  // 建议: "AI 语法修复"
  "downloads.sw.twopoint": "Two-point sync"  // 建议: "双点时间轴同步"
}
```

### 4. 设置页面 (settings) - 核心 127 项

**输出设置 (Output):**
```json
{
  "settings.download.section_output": "Output",  // 建议: "输出"
  "settings.download.section_output_desc": "Where files are saved and how they are named.",  // 建议: "文件保存位置和命名方式"
  "settings.download.always_ask_path_desc": "Show a save dialog for every download."  // 建议: "每次下载都显示保存对话框"
}
```

**质量设置 (Quality):**
```json
{
  "settings.download.section_quality": "Quality & format",  // 建议: "质量和格式"
  "settings.download.section_quality_desc": "Default video quality and yt-dlp presets.",  // 建议: "默认视频质量和 yt-dlp 预设"
  "settings.download.video_quality_desc": "Default quality when you don't pick one in the omnibox."  // 建议: "未在输入框选择质量时的默认值"
}
```

**字幕设置 (Subtitles):**
```json
{
  "settings.download.section_subtitles": "Subtitles & extras",  // 建议: "字幕和附加内容"
  "settings.download.section_subtitles_desc": "Subtitles, thumbnails, and metadata saved alongside media."  // 建议: "与媒体一同保存的字幕、缩略图和元数据"
}
```

**剪贴板和快捷键 (Clipboard & Hotkeys):**
```json
{
  "settings.download.section_clipboard_hotkeys": "Clipboard & hotkeys",  // 建议: "剪贴板和快捷键"
  "settings.download.section_clipboard_hotkeys_desc": "Paste detection and global shortcuts."  // 建议: "粘贴检测和全局快捷键"
}
```

**平台特定设置 (Per-platform):**
```json
{
  "settings.download.section_per_platform": "Per-platform options",  // 建议: "平台特定选项"
  "settings.download.section_per_platform_desc": "YouTube, courses, and Bilibili-specific settings."  // 建议: "YouTube、课程和 Bilibili 的专属设置"
}
```

---

## 📋 建议行动计划

### 第一阶段：核心功能 (优先级：🔴 高)
1. **命令面板** (11 项) - 新增功能，用户常用
2. **首页模式** (5 项) - 首屏体验
3. **下载管理** (18 项) - 核心功能
4. **输入框** (6 项) - 用户交互入口
5. **设置页面核心部分** (~50 项) - 用户配置必需

**预计工作量**: 2-3 小时

### 第二阶段：设置和平台 (优先级：🟡 中)
1. **设置页面完整翻译** (剩余 77 项)
2. **导航和平台** (14 项)
3. **学习模式关键功能** (精选 50 项)

**预计工作量**: 3-4 小时

### 第三阶段：学习模式 (优先级：🟢 低)
1. **学习模式完整翻译** (1392 项) - 新增高级功能，使用率较低

**预计工作量**: 8-10 小时

---

## 🚀 快速修复建议

考虑到默认语言是中文 (zh)，建议：

1. **立即修复**: 先完成第一阶段的核心功能翻译 (~90 项)
2. **渐进改进**: 分批完成设置页面翻译
3. **长期规划**: 学习模式可以作为后续版本逐步完善

---

## 📝 备注

- **俄语 (ru)** 覆盖率最高 (95.71%)，可作为参考
- **study 模块** 是 v0.7.0 新增的大型功能，包含音乐播放器和阅读器
- 建议建立翻译工作流程，避免未来版本再次出现大量未翻译内容
