package com.deepseekqq.agnescord.receiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.deepseekqq.agnescord.util.PollingScheduler;

/**
 * P0-2：AlarmManager 触发的保活接收器（每 15 分钟）。
 *
 * 修复审计 H1：Android 12+ (API 31+) 从 BroadcastReceiver 启动 FGS 受限，
 * 须 try-catch ForegroundServiceStartNotAllowedException，避免崩溃。
 * 主要依赖 START_STICKY 自重启 + 服务内部 ScheduledExecutorService 自续命。
 */
public class PollingAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "PollingAlarmReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "Alarm fired");
        try {
            PollingScheduler.startService(context);
        } catch (Exception e) {
            // Android 12+ FGS 限制：忽略，依赖 START_STICKY 自重启
            Log.w(TAG, "startService failed (FGS restriction): " + e.getMessage());
        }
    }
}
