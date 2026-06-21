#!/bin/bash

# OmniGet macOS 权限修复脚本
# 用于解决 macOS Gatekeeper 阻止应用启动的问题

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 打印标题
clear
echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                        ║"
echo "║          🔧 OmniGet macOS 权限修复工具                ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# 检查应用是否存在
APP_PATH="/Applications/omniget.app"

if [ ! -d "$APP_PATH" ]; then
    print_error "未找到 OmniGet 应用"
    echo ""
    print_info "请确保已将 OmniGet 拖到「应用程序」文件夹"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi

print_success "找到 OmniGet 应用"
echo ""

# 显示说明
print_info "这个脚本会修复 macOS 权限问题，让 OmniGet 正常启动"
print_info "需要执行以下操作："
echo "  1. 移除隔离属性（xattr）"
echo "  2. 重新签名应用"
echo ""
print_warning "这是安全的操作，不会修改系统文件"
echo ""
read -p "按回车键继续，或按 Ctrl+C 取消..."
echo ""

# 步骤 1: 移除隔离属性
print_info "步骤 1/2: 移除隔离属性..."
if xattr -cr "$APP_PATH" 2>/dev/null; then
    print_success "已移除隔离属性"
else
    print_error "移除隔离属性失败"
    echo ""
    print_info "尝试手动执行："
    echo "  xattr -cr /Applications/omniget.app"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi
echo ""

# 步骤 2: 重新签名
print_info "步骤 2/2: 重新签名应用..."
if codesign --force --deep --sign - "$APP_PATH" 2>/dev/null; then
    print_success "应用签名完成"
else
    print_error "应用签名失败"
    echo ""
    print_info "尝试手动执行："
    echo "  codesign --force --deep --sign - /Applications/omniget.app"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi
echo ""

# 完成
echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                        ║"
echo "║              ✨ 修复完成！                            ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
print_success "OmniGet 现在可以正常启动了"
echo ""
print_info "💡 提示："
echo "  • 现在可以从「启动台」或「应用程序」文件夹打开 OmniGet"
echo "  • 此修复只需执行一次"
echo "  • 如果遇到问题，访问：https://github.com/tonhowtf/omniget"
echo ""

# 询问是否立即启动应用
read -p "是否现在启动 OmniGet？(y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "正在启动 OmniGet..."
    open "$APP_PATH"
    sleep 2
fi

echo ""
print_success "感谢使用 OmniGet！"
echo ""
read -p "按回车键关闭此窗口..."
