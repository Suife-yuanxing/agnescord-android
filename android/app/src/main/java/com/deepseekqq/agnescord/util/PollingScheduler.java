package com.deepseekqq.agnescord.util;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

import com.deepseekqq.agnescord.receiver.PollingAlarmReceiver;
import com.deepseekqq.agnescord.service.PollingForegroundService;

/**
 * P0-2：后台轮询调度封装。
 *
 * AlarmManager.setInexactRepeating 每 15 分钟触发 PollingAlarmReceiver →
 * 重启 PollingForegroundService（保活机制）。
 *
 * 注意：
 *  - setInexactRepeating 不需要 SCHEDULE_EXACT_ALARM 权限（避免用户手动授权）。
 *  - Android 12+ (API 31+) 从 BroadcastReceiver 启动 FGS 受限，接收器内须 try-catch
 *    ForegroundServiceStartNotAllowedException（见 PollingAlarmReceiver 实现）。
 *  - 主要依赖 START_STICKY 自重启 + 服务内部 ScheduledExecutorService 自续命，
 *    AlarmManager 仅作辅助。
 */
public final class PollingScheduler {

    private static final String TAG = "PollingScheduler";

    /** AlarmManager 保活间隔：15 分钟 */
    private static final long ALARM_INTERVAL_MS = 15 * 60 * 1000L;

    private static final int ALARM_REQ_CODE = 20261;

    private PollingScheduler() {}

    public static void schedule(Context context) {
        Context app = context.getApplicationContext();
        AlarmManager am = (AlarmManager) app.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            Log.w(TAG, "AlarmManager unavailable, schedule skipped");
            return;
        }
        Intent intent = new Intent(app, PollingAlarmReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(app, ALARM_REQ_CODE, intent, flags);
        am.setInexactRepeating(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + ALARM_INTERVAL_MS,
                ALARM_INTERVAL_MS,
                pi);
        Log.d(TAG, "Alarm scheduled every " + (ALARM_INTERVAL_MS / 1000) + "s");
    }

    public static void cancel(Context context) {
        Context app = context.getApplicationContext();
        AlarmManager am = (AlarmManager) app.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent intent = new Intent(app, PollingAlarmReceiver.class);
        int flags = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getBroadcast(app, ALARM_REQ_CODE, intent, flags);
        am.cancel(pi);
        Log.d(TAG, "Alarm cancelled");
    }

    public static void startService(Context context) {
        Context app = context.getApplicationContext();
        Intent intent = new Intent(app, PollingForegroundService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                app.startForegroundService(intent);
            } else {
                app.startService(intent);
            }
        } catch (Exception e) {
            // Android 12+ 后台启动 FGS 可能抛 ForegroundServiceStartNotAllowedException；
            // 忽略（依赖 START_STICKY 自重启），避免崩溃。
            Log.w(TAG, "startService failed (Android 12+ FGS restriction?): " + e.getMessage());
        }
    }

    public static void stopService(Context context) {
        Context app = context.getApplicationContext();
        Intent intent = new Intent(app, PollingForegroundService.class);
        app.stopService(intent);
        cancel(context);
        Log.d(TAG, "Service stopped + alarm cancelled");
    }
}
