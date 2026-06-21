# macOS 首次启动修复脚本

这个脚本用于解决 macOS Gatekeeper 阻止 OmniGet 启动的问题。

## 使用方法

### 方式一：双击运行（推荐）

1. 下载 `fix-macos-permissions.command` 文件
2. 双击运行此文件
3. 按照提示操作

### 方式二：手动执行命令

如果双击运行失败，打开「终端」应用并执行：

```bash
xattr -cr /Applications/omniget.app
codesign --force --deep --sign - /Applications/omniget.app
```

## 这个脚本做了什么？

1. **移除隔离属性**: 清除 macOS 下载文件时添加的隔离标记
2. **重新签名应用**: 使用本地签名让系统信任此应用

## 安全说明

- ✅ 这些操作是安全的，不会修改系统文件
- ✅ 只对 OmniGet 应用生效
- ✅ 是 macOS 上运行未签名应用的标准方法
- ✅ 只需执行一次

## 为什么需要这个？

OmniGet 是开源免费软件，没有购买 Apple 的付费开发者证书（$99/年）进行公证。这是开源应用的常见情况。

## 遇到问题？

如果脚本执行失败，请：

1. 确保 OmniGet 已拖到「应用程序」文件夹
2. 检查是否有杀毒软件阻止
3. 在 GitHub 上提交 Issue: https://github.com/tonhowtf/omniget/issues

## 其他平台

- **Windows**: 首次运行时点击"更多信息" → "仍要运行"
- **Linux**: 无需额外操作，直接运行即可
