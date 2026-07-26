
// ===== Tab 切换 (Phase 2) =====
var _adminTabKey = 'admin_active_tab';
function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab-btn').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.admin-tab-panel').forEach(function(p){ p.classList.remove('active'); });
  var panel = document.getElementById('tabPanel-' + tab);
  if (panel) panel.classList.add('active');
  try { localStorage.setItem(_adminTabKey, tab); } catch(e) {}
}
// 恢复上次的 Tab
(function(){
  try {
    var saved = localStorage.getItem(_adminTabKey);
    if (saved && document.getElementById('tabPanel-' + saved)) {
      var btn = document.querySelector('.admin-tab-btn[onclick*="' + saved + '"]');
      switchAdminTab(saved, btn);
    }
  } catch(e) {}
})();

// Admin panel data loading
function loadAdminData() {
  if (!API.isLoggedIn()) {
    showAdminError('请先登录', '您需要登录后才能访问开发者面板');
    return;
  }

  // 权限检查：确认当前用户是管理员
  API.getProfile().then(function(user) {
    if (!user.is_admin && user.role !== 'admin') {
      showAdminError('权限不足', '当前账号不是管理员，无法访问开发者面板。\n请联系管理员获取权限。');
      return;
    }
    // 权限通过，加载数据
    loadAllAdminSections();
  }).catch(function(err) {
    showAdminError('权限检查失败', '无法确认用户权限，请检查网络连接。');
  });
}

function showAdminError(title, desc) {
  var scrollArea = document.querySelector('.scroll-area');
  if (!scrollArea) return;
  var errDiv = document.createElement('div');
  errDiv.style.cssText = 'margin:20px;padding:24px;background:rgba(255,255,255,0.9);backdrop-filter:blur(8px);border-radius:18px;border:1.5px solid rgba(255,107,107,0.2);text-align:center;';
  // [安全] title 和 desc 全部转义，不暴露服务器地址
  errDiv.innerHTML = '<div style="font-size:18px;font-weight:800;color:#3A2030;margin-bottom:8px;">' + escapeHtml(title) + '</div>' +
    '<div style="font-size:13px;color:#B090A0;line-height:1.8;white-space:pre-line;">' + escapeHtml(desc) + '</div>' +
    '<button onclick="location.reload()" style="margin-top:16px;padding:10px 28px;border-radius:14px;background:#F472B6;color:#fff;border:none;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">重试</button>';
  scrollArea.insertBefore(errDiv, scrollArea.firstChild);
}

function loadAllAdminSections() {
    // System metrics
    API.getSystemMetrics().then(function(m) {
      var cpuEl = document.querySelector('[data-metric="cpu"]');
      var memEl = document.querySelector('[data-metric="mem"]');
      var bwEl = document.querySelector('[data-metric="bw"]');
      var wsEl = document.querySelector('[data-metric="ws"]');
      if (cpuEl) {
        cpuEl.innerHTML = (m.cpu_percent || 0) + '<span style="font-size:14px;font-weight:600;color:var(--text-secondary);">%</span>';
        // Update CPU bar
        var cpuBar = document.querySelector('.hc-bar-fill.cpu');
        if (cpuBar) cpuBar.style.width = (m.cpu_percent || 0) + '%';
        var cpuSub = cpuEl.parentElement.querySelector('.hc-sub');
        if (cpuSub) cpuSub.textContent = (m.cpu_cores || 0) + ' 核 · 负载 ' + ((m.load_avg || [0])[0] || 0).toFixed(1);
      }
      if (memEl) {
        memEl.innerHTML = (m.mem_used || 0) + '<span style="font-size:14px;font-weight:600;color:var(--text-secondary);">/' + (m.mem_total || 0) + ' GB</span>';
        var memBar = document.querySelector('.hc-bar-fill.ram');
        if (memBar) memBar.style.width = (m.mem_percent || 0) + '%';
        var memSub = memEl.parentElement.querySelector('.hc-sub');
        if (memSub) memSub.textContent = '可用 ' + (m.mem_available || 0) + ' GB · 缓存 ' + ((m.mem_total||0) - (m.mem_used||0) - (m.mem_available||0)).toFixed(1) + ' GB';
      }
      if (bwEl) {
        bwEl.innerHTML = (m.bw_current || 0) + '<span style="font-size:14px;font-weight:600;color:var(--text-secondary);">/' + (m.bw_max || 100) + ' Mbps</span>';
        var bwSub = bwEl.parentElement.querySelector('.hc-sub');
        if (bwSub) bwSub.textContent = '今日流量 ' + (m.traffic_today || 0) + ' MB';
      }
      if (wsEl) {
        wsEl.innerHTML = (m.ws_active || 0) + '<span style="font-size:14px;font-weight:600;color:var(--text-secondary);"> 活跃</span>';
        var wsSub = wsEl.parentElement.querySelector('.hc-sub');
        if (wsSub) wsSub.textContent = '峰值 ' + (m.ws_peak || 0) + ' · 今日新建 ' + (m.ws_new_today || 0);
      }
    }).catch(function(err) {
      console.error('[admin] metrics failed:', err.message || err);
      var errMsg = err.message || '未知错误';
      // 显示具体错误信息
      ['cpu','mem','bw','ws'].forEach(function(key) {
        var el = document.querySelector('[data-metric="' + key + '"]');
        if (el) el.innerHTML = '--<span style="font-size:11px;color:var(--text-muted);"> ' + _esc(errMsg.substring(0,20)) + '</span>';
      });
    });
    // Users
    API.getAdminUsers(1, 20).then(function(d) {
      var tbody = document.querySelector('[data-table="users"] tbody');
      if (tbody && d.users) {
        // Update user count badge
        var userCountEl = document.getElementById('userCountBadge');
        if (userCountEl) userCountEl.textContent = (d.total || d.users.length) + ' 人';
        tbody.innerHTML = d.users.map(function(u) {
          var roleBadge = u.is_admin ? '<span class="badge-sm admin">管理员</span>' : '<span class="badge-sm user">用户</span>';
          var phoneMasked = u.phone_hash ? (u.phone_hash.substring(0,3) + '****' + u.phone_hash.substring(u.phone_hash.length-4)) : '--';
          var createdDate = u.created_at ? new Date(u.created_at * 1000).toLocaleDateString('zh-CN', {month:'2-digit',day:'2-digit'}) : '--';
          var nickname = u.nickname || '用户' + u.id;
          return '<tr>' +
            '<td style="font-weight:700;">' + _esc(nickname) + '</td>' +
            '<td>' + phoneMasked + '</td>' +
            '<td>' + (u.bot_count || 0) + '</td>' +
            '<td>' + (u.message_count || 0) + '</td>' +
            '<td>' + roleBadge + '</td>' +
            '<td>' + createdDate + '</td>' +
          '</tr>';
        }).join('');
      }
    }).catch(function(err) {
      var errMsg = err.message || '未知错误';
      console.error('[admin] users failed:', errMsg);
      var tbody = document.querySelector('[data-table="users"] tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;color:#FF6B6B;font-size:12px;">加载失败: ' + _esc(errMsg) + '</td></tr>';
      var countEl = document.getElementById('userCountBadge');
      if (countEl) countEl.textContent = '异常';
    });
    // Bots
    API.getAdminBots().then(function(d) {
      var botSection = document.querySelector('.sh-icon.bots');
      if (!botSection) return;
      var botCard = botSection.closest('.section-header').nextElementSibling;
      if (!botCard || !botCard.classList.contains('table-card')) return;
      var botTbody = botCard.querySelector('tbody');
      if (!botTbody || !d.bots) return;
      var botCountEl = document.getElementById('botCountBadge');
      if (botCountEl) botCountEl.textContent = d.bots.length + ' 个';
      // 简化状态显示：is_active=true 即在线
      botTbody.innerHTML = d.bots.map(function(b) {
        var isOnline = b.is_active !== false;
        var statusHtml = isOnline
          ? '<span class="status-indicator"><span class="si-dot online"></span>活跃</span>'
          : '<span class="status-indicator"><span class="si-dot offline"></span>停用</span>';
        var createdDate = b.created_at ? new Date(b.created_at * 1000).toLocaleDateString('zh-CN', {month:'2-digit',day:'2-digit'}) : '--';
        return '<tr>' +
          '<td style="font-weight:700;">' + _esc(b.name || '') + '</td>' +
          '<td>' + _esc(b.owner_nickname || '--') + '</td>' +
          '<td>' + _esc(b.personality || '--') + '</td>' +
          '<td>' + (b.message_count || 0) + '</td>' +
          '<td>' + statusHtml + '</td>' +
          '<td>' + createdDate + '</td>' +
        '</tr>';
      }).join('');
    }).catch(function(err) {
      var errMsg = err.message || '未知错误';
      console.error('[admin] bots failed:', errMsg);
      var botTbody = document.getElementById('botsTbody');
      if (botTbody) botTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px;color:#FF6B6B;font-size:12px;">加载失败: ' + _esc(errMsg) + '</td></tr>';
      var countEl = document.getElementById('botCountBadge');
      if (countEl) countEl.textContent = '异常';
    });
    // Token ranking
    API.getAdminTokensRanking('month').then(function(d) {
      var container = document.querySelector('[data-container="tokens-ranking"]');
      if (!container) return;
      var ranking = d.ranking || [];
      if (ranking.length) {
        var maxTokens = ranking[0].tokens || ranking[0].total_tokens || 1;
        var rankColors = ['r1','r2','r3'];
        container.innerHTML = ranking.map(function(r, i) {
          var pct = maxTokens ? Math.round(((r.tokens || r.total_tokens || 0) / maxTokens) * 100) : 0;
          return '<div class="token-item">' +
            '<div class="tk-rank ' + (rankColors[i] || 'rn') + '">' + (i + 1) + '</div>' +
            '<span class="tk-name">' + _esc(r.user_name || r.nickname || '用户' + (r.user_id || '')) + '</span>' +
            '<div class="tk-bar-wrap"><div class="tk-bar-fill" style="width:' + pct + '%;"></div></div>' +
            '<div class="tk-val">' + formatTokens(r.tokens || r.total_tokens || 0) + '</div>' +
          '</div>';
        }).join('');
      } else {
        container.innerHTML = '<div class="token-item"><span style="color:var(--text-secondary);font-size:13px;padding:12px 0;display:block;text-align:center;">暂无数据</span></div>';
      }
      // Token summary
      var summaryEl = container.querySelector('[data-container="tokens-summary"]');
      if (summaryEl) {
        summaryEl.innerHTML = '本月合计 <strong>&yen;' + (d.total_cost || 0).toFixed(2) + '</strong> · 预估全月 <strong>&yen;' + (d.estimated_monthly || 0).toFixed(2) + '</strong>' +
          ' · 缓存命中率 <strong>' + ((d.cache_hit_rate || 0) * 100).toFixed(1) + '%</strong>';
      }
    }).catch(function(err) {
      var errMsg = err.message || '未知错误';
      console.error('[admin] tokens ranking failed:', errMsg);
      var container = document.querySelector('[data-container="tokens-ranking"]');
      if (container) container.innerHTML = '<div class="token-item"><span style="color:#FF6B6B;font-size:12px;padding:12px 0;display:block;text-align:center;">加载失败: ' + _esc(errMsg) + '</span></div>';
    });
    // Backups
    API.getAdminBackups().then(function(d) {
      var container = document.querySelector('[data-container="backups"]');
      var countEl = document.querySelector('[data-container="backups-count"]');
      if (countEl) countEl.textContent = (d.total || d.backups.length) + ' 份';
      if (!container || !d.backups) return;
      if (d.backups.length) {
        container.innerHTML = d.backups.slice(0, 5).map(function(b) {
          var t = new Date(b.created_at * 1000);
          var timeStr = t.toLocaleDateString('zh-CN', {month:'2-digit',day:'2-digit'}) + ' ' +
            t.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
          var sizeStr = formatSize(b.size || 0);
          var typeLabel = b.type === 'auto' ? '自动备份' : '手动备份';
          return '<div class="backup-card" style="margin-top:6px;">' +
            '<div class="backup-info">' +
              '<div class="bi-name">' + _esc(b.file_name || b.id) + '</div>' +
              '<div class="bi-time">' + timeStr + ' · ' + typeLabel + '</div>' +
              '<div class="bi-detail">' + sizeStr + ' · sha256 ' + (b.sha256_status || 'unknown') + '</div>' +
            '</div>' +
            '<div class="backup-actions">' +
              '<button class="ba-btn" title="下载" data-backup-id="' + escapeHtml(b.id) + '" data-backup-name="' + escapeHtml(b.file_name || b.id) + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>';
        }).join('');
        // [安全] 事件委托：备份下载用 fetch+blob，避免 window.open 无鉴权
        container.querySelectorAll('.ba-btn[data-backup-id]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            var backupId = this.getAttribute('data-backup-id');
            var fileName = this.getAttribute('data-backup-name');
            showToast('下载中…');
            API.downloadBackup(backupId, fileName).then(function() {
              showToast('下载完成');
            }).catch(function(err) {
              showToast('下载失败: ' + (err.message || '未知错误'), 'error');
            });
          });
        });
      } else {
        container.innerHTML = '<div class="backup-card"><div class="backup-info"><div class="bi-name" style="color:var(--text-secondary);">暂无备份</div></div></div>';
      }
    }).catch(function(err) {
      var errMsg = err.message || '未知错误';
      console.error('[admin] backups failed:', errMsg);
      var container = document.querySelector('[data-container="backups"]');
      if (container) container.innerHTML = '<div class="backup-card"><div class="backup-info"><div class="bi-name" style="color:#FF6B6B;">加载失败: ' + _esc(errMsg) + '</div></div></div>';
      var countEl = document.querySelector('[data-container="backups-count"]');
      if (countEl) countEl.textContent = '异常';
    });
    // Logs
    loadLogs('all');
  }

  // [安全] 统一使用全局 escapeHtml，此页面不再定义本地 _esc
  function _esc(s) { return escapeHtml(s); }
  function formatTokens(n) { if (n >= 1000000) return (n/1000000).toFixed(1) + 'M'; if (n >= 1000) return (n/1000).toFixed(1) + 'K'; return String(n); }
  function formatSize(bytes) { if (bytes >= 1048576) return (bytes/1048576).toFixed(1) + ' MB'; if (bytes >= 1024) return (bytes/1024).toFixed(0) + ' KB'; return bytes + ' B'; }
  loadAdminData();

var currentLogLevel = 'all';
function loadLogs(level) {
  currentLogLevel = level;
  var container = document.querySelector('[data-container="logs"]');
  if (!container) return;
  var levelParam = level === 'all' ? '' : level;
  API.getAdminLogs(levelParam, 100).then(function(d) {
    if (!d.logs || !d.logs.length) {
      container.innerHTML = '<div class="log-line"><span style="color:var(--text-secondary);font-size:13px;">无日志</span></div>';
      return;
    }
    var levelClass = {DEBUG:'l-debug',INFO:'l-info',WARNING:'l-warn',ERROR:'l-error',CRITICAL:'l-error'};
    container.innerHTML = d.logs.map(function(l) {
      var t = new Date(l.time * 1000);
      var timeStr = t.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
      return '<div class="log-line" data-level="' + (l.level || 'info').toLowerCase() + '">' +
        '<span class="log-time">' + timeStr + '</span>' +
        '<span class="log-level ' + (levelClass[l.level] || 'l-info') + '">' + _esc(l.level || 'INFO') + '</span>' +
        '<span class="log-msg">' + _esc(l.message || '') + '</span>' +
      '</div>';
    }).join('');
    // Apply current filter
    if (currentLogLevel !== 'all') applyLogFilter(currentLogLevel);
  }).catch(function(err) {
    var errMsg = err.message || '未知错误';
    console.error('[admin] logs failed:', errMsg);
    var container = document.querySelector('[data-container="logs"]');
    if (container) container.innerHTML = '<div class="log-line"><span style="color:#FF6B6B;font-size:12px;">日志加载失败: ' + _esc(errMsg) + '</span></div>';
  });
}

function applyLogFilter(level) {
  document.querySelectorAll('#logContainer .log-line').forEach(function(line) {
    line.style.display = (level === 'all' || line.getAttribute('data-level') === level) ? 'flex' : 'none';
  });
}

function filterLogs(level, btn) {
  document.querySelectorAll('.log-filter').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  currentLogLevel = level;
  loadLogs(level);
}

// ── 一键备份（调真 API.createBackup）──
function doCreateBackup() {
  if (!confirm('确定要立即创建数据库备份吗？')) return;
  showToast('备份中…');
  API.createBackup().then(function(r) {
    showToast('备份完成：' + (r.file_name || r.id || ''));
    // 刷新备份列表
    if (typeof loadBackups === 'function') loadBackups();
    else API.getAdminBackups().then(function() {}).catch(function() {});
  }).catch(function(e) {
    showToast('备份失败：' + (e.message || '未知错误'));
  });
}

// ── 日志快照（拉取当前级别日志并提示，后端无独立快照端点，用 getAdminLogs 代替）──
function doLogSnapshot() {
  var level = currentLogLevel || 'info';
  showToast('正在生成日志快照…');
  API.getAdminLogs(level, 200).then(function(d) {
    var count = (d.logs || d).length || 0;
    showToast('日志快照已生成（' + count + ' 条 ' + level + ' 级记录）');
  }).catch(function(e) {
    showToast('日志快照失败：' + (e.message || '未知错误'));
  });
}

// ── 重置 Token 统计 ──
function doResetStats() {
  if (!confirm('确定要重置 Token 统计吗？此操作不可恢复。')) return;
  showToast('重置中…');
  API.resetAdminTokenStats().then(function() {
    showToast('Token 统计已重置', 'success');
    loadAdminData();
  }).catch(function(e) {
    showToast('重置失败: ' + e.message, 'error');
  });
}

// ── 恢复备份（modal-sheet 替代 prompt）──
var _restoreBackups = [];

function showRestoreSheet() {
  showToast('加载备份列表…');
  API.getAdminBackups().then(function(d) {
    if (!d.backups || !d.backups.length) {
      showToast('暂无可用备份', 'error');
      return;
    }
    _restoreBackups = d.backups;
    var container = document.getElementById('restoreList');
    container.innerHTML = d.backups.map(function(b, i) {
      var t = new Date(b.created_at * 1000);
      var timeStr = t.toLocaleDateString('zh-CN', {month:'2-digit',day:'2-digit'}) + ' ' +
        t.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
      var sizeStr = formatSize(b.size || 0);
      return '<button class="modal-option" onclick="doRestoreBackup(' + i + ')">' +
        '<div style="text-align:left;">' +
        '<div style="font-weight:700;">' + _esc(b.file_name || b.id) + '</div>' +
        '<div style="font-size:11px;color:var(--text-secondary,#8A6A78);">' + timeStr + ' · ' + sizeStr + '</div>' +
        '</div></button>';
    }).join('');
    document.getElementById('restoreSheet').classList.remove('hidden');
  }).catch(function(e) {
    showToast('获取备份列表失败: ' + e.message, 'error');
  });
}

function closeRestoreSheet() {
  document.getElementById('restoreSheet').classList.add('hidden');
}

function doRestoreBackup(idx) {
  if (isNaN(idx) || idx < 0 || idx >= _restoreBackups.length) return;
  var b = _restoreBackups[idx];
  if (!confirm('确定恢复备份 "' + (b.file_name || b.id) + '" 吗？\n\n当前数据将被覆盖！')) return;
  closeRestoreSheet();
  showToast('恢复中…（服务可能需要重启）');
  API.restoreBackup(b.id).then(function() {
    showToast('备份恢复成功', 'success');
    // 延迟刷新，等待后端恢复完成
    setTimeout(function() { loadAdminData(); }, 3000);
  }).catch(function(e) {
    showToast('恢复失败: ' + e.message, 'error');
  });
}
