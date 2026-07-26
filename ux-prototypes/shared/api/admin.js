  async function getSystemMetrics() {
    var r = await _fetch('/admin/system-metrics');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getAdminUsers(page, size) {
    var r = await _fetch('/admin/users?page=' + (page || 1) + '&size=' + (size || 20));
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getAdminBots() {
    var r = await _fetch('/admin/bots');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getAdminTokensRanking(period) {
    var r = await _fetch('/admin/tokens/ranking?period=' + (period || 'month'));
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getAdminTokens(period) {
    var r = await _fetch('/admin/tokens?period=' + (period || 'month'));
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getAdminLogs(level, limit) {
    var r = await _fetch('/admin/logs?level=' + (level || 'info') + '&limit=' + (limit || 50));
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getAdminBackups() {
    var r = await _fetch('/admin/backups');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function createBackup() {
    var r = await _fetch('/admin/backup', { method: 'POST' });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getAdminMetrics() {
    var r = await _fetch('/admin/metrics');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function resetAdminTokenStats() {
    var r = await _fetch('/admin/stats/reset', { method: 'POST' });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function restoreBackup(backupId) {
    var r = await _fetch('/admin/backup/' + backupId + '/restore', { method: 'POST' });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  // [安全] 下载备份文件（fetch + blob，避免 window.open 无鉴权）
  async function downloadBackup(backupId, fileName) {
    var r = await _fetch('/admin/backups/' + encodeURIComponent(backupId) + '/download');
    if (!r.ok) throw new Error(await _parseError(r));
    var blob = await r.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName || ('backup_' + backupId);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 100);
    return true;
  }
