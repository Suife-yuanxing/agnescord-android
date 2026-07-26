/* ===== 林念念 Bot — SPA 路由引擎 ===== */
/*
 * 零依赖 SPA 路由器，基于 Hash 路由（file:// 兼容）。
 *
 * API:
 *   Router.init(config)      — 初始化路由表 + 绑定 hashchange/popstate
 *   Router.navigate(path)    — 切换视图 + 更新 hash + 触发转场
 *   Router.back()            — 方向判定 + history.back()
 *   Router.getActiveView()   — 返回当前视图名
 *   Router.onRouteChange(cb) — 注册路由变更回调
 *
 * 路由表 config.routes:
 *   { '/': { view: 'dashboard', tab: true, emotion: 4 }, ... }
 *
 * 安全规范:
 *   S11 — 路由白名单：仅允许 config.routes 中定义的路径
 *   S12 — 视图鉴权守卫：需 auth 的视图加载前检查 token
 *
 * WS 管理（验收 2.4）:
 *   进入 chat 视图 → 调用 onEnterView 钩子（由 app.js 负责 openChatWs）
 *   离开 chat 视图 → 不关闭 WS（保持连接）
 *   SPA 销毁 → 由 app.js 负责 closeChatWs
 */
var Router = (function() {
  'use strict';

  // ── 内部状态 ──
  var _routes = {};           // 路由表 { path: { view, tab, emotion, auth } }
  var _activePath = null;     // 当前路径
  var _activeView = null;     // 当前视图名
  var _history = [];          // 导航历史（用于方向判定）
  var _callbacks = [];        // 路由变更回调
  var _initialized = false;
  var _shell = null;          // .spa-shell 容器元素
  var _transitioning = false; // 转场进行中标志

  // ── 默认配置 ──
  var _config = {
    defaultPath: '/',
    loginPath: '/login',
    transitionDuration: 300   // ms，与 base.css 的 transition 值一致
  };

  // ================================================================
  //  初始化
  // ================================================================

  function init(config) {
    if (_initialized) return;
    config = config || {};

    // 合并路由表
    _routes = config.routes || {};
    if (config.defaultPath) _config.defaultPath = config.defaultPath;
    if (config.loginPath) _config.loginPath = config.loginPath;
    if (config.transitionDuration) _config.transitionDuration = config.transitionDuration;

    // 查找 SPA shell
    _shell = document.querySelector('.spa-shell');
    if (!_shell) {
      console.warn('[Router] .spa-shell 容器未找到');
      return;
    }

    // 绑定 hashchange
    window.addEventListener('hashchange', _onHashChange);

    _initialized = true;

    // 从当前 hash 初始化路由
    var hash = _getHash();
    if (hash && _routes[hash]) {
      _activateRoute(hash, null, true); // 首次加载无转场
    } else {
      navigate(_config.defaultPath);
    }
  }

  // ================================================================
  //  导航
  // ================================================================

  function navigate(path, options) {
    options = options || {};

    // S11：路由白名单校验
    if (!_routes[path]) {
      console.warn('[Router] 非法路径被拒绝: ' + path);
      return;
    }

    var route = _routes[path];

    // S12：鉴权守卫
    if (route.auth !== false && typeof API !== 'undefined' && !API.isLoggedIn()) {
      navigate(_config.loginPath);
      return;
    }

    // 已在目标路径 → 不重复切换
    if (path === _activePath && !options.force) return;

    // 转场方向判定
    var direction = _getTransitionDirection(_activePath, path);

    // 更新 hash（触发 hashchange → _onHashChange 不再重复 navigate）
    if (_getHash() !== path) {
      window.location.hash = '#' + path;
    }

    // 激活路由
    _activateRoute(path, direction, false);
  }

  function back() {
    if (_history.length > 1) {
      var prevPath = _history[_history.length - 2];
      var direction = 'push-left'; // 返回 → 左推入
      window.history.back();
      // hashchange 事件会自动触发 _onHashChange
      // 但我们需要覆盖方向判定
      if (prevPath && _routes[prevPath]) {
        _pendingDirection = direction;
      }
    } else {
      // 无历史可退 → 委托原生层
      if (window.NativeApp && window.NativeApp.goBack) {
        window.NativeApp.goBack();
      }
    }
  }

  // 挂起的方向覆盖（用于 back() 的方向判定）
  var _pendingDirection = null;

  // ================================================================
  //  内部：路由激活 + 转场
  // ================================================================

  function _activateRoute(path, direction, noTransition) {
    var route = _routes[path];
    if (!route) return;

    var prevPath = _activePath;
    var prevView = _activeView;
    var newView = route.view;

    // 更新状态
    _activePath = path;
    _activeView = newView;

    // 维护导航历史
    if (!noTransition) {
      // 前进导航
      if (_history.length > 0 && _history[_history.length - 1] === path) {
        // 返回到同一页面 → 弹出
        _history.pop();
      } else {
        _history.push(path);
      }
    } else {
      _history = [path];
    }

    // 更新 emotion 属性
    var phone = document.querySelector('.phone');
    if (phone && route.emotion) {
      phone.setAttribute('data-emotion', String(route.emotion));
    }

    // 更新底部导航 active 状态
    _updateNavActive(path);

    // 转场动画
    if (noTransition || !_shell) {
      // 首次加载：直接显示
      _showView(newView);
      _fireCallbacks(path, route);
    } else {
      // 使用挂起的方向覆盖（back() 设定）
      if (_pendingDirection) {
        direction = _pendingDirection;
        _pendingDirection = null;
      }

      _transitionViews(prevView, newView, direction);
      _fireCallbacks(path, route);
    }
  }

  function _showView(viewName) {
    var views = _shell.querySelectorAll('.spa-view');
    for (var i = 0; i < views.length; i++) {
      var v = views[i];
      if (v.id === 'view-' + viewName) {
        v.classList.add('active');
        v.classList.remove('fade-enter', 'fade-leave',
          'push-right-enter', 'push-right-leave',
          'push-left-enter', 'push-left-leave');
      } else {
        v.classList.remove('active');
      }
    }
  }

  function _transitionViews(fromView, toView, direction) {
    if (_transitioning) return;
    _transitioning = true;

    var fromEl = fromView ? document.getElementById('view-' + fromView) : null;
    var toEl = document.getElementById('view-' + toView);

    if (!toEl) {
      _transitioning = false;
      return;
    }

    // 判定转场类型
    var transitionClass = direction || 'fade';

    // 准备新视图
    toEl.classList.add(transitionClass + '-enter');
    toEl.classList.add('active');

    // 强制 reflow 让浏览器识别初始状态
    void toEl.offsetHeight;

    // 执行转场
    if (fromEl) {
      fromEl.classList.add(transitionClass + '-leave');
      fromEl.classList.remove('active');
    }
    toEl.classList.remove(transitionClass + '-enter');

    // 转场完成后清理
    setTimeout(function() {
      if (fromEl) {
        fromEl.classList.remove('active', transitionClass + '-leave');
      }
      _transitioning = false;
    }, _config.transitionDuration + 50);
  }

  // ================================================================
  //  转场方向判定
  // ================================================================

  function _getTransitionDirection(fromPath, toPath) {
    if (!fromPath || !_routes[fromPath] || !_routes[toPath]) return 'fade';

    var fromRoute = _routes[fromPath];
    var toRoute = _routes[toPath];

    // Tab → Tab: 淡入淡出
    if (fromRoute.tab && toRoute.tab) return 'fade';

    // Tab → 子页面: 右推入
    if (fromRoute.tab && !toRoute.tab) return 'push-right';

    // 子页面 → Tab（返回）: 左推入
    if (!fromRoute.tab && toRoute.tab) return 'push-left';

    // 子页面 → 子页面: 根据历史判定
    if (_history.length > 1 && _history[_history.length - 2] === toPath) {
      return 'push-left'; // 返回
    }
    return 'push-right'; // 前进
  }

  // ================================================================
  //  底部导航同步
  // ================================================================

  function _updateNavActive(path) {
    var nav = document.getElementById('bottomNav');
    if (!nav) return;

    var items = nav.querySelectorAll('.nav-item');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var href = item.getAttribute('href') || '';
      var itemPath = href.replace(/^#/, '');

      if (itemPath === path) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
        // 胶囊动画由 app.js initBottomNav 处理
      } else {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
      }
    }
  }

  // ================================================================
  //  Hash 工具
  // ================================================================

  function _getHash() {
    var hash = window.location.hash;
    if (!hash || hash === '#') return '';
    return hash.replace(/^#/, '');
  }

  function _onHashChange() {
    if (!_initialized) return;
    var hash = _getHash();
    if (!hash) {
      navigate(_config.defaultPath);
      return;
    }
    // S11: 白名单校验
    if (!_routes[hash]) {
      console.warn('[Router] hashchange 非法路径: ' + hash);
      navigate(_config.defaultPath);
      return;
    }
    // 避免重复激活
    if (hash === _activePath) return;

    var direction = _pendingDirection || _getTransitionDirection(_activePath, hash);
    _pendingDirection = null;
    _activateRoute(hash, direction, false);
  }

  // ================================================================
  //  回调
  // ================================================================

  function _fireCallbacks(path, route) {
    for (var i = 0; i < _callbacks.length; i++) {
      try { _callbacks[i](path, route); } catch (e) {}
    }
  }

  function onRouteChange(cb) {
    if (typeof cb === 'function') _callbacks.push(cb);
  }

  // ================================================================
  //  公共 API
  // ================================================================

  function getActiveView() { return _activeView; }
  function getActivePath() { return _activePath; }
  function isInitialized() { return _initialized; }

  return {
    init: init,
    navigate: navigate,
    back: back,
    getActiveView: getActiveView,
    getActivePath: getActivePath,
    isInitialized: isInitialized,
    onRouteChange: onRouteChange
  };
})();
