# ===== 林念念 Bot — 第三方库 vendor 提取脚本 =====
# 将 npm 安装的 UMD/IIFE 产物复制到 ux-prototypes/shared/vendor/
# copyWebAssets Gradle task 会自动将 vendor/*.js 同步到 APK assets/
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts/copy-vendor.ps1
# 或通过 npm postinstall 自动触发：npm install

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$vendorDir = Join-Path $root 'ux-prototypes\shared\vendor'
$nodeModules = Join-Path $root 'node_modules'

if (!(Test-Path $vendorDir)) {
    New-Item -ItemType Directory -Path $vendorDir -Force | Out-Null
}

# ── Phase 1 必需 ──
$packages = @(
    @{
        name = 'reconnecting-websocket'
        src  = 'reconnecting-websocket\dist\reconnecting-websocket-iife.min.js'
        dest = 'reconnecting-websocket.min.js'
    },
    @{
        name = 'lucide'
        src  = 'lucide\dist\umd\lucide.min.js'
        dest = 'lucide.min.js'
    }
)

# ── Phase 2 ──
$packages += @(
    @{
        name = 'lunar-javascript'
        src  = 'lunar-javascript\lunar.js'
        dest = 'lunar.min.js'
    },
    @{
        name = 'javascript-state-machine'
        src  = 'javascript-state-machine\dist\state-machine.min.js'
        dest = 'state-machine.min.js'
    }
)

$successCount = 0
foreach ($pkg in $packages) {
    $srcPath = Join-Path $nodeModules $pkg.src
    $destPath = Join-Path $vendorDir $pkg.dest
    if (Test-Path $srcPath) {
        Copy-Item $srcPath $destPath -Force
        Write-Host "[OK] $($pkg.name) -> $destPath"
        $successCount++
    } else {
        Write-Warning "[SKIP] $($pkg.name): 未找到 $srcPath，请先 npm install"
    }
}

Write-Host "`n已完成：$successCount / $($packages.Count) 个库"
