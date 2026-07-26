# ===== 林念念 Bot — API 模块构建脚本 =====
# 将 shared/api/ 下的子模块合并为 shared/api.js
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts/build-api.ps1
# 或通过 npm run build:api 触发

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $root 'ux-prototypes\shared\api'
$outFile = Join-Path $root 'ux-prototypes\shared\api.js'

# 子模块加载顺序（依赖关系：core 必须最先）
$modules = @(
    'core.js',
    'auth.js',
    'user.js',
    'bot.js',
    'chat.js',
    'channel.js',
    'stats.js',
    'admin.js',
    'keys.js',
    'app.js'
)

# ── 头部 ──
$header = @'
/* ===== 林念念 Bot — API 客户端（fetch + JWT 自动刷新 + WebSocket）=====
 *
 * 依赖：shared/config.js（先于本文件加载，注入 window.APP_CONFIG.server_base）
 *
 * 对接后端 8766：
 *   - REST: <server_base>/api/v1/*
 *   - WS:   <server_base>/api/v1/chat/ws（子协议 bearer.<jwt>，S5）
 *
 * F6 JWT 自动刷新：access(15min) 过期 → 401 → 自动用 refresh(7d) 换新 → 重试原请求；
 *   refresh 也过期 → 清 token 跳登录页。并发请求只刷新一次。
 *
 * 本文件由 scripts/build-api.ps1 自动合并 shared/api/*.js 生成。
 * 请勿直接编辑本文件，修改请编辑对应子模块后重新构建。
 */
var API = (function() {
  'use strict';

'@

# ── 尾部（return 语句 + IIFE 关闭）──
$footer = @'

  return {
    // auth
    _ping: _ping,
    sendSms: sendSms, register: register, login: login, logout: logout,
    changePassword: changePassword,
    // profile
    getProfile: getProfile, updateProfile: updateProfile, uploadAvatar: uploadAvatar,
    uploadChatImage: uploadChatImage,
    // settings
    getUserSettings: getUserSettings, updateUserSettings: updateUserSettings,
    // data permissions
    getDataPermissions: getDataPermissions, updateDataPermissions: updateDataPermissions,
    // blacklist
    getBlacklist: getBlacklist, addToBlacklist: addToBlacklist, removeFromBlacklist: removeFromBlacklist,
    // bots
    listBots: listBots, createBot: createBot, getBot: getBot,
    updateBot: updateBot, deleteBot: deleteBot,
    uploadBotAvatar: uploadBotAvatar, clearBotMemory: clearBotMemory,
    getBotTemplates: getBotTemplates,
    getBotAbilities: getBotAbilities, updateBotAbilities: updateBotAbilities,
    // messages
    listMessages: listMessages, searchMessages: searchMessages,
    recallMessage: recallMessage, deleteMessage: deleteMessage, reportMessage: reportMessage,
    // ws
    openChatWs: openChatWs, sendMsg: sendMsg, closeChatWs: closeChatWs, cancelWsReconnect: cancelWsReconnect, wsReady: wsReady,
    newClientId: newClientId,
    // dashboard
    getDashboard: getDashboard, getBotDashboard: getBotDashboard,
    // notifications
    getNotifications: getNotifications, getUnreadCount: getUnreadCount,
    markNotificationRead: markNotificationRead, markAllNotificationsRead: markAllNotificationsRead,
    // stats
    getStatsSummary: getStatsSummary, getStatsRelation: getStatsRelation,
    getStatsMood: getStatsMood, getStatsMoodDetail: getStatsMoodDetail,
    getStatsTopics: getStatsTopics, getStatsActiveHours: getStatsActiveHours,
    getStatsUserProfile: getStatsUserProfile, getStatsAchievements: getStatsAchievements,
    shareStats: shareStats,
    // channels
    getQQStatus: getQQStatus, getQQStats: getQQStats,
    getQQRecentMessages: getQQRecentMessages,
    getQQSettings: getQQSettings, updateQQSettings: updateQQSettings,
    getWechatStatus: getWechatStatus,
    disconnectQQ: disconnectQQ,
    bindWechat: bindWechat, getWechatBindStatus: getWechatBindStatus,
    disconnectWechat: disconnectWechat,
    // quota
    getQuota: getQuota, getQuotaStatus: getQuotaStatus,
    // api keys
    getApiKeys: getApiKeys, createApiKey: createApiKey, revokeApiKey: revokeApiKey,
    getApiKeyUsageSummary: getApiKeyUsageSummary,
    getApiKeyUsage: getApiKeyUsage, getApiKeyEndpoints: getApiKeyEndpoints,
    // admin
    getSystemMetrics: getSystemMetrics,
    getAdminUsers: getAdminUsers, getAdminBots: getAdminBots,
    getAdminTokensRanking: getAdminTokensRanking, getAdminTokens: getAdminTokens,
    getAdminLogs: getAdminLogs, getAdminBackups: getAdminBackups,
    createBackup: createBackup, getAdminMetrics: getAdminMetrics,
    resetAdminTokenStats: resetAdminTokenStats, restoreBackup: restoreBackup,
    downloadBackup: downloadBackup,
    // app
    getAppVersion: getAppVersion,
    // token / state
    isLoggedIn: isLoggedIn, getAccessToken: getAccessToken, getRefreshToken: getRefreshToken,
    setTokens: setTokens, clearTokens: clearTokens,
    getCurrentUser: getCurrentUser, setCurrentUser: setCurrentUser,
    getCurrentBotId: getCurrentBotId, setCurrentBotId: setCurrentBotId,
    // config
    getServerBase: _base,
  };
})();
'@

# ── 合并 ──
$content = $header
$loadedCount = 0

foreach ($mod in $modules) {
    $modPath = Join-Path $apiDir $mod
    if (Test-Path $modPath) {
        $modContent = Get-Content $modPath -Raw -Encoding UTF8
        $content += "  // ================================================================`n"
        $content += "  //  Module: $mod`n"
        $content += "  // ================================================================`n`n"
        $content += $modContent
        $content += "`n`n"
        $loadedCount++
        Write-Host "[OK] $mod"
    } else {
        Write-Warning "[SKIP] $mod 不存在"
    }
}

$content += $footer

# 写入输出
[System.IO.File]::WriteAllText($outFile, $content, [System.Text.Encoding]::UTF8)
Write-Host "`n已生成: $outFile ($loadedCount / $($modules.Count) 个模块)"
