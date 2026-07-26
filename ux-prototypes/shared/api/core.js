  function _base() {
    return (window.APP_CONFIG && window.APP_CONFIG.server_base) || location.origin;
  }
  function _apiBase() { return _base() + '/api/v1'; }
  function _wsBase() {
    // http→ws, https→wss
    return _base().replace(/^http/, 'ws') + '/api/v1';
  }

  // ── Token 持久化（localStorage）+ JWT 过期校验 ──
  // [安全] 解析 JWT payload 检查过期时间（不验证签名，仅客户端自检）
  function _jwtExpired(token) {
    if (!token) return true;
    try {
      var parts = token.split('.');
      if (parts.length !== 3) return false; // 非标准 JWT，跳过检查
      var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.exp && (payload.exp * 1000) < Date.now()) return true;
    } catch (e) {} // 解析失败不阻断
    return false;
  }
  function getAccessToken() {
    var token = localStorage.getItem('access_token');
    if (token && _jwtExpired(token)) {
      return null; // 返回 null 触发 401 刷新流程
    }
    return token;
  }
  function getRefreshToken() { return localStorage.getItem('refresh_token'); }
  function setTokens(access, refresh) {
    localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
    // P0-2：同步 JWT token 到原生端（供 PollingForegroundService 读取）+ 启动轮询（幂等）
    if (window.NativeBridge && window.NativeBridge.saveTokens) {
      try { window.NativeBridge.saveTokens(access, refresh || ''); } catch (e) {}
    }
    if (window.NativeBridge && window.NativeBridge.startPollingService) {
      try { window.NativeBridge.startPollingService(); } catch (e) {}
    }
  }
  function clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');
    localStorage.removeItem('current_bot_id');
    // P0-2：清除原生端 token + 停止轮询服务
    if (window.NativeBridge && window.NativeBridge.stopPollingService) {
      try { window.NativeBridge.stopPollingService(); } catch (e) {}
    }
    if (window.NativeBridge && window.NativeBridge.clearNativeTokens) {
      try { window.NativeBridge.clearNativeTokens(); } catch (e) {}
    }
  }
  function isLoggedIn() { return !!localStorage.getItem('access_token'); }
  function getCurrentUser() {
    try { var u = localStorage.getItem('current_user'); return u ? JSON.parse(u) : null; }
    catch (e) { return null; }
  }
  function setCurrentUser(u) { localStorage.setItem('current_user', JSON.stringify(u)); }
  function getCurrentBotId() {
    var v = localStorage.getItem('current_bot_id');
    return v ? parseInt(v, 10) : null;
  }
  function setCurrentBotId(id) { localStorage.setItem('current_bot_id', String(id)); }

  // ── 401 自动刷新（并发只刷一次）──
  var _refreshing = null;
  function refreshAccessToken() {
    var refresh = getRefreshToken();
    if (!refresh) return Promise.resolve(false);
    if (_refreshing) return _refreshing;
    _refreshing = (async function() {
      try {
        var r = await fetch(_apiBase() + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (!r.ok) { clearTokens(); return false; }
        var d = await r.json();
        if (d.access_token) {
          setTokens(d.access_token, getRefreshToken());
          return true;
        }
        clearTokens();
        return false;
      } catch (e) {
        clearTokens();
        return false;
      }
    })();
    var p = _refreshing;
    p.then(function() { _refreshing = null; });
    return p;
  }

  // ── 全局超时配置（弱网保护）──
  var FETCH_TIMEOUT = 15000; // 15s

  function _timeoutSignal(ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, ms);
    return { signal: ctrl.signal, clear: function() { clearTimeout(timer); } };
  }

  // ── fetch 封装 ──
  async function _fetch(path, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    var token = getAccessToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var ts = _timeoutSignal(options.timeout || FETCH_TIMEOUT);
    var resp;
    try {
      resp = await fetch(_apiBase() + path, Object.assign({}, options, { headers: headers, signal: ts.signal }));
    } catch (e) {
      ts.clear();
      if (e.name === 'AbortError') throw new Error('请求超时，请检查网络');
      throw new Error('网络错误: ' + (e.message || '无法连接服务器'));
    }
    ts.clear();
    // 401 → 尝试刷新一次重试
    if (resp.status === 401 && !options._retried) {
      var _tk = localStorage.getItem('access_token');
      if (!_tk) {
        return resp;
      }
      var ok = await refreshAccessToken();
      if (ok) {
        options._retried = true;
        return _fetch(path, options);
      }
      clearTokens();
      throw new Error('未登录');
    }
    return resp;
  }

  // ── multipart 上传（不设 Content-Type，让浏览器自动设 boundary）──
  async function _upload(path, formData, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {});
    var token = getAccessToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var ts = _timeoutSignal(options.timeout || 30000); // 上传给 30s
    var resp;
    try {
      resp = await fetch(_apiBase() + path, Object.assign({}, options, { method: 'POST', headers: headers, body: formData, signal: ts.signal }));
    } catch (e) {
      ts.clear();
      if (e.name === 'AbortError') throw new Error('上传超时，请检查网络');
      throw new Error('网络错误: ' + (e.message || '无法连接服务器'));
    }
    ts.clear();
    if (resp.status === 401 && !options._retried) {
      var _tk = localStorage.getItem('access_token');
      if (!_tk) { return resp; }
      var ok = await refreshAccessToken();
      if (ok) { options._retried = true; return _upload(path, formData, options); }
      clearTokens();
      throw new Error('未登录');
    }
    return resp;
  }

  // 解析后端标准错误体 {detail: {code, message}} 或 {detail: "string"}
  async function _parseError(resp) {
    try {
      var d = await resp.json();
      if (d.detail) {
        if (typeof d.detail === 'string') return d.detail;
        if (Array.isArray(d.detail)) {
          return d.detail.map(function(e) { return e.msg || e.message || JSON.stringify(e); }).join('; ');
        }
        return d.detail.message || d.detail.code || '请求失败(' + resp.status + ')';
      }
      return d.message || ('HTTP ' + resp.status);
    } catch (e) {
      return 'HTTP ' + resp.status;
    }
  }
