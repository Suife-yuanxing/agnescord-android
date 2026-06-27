package com.deepseekqq.agnescord.receiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.deepseekqq.agnescord.util.PollingScheduler;
import com.deepseekqq.agnescord.util.TokenStore;

/**
 * P0-2：开机自启动接收器。
 *
 * 收到 ACTION_BOOT_COMPLETED 时，若 native SP 存有 JWT token（说明用户上次登录过），
 * 则启动轮询服务 + 注册 AlarmManager 保活。
 *
 * 修复审计 H1：Android 12+ 启动 FGS 受限，try-catch 容错。
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;

        if (!TokenStore.hasToken(context)) {
            Log.d(TAG, "No token, skip boot polling");
            return;
        }

        Log.i(TAG, "Boot completed with token, starting polling");
        PollingScheduler.schedule(context);
        try {
            PollingScheduler.startService(context);
        } catch (Exception e) {
            Log.w(TAG, "startService failed on boot: " + e.getMessage());
        }
    }
}
