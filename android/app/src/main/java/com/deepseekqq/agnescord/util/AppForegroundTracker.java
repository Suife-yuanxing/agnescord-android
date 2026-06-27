package com.deepseekqq.agnescord.util;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

/**
 * P0-2：应用前后台状态追踪。
 *
 * 单例，通过 Application.registerActivityLifecycleCallbacks 注册。
 *
 * 使用 startedCount（而非 resumedCount），更准确：
 *  - onActivityStarted +1；onActivityStopped -1。
 *  - A→B 跳转时，A stopped 但 B 已 started，计数保持 > 0，不误判为后台。
 *
 * isForeground() 用 300ms Handler.postDelayed 去抖，
 * 防止 Activity 过渡瞬间（旋转、Dialog Activity）误判，
 * 导致 App 在前台时轮询弹通知。
 *
 * 单例仅持有 Application context（修复审计 M2，无 Activity 泄漏风险）。
 */
public final class AppForegroundTracker implements Application.ActivityLifecycleCallbacks {

    private static final String TAG = "ForegroundTracker";
    private static final long DEBOUNCE_MS = 300;

    private static final AppForegroundTracker INSTANCE = new AppForegroundTracker();
    public static AppForegroundTracker getInstance() { return INSTANCE; }

    private int startedCount = 0;
    private boolean foreground = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable updateTask = this::recalculate;

    private AppForegroundTracker() {}

    public synchronized boolean isForeground() { return foreground; }

    private synchronized void recalculate() {
        boolean next = startedCount > 0;
        if (next != foreground) {
            foreground = next;
            Log.d(TAG, "foreground=" + foreground + " (startedCount=" + startedCount + ")");
        }
    }

    @Override public void onActivityStarted(Activity activity) {
        startedCount++;
        handler.removeCallbacks(updateTask);
        handler.postDelayed(updateTask, DEBOUNCE_MS);
    }

    @Override public void onActivityStopped(Activity activity) {
        startedCount = Math.max(0, startedCount - 1);
        handler.removeCallbacks(updateTask);
        handler.postDelayed(updateTask, DEBOUNCE_MS);
    }

    @Override public void onActivityCreated(Activity a, Bundle b) {}
    @Override public void onActivityResumed(Activity a) {}
    @Override public void onActivityPaused(Activity a) {}
    @Override public void onActivitySaveInstanceState(Activity a, Bundle b) {}
    @Override public void onActivityDestroyed(Activity a) {}
}
