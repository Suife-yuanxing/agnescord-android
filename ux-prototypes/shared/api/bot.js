  async function listBots() {
    var r = await _fetch('/bots');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function createBot(data) {
    var r = await _fetch('/bots', { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getBot(id) {
    var r = await _fetch('/bots/' + id);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function updateBot(id, data) {
    var r = await _fetch('/bots/' + id, { method: 'PUT', body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function deleteBot(id) {
    var r = await _fetch('/bots/' + id, { method: 'DELETE' });
    if (!r.ok && r.status !== 204) throw new Error(await _parseError(r));
    return { ok: true };
  }

  async function uploadBotAvatar(id, file) {
    var fd = new FormData();
    fd.append('file', file);
    var r = await _upload('/bots/' + id + '/avatar', fd);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function clearBotMemory(id) {
    var r = await _fetch('/bots/' + id + '/memory', { method: 'DELETE' });
    if (!r.ok) throw new Error(await _parseError(r));
    return { ok: true };
  }

  async function getBotTemplates() {
    var r = await _fetch('/bot-templates');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getBotAbilities(id) {
    var r = await _fetch('/bots/' + id + '/abilities');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function updateBotAbilities(id, data) {
    var r = await _fetch('/bots/' + id + '/abilities', { method: 'PUT', body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  // ── 仪表盘 ──

  async function getDashboard() {
    var r = await _fetch('/dashboard');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getBotDashboard(botId) {
    var r = await _fetch('/dashboard/bot/' + botId);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }
