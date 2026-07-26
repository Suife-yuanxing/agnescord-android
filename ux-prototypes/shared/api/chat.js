  // ── 消息 ──

  async function listMessages(botId, cursor) {
    var url = '/messages?bot_id=' + botId + (cursor ? '&cursor=' + cursor : '');
    var r = await _fetch(url);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function searchMessages(q, botId, dateFrom, dateTo) {
    var qs = ['q=' + encodeURIComponent(q)];
    if (botId) qs.push('bot_id=' + botId);
    if (dateFrom) qs.push('date_from=' + dateFrom);
    if (dateTo) qs.push('date_to=' + dateTo);
    var r = await _fetch('/messages/search?' + qs.join('&'));
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function recallMessage(messageId) {
    var r = await _fetch('/messages/' + messageId + '/recall', { method: 'POST' });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function deleteMessage(messageId) {
    var r = await _fetch('/messages/' + messageId, { method: 'DELETE' });
    if (!r.ok && r.status !== 204) throw new Error(await _parseError(r));
    return { ok: true };
  }

  async function reportMessage(messageId, reason) {
    var r = await _fetch('/messages/' + messageId + '/report', {
      method: 'POST', body: JSON.stringify({ reason: reason || '用户举报' })
    });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  // ── WebSocket 聊天 ──

  var _ws = null;
  var _wsHandlers = null;

  function openChatWs(handlers) {
    handlers = handlers || {};
    var token = getAccessToken();
    if (!token) throw new Error('未登录，无法建立 WS');
    if (_ws) { try { _ws.close(); } catch (e) {} _ws = null; }

    var url = _wsBase() + '/chat/ws';
    var protocols = ['bearer.' + token];
    var rws;
    try {
      if (typeof ReconnectingWebSocket !== 'undefined') {
        rws = new ReconnectingWebSocket(url, protocols, {
          maxReconnectionDelay: 30000,
          minReconnectionDelay: 3000,
          reconnectionDelayGrowFactor: 2.0,
          connectionTimeout: 10000,
          maxRetries: Infinity
        });
      } else {
        rws = new WebSocket(url, protocols);
      }
    } catch (e) {
      if (handlers.onError) handlers.onError('WebSocket 建立失败: ' + e.message);
      return null;
    }
    _ws = rws;
    _wsHandlers = handlers;

    rws.onopen = function() { if (handlers.onOpen) handlers.onOpen(); };
    rws.onmessage = function(e) {
      var f;
      try { f = JSON.parse(e.data); } catch (err) { return; }
      switch (f.type) {
        case 'token':   if (handlers.onToken) handlers.onToken(f.text); break;
        case 'done':    if (handlers.onDone) handlers.onDone(f); break;
        case 'typing':  if (handlers.onTyping) handlers.onTyping(); break;
        case 'ack':     if (handlers.onAck) handlers.onAck(f); break;
        case 'error':   if (handlers.onError) handlers.onError(f.message || '服务端错误'); break;
        case 'pong':    break;
        case 'read_ack': break;
      }
    };
    rws.onerror = function() { if (handlers.onError) handlers.onError('WebSocket 错误'); };
    rws.onclose = function(ev) {
      if (_ws === rws) _ws = null;
      if (handlers.onClose) handlers.onClose(ev);
    };
    return rws;
  }

  function cancelWsReconnect() { /* no-op: reconnecting-websocket manages reconnection internally */ }

  function sendMsg(botId, text, clientId) {
    if (!_ws || _ws.readyState !== 1) throw new Error('WebSocket 未连接');
    _ws.send(JSON.stringify({ type: 'msg', bot_id: botId, text: text, client_id: clientId }));
  }

  function closeChatWs() {
    if (_ws) { try { _ws.close(); } catch (e) {} _ws = null; }
  }

  function wsReady() { return _ws && _ws.readyState === 1; }

  function newClientId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  // ── 通知 ──

  async function getNotifications(params) {
    params = params || {};
    var qs = [];
    if (params.type) qs.push('type=' + encodeURIComponent(params.type));
    if (params.unread != null) qs.push('unread=' + (params.unread ? '1' : '0'));
    if (params.cursor) qs.push('cursor=' + encodeURIComponent(params.cursor));
    if (params.limit) qs.push('limit=' + params.limit);
    var url = '/notifications' + (qs.length ? '?' + qs.join('&') : '');
    var r = await _fetch(url);
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function getUnreadCount() {
    var r = await _fetch('/notifications/unread-count');
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function markNotificationRead(id) {
    var r = await _fetch('/notifications/' + id + '/read', { method: 'PATCH' });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function markAllNotificationsRead() {
    var r = await _fetch('/notifications/read-all', { method: 'PATCH' });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }
