package com.deepseekqq.agnescord;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.pm.PackageInfoCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.deepseekqq.agnescord.util.AppForegroundTracker;
import com.deepseekqq.agnescord.util.AppUpdateChecker;
import com.deepseekqq.agnescord.util.NotificationChannelHelper;
import com.deepseekqq.agnescord.util.PollingScheduler;
import com.deepseekqq.agnescord.util.TokenStore;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * 林念念 Bot — 原生 Android MainActivity
 *
 * 使用原生 WebView 加载本地 HTML 资产（assets/），
 * 无需 Capacitor/Cordova 等第三方桥接框架。
 */
public class MainActivity extends AppCompatActivity {

    private static final String TAG = "Agnescord";
    private static final int REQUEST_CODE_POST_NOTIFICATIONS = 1001;
    private WebView webView;
    private NativeBridge nativeBridge;
    // 文件上传：WebView onShowFileChooser 回调
    private ValueCallback<Uri[]> filePathCallback;
    private ActivityResultLauncher<String[]> fileChooserLauncher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // ── MUST be called before super.onCreate() for SplashScreen API ──
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // ── P0-1：通知渠道注册（幂等）──
        NotificationChannelHelper.createChannels(this);

        // ── P0-2：Android 13+ (API 33) 运行时请求 POST_NOTIFICATIONS 权限 ──
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        REQUEST_CODE_POST_NOTIFICATIONS);
            }
        }

        // ── Edge-to-edge immersive mode ──
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
            window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        }

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);  // dark status bar icons for light bg
        }

        // ── Create WebView with fallback for devices without WebView ──
        try {
            webView = new WebView(this);
        } catch (Exception e) {
            Log.e(TAG, "WebView creation failed — device may not have Android System WebView", e);
            // Fallback: show error message
            TextView errorView = new TextView(this);
            errorView.setText("需要 Android System WebView 才能运行\n\n请前往应用商店更新 WebView");
            errorView.setTextSize(16);
            errorView.setPadding(48, 48, 48, 48);
            errorView.setTextColor(0xFF1A1A2E);
            errorView.setBackgroundColor(0xFFFFF5F6);
            errorView.setGravity(android.view.Gravity.CENTER);
            setContentView(errorView);
            Toast.makeText(this, "请安装/启用 Android System WebView", Toast.LENGTH_LONG).show();
            return;
        }

        setContentView(webView);
        configureWebView(webView);

        // ── 文件选择器（图片/文件上传）──
        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.OpenDocument(),
            uri -> {
                if (filePathCallback != null) {
                    Uri[] results = (uri != null) ? new Uri[]{uri} : null;
                    filePathCallback.onReceiveValue(results);
                    filePathCallback = null;
                }
            });

        // ── Add NativeBridge JS Interface ──
        nativeBridge = new NativeBridge();
        webView.addJavascriptInterface(nativeBridge, "NativeBridge");

        // ── Back button handling (Android 16 dispatcher) ──
        setupBackHandling();

        // ── Load entry page ──
        webView.loadUrl("file:///android_asset/启动页.html");

        // ── P0-3：处理冷启动通知点击 ──
        handleNotificationIntent(getIntent());

        // ── P0-4：延迟 3s 检查版本（不依赖特定 HTML 页面名，避免 URL 加载失败跳过）──
        new Handler().postDelayed(() -> AppUpdateChecker.check(MainActivity.this), 3000);

        // ── P0-2：已有 token 时启动轮询保活（开机后冷启动 / App 进程被杀后恢复）──
        if (TokenStore.hasToken(this)) {
            PollingScheduler.schedule(this);
            PollingScheduler.startService(this);
        }

        // ── A3：键盘适配 — 仅传键盘 CSS 高度给 JS，由 JS 单独移动输入栏 ──
        final View rootView = getWindow().getDecorView().findViewById(android.R.id.content);
        rootView.getViewTreeObserver().addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
            private int lastKb = 0;
            @Override
            public void onGlobalLayout() {
                Rect r = new Rect();
                rootView.getWindowVisibleDisplayFrame(r);
                int screenH = rootView.getHeight();
                int kbHPhys = screenH - r.bottom;
                if (Math.abs(kbHPhys - lastKb) < 50) return;
                lastKb = kbHPhys;
                float density = getResources().getDisplayMetrics().density;
                int kbHCss = Math.round(kbHPhys / density);
                Log.d(TAG, "A3 keyboard: phys=" + kbHPhys + " css=" + kbHCss + " density=" + density);
                webView.evaluateJavascript(
                    "if(window._onKeyboardChanged){window._onKeyboardChanged(" + kbHCss + ");}", null);
            }
        });
    }

    // ────────────────────────────────────────
    //  WebView Configuration
    // ────────────────────────────────────────
    private void configureWebView(WebView wv) {
        WebSettings settings = wv.getSettings();

        // JavaScript
        settings.setJavaScriptEnabled(true);

        // DOM storage (required for localStorage JWT tokens)
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        // Viewport: match screen width
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        // Media
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Mixed content: allow HTTP resources inside file:// page
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Allow file access (for assets)
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // CORS: file:// → http:// 跨域（APK 本地加载 HTML，API 请求到远程服务器）
        settings.setAllowUniversalAccessFromFileURLs(true);

        // Text zoom: prevent system font size from breaking layout
        settings.setTextZoom(100);

        // Enable WebGL / hardware acceleration
        wv.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);

        // ── Remote debugging (chrome://inspect) — diagnostic for white-screen issues ──
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // E10：禁用 WebView 长按（防止长按模块浮出文本选择/上下文菜单/HTML 信息）
        wv.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                return true; // 消费长按事件，不触发默认行为
            }
        });
        wv.setLongClickable(false);

        // Smooth scrolling
        wv.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        wv.setVerticalScrollBarEnabled(false);
        wv.setHorizontalScrollBarEnabled(false);

        // ── WebViewClient: keep navigation in-app ──
        wv.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // API < 24: let WebView handle all navigation in-app
                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // API 24+: let WebView handle all navigation in-app
                // Return false = "WebView, you handle this URL yourself"
                // (Returning true + loadUrl causes redirect loops with location.replace)
                return false;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                Log.e(TAG, "WebView error [" + errorCode + "]: " + description + " — " + failingUrl);
                showLoadError(view, "错误 " + errorCode + ": " + description, failingUrl);
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse errorResponse) {
                // API 23+: HTTP errors (e.g. 404 for a missing asset) are NOT reported by onReceivedError
                Log.e(TAG, "WebView HTTP error " + errorResponse.getStatusCode() + " — " + request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.i(TAG, "onPageFinished: " + url);
                // Signal to JS that we're native + dump diagnostic state to logcat
                view.evaluateJavascript(
                    "if(window.NativeApp){window.NativeApp.isNative=true;window.NativeApp.platform='android';" +
                    "document.documentElement.setAttribute('data-platform','native');}" +
                    // Diagnostic: log JS environment so white-screen root cause surfaces in logcat
                    "console.log('[DIAG] url=' + location.href + ' API=' + (typeof API) + ' NativeApp=' + (typeof NativeApp) + " +
                    "' APP_CONFIG=' + (window.APP_CONFIG?window.APP_CONFIG.server_base:'undef') + " +
                    "' bodyHas=' + (document.body?document.body.children.length:'nobody'));",
                    null);
            }
        });

        // ── WebChromeClient: console logs, dialogs, file chooser ──
        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage cm) {
                android.util.Log.d("WebView", cm.message());
                return true;
            }

            // 文件上传：WebView <input type="file"> 必须实现此回调，否则点上传无反应
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback,
                                              FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                // 提取 accept 类型
                String[] mimeTypes = params.getAcceptTypes();
                if (mimeTypes == null || mimeTypes.length == 0 || "*/*".equals(mimeTypes[0])) {
                    mimeTypes = new String[]{"image/*", "application/*"};
                }
                try {
                    fileChooserLauncher.launch(mimeTypes);
                } catch (Exception e) {
                    Log.e(TAG, "File chooser failed", e);
                    filePathCallback.onReceiveValue(null);
                    filePathCallback = null;
                }
                return true;
            }
        });

        // ── A3：键盘高度检测 — ViewTreeObserver 精确获取键盘弹出高度传 JS ──
        // 物理像素需转换为 CSS 像素（除以 density），否则 bottom/translateY 值过大导致黑屏
        wv.getViewTreeObserver().addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
            private int lastKeyboardH = 0;
            @Override
            public void onGlobalLayout() {
                Rect r = new Rect();
                wv.getWindowVisibleDisplayFrame(r);
                int screenH = wv.getRootView().getHeight();
                int keyboardHPhys = screenH - r.bottom;
                // 去抖：变化 < 30 物理像素忽略
                if (Math.abs(keyboardHPhys - lastKeyboardH) < 30) return;
                lastKeyboardH = keyboardHPhys;
                // 转换物理像素 → CSS 像素
                float density = getResources().getDisplayMetrics().density;
                int keyboardHCss = Math.round(keyboardHPhys / density);
                Log.d(TAG, "A3 keyboard: phys=" + keyboardHPhys + " css=" + keyboardHCss + " density=" + density);
                if (webView != null) {
                    webView.evaluateJavascript(
                        "if(window._onKeyboardChanged){window._onKeyboardChanged(" + keyboardHCss + ");}", null);
                }
            }
        });
    }

    // ────────────────────────────────────────
    //  Load Error Fallback (any page, not just index.html)
    // ────────────────────────────────────────
    private void showLoadError(WebView view, String title, String failingUrl) {
        // Skip non-main-resource errors (images/css/js) so a missing asset
        // doesn't blank the whole page — only blank if the HTML itself failed.
        if (failingUrl != null && !failingUrl.endsWith(".html")) {
            return;
        }
        Log.e(TAG, "Showing load-error fallback for: " + failingUrl);
        view.loadUrl("about:blank");
        view.evaluateJavascript(
            "document.body.innerHTML='<div style=\"padding:48px 24px;text-align:center;font-family:sans-serif;color:#3A2030;background:#FFF5F6;min-height:100vh;box-sizing:border-box\">" +
            "<h2 style=\"margin:0 0 12px\">页面加载失败</h2>" +
            "<p style=\"color:#6A5060;font-size:14px;margin:0 0 8px\">" + title + "</p>" +
            "<p style=\"color:#999;font-size:12px;margin:0 0 24px;word-break:break-all\">" + failingUrl + "</p>" +
            "<button onclick=\"location.reload()\" style=\"padding:12px 28px;border-radius:16px;border:none;background:#F472B6;color:#fff;font-size:14px;font-weight:700;cursor:pointer\">重试</button>" +
            "</div>';", null);
    }

    // ────────────────────────────────────────
    //  NativeBridge: exposed to JS as window.NativeBridge
    // ────────────────────────────────────────
    public class NativeBridge {

        @JavascriptInterface
        public boolean isNative() {
            return true;
        }

        @JavascriptInterface
        public String getPlatform() {
            return "android";
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    finishAndRemoveTask();
                } else {
                    finish();
                }
                System.exit(0);
            });
        }

        /**
         * Called by JS when WebView has no more history to go back.
         * Delegates to the back dispatcher (root page → minimize, not exit).
         */
        @JavascriptInterface
        public void onBackPressed() {
            runOnUiThread(() -> getOnBackPressedDispatcher().onBackPressed());
        }

        /**
         * C6：JS 请求系统权限 — 检查已有权限，无则弹系统授权对话框。
         * 结果通过 window._permissionCallback(granted) 回调给 JS 层。
         * 新增：Oppo ColorOS fallback — 用户拒绝后跳系统设置。
         */
        @JavascriptInterface
        public void requestPermission(final String permission) {
            runOnUiThread(() -> {
                String perm = permission;
                // 兼容简写：camera → CAMERA, microphone → RECORD_AUDIO
                if ("camera".equalsIgnoreCase(permission) || "拍照".equals(permission)) {
                    perm = android.Manifest.permission.CAMERA;
                } else if ("microphone".equalsIgnoreCase(permission) || "录音".equals(permission) || "语音".equals(permission)) {
                    perm = android.Manifest.permission.RECORD_AUDIO;
                } else if ("notification".equalsIgnoreCase(permission) || "通知".equals(permission)) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        perm = android.Manifest.permission.POST_NOTIFICATIONS;
                    } else {
                        // Android < 13 通知权限默认已授
                        webView.evaluateJavascript("if(window._permissionCallback){window._permissionCallback(true);}", null);
                        return;
                    }
                } else if ("storage".equalsIgnoreCase(permission) || "存储".equals(permission)) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        perm = android.Manifest.permission.READ_MEDIA_IMAGES;
                    } else {
                        perm = android.Manifest.permission.READ_EXTERNAL_STORAGE;
                    }
                }
                int grantStatus = ContextCompat.checkSelfPermission(MainActivity.this, perm);
                boolean alreadyGranted = grantStatus == PackageManager.PERMISSION_GRANTED;
                boolean shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(MainActivity.this, perm);
                Log.d(TAG, "requestPermission: " + permission + " → " + perm +
                    " granted=" + alreadyGranted + " shouldShowRationale=" + shouldShowRationale);
                if (alreadyGranted) {
                    webView.evaluateJavascript("if(window._permissionCallback){window._permissionCallback(true);}", null);
                } else if (shouldShowRationale) {
                    // C6：用户之前拒绝过 → ColorOS 可能阻止二次弹窗 → 跳系统设置
                    Log.d(TAG, "C6 fallback: opening app settings (permission previously denied)");
                    openAppSettings();
                    webView.evaluateJavascript("if(window._permissionCallback){window._permissionCallback(false);}", null);
                } else {
                    // 首次请求 → 弹系统对话框
                    ActivityCompat.requestPermissions(MainActivity.this, new String[]{perm}, 100);
                }
            });
        }

        private void openAppSettings() {
            Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(android.net.Uri.parse("package:" + getPackageName()));
            startActivity(intent);
            Toast.makeText(MainActivity.this, "请在设置中手动开启权限", Toast.LENGTH_LONG).show();
        }

        // A7：原生录音 — MediaRecorder（C6修复：自带权限检查 + 被拒时引导设置）
        private android.media.MediaRecorder audioRecorder = null;
        private String currentAudioFile = null;

        @JavascriptInterface
        public void startRecording() {
            runOnUiThread(() -> {
                // C6：先检查权限，无权限则引导而非静默失败
                if (ContextCompat.checkSelfPermission(MainActivity.this, android.Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                    Log.d(TAG, "startRecording: RECORD_AUDIO not granted, requesting...");
                    ActivityCompat.requestPermissions(MainActivity.this,
                        new String[]{android.Manifest.permission.RECORD_AUDIO}, 200);
                    // 告诉 JS 等待权限结果（_recordingResult 在 onRequestPermissionsResult 中回调）
                    return;
                }
                try {
                    if (audioRecorder != null) return;
                    currentAudioFile = getFilesDir().getAbsolutePath() + "/voice_" + System.currentTimeMillis() + ".amr";
                    audioRecorder = new android.media.MediaRecorder();
                    audioRecorder.setAudioSource(android.media.MediaRecorder.AudioSource.MIC);
                    audioRecorder.setOutputFormat(android.media.MediaRecorder.OutputFormat.AMR_NB);
                    audioRecorder.setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AMR_NB);
                    audioRecorder.setOutputFile(currentAudioFile);
                    audioRecorder.prepare();
                    audioRecorder.start();
                    Log.d(TAG, "startRecording: started, file=" + currentAudioFile);
                } catch (Exception e) {
                    Log.e(TAG, "startRecording failed", e);
                    webView.evaluateJavascript("if(window._recordingResult){window._recordingResult(null);}", null);
                }
            });
        }

        @JavascriptInterface
        public void stopRecording() {
            runOnUiThread(() -> {
                try {
                    if (audioRecorder != null) {
                        audioRecorder.stop();
                        audioRecorder.release();
                        audioRecorder = null;
                    }
                    if (currentAudioFile != null) {
                        java.io.File f = new java.io.File(currentAudioFile);
                        byte[] bytes = new byte[(int) f.length()];
                        java.io.FileInputStream fis = new java.io.FileInputStream(f);
                        fis.read(bytes);
                        fis.close();
                        String b64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP);
                        String jsData = b64.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n");
                        // 保存文件路径供 playAudio 使用
                        final String savedFile = currentAudioFile;
                        webView.evaluateJavascript(
                            "if(window._recordingResult){window._recordingResult('" + jsData + "','" + savedFile.replace("'", "\\'") + "');}", null);
                        currentAudioFile = null;
                    }
                } catch (Exception e) {
                    Log.e(TAG, "stopRecording failed", e);
                    webView.evaluateJavascript(
                        "if(window._recordingResult){window._recordingResult(null);}", null);
                }
            });
        }

        // A7：原生音频播放 — 优先用 base64（不依赖临时文件路径）
        private android.media.MediaPlayer voicePlayer = null;

        @JavascriptInterface
        public void playAudio(final String filePathOrBase64) {
            runOnUiThread(() -> {
                try {
                    if (voicePlayer != null) {
                        voicePlayer.release();
                        voicePlayer = null;
                    }
                    voicePlayer = new android.media.MediaPlayer();
                    // 判断是 base64 data URL（以 "data:" 开头）还是文件路径
                    if (filePathOrBase64 != null && filePathOrBase64.startsWith("data:")) {
                        // base64 data URL: "data:audio/amr;base64,AAAA..."
                        String b64 = filePathOrBase64;
                        int commaIdx = b64.indexOf(",");
                        if (commaIdx > 0) b64 = b64.substring(commaIdx + 1);
                        byte[] audioBytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
                        java.io.File tmpFile = new java.io.File(getFilesDir(), "voice_pb_" + System.currentTimeMillis() + ".amr");
                        java.io.FileOutputStream fos = new java.io.FileOutputStream(tmpFile);
                        fos.write(audioBytes);
                        fos.close();
                        voicePlayer.setDataSource(tmpFile.getAbsolutePath());
                        tmpFile.deleteOnExit();
                    } else {
                        // 文件路径
                        java.io.File f = new java.io.File(filePathOrBase64);
                        if (!f.exists()) {
                            Log.e(TAG, "playAudio: file not found: " + filePathOrBase64);
                            webView.evaluateJavascript("if(window._voicePlayEnded){window._voicePlayEnded();}", null);
                            return;
                        }
                        voicePlayer.setDataSource(filePathOrBase64);
                    }
                    voicePlayer.prepare();
                    voicePlayer.start();
                    Log.d(TAG, "playAudio: playing");
                    voicePlayer.setOnCompletionListener(mp -> {
                        mp.release();
                        voicePlayer = null;
                        webView.evaluateJavascript("if(window._voicePlayEnded){window._voicePlayEnded();}", null);
                    });
                } catch (Exception e) {
                    Log.e(TAG, "playAudio failed", e);
                    if (voicePlayer != null) { voicePlayer.release(); voicePlayer = null; }
                    webView.evaluateJavascript("if(window._voicePlayEnded){window._voicePlayEnded();}", null);
                }
            });
        }

        @JavascriptInterface
        public void stopAudio() {
            runOnUiThread(() -> {
                if (voicePlayer != null) {
                    voicePlayer.release();
                    voicePlayer = null;
                }
            });
        }

        // ════════════════════════════════════════
        //  P0-5：NativeBridge 扩展（供 JS 调用）
        // ════════════════════════════════════════

        /** P0-5：返回 App 的 versionCode (int) */
        @JavascriptInterface
        public int getAppVersionCode() {
            try {
                return (int) PackageInfoCompat.getLongVersionCode(
                        getPackageManager().getPackageInfo(getPackageName(), 0));
            } catch (Exception e) {
                return 0;
            }
        }

        /** P0-5：返回 App 的 versionName（展示用） */
        @JavascriptInterface
        public String getAppVersionName() {
            try {
                String v = getPackageManager()
                        .getPackageInfo(getPackageName(), 0).versionName;
                return v != null ? v : "0.0.0";
            } catch (Exception e) {
                return "0.0.0";
            }
        }

        /** P0-5：JS 触发打开应用商店（更新） */
        @JavascriptInterface
        public void updateApp() {
            runOnUiThread(() -> AppUpdateChecker.openAppStore(MainActivity.this, null));
        }

        /** P0-5：JS 查询 App 前后台状态 */
        @JavascriptInterface
        public String isForeground() {
            return AppForegroundTracker.getInstance().isForeground() ? "true" : "false";
        }

        /** P0-2：JS 登录后启动轮询服务（幂等） */
        @JavascriptInterface
        public void startPollingService() {
            PollingScheduler.schedule(MainActivity.this);
            PollingScheduler.startService(MainActivity.this);
        }

        /** P0-2：JS 登出后停止轮询服务 */
        @JavascriptInterface
        public void stopPollingService() {
            PollingScheduler.stopService(MainActivity.this);
        }

        /** P0-2：JS 将 JWT token 同步到原生端（setTokens 统一调用） */
        @JavascriptInterface
        public void saveTokens(String access, String refresh) {
            TokenStore.saveTokens(MainActivity.this, access, refresh);
        }

        /** P0-2：JS 清除原生端 JWT token（clearTokens 统一调用） */
        @JavascriptInterface
        public void clearNativeTokens() {
            TokenStore.clearTokens(MainActivity.this);
        }
    }

    // ────────────────────────────────────────
    //  P0-3：通知点击处理
    // ────────────────────────────────────────
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleNotificationIntent(intent);
    }

    /**
     * 解析通知 Intent 携带的 target_url，通过 evaluateJavascript 通知 JS 跳转。
     * 使用 JSONObject.quote 对 URL 做标准 JSON 字符串转义，防止注入。
     */
    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        String targetUrl = intent.getStringExtra("target_url");
        if (targetUrl == null) {
            Uri data = intent.getData();
            if (data != null) {
                targetUrl = data.getQueryParameter("page");
                if (targetUrl == null) targetUrl = data.toString();
            }
        }
        if (targetUrl != null && webView != null) {
            try {
                // JSONObject.quote 做标准 JSON 字符串转义（含引号包裹，避免特殊字符 / 引号注入）
                String escaped = JSONObject.quote(targetUrl);
                webView.evaluateJavascript(
                        "if(window.handleNotification){" +
                                "window.handleNotification(" + escaped + ");}", null);
            } catch (Exception e) {
                android.util.Log.w(TAG, "handleNotificationIntent error: " + e.getMessage());
            }
        }
    }

    // ────────────────────────────────────────
    //  Back Button Handling — Android 16 (SDK 36) robust handling
    //  使用 OnBackPressedDispatcher（现代方式，替代已废弃的 onBackPressed）：
    //    有历史 → webView.goBack()
    //    无历史（根页面）→ moveTaskToBack(true) 退到后台，不杀进程
    //  解决"侧边返回直接退出应用"：根页面返回键改为最小化而非退出。
    // ────────────────────────────────────────
    private void setupBackHandling() {
        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    // 根页面：退到后台而非退出（避免误触退出 + 解决手势双触发直接退出）
                    moveTaskToBack(true);
                }
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.clearHistory();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    // C6：权限请求结果回调（ActivityCompat.requestPermissions）
    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        Log.d(TAG, "onRequestPermissionsResult: requestCode=" + requestCode +
            " perm=" + java.util.Arrays.toString(permissions) +
            " result=" + java.util.Arrays.toString(grantResults));
        if (webView == null) return;
        if (requestCode == 100 && grantResults.length > 0) {
            boolean granted = grantResults[0] == PackageManager.PERMISSION_GRANTED;
            webView.evaluateJavascript(
                "if(window._permissionCallback){window._permissionCallback(" + granted + ");}", null);
        }
        // C6+A7：录音权限回调（requestCode=200），授权后自动开始录音
        if (requestCode == 200 && grantResults.length > 0) {
            if (grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "RECORD_AUDIO granted, auto-starting recording");
                // 委托 NativeBridge 实例重新调用 startRecording
                if (nativeBridge != null) nativeBridge.startRecording();
            } else {
                Log.d(TAG, "RECORD_AUDIO denied, opening settings");
                if (nativeBridge != null) nativeBridge.openAppSettings();
                webView.evaluateJavascript("if(window._recordingResult){window._recordingResult(null);}", null);
            }
        }
    }
}
