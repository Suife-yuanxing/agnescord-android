  async function getAppVersion() {
    var r = await _fetch('/app/version');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  // ── 服务器可用性探测（用于启动页判断离线模式）──
  async function _ping() {
    try {
      var ctrl = new AbortController();
      var t = setTimeout(function() { ctrl.abort(); }, 3000);
      var r = await fetch(_apiBase() + '/health', { method: 'GET', signal: ctrl.signal });
      clearTimeout(t);
      return r.ok;
    } catch (e) { return false; }
  }
