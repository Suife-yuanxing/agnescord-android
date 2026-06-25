# Add project specific ProGuard rules here.

# ── Keep NativeBridge JS Interface methods ──
-keepclassmembers class com.deepseekqq.agnescord.MainActivity$NativeBridge {
    public *;
}

# ── Keep WebView-related classes ──
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
