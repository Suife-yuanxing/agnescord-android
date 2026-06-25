#!/bin/bash
# ===== 林念念 Bot — 实时重载开发模式 =====
# 用法: bash dev-live-reload.sh
# 效果: 手机和电脑连同一 WiFi → APK 内 HTML/CSS/JS 从电脑加载 → 改代码秒级生效
#
# 首次设置:
#   1. 运行本脚本
#   2. 构建 APK 安装到手机
#   3. 之后改 HTML/CSS/JS → 下拉刷新即可，无需重新构建
#
# 切回离线模式:
#   bash dev-build-install.sh

set -e
cd "$(dirname "$0")"

LOCAL_IP="10.92.92.224"
HTTP_PORT="8767"

echo "========================================="
echo "  林念念 Bot — 实时重载模式"
echo "  服务器: http://${LOCAL_IP}:${HTTP_PORT}"
echo "========================================="

# 1. 修改 capacitor.config.json → 指向本机
cat > capacitor.config.json << EOF
{
  "appId": "com.deepseekqq.agnescord",
  "appName": "林念念Bot",
  "webDir": "../安卓控制面板UI原型",
  "server": {
    "url": "http://${LOCAL_IP}:${HTTP_PORT}",
    "cleartext": true
  },
  "android": {
    "allowMixedContent": true
  }
}
EOF

echo "[1/3] capacitor.config.json → server.url = http://${LOCAL_IP}:${HTTP_PORT}"

# 2. 同步到 Android
npx cap sync android
echo "[2/3] cap sync android ✅"

# 3. 启动本地 HTTP 服务器
echo "[3/3] 启动本地服务器..."
echo ""
echo "  📱 手机端操作:"
echo "     1. 确保手机和电脑连同一 WiFi"
echo "     2. 打开林念念 APP → 下拉刷新"
echo "     3. 改代码后 → 再次下拉刷新即可看见效果"
echo ""
echo "  按 Ctrl+C 停止服务器"
echo "========================================="

# Python HTTP Server（支持所有文件类型）
cd ../安卓控制面板UI原型
python3 -m http.server ${HTTP_PORT} --bind 0.0.0.0
