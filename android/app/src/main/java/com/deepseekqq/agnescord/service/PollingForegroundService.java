package com.deepseekqq.agnescord.service;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.text.TextUtils;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.deepseekqq.agnescord.MainActivity;
import com.deepseekqq.agnescord.R;
import com.deepseekqq.agnescord.util.AppForegroundTracker;
import com.deepseekqq.agnescord.util.NotificationChannelHelper;
import com.deepseekqq.agnescord.util.NotificationHelper;
import com.deepseekqq.agnescord.util.PollingScheduler;
import com.deepseekqq.agnescord.util.TokenStore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * P0-2：后台轮询前台服务。
 *
 * 核心设计：
 *  - 持久前台通知（"念念在呢..."），绕过 Android 8+ 后台限制
 *  - ScheduledExecutorService 每 75s 查询 /notifications/unread-count
 *  - 增量 > 0 且 App 在后台时，追拉 /notifications?unread=1 获取真实标题正文
 *  - START_STICKY：被系统杀后自动重启（修复审计 H1）
 *  - onCreate 双建渠道（修复审计 C4，确保 BootReceiver 冷启动渠道存在）
 *  - App 前台时不弹通知（由 AppForegroundTracker 提供状态）
 *  - 401 自停服务；5xx 单次退避重试（5s）
 */
public class PollingForegroundService extends Service {

    private static final String TAG = "PollingTask";
    private static final int FOREGROUND_ID = 9999;
    private static final long POLL_INTERVAL_S = 75;
    private static final int HTTP_TIMEOUT_S = 10;
    private static final String SP_NAME = "polling_state";
    private static final String SP_KEY_LAST_UNREAD = "last_unread_count";

    private static final String SERVER_BASE = "http://129.211.7.67:8766";
    private static final String URL_UNREAD = SERVER_BASE + "/api/v1/notifications/unread-count";
    private static final String URL_LIST = SERVER_BASE + "/api/v1/notifications";

    private PowerManager.WakeLock wakeLock;
    private ScheduledExecutorService executor;
    private ScheduledFuture<?> pollTask;
    private final OkHttpClient http = new OkHttpClient.Builder()
            .connectTimeout(HTTP_TIMEOUT_S, TimeUnit.SECONDS)
            .readTimeout(HTTP_TIMEOUT_S, TimeUnit.SECONDS)
            .build();

    @Override public void onCreate() {
        super.onCreate();
        // 修复 C4：先建渠道再 startForeground（幂等）
        NotificationChannelHelper.createChannels(this);
        startForeground(FOREGROUND_ID, buildForegroundNotification());

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Agnescord::PollingWakeLock");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(24 * 60 * 60 * 1000L); // 24h 上限，防止泄漏
        }

        executor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "PollingWorker");
            t.setDaemon(true);
            return t;
        });
        pollTask = executor.scheduleWithFixedDelay(
                this::pollOnce, POLL_INTERVAL_S, POLL_INTERVAL_S, TimeUnit.SECONDS);

        Log.i(TAG, "Service started, polling every " + POLL_INTERVAL_S + "s");
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }

    @Override public void onDestroy() {
        if (pollTask != null) pollTask.cancel(false);
        if (executor != null) executor.shutdownNow();
        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception e) { /* ignore */ }
        }
        Log.i(TAG, "Service destroyed");
        super.onDestroy();
    }

    // ── PollingTask ──────────────────────────────────────────

    private void pollOnce() {
        try {
            String token = TokenStore.getAccessToken(this);
            if (TextUtils.isEmpty(token)) {
                Log.d(TAG, "No token, skip polling");
                return;
            }

            int current = fetchUnreadCount(token);
            if (current < 0) return; // 失败已处理（401/重试）

            int last = readLastCount();
            int delta = current - last;
            Log.d(TAG, "unread: last=" + last + " current=" + current + " delta=" + delta);

            if (delta > 0 && !AppForegroundTracker.getInstance().isForeground()) {
                showNewNotifications(token, delta);
            }

            writeLastCount(current);
        } catch (Exception e) {
            Log.w(TAG, "pollOnce error: " + e.getMessage());
        }
    }

    /** @return -1 表示失败（已处理）；>= 0 为当前未读数 */
    private int fetchUnreadCount(String token) {
        Request req = new Request.Builder()
                .url(URL_UNREAD)
                .addHeader("Authorization", "Bearer " + token)
                .get().build();

        Response resp = null;
        try {
            resp = http.newCall(req).execute();
            if (resp.code() == 401) {
                Log.w(TAG, "401 token invalid, stopping service");
                PollingScheduler.stopService(this);
                return -1;
            }
            if (resp.code() >= 500) {
                // 5xx 单次退避重试
                try { Thread.sleep(5000); } catch (InterruptedException ignored) {}
                resp.close();
                resp = http.newCall(req).execute();
                if (!resp.isSuccessful()) {
                    Log.w(TAG, "Server error after retry: " + resp.code());
                    return -1;
                }
            } else if (!resp.isSuccessful()) {
                Log.w(TAG, "HTTP error: " + resp.code());
                return -1;
            }

            ResponseBody body = resp.body();
            if (body == null) return -1;
            String raw = body.string();
            JSONObject j = new JSONObject(raw);
            return j.optInt("count", j.optInt("unread_count", -1));
        } catch (Exception e) {
            Log.w(TAG, "fetchUnreadCount error: " + e.getMessage());
            return -1;
        } finally {
            if (resp != null) resp.close();
        }
    }

    private void showNewNotifications(String token, int delta) {
        int limit = Math.min(delta, 50); // 上限保护
        String url = URL_LIST + "?unread=1&limit=" + limit;
        Request req = new Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer " + token)
                .get().build();

        Response resp = null;
        int shown = 0;
        try {
            resp = http.newCall(req).execute();
            if (!resp.isSuccessful() || resp.body() == null) {
                // 拉不到详情，退化为合并通知
                NotificationHelper.showMergedNotification(this, delta);
                return;
            }
            JSONObject j = new JSONObject(resp.body().string());
            JSONArray arr = j.optJSONArray("notifications");
            if (arr == null || arr.length() == 0) {
                NotificationHelper.showMergedNotification(this, delta);
                return;
            }

            int cap = Math.min(arr.length(), NotificationHelper.MERGE_THRESHOLD);
            for (int i = 0; i < cap; i++) {
                JSONObject n = arr.getJSONObject(i);
                int id = n.optInt("id", 0);
                String title = n.optString("title", "林念念");
                String body = n.optString("body", "");
                String target = n.optString("target_url", "通知.html");
                if (id <= 0) id = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
                NotificationHelper.showMessageNotification(this, id, title, body, target);
                shown++;
            }

            int remaining = delta - shown;
            if (remaining > 0) {
                NotificationHelper.showMergedNotification(this, remaining);
            }
        } catch (Exception e) {
            Log.w(TAG, "showNewNotifications error: " + e.getMessage());
            if (shown == 0) NotificationHelper.showMergedNotification(this, delta);
        } finally {
            if (resp != null) resp.close();
        }
    }

    // ── SP 持久化（防系统杀后重复弹）─────────────────

    private int readLastCount() {
        return getSharedPreferences(SP_NAME, MODE_PRIVATE)
                .getInt(SP_KEY_LAST_UNREAD, 0);
    }

    private void writeLastCount(int count) {
        getSharedPreferences(SP_NAME, MODE_PRIVATE).edit()
                .putInt(SP_KEY_LAST_UNREAD, count).apply();
    }

    // ── 前台持久通知 ──────────────────────────────────────

    private Notification buildForegroundNotification() {
        Intent tapIntent = new Intent(this, MainActivity.class);
        tapIntent.setAction("FGS_TAP_" + System.currentTimeMillis());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(this, 0, tapIntent, flags);

        return new NotificationCompat.Builder(this, NotificationChannelHelper.CHANNEL_POLLING)
                .setSmallIcon(R.drawable.ic_notification_small)
                .setContentTitle("林念念")
                .setContentText("念念在呢...")
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setContentIntent(pi)
                .build();
    }
}
