  async function getStatsSummary(botId) {
    var r = await _fetch('/stats/' + botId + '/summary');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getStatsRelation(botId) {
    var r = await _fetch('/stats/' + botId + '/relation');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getStatsMood(params) {
    params = params || {};
    var qs = [];
    if (params.bot_id) qs.push('bot_id=' + params.bot_id);
    if (params.days) qs.push('days=' + params.days);
    var url = '/stats/mood' + (qs.length ? '?' + qs.join('&') : '');
    var r = await _fetch(url);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getStatsMoodDetail(date) {
    var r = await _fetch('/stats/mood/' + date);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getStatsTopics(params) {
    params = params || {};
    var qs = [];
    if (params.bot_id) qs.push('bot_id=' + params.bot_id);
    if (params.days) qs.push('days=' + params.days);
    var url = '/stats/topics' + (qs.length ? '?' + qs.join('&') : '');
    var r = await _fetch(url);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getStatsActiveHours(params) {
    params = params || {};
    var qs = [];
    if (params.bot_id) qs.push('bot_id=' + params.bot_id);
    if (params.days) qs.push('days=' + params.days);
    var url = '/stats/active-hours' + (qs.length ? '?' + qs.join('&') : '');
    var r = await _fetch(url);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getStatsUserProfile(botId) {
    var r = await _fetch('/stats/user-profile?bot_id=' + botId);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getStatsAchievements(botId) {
    var r = await _fetch('/stats/achievements?bot_id=' + botId);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function shareStats(botId) {
    var r = await _fetch('/stats/' + botId + '/share', { method: 'POST' });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }
