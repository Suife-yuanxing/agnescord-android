package com.deepseekqq.agnescord.util;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.text.TextUtils;

import androidx.core.app.NotificationCompat;

import com.deepseekqq.agnescord.MainActivity;
import com.deepseekqq.agnescord.R;

/**
 * P0-2 / P0-3：统一通知构建/发送。
 *
 * 关键设计：
 *  - notifyId 使用后端消息 id（整数），同一消息不会覆盖其它未读通知。
 *  - intent.setData(Uri) + putExtra("target_url") 双路径携带跳转目标。
 *  - setAction("NOTIF_" + notifyId + "_" + UUID) 确保每次构建出独立 PendingIntent，
 *    避免系统复用导致不同通知都跳转到同一页面。
 *  - API 31+ 必须使用 FLAG_IMMUTABLE（Android 12 强制要求）。
 */
public final class NotificationHelper {

    /** 通知合并阈值：单轮超过此数量的未读改为一条合并通知 */
    public static final int MERGE_THRESHOLD = 5;

    private NotificationHelper() {}

    /**
     * 弹出一条消息通知。
     *
     * @param notifyId  后端消息 id（唯一）
     * @param title     标题
     * @param body      正文
     * @param targetUrl 点击跳转页面（如 "通知.html"），为 null 时默认 "通知.html"
     */
    public static void showMessageNotification(Context context, int notifyId,
                                                String title, String body, String targetUrl) {
        NotificationManager nm = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        NotificationCompat.Builder b = new NotificationCompat.Builder(
                context, NotificationChannelHelper.CHANNEL_MESSAGES)
                .setSmallIcon(R.drawable.ic_notification_small)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setContentIntent(buildPendingIntent(context, notifyId, targetUrl));

        nm.notify(notifyId, b.build());
    }

    /**
     * 弹出一条合并通知（多条未读汇总）。
     *
     * @param count 合并的消息条数
     */
    public static void showMergedNotification(Context context, int count) {
        NotificationManager nm = (NotificationManager)
                context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        String title = "林念念";
        String body = "你有 " + count + " 条新通知";

        NotificationCompat.Builder b = new NotificationCompat.Builder(
                context, NotificationChannelHelper.CHANNEL_MESSAGES)
                .setSmallIcon(R.drawable.ic_notification_small)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setNumber(count)
                .setContentIntent(buildPendingIntent(context, 0, "通知.html"));

        // notifyId 固定为 0，每次合并通知覆盖上一条合并通知
        nm.notify(0, b.build());
    }

    private static PendingIntent buildPendingIntent(Context context, int notifyId, String targetUrl) {
        if (TextUtils.isEmpty(targetUrl)) targetUrl = "通知.html";
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction("NOTIF_" + notifyId + "_" + java.util.UUID.randomUUID());
        intent.putExtra("target_url", targetUrl);
        intent.setData(Uri.parse("agnescord://notification/" + notifyId));
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, notifyId, intent, flags);
    }
}
