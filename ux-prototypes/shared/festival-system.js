/* ===== 林念念 Bot — 节日庆祝系统 (Festival System) ===== */
/*
 * 公历 + 农历节日检测 → 触发 Agnes 心情 + 节日装饰。
 *
 * API:
 *   FestivalSystem.init(options)       — 初始化 + 立即检测今日节日
 *   FestivalSystem.getToday()          — 返回 {festival, type, emoji} 或 null
 *   FestivalSystem.getUpcoming(days)   — 返回未来 N 天的节日列表
 *   FestivalSystem.onFestival(cb)      — 注册节日触发回调
 *
 * 依赖：lunar.min.js（vendor）、mood-engine.js（可选）
 */
var FestivalSystem = (function() {
  'use strict';

  // ── 公历固定节日 ──
  var GREGORIAN = {
    '01-01': { name: '元旦',       emoji: '🎆', mood: 'celebrate', decor: 'fireworks' },
    '02-14': { name: '情人节',     emoji: '💕', mood: 'excited',   decor: 'hearts' },
    '03-08': { name: '妇女节',     emoji: '🌸', mood: 'happy',     decor: 'flowers' },
    '04-01': { name: '愚人节',     emoji: '🃏', mood: 'surprise',  decor: 'confetti' },
    '05-01': { name: '劳动节',     emoji: '🎉', mood: 'celebrate', decor: 'confetti' },
    '06-01': { name: '儿童节',     emoji: '🧸', mood: 'excited',   decor: 'balloons' },
    '09-10': { name: '教师节',     emoji: '📚', mood: 'happy',     decor: 'flowers' },
    '10-01': { name: '国庆节',     emoji: '🇨🇳', mood: 'celebrate', decor: 'fireworks' },
    '10-31': { name: '万圣节',     emoji: '🎃', mood: 'surprise',  decor: 'pumpkins' },
    '12-24': { name: '平安夜',     emoji: '🍎', mood: 'excited',   decor: 'snow' },
    '12-25': { name: '圣诞节',     emoji: '🎄', mood: 'celebrate', decor: 'snow' }
  };

  // ── 农历固定节日（月-日）──
  var LUNAR = {
    '01-01': { name: '春节',       emoji: '🧧', mood: 'celebrate', decor: 'lanterns' },
    '01-15': { name: '元宵节',     emoji: '🏮', mood: 'celebrate', decor: 'lanterns' },
    '05-05': { name: '端午节',     emoji: '🐉', mood: 'excited',   decor: 'dragon' },
    '07-07': { name: '七夕节',     emoji: '💑', mood: 'excited',   decor: 'hearts' },
    '07-15': { name: '中元节',     emoji: '🪷', mood: 'missing',   decor: 'lotus' },
    '08-15': { name: '中秋节',     emoji: '🥮', mood: 'celebrate', decor: 'moon' },
    '09-09': { name: '重阳节',     emoji: '🌼', mood: 'happy',     decor: 'flowers' },
    '12-30': { name: '除夕',       emoji: '🎆', mood: 'celebrate', decor: 'fireworks' }
  };

  // ── 动态公历节日（第N个星期X）──
  var DYNAMIC_GREGORIAN = [
    { month: 5,  week: 2, day: 0, name: '母亲节', emoji: '👩', mood: 'happy', decor: 'flowers' },
    { month: 6,  week: 3, day: 0, name: '父亲节', emoji: '👨', mood: 'happy', decor: 'flowers' },
    { month: 11, week: 4, day: 4, name: '感恩节', emoji: '🦃', mood: 'happy', decor: 'autumn' }
  ];

  // ── 内部状态 ──
  var _callbacks = [];
  var _todayFestival = null;
  var _decorContainer = null;

  // ── 初始化 ──
  function init(options) {
    options = options || {};
    _decorContainer = options.decorContainer || document.querySelector('.phone');

    // 检测今日节日
    _todayFestival = _detectToday();

    if (_todayFestival) {
      _fireCallbacks(_todayFestival);
      // 触发心情引擎（如果已初始化）
      if (typeof MoodEngine !== 'undefined' && MoodEngine.getMood) {
        MoodEngine.setMood(_todayFestival.mood);
      }
      // 添加节日装饰
      _applyDecor(_todayFestival.decor);
    }
  }

  // ── 获取今日节日 ──
  function getToday() {
    return _todayFestival;
  }

  // ── 获取未来 N 天节日 ──
  function getUpcoming(days) {
    days = days || 30;
    var results = [];
    var now = new Date();

    for (var i = 1; i <= days; i++) {
      var d = new Date(now.getTime() + i * 86400000);
      var fest = _detectForDate(d);
      if (fest) {
        fest.date = d.toISOString().slice(0, 10);
        fest.daysAway = i;
        results.push(fest);
      }
    }
    return results;
  }

  // ── 回调 ──
  function onFestival(cb) {
    if (typeof cb === 'function') _callbacks.push(cb);
  }

  // ── 内部：检测今日 ──
  function _detectToday() {
    return _detectForDate(new Date());
  }

  function _detectForDate(date) {
    var mm = ('0' + (date.getMonth() + 1)).slice(-2);
    var dd = ('0' + date.getDate()).slice(-2);
    var key = mm + '-' + dd;

    // 1. 检查公历固定节日
    if (GREGORIAN[key]) {
      var g = GREGORIAN[key];
      return { festival: g.name, type: 'gregorian', emoji: g.emoji, mood: g.mood, decor: g.decor };
    }

    // 2. 检查动态公历节日
    for (var i = 0; i < DYNAMIC_GREGORIAN.length; i++) {
      var dg = DYNAMIC_GREGORIAN[i];
      if (_isNthWeekday(date, dg.month, dg.week, dg.day)) {
        return { festival: dg.name, type: 'gregorian', emoji: dg.emoji, mood: dg.mood, decor: dg.decor };
      }
    }

    // 3. 检查农历节日（需要 lunar-javascript）
    try {
      if (typeof Lunar !== 'undefined') {
        var solar = Solar.fromDate(date);
        var lunar = solar.getLunar();
        var lm = ('0' + lunar.getMonth()).slice(-2);
        var ld = ('0' + lunar.getDay()).slice(-2);
        var lKey = lm + '-' + ld;
        if (LUNAR[lKey]) {
          var l = LUNAR[lKey];
          return { festival: l.name, type: 'lunar', emoji: l.emoji, mood: l.mood, decor: l.decor };
        }
      }
    } catch(e) {
      // lunar-javascript 未加载时静默跳过
    }

    return null;
  }

  // 判断 date 是否为 month 月的第 week 个 weekday(day: 0=Sun)
  function _isNthWeekday(date, month, week, day) {
    if (date.getMonth() + 1 !== month) return false;
    var first = new Date(date.getFullYear(), month - 1, 1);
    var firstDay = first.getDay();
    var firstTarget = 1 + ((day - firstDay + 7) % 7);
    var target = firstTarget + (week - 1) * 7;
    return date.getDate() === target;
  }

  // ── 节日装饰 ──
  function _applyDecor(type) {
    if (!_decorContainer) return;
    _decorContainer.setAttribute('data-festival', type);

    // 根据装饰类型添加轻量 CSS 类
    _decorContainer.classList.add('festival-active', 'festival-' + type);

    // 节日横幅（插入到 scroll-area 前面）
    var scrollArea = _decorContainer.querySelector('.scroll-area');
    if (scrollArea && _todayFestival) {
      var banner = document.createElement('div');
      banner.className = 'festival-banner';
      banner.innerHTML = '<span class="festival-emoji">' + _todayFestival.emoji + '</span>' +
        '<span class="festival-text">今天是' + _todayFestival.festival + '！' + _todayFestival.emoji + '</span>';
      scrollArea.insertBefore(banner, scrollArea.firstChild);
    }
  }

  function _fireCallbacks(info) {
    for (var i = 0; i < _callbacks.length; i++) {
      try { _callbacks[i](info); } catch(e) {}
    }
  }

  return {
    init: init,
    getToday: getToday,
    getUpcoming: getUpcoming,
    onFestival: onFestival
  };
})();
