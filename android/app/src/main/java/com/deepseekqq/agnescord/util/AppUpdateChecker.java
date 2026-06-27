package com.deepseekqq.agnescord.util;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.content.pm.PackageInfoCompat;

import org.json.JSONObject;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * P0-4：版本更新检查。
 *
 * 契约（与后端约定）：
 *   GET <server_base>/api/v1/app/version
 *   响应：{
 *     "latest_version_code": int,     // 与本地 versionCode (int) 比较
 *     "latest_version_name": string,  // 仅展示
 *     "min_version_code":    int,     // 与本地 versionCode 比较
 *     "force_update":        boolean, // 是否强制
 *     "update_url":          string   // market:// 或 https:// 链接
 *   }
 *
 * 策略（修复审计 M1：消除字符串与 int 的类型混淆）：
 *   - min_version_code > 本地 versionCode  → 强制更新对话框（不可关闭，点退出则关闭 App）
 *   - latest_version_code > 本地 versionCode 且 force_update=false → 建议更新（可关闭）
 *   - 其它 → 不弹框
 */
public final class AppUpdateChecker {

    private static final String TAG = "AppUpdateChecker";
    private static final String VERSION_PATH = "/api/v1/app/version";

    private static final OkHttpClient HTTP = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .build();

    private AppUpdateChecker() {}

    /** 异步检查版本（Activity 内调用）。 */
    public static void check(@NonNull Activity activity) {
        String serverBase = resolveServerBase(activity);
        if (TextUtils.isEmpty(serverBase)) {
            Log.w(TAG, "server_base 为空，跳过版本检查");
            return;
        }
        int currentCode = getVersionCode(activity);

        Request req = new Request.Builder().url(serverBase + VERSION_PATH).get().build();
        HTTP.newCall(req).enqueue(new Callback() {
            @Override public void onFailure(Call call, IOException e) {
                Log.w(TAG, "版本检查失败（静默）: " + e.getMessage());
            }

            @Override public void onResponse(Call call, Response response) throws IOException {
                try (ResponseBody body = response.body()) {
                    if (!response.isSuccessful() || body == null) return;
                    JSONObject j = new JSONObject(body.string());
                    int minCode = j.optInt("min_version_code", 0);
                    int latestCode = j.optInt("latest_version_code", 0);
                    String latestName = j.optString("latest_version_name", "");
                    boolean force = j.optBoolean("force_update", false);
                    String updateUrl = j.optString("update_url", "");

                    boolean needForce = force || (minCode > currentCode);
                    boolean needSuggest = !needForce && (latestCode > currentCode);

                    if (!needForce && !needSuggest) {
                        Log.d(TAG, "已是最新（local=" + currentCode + ", latest=" + latestCode + "），无需更新");
                        return;
                    }

                    final boolean isForce = needForce;
                    final String msg = buildDialogMessage(latestName, minCode, latestCode, force);

                    new Handler(Looper.getMainLooper()).post(() -> {
                        if (activity.isFinishing() || activity.isDestroyed()) return;
                        showDialog(activity, msg, updateUrl, isForce);
                    });
                } catch (Exception e) {
                    Log.w(TAG, "解析版本响应失败: " + e.getMessage());
                }
            }
        });
    }

    public static void openAppStore(Context context, String updateUrl) {
        try {
            if (!TextUtils.isEmpty(updateUrl)) {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(updateUrl));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(i);
            } else {
                Intent i = new Intent(Intent.ACTION_VIEW,
                        Uri.parse("market://details?id=" + context.getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(i);
            }
        } catch (Exception e) {
            Log.w(TAG, "打开商店失败: " + e.getMessage());
        }
    }

    // ── internal ──

    private static void showDialog(Activity activity, String message, String updateUrl, boolean force) {
        AlertDialog.Builder b = new AlertDialog.Builder(activity);
        b.setTitle(force ? "发现重要更新" : "发现新版本");
        b.setMessage(message);
        b.setCancelable(!force);
        b.setPositiveButton("立即更新", (d, w) -> openAppStore(activity, updateUrl));
        if (force) {
            b.setNegativeButton("退出 App", (d, w) -> {
                activity.finishAffinity();
                System.exit(0);
            });
        }
        try {
            b.show();
        } catch (Exception e) {
            Log.w(TAG, "显示更新对话框失败: " + e.getMessage());
        }
    }

    private static String buildDialogMessage(String latestName, int minCode, int latestCode, boolean force) {
        StringBuilder sb = new StringBuilder();
        if (!TextUtils.isEmpty(latestName)) {
            sb.append("最新版本：v").append(latestName).append("\n");
        }
        if (force) {
            sb.append("\n该版本为必须更新版本，请先更新后继续使用。");
        } else {
            sb.append("\n推荐更新以获得更好体验。");
        }
        return sb.toString();
    }

    private static int getVersionCode(Context context) {
        try {
            PackageInfo pi = context.getPackageManager()
                    .getPackageInfo(context.getPackageName(), 0);
            return (int) PackageInfoCompat.getLongVersionCode(pi);
        } catch (PackageManager.NameNotFoundException e) {
            return 0;
        }
    }

    /** 读取 APP_CONFIG.server_base：优先 SharedPreferences（用户手填）→ BuildConfig → 默认。 */
    private static String resolveServerBase(Context context) {
        String override = context.getSharedPreferences("WebView", Context.MODE_PRIVATE)
                .getString("server_base", null);
        if (!TextUtils.isEmpty(override)) return override;
        // 默认公网地址（与 config.js 对齐）
        return "http://129.211.7.67:8766";
    }
}
