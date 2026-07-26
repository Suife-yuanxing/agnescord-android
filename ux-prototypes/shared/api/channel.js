  async function getQQStatus() {
    var r = await _fetch('/channel/qq/status');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getQQStats() {
    var r = await _fetch('/channel/qq/stats/today');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getQQRecentMessages(limit) {
    var r = await _fetch('/channel/qq/recent-messages?limit=' + (limit || 3));
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getQQSettings() {
    var r = await _fetch('/channel/qq/settings');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function updateQQSettings(data) {
    var r = await _fetch('/channel/qq/settings', { method: 'PUT', body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getWechatStatus() {
    var r = await _fetch('/channel/wechat/status');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function disconnectQQ() {
    var r = await _fetch('/channel/qq/disconnect', { method: 'POST' });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function bindWechat(botId) {
    var r = await _fetch('/channel/wechat/bind?bot_id=' + botId, { method: 'POST' });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getWechatBindStatus(botId) {
    var r = await _fetch('/channel/wechat/bind/status?bot_id=' + botId);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function disconnectWechat(botId) {
    var r = await _fetch('/channel/wechat/disconnect?bot_id=' + botId, { method: 'DELETE' });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  // ── 额度 ──

  async function getQuota(botId) {
    var r = await _fetch('/quota?bot_id=' + (botId || ''));
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getQuotaStatus() {
    var r = await _fetch('/quota/status');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }
