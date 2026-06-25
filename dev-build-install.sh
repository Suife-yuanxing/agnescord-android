#!/bin/bash
# ===== 林念念 Bot — 原生 Android APK 构建 + ADB 一键安装 =====
# 用法: bash dev-build-install.sh
# 前提: 手机通过 USB 连接电脑，已开启 USB 调试
#
# 与旧 Capacitor 版本的区别：
#   - 无需 npx cap sync（原生 Gradle task 自动复制 assets）
#   - 无需 node_modules（纯 Android Gradle 构建）
#   - 无需 capacitor.config.json

set -e
cd "$(dirname "$0")"

ANDROID_HOME="${ANDROID_HOME:-C:/Users/se'jng'k's/Android}"
ADB="$ANDROID_HOME/platform-tools/adb"
JAVA_HOME="${JAVA_HOME:-C:/Program Files/Microsoft/jdk-21.0.11.10-hotspot}"

export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

echo "========================================="
echo "  林念念 Bot — 原生 APK 构建"
echo "========================================="

# 1. Clean old Capacitor assets (first time only)
if [ -f "android/app/src/main/assets/capacitor.config.json" ]; then
  echo "[1/4] 清理旧 Capacitor 资产..."
  rm -rf android/app/src/main/assets/*
  echo "[1/4] ✅ 清理完成"
else
  echo "[1/4] 跳过清理（已是原生模式）"
fi

# 2. Build APK (Gradle copyWebAssets task runs automatically)
echo "[2/4] 构建 APK..."
cd android
./gradlew assembleDebug 2>&1 | tail -5
APK="app/build/outputs/apk/debug/app-debug.apk"
echo "[2/4] ✅ APK 构建完成: $APK"

# 3. ADB 安装
echo ""
echo "[3/4] 检查设备..."

DEVICES=$("$ADB" devices 2>/dev/null | tail -n +2 | grep -v "^$" | wc -l)

if [ "$DEVICES" -gt 0 ]; then
  echo "  检测到 $DEVICES 台设备，正在安装..."
  "$ADB" install -r "$APK"
  echo ""
  echo "  ✅ 安装完成！在手机上打开 林念念Bot"
  echo ""
  # 尝试自动启动
  "$ADB" shell am start -n com.deepseekqq.agnescord/.MainActivity 2>/dev/null || true
else
  echo "  ⚠️  未检测到设备"
  echo ""
  echo "  📱 手动安装:"
  echo "     1. USB 连接手机后重新运行本脚本"
  echo "     2. 或把 APK 传到手机安装"
  echo "     APK 路径: $APK"
  echo ""
  echo "  🌐 局域网下载:"
  echo "     python3 -m http.server 8767 --bind 0.0.0.0"
  IP=$(python3 -c "import socket; s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8',80)); print(s.getsockname()[0]); s.close()" 2>/dev/null || echo "10.92.92.224")
  echo "     # 手机浏览器访问 http://$IP:8767"
fi
