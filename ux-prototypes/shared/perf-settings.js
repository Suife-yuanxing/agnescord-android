/* ===== 林念念 Bot — Performance Settings (Phase 2) ===== */
/*
 * 4 档加载策略 + 7 个动效开关 + 自动推荐
 *
 * 档位:
 *   - 极致流畅 (high)  — 全开所有动效
 *   - 均衡 (balanced)  — 关闭花瓣/节日特效
 *   - 省电 (low)       — 仅保留必要动效
 *   - 自定义 (custom)  — 用户逐项控制
 *
 * 7 个开关:
 *   ripple, petals, navAnim, transition, moodAnim, festival, typing
 *
 * API:
 *   PerfSettings.init()
 *   PerfSettings.get(key)
 *   PerfSettings.set(key, value)
 *   PerfSettings.setTier(tier)
 *   PerfSettings.getTier()
 *   PerfSettings.autoRecommend()
 */
var PerfSettings = (function() {
  'use strict';

  var STORAGE_KEY = 'perf_settings';

  // ── 7 toggles with defaults per tier ──
  var TIERS = {
    high: {
      label: '极致流畅', emoji: '⚡',
      ripple: true, petals: true, navAnim: true, transition: true,
      moodAnim: true, festival: true, typing: true
    },
    balanced: {
      label: '均衡', emoji: '⚖️',
      ripple: true, petals: false, navAnim: true, transition: true,
      moodAnim: true, festival: false, typing: true
    },
    low: {
      label: '省电模式', emoji: '🔋',
      ripple: false, petals: false, navAnim: false, transition: false,
      moodAnim: false, festival: false, typing: true
    },
    custom: {
      label: '自定义', emoji: '🔧',
      ripple: true, petals: false, navAnim: true, transition: true,
      moodAnim: true, festival: false, typing: true
    }
  };

  var TOGGLE_META = [
    { key: 'ripple',     label: '涟漪效果',     desc: '点击卡片时的水波纹扩散' },
    { key: 'petals',     label: '花瓣飘落',     desc: '品牌页/聊天页的花瓣粒子' },
    { key: 'navAnim',    label: '导航动画',     desc: '底部导航栏的胶囊拉伸动画' },
    { key: 'transition', label: '转场动画',     desc: '页面切换时的推入/淡出效果' },
    { key: 'moodAnim',   label: '心情动画',     desc: 'Agnes 的心情idle微动画' },
    { key: 'festival',   label: '节日特效',     desc: '节日横幅的发光和装饰效果' },
    { key: 'typing',     label: '打字指示器',   desc: '聊天中对方正在输入的动画' }
  ];

  var _current = null;

  // ── Initialize ──
  function init() {
    _current = _load();
    if (!_current) {
      var tier = autoRecommend();
      _current = { tier: tier, settings: _cloneTier(tier) };
      _save();
    }
    _apply();
  }

  // ── Get / Set ──
  function get(key) {
    if (!_current) init();
    return _current.settings[key] !== false;
  }

  function set(key, value) {
    if (!_current) init();
    _current.settings[key] = !!value;
    _current.tier = 'custom';
    _save();
    _apply();
  }

  function setTier(tier) {
    if (!TIERS[tier]) return;
    _current = { tier: tier, settings: _cloneTier(tier) };
    _save();
    _apply();
  }

  function getTier() {
    if (!_current) init();
    return _current.tier;
  }

  function getSettings() {
    if (!_current) init();
    return _current.settings;
  }

  function getToggleMeta() { return TOGGLE_META; }
  function getTiers() { return TIERS; }

  // ── Auto Recommend ──
  function autoRecommend() {
    var score = 0;
    // CPU cores
    var cores = navigator.hardwareConcurrency || 4;
    if (cores >= 8) score += 3;
    else if (cores >= 6) score += 2;
    else if (cores >= 4) score += 1;

    // Device memory (Chrome only)
    var mem = navigator.deviceMemory || 4;
    if (mem >= 8) score += 3;
    else if (mem >= 6) score += 2;
    else if (mem >= 4) score += 1;

    // Reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 'low';
    }

    // Connection quality
    if (navigator.connection) {
      var conn = navigator.connection;
      if (conn.saveData) return 'low';
      if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') return 'low';
    }

    if (score >= 5) return 'high';
    if (score >= 3) return 'balanced';
    return 'low';
  }

  // ── Apply settings to DOM ──
  function _apply() {
    var s = _current.settings;
    var phone = document.querySelector('.phone');
    if (!phone) return;

    // Set data attributes for CSS targeting
    phone.setAttribute('data-perf-ripple', s.ripple !== false ? '1' : '0');
    phone.setAttribute('data-perf-petals', s.petals !== false ? '1' : '0');
    phone.setAttribute('data-perf-nav', s.navAnim !== false ? '1' : '0');
    phone.setAttribute('data-perf-transition', s.transition !== false ? '1' : '0');
    phone.setAttribute('data-perf-mood', s.moodAnim !== false ? '1' : '0');
    phone.setAttribute('data-perf-festival', s.festival !== false ? '1' : '0');
    phone.setAttribute('data-perf-typing', s.typing !== false ? '1' : '0');
  }

  // ── Persistence ──
  function _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_current)); } catch(e) {}
  }

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return null;
  }

  function _cloneTier(tier) {
    var t = TIERS[tier];
    var s = {};
    for (var k in t) {
      if (k !== 'label' && k !== 'emoji') s[k] = t[k];
    }
    return s;
  }

  return {
    init: init,
    get: get,
    set: set,
    setTier: setTier,
    getTier: getTier,
    getSettings: getSettings,
    getToggleMeta: getToggleMeta,
    getTiers: getTiers,
    autoRecommend: autoRecommend
  };
})();
