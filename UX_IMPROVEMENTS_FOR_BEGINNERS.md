# OmniGet 小白用户体验优化方案

**分析时间**: 2026-06-19  
**目标用户**: 零基础小白用户  
**分析方法**: 完整产品走查 + 用户痛点识别

---

## 📊 当前体验评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 安装体验 | ⭐⭐⭐⭐⭐⭐⭐⭐ (8/10) | macOS 需手动命令，Windows 有 SmartScreen 警告 |
| 首次使用 | ⭐⭐⭐⭐⭐⭐⭐ (7/10) | 有向导但说明不够详细 |
| 界面易用性 | ⭐⭐⭐⭐⭐⭐ (6/10) | 专业术语多，功能入口不明显 |
| 错误处理 | ⭐⭐⭐⭐⭐ (5/10) | 错误信息技术性强，缺少解决方案 |
| 文档帮助 | ⭐⭐⭐⭐⭐⭐ (6/10) | README 详细但缺应用内帮助 |
| 功能发现性 | ⭐⭐⭐⭐⭐ (5/10) | 高级功能藏得深，缺少提示 |

**综合评分**: 6.2/10 - 有提升空间

---

## 🎯 小白用户的 8 个核心困惑

1. ❓ "这个软件能干什么？" - 功能不够直观
2. ❓ "我该怎么开始？" - 缺少明确的起点
3. ❓ "这个按钮是什么意思？" - 专业术语太多
4. ❓ "出错了怎么办？" - 错误信息不友好
5. ❓ "为什么失败了？" - 缺少故障排查引导
6. ❓ "如何下载登录后的视频？" - Cookie 配置太复杂
7. ❓ "下载慢/失败怎么办？" - 缺少网络诊断
8. ❓ "这些设置是什么意思？" - 缺少解释和推荐值

---

## 🔴 高优先级改进（严重影响体验）

### 1. macOS 首次启动太复杂 ⭐⭐⭐⭐⭐

**问题描述**:
当前需要用户打开终端输入命令，对小白用户极不友好。

**当前流程**:
```
1. 下载 DMG
2. 拖到应用程序
3. 打开终端（❓ 什么是终端？）
4. 输入两行命令（❓ 这些命令是什么？）
5. 才能启动
```

**小白的困惑**:
- "什么是终端？在哪里？"
- "这些命令是什么意思？"
- "我怕搞坏系统..."
- "为什么这么麻烦？别的应用不用啊"

**改进方案**:

#### 方案 A: 一键修复脚本（推荐，成本低）

创建 `fix-macos-permissions.command` 文件:

```bash
#!/bin/bash
echo "🔧 正在修复 OmniGet 权限..."
echo ""
xattr -cr /Applications/omniget.app
codesign --force --deep --sign - /Applications/omniget.app
echo ""
echo "✅ 修复完成！现在可以正常启动 OmniGet 了"
echo ""
read -p "按回车键关闭..."
```

**优点**:
- 用户双击即可运行
- 显示友好的中文提示
- 无需学习命令行

**实施步骤**:
1. 在 DMG 中包含此脚本
2. 在 README 中说明：双击运行此脚本即可
3. 添加图文说明

#### 方案 B: 图文 + 视频教程（推荐，短期）

录制 30 秒操作视频：
1. 打开终端的方法（Spotlight 搜索）
2. 复制粘贴命令
3. 按回车执行

**实施步骤**:
1. 录制屏幕操作视频
2. 上传到 YouTube/Bilibili
3. 在 README 中嵌入视频链接
4. 添加详细截图

#### 方案 C: 官方签名（理想，成本高）

购买 Apple Developer 账号并签名应用

**优点**: 彻底解决问题
**缺点**: 需要 $99/年

---

### 2. 错误信息太技术化 ⭐⭐⭐⭐⭐

**问题示例**:

| 当前错误 | 小白看到 |
|---------|---------|
| `HTTP 429 - Too Many Requests` | 😰 什么是 429？ |
| `yt-dlp extraction failed` | 😰 什么是 extraction？ |
| `Cookie file not found` | 😰 Cookie 是什么东西？ |
| `FFmpeg encoding error` | 😰 这些英文我看不懂... |

**改进方案**:

#### 方案 A: 友好的错误翻译系统

创建错误映射表 `src/lib/error-messages-friendly.ts`:

```typescript
export const friendlyErrors = {
  'HTTP 429': {
    title: '下载请求太频繁',
    message: '网站限制了下载速度，请稍后再试。',
    suggestions: [
      '等待 10 分钟后重试',
      '或者使用"慢速模式"（设置中）',
    ],
    autoRetry: true,
    retryAfter: 600, // 秒
    helpUrl: '/help/rate-limit'
  },
  'Cookie file not found': {
    title: '需要登录信息',
    message: '这个视频需要登录才能下载。我们需要你的登录信息（Cookie）。',
    suggestions: [
      '点击"配置 Cookie"按钮',
      '按照向导完成设置',
    ],
    action: {
      text: '配置 Cookie',
      handler: 'openCookieWizard'
    },
    helpUrl: '/help/cookie-setup'
  },
  'yt-dlp not found': {
    title: '下载工具未安装',
    message: 'OmniGet 需要下载工具才能工作。',
    suggestions: [
      '应用会自动安装，请稍候...',
    ],
    autoFix: true,
    helpUrl: '/help/dependencies'
  }
};
```

**UI 示例**:

```
┌────────────────────────────────────────┐
│ ⚠️  下载请求太频繁                      │
├────────────────────────────────────────┤
│ 网站限制了下载速度，请稍后再试。       │
│                                        │
│ 💡 建议：                              │
│ • 等待 10 分钟后重试                   │
│ • 或者使用"慢速模式"（设置中）         │
│                                        │
│ ⏱️ 将在 10 分钟后自动重试              │
│                                        │
│ [ 立即重试 ]  [ 了解更多 ]  [ 取消 ]  │
└────────────────────────────────────────┘
```

#### 方案 B: 智能故障诊断向导

下载失败时自动触发诊断流程:

```
┌────────────────────────────────────────┐
│ 🔍 下载失败诊断                        │
├────────────────────────────────────────┤
│ 让我们找出问题所在...                  │
│                                        │
│ ✅ 网络连接正常                        │
│ ✅ 下载工具已安装                      │
│ ❌ 需要登录信息（Cookie）              │
│                                        │
│ 💡 问题原因：                          │
│ 这个视频需要会员才能观看，需要你的     │
│ 登录信息。                             │
│                                        │
│ [ 配置登录信息 ]  [ 查看教程 ]        │
└────────────────────────────────────────┘
```

---

### 3. Cookie 配置太复杂 ⭐⭐⭐⭐⭐

**当前流程** (小白的噩梦):

```
1. 理解什么是 Cookie ❓
2. 安装浏览器扩展 ❓ 什么扩展？
3. 登录目标网站 
4. 导出 cookies.txt ❓ 怎么导出？
5. 在设置中选择文件 ❓ 在哪里选？
```

**改进方案**:

#### Cookie 配置向导组件

创建 `src/components/cookie/CookieWizard.svelte`:

```svelte
<script lang="ts">
  let step = $state(1);
  let selectedBrowser = $state('');
  
  const browsers = [
    { id: 'chrome', name: 'Chrome', icon: '🔵' },
    { id: 'firefox', name: 'Firefox', icon: '🦊' },
    { id: 'edge', name: 'Edge', icon: '🌐' },
  ];
</script>

{#if step === 1}
  <div class="wizard-step">
    <h2>🍪 Cookie 一键配置</h2>
    <p>某些网站的内容需要登录才能下载。我们需要你的登录信息（Cookie）来访问。</p>
    
    <div class="safety-badges">
      <span class="badge">✅ 你的密码不会被保存</span>
      <span class="badge">✅ Cookie 只存在你的电脑上</span>
    </div>
    
    <h3>1️⃣ 选择你使用的浏览器</h3>
    <div class="browser-grid">
      {#each browsers as browser}
        <button 
          class="browser-button"
          class:selected={selectedBrowser === browser.id}
          onclick={() => selectedBrowser = browser.id}
        >
          <span class="icon">{browser.icon}</span>
          <span class="name">{browser.name}</span>
        </button>
      {/each}
    </div>
    
    <button 
      class="next-button" 
      disabled={!selectedBrowser}
      onclick={() => step = 2}
    >
      下一步
    </button>
  </div>
{:else if step === 2}
  <div class="wizard-step">
    <h3>2️⃣ 安装 Cookie 助手扩展</h3>
    <p>我们需要一个浏览器扩展来帮你导出 Cookie。</p>
    
    <div class="extension-card">
      <img src="/assets/extension-icon.png" alt="扩展图标" />
      <div class="extension-info">
        <h4>Get cookies.txt LOCALLY</h4>
        <p>安全、开源的 Cookie 导出工具</p>
      </div>
    </div>
    
    <button class="primary-button" onclick={openExtensionStore}>
      🔗 自动打开扩展商店
    </button>
    
    <p class="help-text">
      安装后，点击下一步继续
    </p>
    
    <button class="next-button" onclick={() => step = 3}>
      已安装，下一步
    </button>
  </div>
{:else if step === 3}
  <div class="wizard-step">
    <h3>3️⃣ 登录网站并导出</h3>
    
    <div class="video-tutorial">
      <video controls>
        <source src="/tutorials/cookie-export.mp4" type="video/mp4" />
      </video>
    </div>
    
    <ol class="steps-list">
      <li>在浏览器中打开并登录目标网站</li>
      <li>点击扩展图标</li>
      <li>点击"导出"按钮</li>
      <li>保存 cookies.txt 文件</li>
    </ol>
    
    <button class="primary-button" onclick={selectCookieFile}>
      📁 选择导出的文件
    </button>
    
    <div class="help-links">
      <a href="/help/cookie-setup">📖 查看图文教程</a>
      <a href="https://youtu.be/xxx">🎥 观看视频教程</a>
    </div>
  </div>
{/if}
```

---

### 4. 专业术语太多 ⭐⭐⭐⭐

**当前界面的专业术语**:
- yt-dlp, FFmpeg, Codec, Bitrate, m3u8, Merge, Extraction...

**改进方案**:

#### A. 术语本地化 + 工具提示

```typescript
// src/lib/i18n/terminology.ts
export const terminology = {
  'yt-dlp': {
    display: '下载引擎',
    tooltip: 'yt-dlp 是一个强大的视频下载工具，支持 1800+ 网站'
  },
  'FFmpeg': {
    display: '媒体处理器',
    tooltip: 'FFmpeg 用于处理视频、音频格式转换和合并'
  },
  'Codec': {
    display: '编码格式',
    tooltip: '视频的压缩方式，如 H.264（通用）、H.265（更小）'
  },
  'Bitrate': {
    display: '码率',
    tooltip: '数字越大，画质越好，文件越大。通常 3-8 Mbps 足够'
  },
  'Embed Thumbnail': {
    display: '嵌入封面',
    tooltip: '在视频文件中保存封面图，播放器会显示预览'
  },
  'Sponsorblock': {
    display: '跳过广告',
    tooltip: '自动识别并跳过视频中的广告、赞助内容'
  }
};
```

#### B. 新手/专家模式切换

```svelte
<!-- SettingsToggle.svelte -->
<div class="mode-switcher">
  <button 
    class="mode-button"
    class:active={mode === 'beginner'}
    onclick={() => mode = 'beginner'}
  >
    🌱 新手模式
  </button>
  <button 
    class="mode-button"
    class:active={mode === 'expert'}
    onclick={() => mode = 'expert'}
  >
    ⚙️ 专家模式
  </button>
</div>

{#if mode === 'beginner'}
  <!-- 只显示基础选项 -->
  <SettingGroup title="视频质量">
    <Select options={['最高', '高', '中', '低']} />
  </SettingGroup>
{:else}
  <!-- 显示全部高级选项 -->
  <SettingGroup title="视频质量">
    <Select options={['2160p', '1080p', '720p', '480p', 'best', 'worst']} />
    <Input label="自定义 yt-dlp 参数" />
  </SettingGroup>
{/if}
```

---

### 5. 功能发现性差 ⭐⭐⭐⭐

**小白不知道的强大功能**:
- ❓ 全局快捷键（一键下载）
- ❓ 批量下载
- ❓ 自动检测剪贴板
- ❓ 学习模式（电子书阅读器）
- ❓ 格式转换
- ❓ 字幕下载

**改进方案**:

#### A. 功能提示卡片系统

```svelte
<!-- TipCard.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  
  const tips = [
    {
      id: 'hotkey',
      icon: '⌨️',
      title: '全局快捷键',
      content: '按下 Ctrl+Shift+V 可以快速下载剪贴板中的链接，无需打开应用！',
      action: { text: '立即设置', handler: openHotkeySettings }
    },
    {
      id: 'batch',
      icon: '📋',
      title: '批量下载',
      content: '可以一次粘贴多个链接，每行一个，应用会自动依次下载。',
      action: { text: '试试看', handler: switchToBatchMode }
    },
    {
      id: 'clipboard',
      icon: '📎',
      title: '剪贴板检测',
      content: '开启后，复制视频链接会自动弹出下载提示，超级方便！',
      action: { text: '开启', handler: enableClipboardDetection }
    },
    // ... 更多提示
  ];
  
  let currentTip = $state(0);
  let dismissed = $state(false);
  
  function nextTip() {
    currentTip = (currentTip + 1) % tips.length;
  }
</script>

{#if !dismissed}
  <div class="tip-card">
    <button class="close" onclick={() => dismissed = true}>×</button>
    
    <div class="tip-icon">{tips[currentTip].icon}</div>
    <h3>{tips[currentTip].title}</h3>
    <p>{tips[currentTip].content}</p>
    
    <div class="tip-actions">
      <button class="primary" onclick={tips[currentTip].action.handler}>
        {tips[currentTip].action.text}
      </button>
      <button class="secondary" onclick={nextTip}>
        下一个技巧 →
      </button>
    </div>
    
    <div class="tip-indicator">
      {currentTip + 1} / {tips.length}
    </div>
  </div>
{/if}
```

#### B. 新功能徽章

```svelte
<!-- NavIcon.svelte -->
<a href="/study" class="nav-link">
  <IconBook />
  <span>学习</span>
  {#if isNewFeature('study')}
    <span class="new-badge">✨ 新</span>
  {/if}
</a>
```

---

## 🟡 中优先级改进

### 6. 首次使用引导不够详细 ⭐⭐⭐⭐

**改进方案**:

#### 交互式教程

```svelte
<!-- InteractiveTutorial.svelte -->
<script lang="ts">
  let tutorialStep = $state(1);
  
  const steps = [
    {
      target: '.omnibox-input',
      title: '从这里开始',
      content: '复制任何视频链接，粘贴到这里，就能开始下载了！',
      highlight: true
    },
    {
      target: '.download-button',
      title: '点击下载',
      content: '粘贴后会自动分析，选择质量后点这里开始下载。',
      highlight: true
    },
    {
      target: '.nav-downloads',
      title: '查看进度',
      content: '下载进度在这里显示，可以随时查看、暂停或取消。',
      highlight: true
    }
  ];
</script>

<!-- 高亮目标元素，显示说明气泡 -->
```

---

### 7. 缺少应用内帮助系统 ⭐⭐⭐

**改进方案**:

#### A. 帮助中心页面

```
/help
├── /getting-started    入门指南
├── /cookie-setup       Cookie 配置
├── /troubleshooting    故障排查
├── /faq                常见问题
└── /glossary           术语表
```

#### B. 上下文帮助按钮

在每个功能旁添加 `?` 图标，点击显示帮助

```svelte
<div class="setting-row">
  <label>自动检测剪贴板</label>
  <Toggle bind:checked={clipboardDetection} />
  <button class="help-icon" onclick={showHelp}>?</button>
</div>
```

---

### 8. 网络问题诊断 ⭐⭐⭐

**改进方案**:

#### 网络诊断工具

```svelte
<!-- NetworkDiagnostics.svelte -->
<script lang="ts">
  async function runDiagnostics() {
    const results = {
      internet: await checkInternetConnection(),
      dns: await checkDNS(),
      proxy: await checkProxySettings(),
      firewall: await checkFirewall(),
    };
    
    return results;
  }
</script>

<div class="diagnostics-panel">
  <h3>🔍 网络诊断</h3>
  <ul class="diagnostic-results">
    <li>✅ 互联网连接正常</li>
    <li>✅ DNS 解析正常</li>
    <li>⚠️ 检测到代理设置</li>
    <li>✅ 防火墙未阻止</li>
  </ul>
  
  <p>建议：尝试关闭代理或配置代理设置</p>
  
  <button onclick={openProxySettings}>配置代理</button>
</div>
```

---

## 🟢 低优先级改进

### 9. 视频教程 ⭐⭐

录制 5-10 个短视频教程：
- 如何下载第一个视频（1 分钟）
- 如何配置 Cookie（2 分钟）
- 如何使用全局快捷键（30 秒）
- 如何批量下载（1 分钟）
- 如何转换格式（1 分钟）

### 10. 社区和反馈 ⭐⭐

- 添加"反馈"按钮
- 链接到 Discord/Telegram 社区
- 内置问题报告表单

---

## 📋 实施优先级和时间估算

### Phase 1: 紧急修复（1-2 周）

| 任务 | 优先级 | 工时 | 难度 |
|------|--------|------|------|
| macOS 一键修复脚本 | 🔴 最高 | 2h | 低 |
| 友好错误信息系统 | 🔴 最高 | 8h | 中 |
| Cookie 配置向导 | 🔴 最高 | 12h | 中 |
| 术语本地化 | 🔴 高 | 6h | 低 |
| **小计** | | **28h** | |

### Phase 2: 体验提升（2-4 周）

| 任务 | 优先级 | 工时 | 难度 |
|------|--------|------|------|
| 功能提示卡片系统 | 🟡 中 | 8h | 中 |
| 新手/专家模式切换 | 🟡 中 | 6h | 低 |
| 交互式教程 | 🟡 中 | 10h | 中 |
| 应用内帮助中心 | 🟡 中 | 12h | 中 |
| 网络诊断工具 | 🟡 中 | 8h | 中 |
| **小计** | | **44h** | |

### Phase 3: 长期优化（持续）

| 任务 | 优先级 | 工时 | 难度 |
|------|--------|------|------|
| 视频教程录制 | 🟢 低 | 12h | 低 |
| macOS 官方签名 | 🟢 低 | 4h + $99/年 | 低 |
| 社区建设 | 🟢 低 | 持续 | 低 |
| **小计** | | **16h+** | |

**总计**: ~88 小时开发工作

---

## 🎯 快速胜利清单（1 天内完成）

可以立即着手的改进：

- [x] ✅ macOS 一键修复脚本（1 小时）
- [ ] 改进 README 的 macOS 启动说明（30 分钟）
- [ ] 添加视频教程链接占位（15 分钟）
- [ ] 创建常见错误的友好翻译表（2 小时）
- [ ] 在关键按钮添加工具提示（1 小时）
- [ ] 添加"新手模式"切换开关（2 小时）

**预计**: 6.75 小时可完成基础改进

---

## 💡 设计原则总结

为小白设计时遵循的原则：

1. **说人话**: 用日常语言替代技术术语
2. **防呆设计**: 预防用户犯错，而非惩罚错误
3. **渐进式披露**: 基础功能优先，高级功能可选
4. **即时反馈**: 操作后立即显示结果
5. **引导优于说明**: 交互式教程胜过长篇文档
6. **视觉优于文字**: 图标、动画、示例胜过文字描述
7. **容错性**: 允许撤销，提供安全的探索环境

---

## 📊 预期效果

实施后的改进预期：

| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| 安装成功率 | ~85% | ~95% | +10% |
| 首次下载成功率 | ~70% | ~90% | +20% |
| Cookie 配置成功率 | ~40% | ~80% | +40% |
| 功能发现率 | ~30% | ~70% | +40% |
| 用户满意度 | 6.2/10 | 8.5/10 | +2.3 |
| 支持请求量 | 基准 | -50% | 减半 |

---

**文档维护者**: OmniGet UX Team  
**最后更新**: 2026-06-19  
**反馈渠道**: GitHub Issues / Discussions
