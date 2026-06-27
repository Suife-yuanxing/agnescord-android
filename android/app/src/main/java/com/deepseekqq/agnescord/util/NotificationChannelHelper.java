package com.deepseekqq.agnescord.util;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import com.deepseekqq.agnescord.R;

/**
 * P0-1：通知渠道创建工具类。
 *
 * 幂等：重复调用安全。必须在 MainActivity.onCreate 和 PollingForegroundService.onCreate
 * 双调用，确保 BootReceiver 冷启动服务时渠道已存在（修复审计 C4）。
 */
public final class NotificationChannelHelper {

    /** 前台服务持久通知（IMPORTANCE_LOW，无声无角标） */
    public static final String CHANNEL_POLLING = "channel_polling";

    /** 新消息 / 提醒（IMPORTANCE_DEFAULT，有声有角标） */
    public static final String CHANNEL_MESSAGES = "channel_messages";

    /** 版本更新等系统通知（IMPORTANCE_DEFAULT） */
    public static final String CHANNEL_SYSTEM = "channel_system";

    private NotificationChannelHelper() {}

    public static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        // CHANNEL_POLLING — 前台服务持久通知，无声音、无角标
        if (nm.getNotificationChannel(CHANNEL_POLLING) == null) {
            NotificationChannel polling = new NotificationChannel(
                    CHANNEL_POLLING,
                    context.getString(R.string.channel_polling_name),
                    NotificationManager.IMPORTANCE_LOW);
            polling.setDescription(context.getString(R.string.channel_polling_desc));
            polling.setShowBadge(false);
            polling.setSound(null, null);
            polling.enableVibration(false);
            nm.createNotificationChannel(polling);
        }

        // CHANNEL_MESSAGES — 新消息提醒，默认声音 + 角标
        if (nm.getNotificationChannel(CHANNEL_MESSAGES) == null) {
            NotificationChannel messages = new NotificationChannel(
                    CHANNEL_MESSAGES,
                    context.getString(R.string.channel_messages_name),
                    NotificationManager.IMPORTANCE_DEFAULT);
            messages.setDescription(context.getString(R.string.channel_messages_desc));
            nm.createNotificationChannel(messages);
        }

        // CHANNEL_SYSTEM — 系统通知（版本更新等）
        if (nm.getNotificationChannel(CHANNEL_SYSTEM) == null) {
            NotificationChannel system = new NotificationChannel(
                    CHANNEL_SYSTEM,
                    context.getString(R.string.channel_system_name),
                    NotificationManager.IMPORTANCE_DEFAULT);
            system.setDescription(context.getString(R.string.channel_system_desc));
            nm.createNotificationChannel(system);
        }
    }
}
