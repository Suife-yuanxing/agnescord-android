# ===== 林念念 Bot — JS/CSS 压缩构建脚本 =====
# 用于发布前压缩 shared/ 下的公共文件，减小 APK 体积。
# 压缩产物写入 ux-prototypes/shared/dist/，页面可选择引用 dist/ 版本。
#
# 用法：
#   npm run build:min
#   powershell -ExecutionPolicy Bypass -File scripts/build-minify.ps1
#
# 依赖：npx esbuild（自动下载，无需全局安装）

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sharedDir = Join-Path $root 'ux-prototypes\shared'
$distDir = Join-Path $sharedDir 'dist'

if (!(Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

$successCount = 0
$totalCount = 0

# ── Phase 1: JS 压缩（esbuild）──
$jsFiles = @(
    'config.js', 'native.js', 'api.js', 'app.js', 'router.js',
    'ui-components.js', 'perf-settings.js', 'mood-engine.js', 'festival-system.js'
)

Write-Host "=== JS Minification (esbuild) ==="
foreach ($js in $jsFiles) {
    $src = Join-Path $sharedDir $js
    $dest = Join-Path $distDir $js
    if (!(Test-Path $src)) { Write-Warning "[SKIP] $js not found"; continue }
    $totalCount++
    try {
        $srcSize = (Get-Item $src).Length
        npx --yes esbuild $src --minify --outfile=$dest 2>$null
        if (Test-Path $dest) {
            $destSize = (Get-Item $dest).Length
            $ratio = [math]::Round(($destSize / $srcSize) * 100, 1)
            Write-Host "[OK] $js : $srcSize -> $destSize bytes ($ratio%)"
            $successCount++
        }
    } catch {
        Write-Warning "[FAIL] $js : $_"
    }
}

# ── Phase 2: CSS 压缩（简单正则去注释+空白）──
$cssFiles = @('tokens.css', 'base.css', 'components.css', 'effects.css', 'anime-cat.css')

Write-Host "`n=== CSS Minification ==="
foreach ($css in $cssFiles) {
    $src = Join-Path $sharedDir $css
    $dest = Join-Path $distDir $css
    if (!(Test-Path $src)) { Write-Warning "[SKIP] $css not found"; continue }
    $totalCount++
    try {
        $content = Get-Content -LiteralPath $src -Raw -Encoding UTF8
        $srcSize = (Get-Item $src).Length
        # Remove comments
        $content = $content -replace '/\*[\s\S]*?\*/', ''
        # Remove newlines
        $content = $content -replace "`r?`n", ''
        # Collapse whitespace
        $content = $content -replace '\s{2,}', ' '
        # Remove spaces around { } : ; ,
        $content = $content -replace '\s*\{\s*', '{'
        $content = $content -replace '\s*\}\s*', '}'
        $content = $content -replace '\s*:\s*', ':'
        $content = $content -replace '\s*;\s*', ';'
        $content = $content -replace '\s*,\s*', ','
        # Fix negative values like "margin: -4px" broken by colon rule
        $content = $content -replace ':\s*-', ':-'
        [System.IO.File]::WriteAllText($dest, $content.Trim(), [System.Text.Encoding]::UTF8)
        $destSize = (Get-Item $dest).Length
        $ratio = [math]::Round(($destSize / $srcSize) * 100, 1)
        Write-Host "[OK] $css : $srcSize -> $destSize bytes ($ratio%)"
        $successCount++
    } catch {
        Write-Warning "[FAIL] $css : $_"
    }
}

Write-Host "`n=== Done: $successCount / $totalCount files minified to shared/dist/ ==="
Write-Host "Tip: Gradle copyWebAssets includes **/*.css and **/*.js so dist/ is auto-copied."
