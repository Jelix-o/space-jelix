#!/bin/bash
# Hermes Hub - Android APK Build Script
# 在本地开发机器上运行此脚本

set -e

echo "🚀 Hermes Hub - Android APK Builder"
echo "===================================="

# 检查前置条件
command -v java >/dev/null 2>&1 || { echo "❌ 需要安装 Java JDK 17+"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ 需要安装 Node.js 18+"; exit 1; }

# 检查 Android SDK
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
    echo "⚠️  未检测到 Android SDK"
    echo "请安装 Android Studio 或设置 ANDROID_HOME 环境变量"
    echo "下载地址: https://developer.android.com/studio"
    exit 1
fi

echo "✅ 环境检查通过"

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建前端
echo "🔨 构建前端..."
npx vite build

# 同步到 Android
echo "📱 同步到 Android..."
npx cap sync android

# 构建 APK
echo "🏗️  构建 APK..."
cd android
./gradlew assembleDebug

# 输出路径
APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    echo ""
    echo "✅ APK 构建成功！"
    echo "📍 路径: android/$APK_PATH"
    echo "📱 大小: $(du -h "$APK_PATH" | cut -f1)"
    echo ""
    echo "安装到手机："
    echo "  adb install android/$APK_PATH"
else
    echo "❌ APK 构建失败"
    exit 1
fi
