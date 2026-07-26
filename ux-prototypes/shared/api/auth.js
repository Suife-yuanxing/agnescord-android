  async function sendSms(phone) {
    var r = await _fetch('/auth/sms', { method: 'POST', body: JSON.stringify({ phone: phone }) });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }

  async function register(phone, code, nickname, password) {
    var r = await _fetch('/auth/register', {
      method: 'POST', body: JSON.stringify({ phone: phone, code: code, nickname: nickname, password: password }),
    });
    if (!r.ok) throw new Error(await _parseError(r));
    var d = await r.json();
    setTokens(d.access_token, d.refresh_token);
    if (d.user) setCurrentUser(d.user);
    return d;
  }

  async function login(phone, code, password) {
    var r = await _fetch('/auth/login', {
      method: 'POST', body: JSON.stringify({ phone: phone, code: code, password: password }),
    });
    if (!r.ok) throw new Error(await _parseError(r));
    var d = await r.json();
    setTokens(d.access_token, d.refresh_token);
    if (d.user) setCurrentUser(d.user);
    return d;
  }

  async function logout() {
    try {
      await _fetch('/auth/logout', {
        method: 'POST', body: JSON.stringify({ refresh_token: getRefreshToken() }),
      });
    } catch (e) { /* 忽略，本地清 token 即可 */ }
    clearTokens();
  }

  async function changePassword(oldPassword, newPassword) {
    var r = await _fetch('/auth/change-password', {
      method: 'POST', body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
    if (!r.ok) throw new Error(await _parseError(r));
    return r.json();
  }
