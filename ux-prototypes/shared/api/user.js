  async function getProfile() {
    var r = await _fetch('/user/profile');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function updateProfile(data) {
    var r = await _fetch('/user/profile', { method: 'PATCH', body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await _parseError(r));
    var d = await r.json();
    setCurrentUser(d);
    return d;
  }

  async function uploadAvatar(file) {
    var fd = new FormData();
    fd.append('file', file);
    var r = await _upload('/user/avatar', fd);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  // A2：聊天图片上传
  async function uploadChatImage(botId, file) {
    var fd = new FormData();
    fd.append('file', file);
    var r = await _upload('/messages/upload-image?bot_id=' + botId, fd);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getUserSettings() {
    var r = await _fetch('/user/settings');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function updateUserSettings(data) {
    var r = await _fetch('/user/settings', { method: 'PATCH', body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getDataPermissions() {
    var r = await _fetch('/user/data-permissions');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function updateDataPermissions(data) {
    var r = await _fetch('/user/data-permissions', { method: 'PUT', body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getBlacklist() {
    var r = await _fetch('/user/blacklist');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function addToBlacklist(blockedUserId, blockedName, reason) {
    var r = await _fetch('/user/blacklist', {
      method: 'POST',
      body: JSON.stringify({ blocked_user_id: blockedUserId, blocked_name: blockedName || '', reason: reason || '' }),
    });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function removeFromBlacklist(blockedUserId) {
    var r = await _fetch('/user/blacklist/' + blockedUserId, { method: 'DELETE' });
    if (!r.ok && r.status !== 204) throw new Error(await _parseError(r));
    return { ok: true };
  }
