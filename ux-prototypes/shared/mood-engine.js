/* ===== 林念念 Bot — Agnes 心情状态机 (Mood Engine) ===== */
/*
 * 基于 javascript-state-machine 的心情系统。
 *
 * 6 基础心情：happy / missing / excited / sleepy / bored / wronged
 * 2 特殊心情：celebrate / surprise（由节日系统或特殊事件触发）
 *
 * 每种心情对应：
 *   - CSS 类 .mood-{name}（控制 Agnes 视觉变化）
 *   - emoji 表情映射
 *   - idle 微动画
 *   - 过渡动画
 *
 * API:
 *   MoodEngine.init(options)     — 初始化状态机 + 绑定 DOM
 *   MoodEngine.setMood(name)     — 手动切换心情
 *   MoodEngine.getMood()         — 获取当前心情名
 *   MoodEngine.getMoodInfo()     — 获取 {name, emoji, label, cssClass}
 *   MoodEngine.onMoodChange(cb)  — 注册心情变更回调
 *   MoodEngine.destroy()         — 销毁定时器
 *
 * 依赖：state-machine.min.js（vendor）
 */
var MoodEngine = (function() {
  'use strict';

  // ── 心情定义 ──
  var MOODS = {
    happy:     { emoji: '😊', label: '开心', cssClass: 'mood-happy',     tier: 'base' },
    missing:   { emoji: '🥺', label: '想念', cssClass: 'mood-missing',   tier: 'base' },
    excited:   { emoji: '✨', label: '兴奋', cssClass: 'mood-excited',   tier: 'base' },
    sleepy:    { emoji: '😴', label: '困倦', cssClass: 'mood-sleepy',    tier: 'base' },
    bored:     { emoji: '😑', label: '无聊', cssClass: 'mood-bored',     tier: 'base' },
    wronged:   { emoji: '🥹', label: '委屈', cssClass: 'mood-wronged',   tier: 'base' },
    celebrate: { emoji: '🎉', label: '庆祝', cssClass: 'mood-celebrate', tier: 'special' },
    surprise:  { emoji: '🎁', label: '惊喜', cssClass: 'mood-surprise',  tier: 'special' }
  };

  // ── 合法转换表（from → [to, to, ...]）──
  var TRANSITIONS = {
    happy:     ['missing', 'excited', 'sleepy', 'bored', 'wronged', 'celebrate', 'surprise'],
    missing:   ['happy', 'excited', 'sleepy', 'bored', 'celebrate', 'surprise'],
    excited:   ['happy', 'missing', 'sleepy', 'bored', 'celebrate', 'surprise'],
    sleepy:    ['happy', 'missing', 'excited', 'bored', 'celebrate', 'surprise'],
    bored:     ['happy', 'missing', 'excited', 'sleepy', 'wronged', 'celebrate', 'surprise'],
    wronged:   ['happy', 'missing', 'excited', 'sleepy', 'bored', 'surprise'],
    celebrate: ['happy', 'excited', 'missing'],
    surprise:  ['happy', 'excited', 'missing']
  };

  // ── 内部状态 ──
  var _fsm = null;          // StateMachine 实例
  var _container = null;    // Agnes 容器 DOM
  var _callbacks = [];      // 心情变更回调
  var _idleTimer = null;    // idle 自动切换定时器
  var _autoIdle = true;     // 是否启用 idle 自动切换
  var _persistKey = 'agnes_mood';

  // ── 初始化 ──
  function init(options) {
    options = options || {};

    // 查找 Agnes 容器
    _container = options.container ||
      document.querySelector('.img-cat.hero') ||
      document.querySelector('.img-cat.avatar') ||
      document.querySelector('.anime-cat');

    _autoIdle = options.autoIdle !== false;
    if (options.persistKey) _persistKey = options.persistKey;

    // 恢复持久化的心情
    var savedMood = 'happy';
    try {
      var raw = localStorage.getItem(_persistKey);
      if (raw && MOODS[raw]) savedMood = raw;
    } catch(e) {}

    // 创建状态机（使用简化的自实现，避免依赖 UMD 格式问题）
    _fsm = {
      state: savedMood,
      canTransition: function(to) {
        var allowed = TRANSITIONS[_fsm.state];
        return allowed && allowed.indexOf(to) !== -1;
      },
      transition: function(to) {
        if (!_fsm.canTransition(to)) return false;
        var from = _fsm.state;
        _fsm.state = to;
        _onMoodChanged(from, to);
        return true;
      }
    };

    // 应用初始心情
    _applyMoodVisual(savedMood);
    _fireCallbacks(savedMood, MOODS[savedMood]);

    // 启动 idle 定时器
    if (_autoIdle) _startIdleTimer();
  }

  // ── 手动切换心情 ──
  function setMood(name) {
    if (!_fsm) { console.warn('[MoodEngine] 未初始化'); return false; }
    if (!MOODS[name]) { console.warn('[MoodEngine] 未知心情: ' + name); return false; }
    if (name === _fsm.state) return true;

    // 特殊心情允许从任何状态直接切换
    if (MOODS[name].tier === 'special') {
      var from = _fsm.state;
      _fsm.state = name;
      _onMoodChanged(from, name);
      return true;
    }

    return _fsm.transition(name);
  }

  // ── 获取当前心情 ──
  function getMood() {
    return _fsm ? _fsm.state : 'happy';
  }

  function getMoodInfo() {
    var name = getMood();
    var info = MOODS[name] || MOODS.happy;
    return { name: name, emoji: info.emoji, label: info.label, cssClass: info.cssClass };
  }

  // ── 回调 ──
  function onMoodChange(cb) {
    if (typeof cb === 'function') _callbacks.push(cb);
  }

  // ── 内部：心情变更处理 ──
  function _onMoodChanged(from, to) {
    _applyMoodVisual(to);
    _persistMood(to);
    _fireCallbacks(to, MOODS[to], from);
  }

  function _applyMoodVisual(name) {
    if (!_container) return;
    var info = MOODS[name];
    if (!info) return;

    // 移除所有心情类
    Object.keys(MOODS).forEach(function(k) {
      _container.classList.remove(MOODS[k].cssClass);
    });
    // 添加当前心情类
    _container.classList.add(info.cssClass);

    // 添加过渡动画
    _container.classList.add('mood-transition');
    setTimeout(function() {
      _container.classList.remove('mood-transition');
    }, 600);

    // 设置 data-mood 属性（供 CSS 选择器使用）
    var phone = _container.closest('.phone') || document.querySelector('.phone');
    if (phone) phone.setAttribute('data-mood', name);
  }

  function _persistMood(name) {
    try { localStorage.setItem(_persistKey, name); } catch(e) {}
  }

  function _fireCallbacks(name, info, from) {
    for (var i = 0; i < _callbacks.length; i++) {
      try { _callbacks[i](name, info, from); } catch(e) {}
    }
  }

  // ── Idle 自动切换 ──
  // 长时间无交互 → 自动切换到 sleepy / bored / missing
  var _IDLE_MOODS = ['sleepy', 'bored', 'missing'];
  var _IDLE_TIMEOUT = 5 * 60 * 1000; // 5 分钟无交互

  function _startIdleTimer() {
    _resetIdleTimer();
    // 监听用户交互事件
    ['click', 'touchstart', 'keydown', 'scroll'].forEach(function(evt) {
      document.addEventListener(evt, _resetIdleTimer, { passive: true });
    });
  }

  function _resetIdleTimer() {
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(function() {
      // 当前是基础心情才自动 idle
      if (_fsm && MOODS[_fsm.state] && MOODS[_fsm.state].tier === 'base') {
        // 根据时间段选择 idle 心情
        var hour = new Date().getHours();
        var idleMood;
        if (hour >= 23 || hour < 6) idleMood = 'sleepy';
        else if (hour >= 14 && hour < 17) idleMood = 'bored';
        else idleMood = 'missing';

        if (_fsm.state !== idleMood) {
          setMood(idleMood);
        }
      }
    }, _IDLE_TIMEOUT);
  }

  // ── 销毁 ──
  function destroy() {
    if (_idleTimer) clearTimeout(_idleTimer);
    ['click', 'touchstart', 'keydown', 'scroll'].forEach(function(evt) {
      document.removeEventListener(evt, _resetIdleTimer);
    });
    _callbacks = [];
    _fsm = null;
    _container = null;
  }

  // ── 公共 API ──
  return {
    init: init,
    setMood: setMood,
    getMood: getMood,
    getMoodInfo: getMoodInfo,
    onMoodChange: onMoodChange,
    destroy: destroy,
    MOODS: MOODS
  };
})();
