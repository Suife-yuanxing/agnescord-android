/* ===== 林念念 Bot — 公共 UI 组件 =====
 *
 * 提供可复用的 UI 辅助函数，减少页面内重复代码。
 * 依赖：app.js（showToast, escapeHtml）
 *
 * API:
 *   UI.showLoading(container)         — 显示加载态
 *   UI.hideLoading(container)         — 隐藏加载态
 *   UI.showEmpty(container, text)     — 显示空状态
 *   UI.showError(container, msg, fn)  — 显示错误态+重试按钮
 *   UI.confirm(title, msg, onOk)      — 确认弹窗（替代原生 confirm）
 *   UI.renderBottomNav(activePage)    — 动态注入底部导航
 */
var UI = (function() {
  'use strict';

  // ── 加载态 ──
  function showLoading(container) {
    if (!container) return;
    container.innerHTML = '<div class="ui-loading" style="text-align:center;padding:48px 20px;color:#C0A0B0;">' +
      '<div style="width:28px;height:28px;border:3px solid rgba(244,114,182,0.2);border-top-color:#F472B6;border-radius:50%;animation:ui-spin 0.8s linear infinite;margin:0 auto 12px;"></div>' +
      '<div style="font-size:13px;">加载中…</div></div>' +
      '<style>@keyframes ui-spin{to{transform:rotate(360deg)}}</style>';
  }

  function hideLoading(container) {
    if (!container) return;
    var el = container.querySelector('.ui-loading');
    if (el) el.remove();
  }

  // ── 空状态 ──
  function showEmpty(container, text) {
    if (!container) return;
    container.innerHTML = '<div class="ui-empty" style="text-align:center;padding:60px 20px;color:#C0A0B0;">' +
      '<div style="font-size:36px;margin-bottom:12px;opacity:0.5;">📭</div>' +
      '<div style="font-size:13px;line-height:1.8;">' + escapeHtml(text || '暂无数据') + '</div></div>';
  }

  // ── 错误态 + 重试 ──
  function showError(container, msg, retryFn) {
    if (!container) return;
    container.innerHTML = '<div class="ui-error" style="text-align:center;padding:48px 20px;color:#C0A0B0;">' +
      '<div style="font-size:32px;margin-bottom:12px;">⚠️</div>' +
      '<div style="font-size:13px;color:#FF6B6B;margin-bottom:16px;line-height:1.6;">' + escapeHtml(msg || '加载失败') + '</div>' +
      (retryFn ? '<button class="ui-retry-btn" style="padding:10px 24px;border-radius:14px;border:none;background:#F472B6;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">重试</button>' : '') +
      '</div>';
    if (retryFn) {
      var btn = container.querySelector('.ui-retry-btn');
      if (btn) btn.onclick = retryFn;
    }
  }

  // ── 确认弹窗（替代原生 confirm，适配 WebView）──
  function confirm(title, msg, onOk, opts) {
    opts = opts || {};
    var okText = opts.okText || '确认';
    var cancelText = opts.cancelText || '取消';
    var danger = opts.danger;

    // 移除已有弹窗
    var existing = document.getElementById('uiConfirmOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'uiConfirmOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);animation:ui-fade-in 0.2s ease;';
    overlay.innerHTML =
      '<div style="width:280px;background:#fff;border-radius:18px;padding:24px 20px 16px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.15);animation:ui-scale-in 0.25s cubic-bezier(0.34,1.56,0.64,1);">' +
      '<div style="font-size:16px;font-weight:800;color:#3A2030;margin-bottom:8px;">' + escapeHtml(title) + '</div>' +
      '<div style="font-size:13px;color:#6A5060;line-height:1.6;margin-bottom:20px;">' + escapeHtml(msg) + '</div>' +
      '<div style="display:flex;gap:10px;">' +
      '<button id="uiConfirmCancel" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:rgba(0,0,0,0.04);color:#B090A0;">' + escapeHtml(cancelText) + '</button>' +
      '<button id="uiConfirmOk" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:inherit;color:#fff;background:' + (danger ? '#FF6B7A' : 'linear-gradient(135deg,#F472B6,#FF8095)') + ';">' + escapeHtml(okText) + '</button>' +
      '</div></div>' +
      '<style>@keyframes ui-fade-in{from{opacity:0}to{opacity:1}}@keyframes ui-scale-in{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}</style>';

    document.body.appendChild(overlay);

    function close() { overlay.remove(); }
    overlay.querySelector('#uiConfirmCancel').onclick = close;
    overlay.querySelector('#uiConfirmOk').onclick = function() { close(); if (onOk) onOk(); };
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  }

  // ── 底部导航动态注入 ──
  var NAV_ITEMS = [
    { page: 'home', label: '首页', href: '首页仪表盘.html', icon: '<path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/>' },
    { page: 'chat', label: '聊天', href: '聊天页.html', icon: '<path d="M4 4h16v13H8l-4 4v-4H4z"/>' },
    { page: 'bots', label: 'Bot管理', href: '我的Bot.html', icon: '<circle cx="12" cy="8" r="5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>' },
    { page: 'me', label: '我的', href: '我的.html', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7 18c0-2 2.2-4 5-4s5 2 5 4"/>' }
  ];

  function renderBottomNav(activePage) {
    var existing = document.getElementById('bottomNav');
    if (existing) existing.remove();

    var nav = document.createElement('div');
    nav.className = 'bottom-nav';
    nav.id = 'bottomNav';

    NAV_ITEMS.forEach(function(item) {
      var a = document.createElement('a');
      a.className = 'nav-item' + (item.page === activePage ? ' active' : '');
      a.href = item.href;
      a.setAttribute('data-page', item.page);
      a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + item.icon + '</svg>' + item.label;
      nav.appendChild(a);
    });

    var phone = document.querySelector('.phone');
    if (phone) {
      phone.appendChild(nav);
    } else {
      document.body.appendChild(nav);
    }
    return nav;
  }

  return {
    showLoading: showLoading,
    hideLoading: hideLoading,
    showEmpty: showEmpty,
    showError: showError,
    confirm: confirm,
    renderBottomNav: renderBottomNav
  };
})();
