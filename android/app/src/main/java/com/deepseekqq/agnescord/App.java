package com.deepseekqq.agnescord;

import android.app.Application;

import com.deepseekqq.agnescord.util.AppForegroundTracker;

/**
 * P0：应用级 Application。
 *
 * onCreate 中注册 AppForegroundTracker（实现 ActivityLifecycleCallbacks），
 * 使前后台状态追踪在应用生命周期内全局生效。
 */
public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        registerActivityLifecycleCallbacks(AppForegroundTracker.getInstance());
    }
}
