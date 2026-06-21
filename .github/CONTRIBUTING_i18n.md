# 翻译贡献指南 (i18n Contributing Guide)

感谢您为 OmniGet 的国际化做出贡献！本指南将帮助您了解如何参与翻译工作。

## 📋 目录

- [当前翻译状态](#当前翻译状态)
- [如何贡献翻译](#如何贡献翻译)
- [翻译规范](#翻译规范)
- [翻译工具](#翻译工具)
- [常见问题](#常见问题)

---

## 🌍 当前翻译状态

| 语言 | 代码 | 覆盖率 | 状态 | 维护者 |
|------|------|--------|------|--------|
| 俄语 | ru | 95.71% | ✅ 优秀 | - |
| 葡萄牙语 | pt | 90.36% | ✅ 良好 | - |
| 西班牙语 | es | 86.01% | ✅ 良好 | - |
| 简体中文 | zh | 55.00% | ⚠️ 需要改进 | - |
| 繁体中文 | zh-TW | 53.39% | ⚠️ 需要改进 | - |
| 日语 | ja | 53.27% | ⚠️ 需要改进 | - |
| 希腊语 | el | 52.45% | ⚠️ 需要改进 | - |
| 意大利语 | it | 51.55% | ⚠️ 需要改进 | - |
| 法语 | fr | 50.88% | ⚠️ 需要改进 | - |
| 英语 | en | 0.23% | 🔵 基准语言 | - |

*最后更新: 2026-06-19*

---

## 🚀 如何贡献翻译

### 1. 准备工作

```bash
# Fork 并克隆仓库
git clone https://github.com/YOUR_USERNAME/omniget.git
cd omniget

# 安装依赖
pnpm install

# 创建翻译分支
git checkout -b i18n/improve-zh-translation
```

### 2. 查找需要翻译的内容

**方法一：使用检查脚本**
```bash
node scripts/check-i18n-coverage.cjs zh
```

**方法二：手动查找**
- 翻译文件位置：`src/lib/i18n/{语言代码}.json`
- 基准语言：`src/lib/i18n/en.json`
- 对比英文和目标语言，找出相同的值

### 3. 编辑翻译文件

编辑 `src/lib/i18n/zh.json`（以中文为例）：

```json
{
  "command_palette": {
    "open": "Search",        // ❌ 未翻译
    "placeholder": "搜索"    // ✅ 已翻译
  }
}
```

修改为：

```json
{
  "command_palette": {
    "open": "搜索",
    "placeholder": "搜索"
  }
}
```

### 4. 测试翻译

```bash
# 启动开发服务器
cargo tauri dev

# 在设置中切换到你的翻译语言
# 检查界面显示是否正确
```

### 5. 提交 Pull Request

```bash
git add src/lib/i18n/zh.json
git commit -m "i18n(zh): translate command palette module"
git push origin i18n/improve-zh-translation
```

然后在 GitHub 上创建 Pull Request。

---

## 📖 翻译规范

### 翻译原则

1. **保持一致性**
   - 相同概念使用相同译法
   - 参考已有翻译和术语表

2. **符合目标语言习惯**
   - 使用自然、地道的表达
   - 避免直译导致的生硬

3. **保持简洁**
   - 按钮文字：2-5 个字
   - 标题文字：3-10 个字
   - 描述文字：根据需要

4. **保留技术术语**
   - API、URL、Cookie 等保持原文
   - 品牌名称保持原文（YouTube, Bilibili）

### 占位符规则

翻译中的 `{{variable}}` 是动态占位符，**不要翻译**：

```json
{
  // ✅ 正确
  "install_success": "{{name}} {{version}} 已安装",
  
  // ❌ 错误
  "install_success": "{{名称}} {{版本}} 已安装"
}
```

### 标点符号

- **中文**：使用全角标点（，。！？）
- **英文**：使用半角标点（, . ! ?）
- **省略号**：中文用 `…`，不用 `...`

### 术语表

| 英文 | 中文 | 说明 |
|------|------|------|
| Download | 下载 | |
| Settings | 设置 | |
| Quality | 质量 | |
| Subtitle | 字幕 | |
| Cookie | Cookie | 保留原文 |
| Plugin | 插件 | |
| Output | 输出 | |
| Format | 格式 | |
| Hotkey | 快捷键 | |
| Clipboard | 剪贴板 | |

---

## 🛠 翻译工具

### 自动化脚本

项目提供了辅助脚本（位于 `scripts/` 目录）：

```bash
# 检查翻译覆盖率
node scripts/check-i18n-coverage.js zh

# 查找缺失的翻译
node scripts/find-missing-translations.js zh

# 生成翻译报告
node scripts/generate-i18n-report.js
```

### VS Code 扩展推荐

安装 **i18n Ally** 扩展，可以：
- 实时查看翻译覆盖率
- 在代码中高亮显示翻译键
- 快速跳转到翻译文件

```json
// .vscode/settings.json
{
  "i18n-ally.localesPaths": ["src/lib/i18n"],
  "i18n-ally.keystyle": "nested",
  "i18n-ally.sourceLanguage": "en"
}
```

---

## 🎯 优先级指南

### 高优先级（核心功能）

必须先翻译这些模块，它们直接影响用户体验：

1. **命令面板** (`command_palette`) - 搜索和快速操作
2. **首页** (`home`) - 用户入口
3. **下载管理** (`downloads`) - 核心功能
4. **设置页面** (`settings`) - 用户配置
5. **输入框** (`omnibox`) - 主要交互
6. **导航** (`nav`) - 页面导航

### 中优先级

7. **错误消息** (`errors`) - 问题排查
8. **通用按钮** (`common`) - 通用交互
9. **平台名称** (`platforms`) - 平台显示
10. **提示信息** (`hints`) - 用户引导

### 低优先级（高级功能）

11. **学习模式** (`study`) - 音乐和阅读器（1392 项）
12. **课程平台** (`courses`, `hotmart`, `udemy`)
13. **调试信息** (`debug`)
14. **关于页面** (`about`)

---

## ❓ 常见问题

### Q: 为什么英语 (en) 的覆盖率只有 0.23%？

A: 英语是基准语言，大部分键的"翻译"就是键本身，所以覆盖率统计显示很低。这是正常的。

### Q: 我可以修改已有的翻译吗？

A: 可以！如果您发现翻译不准确或不自然，欢迎提出改进。请在 PR 中说明修改原因。

### Q: 翻译文件很大，我应该全部翻译吗？

A: 不需要。建议按模块逐步翻译。参考"优先级指南"，先完成核心功能。

### Q: 如何处理复数形式？

A: 使用占位符和描述性文字：

```json
{
  // 英文
  "items_count": "{{count}} item(s)",
  
  // 中文（中文无复数变化）
  "items_count": "{{count}} 个项目"
}
```

### Q: 我的语言不在列表中，如何添加？

A: 请先创建 Issue 讨论，然后：

1. 复制 `src/lib/i18n/en.json` 为 `{语言代码}.json`
2. 在 `src/lib/i18n/index.ts` 添加 loader
3. 完成至少 60% 的核心翻译
4. 提交 PR

### Q: 如何测试不同长度的文本是否会破坏布局？

A: 在浏览器开发者工具中切换不同语言，检查：
- 按钮是否换行
- 文本是否溢出
- 对话框是否变形

---

## 📞 联系方式

- **Issues**: [GitHub Issues](https://github.com/tonhowtf/omniget/issues)
- **Discussions**: [GitHub Discussions](https://github.com/tonhowtf/omniget/discussions)
- **翻译问题标签**: 使用 `i18n` 标签

---

## 🙏 致谢

感谢所有翻译贡献者！您的工作让 OmniGet 能够服务全球用户。

**当前贡献者名单**：
- 待补充...

---

**最后更新**: 2026-06-19  
**维护者**: OmniGet Team
