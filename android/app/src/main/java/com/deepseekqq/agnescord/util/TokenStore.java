package com.deepseekqq.agnescord.util;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * P0-2：JWT access_token / refresh_token 原生持久化。
 *
 * 与 WebView 的 localStorage 双写：JS 端通过 NativeBridge.saveTokens/clearNativeTokens 同步。
 * 仅供 PollingForegroundService 读取（安全等级与 WebView 明文 localStorage 一致，
 * 不引入 EncryptedSharedPreferences，避免 WebView/原生两套存储不一致）。
 */
public final class TokenStore {

    private static final String PREF_NAME = "agnescord_tokens";
    private static final String KEY_ACCESS = "access_token";
    private static final String KEY_REFRESH = "refresh_token";

    private TokenStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext()
                .getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public static void saveTokens(Context ctx, String access, String refresh) {
        prefs(ctx).edit()
                .putString(KEY_ACCESS, access)
                .putString(KEY_REFRESH, refresh)
                .apply();
    }

    public static String getAccessToken(Context ctx) {
        return prefs(ctx).getString(KEY_ACCESS, null);
    }

    public static String getRefreshToken(Context ctx) {
        return prefs(ctx).getString(KEY_REFRESH, null);
    }

    public static void clearTokens(Context ctx) {
        prefs(ctx).edit()
                .remove(KEY_ACCESS)
                .remove(KEY_REFRESH)
                .apply();
    }

    public static boolean hasToken(Context ctx) {
        return prefs(ctx).contains(KEY_ACCESS);
    }
}
