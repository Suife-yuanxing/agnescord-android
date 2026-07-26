// [安全] _resolveUrl 已由 app.js 全局提供（含协议白名单过滤）

// ===== 聊天背景全局同步 (loadChatBg + 跨页由 app.js storage 事件统一管理) =====
loadChatBg();

// ===== 聊天页初始化：拉历史 + 建 WS（对接 8766 真后端）=====
(function() {
  var params = new URLSearchParams(location.search);
  var botId = params.get('bot_id') || API.getCurrentBotId();
  if (!botId) {
    if (typeof showToast === 'function') showToast('未指定 Bot，请先创建');
    setTimeout(function() { location.href = 'Bot创建向导.html'; }, 800);
    return;
  }
  API.setCurrentBotId(botId);

  if (typeof showToast === 'function' && !API.isLoggedIn()) {
    showToast('离线模式：消息功能需要登录');
  }

  window._chat = { botId: parseInt(botId, 10), pendingBotBubble: null, _manualClose: false };

  // 补全右上角设置链接的 bot_id 参数
  var settingsLink = document.getElementById('botSettingsLink');
  if (settingsLink) settingsLink.href = 'Bot设置.html?bot_id=' + botId;

  // A5+A6：拉 Bot 详情回填顶部名 + 人格标签 + 头像
  API.getBot(botId).then(function(bot) {
    window._chat.bot = bot; // 存供消息渲染用
    var nameEl = document.querySelector('.title-bar .name');
    if (nameEl && bot.name) nameEl.textContent = bot.name;
    // A5：人格标签 + 在线状态（读 bot.is_active，不再硬编码“在线”）
    var personaLabels = { tsundere: '傲娇', gentle: '温柔', sarcastic: '毒舌', energetic: '元气', emotionless: '三无', sly: '腹黑' };
    var personaEl = document.querySelector('.title-bar .persona-tag, .title-bar .status');
    if (personaEl) {
      var label = bot.personality ? (personaLabels[bot.personality] || bot.personality) : '';
      // 基于 is_active 显示真实状态
      var isBotActive = bot.is_active !== false;
      var statusText = isBotActive ? '在线' : '已停用';
      personaEl.innerHTML = '<span class="dot"></span> ' + (label ? label + ' · ' + statusText : statusText);
    }
    // A6：头像 — 读 avatar_url 或按 personality 映射预设猫娘
    var PERSONA_AVATARS = { tsundere: 'agnes-tsundere.png', gentle: 'agnes-gentle.png', sarcastic: 'agnes-sarcastic.png', energetic: 'agnes-energetic.png', emotionless: 'agnes-emotionless.png', sly: 'agnes-sly.png' };
    var avatarUrl = bot.avatar_url ? _resolveUrl(bot.avatar_url) : ('shared/agnes-' + (PERSONA_AVATARS[bot.personality] ? bot.personality : 'cat') + '.png');
    var fallbackAvatar = 'shared/agnes-' + (PERSONA_AVATARS[bot.personality] ? bot.personality : 'cat') + '.png';
    // [安全] 通过 .src 赋值而非 innerHTML 设置图片 URL
    var avImgs = document.querySelectorAll('.title-bar .avatar-wrap img, .msg-avatar img');
    avImgs.forEach(function(img) {
      img.src = avatarUrl;
      img.onerror = function() { this.onerror = null; this.src = fallbackAvatar; };
    });
  }).catch(function() {});

  // 拉历史消息渲染
  API.listMessages(botId).then(function(d) {
    var list = document.getElementById('messageList');
    list.innerHTML = '';  // 无条件清掉静态演示消息（A4：新 bot 空历史时不再残留演示内容）
    if (d && d.messages && d.messages.length > 0) {
      // A1：后端返回 DESC（新→旧），前端 reverse 后正序渲染（旧→新），最新在底部
      d.messages.reverse();
      d.messages.forEach(function(m) { appendHistoryMessage(list, m); });
      // 暴力滚动到底：scrollTop 设极大值，浏览器自动 clamp 到 scrollHeight
      setTimeout(function(){ list.scrollTop = 999999; }, 150);
    } else {
      // A4：空历史显示空状态提示
      list.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#C0A0B0;font-size:13px;line-height:1.8;">还没有聊天记录<br>发条消息开始对话吧 💬</div>';
    }
  }).catch(function(e) {
    if (typeof showToast === 'function') showToast('加载历史失败: ' + e.message);
  });

  connectWs();
})();

function appendHistoryMessage(list, m) {
  var row = document.createElement('div');
  var isUser = m.role === 'user';
  row.className = isUser ? 'msg-row me' : 'msg-row';
  var t = new Date((m.time || 0) * 1000);
  var hh = t.getHours().toString().padStart(2,'0');
  var mm = t.getMinutes().toString().padStart(2,'0');
  // [安全] 头像用 createElement 而非 innerHTML 拼接
  var avatarEl;
  if (isUser) {
    avatarEl = document.createElement('div');
    avatarEl.className = 'msg-avatar user';
    avatarEl.textContent = '我';
  } else {
    avatarEl = document.createElement('div');
    avatarEl.className = 'msg-avatar bot';
    var catDiv = document.createElement('div');
    catDiv.className = 'img-cat avatar img-sm';
    var img = _safeCreateImg(
      (window._chat && window._chat.bot && window._chat.bot.avatar_url) ? _resolveUrl(window._chat.bot.avatar_url) : 'shared/agnes-cat.png',
      'Bot', 'shared/agnes-cat.png');
    catDiv.appendChild(img);
    avatarEl.appendChild(catDiv);
  }
  row.appendChild(avatarEl);
  var bubbleDiv = document.createElement('div');
  var bubbleClass = isUser ? 'bubble me' : 'bubble bot';
  bubbleDiv.className = bubbleClass;
  // 撤回消息渲染
  if (m.recalled) {
    bubbleDiv.setAttribute('data-recalled', '1');
    var span = document.createElement('span');
    span.style.cssText = 'color:#C0A0B0;font-style:italic;';
    span.textContent = '你撤回了一条消息';
    bubbleDiv.appendChild(span);
  } else {
    // 图片消息：检查 content 是否是图片 URL
    var content = m.content || '';
    var isImage = m.type === 'image' || /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(content);
    if (isImage && content) {
      bubbleDiv.style.cssText = 'padding:5px;background:transparent;box-shadow:none;';
      var msgImg = _safeCreateImg(_resolveUrl(content), '图片');
      msgImg.className = 'msg-img';
      msgImg.loading = 'lazy';
      msgImg.style.cssText = 'max-width:200px;max-height:200px;border-radius:12px;cursor:pointer;';
      msgImg.addEventListener('click', function() { previewImage(this.src); });
      bubbleDiv.appendChild(msgImg);
      var timeDiv = document.createElement('div');
      timeDiv.className = 'time';
      timeDiv.style.marginTop = '4px';
      timeDiv.textContent = hh + ':' + mm;
      bubbleDiv.appendChild(timeDiv);
    } else {
      bubbleDiv.appendChild(document.createTextNode(content));
      var timeDiv = document.createElement('div');
      timeDiv.className = 'time';
      timeDiv.textContent = hh + ':' + mm;
      bubbleDiv.appendChild(timeDiv);
    }
  }
  // 记录 message_id
  if (m.id) bubbleDiv.setAttribute('data-msg-id', m.id);
  row.appendChild(bubbleDiv);
  list.appendChild(row);
}

// [安全] escapeHtml 已由 app.js 全局提供

// Bot 头像更换
function changeBotAvatar() {
  document.getElementById('botAvatarInput').click();
}
function handleBotAvatarSelected(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { if (typeof showToast === 'function') showToast('头像最大 2MB'); return; }
  if (typeof API === 'undefined' || !API.uploadBotAvatar) { if (typeof showToast === 'function') showToast('上传功能不可用'); return; }
  var botId = window._chat ? window._chat.botId : null;
  if (!botId) { if (typeof showToast === 'function') showToast('未指定 Bot'); return; }
  if (typeof showToast === 'function') showToast('上传中…');
  API.uploadBotAvatar(botId, file).then(function(r) {
    if (r && r.avatar_url) {
      var fullUrl = _resolveUrl(r.avatar_url);
      var avImgs = document.querySelectorAll('.title-bar .avatar-wrap img, .msg-avatar.bot img');
      avImgs.forEach(function(img) { img.src = fullUrl; });
      // 更新内存中的 bot 对象
      if (window._chat && window._chat.bot) window._chat.bot.avatar_url = r.avatar_url;
      if (typeof showToast === 'function') showToast('头像已更新');
    }
  }).catch(function(err) {
    if (typeof showToast === 'function') showToast('上传失败：' + (err.message || '未知错误'));
  });
  e.target.value = '';
}

// ── WS 断线横幅提示 ──
function _showWsBanner(msg) {
  var banner = document.getElementById('wsBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'wsBanner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:8px 16px;text-align:center;font-size:12px;font-weight:600;color:#fff;background:rgba(255,107,107,0.92);backdrop-filter:blur(8px);transform:translateY(-100%);transition:transform 0.3s ease;';
    document.body.appendChild(banner);
  }
  banner.textContent = msg;
  banner.style.transform = 'translateY(0)';
}
function _hideWsBanner() {
  var banner = document.getElementById('wsBanner');
  if (banner) banner.style.transform = 'translateY(-100%)';
}

function connectWs() {
  API.openChatWs({
    onOpen: function() {
      _hideWsBanner();
    },
    onAck: function(f) {
      if (f.duplicate && typeof showToast === 'function') showToast('消息已发送过（去重）');
      // S2修复：ack 帧回填 message_id 到用户气泡
      // 兼容后端字段名：message_id / server_id / msg_id
      var ackId = f.message_id || f.server_id || f.msg_id;
      if (ackId) {
        var pendingBubble = document.querySelector('.bubble.me[data-pending="1"]');
        if (pendingBubble) {
          pendingBubble.setAttribute('data-msg-id', ackId);
          pendingBubble.removeAttribute('data-pending');
        }
      }
    },
    onTyping: function() { /* typing dots 由 sendMessage 本地先建 */ },
    onToken: function(text) {
      var bubble = window._chat.pendingBotBubble;
      if (!bubble) return;
      // 首个 token：把 typing dots 换成流式文本容器 + 光标
      if (bubble._typingShown) {
        bubble.querySelector('.bubble.bot').innerHTML = '<span class="stream-text"></span><span class="cursor">&nbsp;</span>';
        bubble._typingShown = false;
      }
      var el = bubble.querySelector('.stream-text');
      if (el) {
        el.appendChild(document.createTextNode(text));
        var list = document.getElementById('messageList');
        list.scrollTop = list.scrollHeight;
      }
    },
    onDone: function(f) {
      var bubble = window._chat.pendingBotBubble;
      if (bubble) {
        var cursor = bubble.querySelector('.cursor');
        if (cursor) cursor.remove();
        var t = new Date();
        var hh = t.getHours().toString().padStart(2,'0');
        var mm = t.getMinutes().toString().padStart(2,'0');
        bubble.querySelector('.bubble.bot').insertAdjacentHTML('beforeend',
          '<div class="time">' + hh + ':' + mm + '</div>');
        bubble.classList.add('anim-in');
        // S2修复：done 帧回填 message_id 到 bot 气泡
        // 后端设计文档字段名为 server_id，兼容 message_id
        var doneId = f.server_id || f.message_id;
        if (doneId) {
          var botBubble = bubble.querySelector('.bubble.bot');
          if (botBubble) botBubble.setAttribute('data-msg-id', doneId);
        }
        window._chat.pendingBotBubble = null;
        var list = document.getElementById('messageList');
        list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
      }
    },
    onError: function(msg) {
      if (typeof showToast === 'function') showToast('聊天错误: ' + msg);
      var bubble = window._chat.pendingBotBubble;
      if (bubble) {
        bubble.querySelector('.bubble.bot').innerHTML = '<div class="stream-text">(回复失败: ' + escapeHtml(msg || '') + ')</div>';
      }
      window._chat.pendingBotBubble = null;
    },
    // [安全] 指数退避重连（替代固定 3s 重连）
    _autoReconnect: true,
    onClose: function(ev) {
      // api.js 内置的指数退避重连已生效（3s→6s→12s→24s→30s 上限）
      if (window._chat._manualClose) {
        if (typeof API.cancelWsReconnect === 'function') API.cancelWsReconnect();
      } else {
        _showWsBanner('连接断开，重连中…');
      }
    },
  });
}

// ===== A3：键盘 — 仅输入栏 position:fixed 浮到键盘上方，其余不动 =====
(function() {
  var inputBar = document.querySelector('.input-bar');
  if (!inputBar) return;
  var origMargin = inputBar.style.margin || '';
  var origBottom = '';
  window._onKeyboardChanged = function(keyboardHCss) {
    if (keyboardHCss > 60) {
      inputBar.style.position = 'fixed';
      inputBar.style.bottom = keyboardHCss + 'px';
      inputBar.style.left = '12px';
      inputBar.style.right = '12px';
      inputBar.style.zIndex = '999';
      inputBar.style.transition = 'bottom 0.12s ease-out';
      var list = document.getElementById('messageList');
      if (list) setTimeout(function(){ list.scrollTop = 999999; }, 150);
    } else {
      inputBar.style.position = '';
      inputBar.style.bottom = '';
      inputBar.style.left = '';
      inputBar.style.right = '';
      inputBar.style.zIndex = '';
      inputBar.style.transition = 'bottom 0.18s ease-out';
    }
  };
})();

// ===== A7：语音输入 — WeChat 风格原生录音 =====
(function() {
  var micBtn = document.getElementById('micBtn') || document.querySelector('[onmousedown*="startRecording"]');
  if (!micBtn) return;
  var isRecording = false;
  var canUseRecording = window.NativeBridge && typeof window.NativeBridge.startRecording === 'function';
  var VOICE_KEY = 'voice_msgs_' + (window._chat ? window._chat.botId : '0');

  // 创建微信风格录音浮层
  var overlay = document.createElement('div');
  overlay.id = 'voiceOverlay';
  overlay.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:999;background:rgba(26,26,46,0.92);border-radius:20px;padding:32px 40px;text-align:center;color:#fff;display:none;flex-direction:column;align-items:center;gap:12px;min-width:140px;';
  overlay.innerHTML = '<div id="voiceDot" style="width:12px;height:12px;border-radius:50%;background:#FF4757;animation:voicePulse 1s infinite;"></div>' +
    '<div style="font-size:15px;font-weight:600;">松开发送</div>' +
    '<div style="font-size:12px;opacity:0.6;">上滑取消</div>' +
    '<div style="font-size:20px;font-weight:700;" id="voiceTime">0:00</div>';
  document.body.appendChild(overlay);

  var voiceTimer = null, voiceSeconds = 0;

  // 页面离开时清理录音状态，防止回调残留到新页面
  window.addEventListener('beforeunload', function() {
    if (isRecording) {
      isRecording = false;
      window._recordingResult = null;
      if (voiceTimer) clearInterval(voiceTimer);
      if (window.NativeBridge && window.NativeBridge.stopRecording) {
        window.NativeBridge.stopRecording();
      }
    }
  });

  window.startRecording = function() {
    if (!canUseRecording) { showToast('原生环境才能录音'); return; }
    var doRecord = function() {
      isRecording = true; micBtn.classList.add('recording');
      overlay.style.display = 'flex'; overlay.style.background = 'rgba(26,26,46,0.92)';
      voiceSeconds = 0; document.getElementById('voiceTime').textContent = '0:00';
      voiceTimer = setInterval(function() {
        voiceSeconds++;
        var m = Math.floor(voiceSeconds/60), s = voiceSeconds%60;
        document.getElementById('voiceTime').textContent = m + ':' + String(s).padStart(2,'0');
        if (voiceSeconds >= 60) window.stopRecording();
      }, 1000);
      // A7修复：NativeBridge 是 Java 桥接对象（非 NativeApp）
      window.NativeBridge.startRecording();
    };
    // 权限检查通过后直接录音（Java 层自带权限检查）
    doRecord();
  };

  window.stopRecording = function() {
    if (!isRecording) return;
    isRecording = false; micBtn.classList.remove('recording');
    clearInterval(voiceTimer); var seconds = voiceSeconds;
    overlay.style.display = 'none';
    if (seconds < 1) { showToast('录音时间太短'); return; }
    showToast('处理中…');
    // A7：_recordingResult 回调 (base64, filePath) — base64 用于 localStorage 持久化，
    // filePath 传给 NativeBridge.playAudio 原生播放（WebView <audio> 不支持 AMR）
    window._recordingResult = function(audioB64, filePath) {
      if (!audioB64) { showToast('录音处理失败'); return; }
      var audioSrc = 'data:audio/amr;base64,' + audioB64;
      appendVoiceBubble(seconds, audioSrc, filePath);
    };
    window.NativeBridge.stopRecording();
  };

  // A7修复：语音气泡 — base64Audio 用于 localStorage 持久化，filePath 用于 NativeBridge 播放
  function appendVoiceBubble(seconds, base64Audio, filePath) {
    window.appendVoiceBubble = appendVoiceBubble;
    var list = document.getElementById('messageList');
    if (!list) return;
    var row = document.createElement('div');
    row.className = 'msg-row me voice-msg';
    row.setAttribute('data-voice-src', base64Audio);
    row.setAttribute('data-voice-file', filePath || '');
    row.setAttribute('data-voice-seconds', seconds);
    row.setAttribute('data-voice-time', Date.now());
    row.innerHTML =
      '<div class="msg-avatar user">我</div>' +
      '<div class="bubble me voice-bubble" style="padding:8px 14px;display:flex;align-items:center;gap:8px;cursor:pointer;min-width:80px;">' +
      '<span class="voice-play" style="font-size:16px;color:#F472B6;">▶</span>' +
      '<span class="voice-time" style="font-size:13px;color:#3A2030;min-width:30px;">' + seconds + '"</span>' +
      '</div>';
    list.appendChild(row);
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
    // 保存到 localStorage（仅存 base64，filePath 在 App 重启后失效）
    try {
      var msgs = JSON.parse(localStorage.getItem(VOICE_KEY) || '[]');
      msgs.push({ seconds: seconds, src: base64Audio, time: Date.now() });
      if (msgs.length > 20) msgs = msgs.slice(-20);
      localStorage.setItem(VOICE_KEY, JSON.stringify(msgs));
    } catch(e) {}
  };


  // A7修复：加载已保存语音 — 用时间戳去重，不要求列表为空
  function loadSavedVoices() {
    try {
      var msgs = JSON.parse(localStorage.getItem(VOICE_KEY) || '[]');
      if (!msgs.length) return;
      var list = document.getElementById('messageList');
      if (!list) return;
      // 收集已有语音的时间戳用于去重
      var existingTimes = new Set();
      list.querySelectorAll('.voice-msg').forEach(function(row) {
        var t = row.getAttribute('data-voice-time');
        if (t) existingTimes.add(parseInt(t));
      });
      msgs.forEach(function(m) {
        if (!existingTimes.has(m.time)) {
          appendVoiceBubble(m.seconds, m.src);
        }
      });
    } catch(e) {}
  }
  setTimeout(loadSavedVoices, 500);

  // A7修复：消息列表事件委托 — 语音气泡点击用 NativeBridge 原生播放（WebView 不支持 AMR）
  (function() {
    var list = document.getElementById('messageList');
    if (!list) return;
    var activeVoiceRow = null;
    window._voicePlayEnded = function() {
      if (activeVoiceRow) {
        var icon = activeVoiceRow.querySelector('.voice-play');
        if (icon) icon.textContent = '\u25B6';
        activeVoiceRow = null;
      }
    };
    list.addEventListener('click', function(e) {
      var el = e.target;
      while (el && el !== list) {
        if (el.classList && el.classList.contains('voice-bubble')) break;
        el = el.parentElement;
      }
      if (!el || el === list) return;
      var bubble = el;
      var row = bubble;
      while (row && row !== list) {
        if (row.classList && row.classList.contains('voice-msg')) break;
        row = row.parentElement;
      }
      if (!row || row === list) return;
      var playIcon = bubble.querySelector('.voice-play');
      // A7：优先用 base64 data URL（不依赖临时文件），降级用 filePath
      var audioData = row.getAttribute('data-voice-src') || row.getAttribute('data-voice-file') || '';
      var filePath = row.getAttribute('data-voice-file');
      // 如果已在播放，停止
      if (activeVoiceRow === row) {
        if (window.NativeBridge && window.NativeBridge.stopAudio) {
          window.NativeBridge.stopAudio();
        }
        if (playIcon) playIcon.textContent = '\u25B6';
        activeVoiceRow = null;
        return;
      }
      // 停止其他播放
      if (activeVoiceRow) {
        var prevIcon = activeVoiceRow.querySelector('.voice-play');
        if (prevIcon) prevIcon.textContent = '\u25B6';
        if (window.NativeBridge && window.NativeBridge.stopAudio) {
          window.NativeBridge.stopAudio();
        }
      }
      // 用 NativeBridge 原生播放（支持 base64 和 filePath）
      if (audioData && window.NativeBridge && window.NativeBridge.playAudio) {
        window.NativeBridge.playAudio(audioData);
        activeVoiceRow = row;
        if (playIcon) playIcon.textContent = '\u23F8';
      } else if (row.querySelector('audio')) {
        // 降级：尝试 <audio> 元素播放
        var audio = row.querySelector('audio');
        if (audio.paused) {
          audio.play();
          if (playIcon) playIcon.textContent = '\u23F8';
          audio.onended = function() { if (playIcon) playIcon.textContent = '\u25B6'; };
        }
      }
    });
  })();
})();
