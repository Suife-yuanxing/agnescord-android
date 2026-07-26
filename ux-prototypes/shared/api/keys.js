  async function getApiKeys() {
    var r = await _fetch('/api-keys');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function createApiKey(data) {
    var r = await _fetch('/api-keys', { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function revokeApiKey(id) {
    var r = await _fetch('/api-keys/' + id + '/revoke', { method: 'POST' });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getApiKeyUsageSummary() {
    var r = await _fetch('/api-keys/usage-summary');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getApiKeyUsage(id, range) {
    var r = await _fetch('/api-keys/' + id + '/usage?range=' + (range || '7d'));
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getApiKeyEndpoints(id, range) {
    var r = await _fetch('/api-keys/' + id + '/endpoints?range=' + (range || '30d'));
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }
