/* One product experience; optional provider details and owner-only connections. No keys in localStorage. */
(function () {
  'use strict';
  const E = window.OMNI.esc, $ = s => document.querySelector(s);
  let ownerToken = '', catalog = null;
  async function request(path, { body, method = body ? 'POST' : 'GET', signal, timeout = 110000, owner = false } = {}) {
    const controller = new AbortController(), abort = () => controller.abort();
    if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeout), headers = {};
    if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
    if (owner) headers.authorization = 'Bearer ' + ownerToken;
    try {
      const response = await fetch(path, { method, headers, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined, signal: controller.signal });
      let data; try { data = await response.json(); } catch { throw Error('The server returned an unreadable response.'); }
      if (!response.ok) {
        const error = Error(data.error || 'Request failed.');
        error.code = data.code;
        error.retryAfter = Number.isFinite(Number(data.retryAfter)) ? Number(data.retryAfter) : null;
        // Deliberately accept only short human-readable status fields. Upstream
        // provider error bodies, credentials and raw request data are never shown.
        const diagnostic = data.diagnostics;
        if (diagnostic && typeof diagnostic === 'object') {
          const providers = Array.isArray(diagnostic.providers) ? diagnostic.providers : [];
          error.providerDiagnostics = providers.slice(0, 5).filter(item => item && typeof item.provider === 'string' && typeof item.reason === 'string')
            .map(item => ({ provider: item.provider.replace(/[\r\n]/g, ' ').slice(0, 48), reason: item.reason.replace(/[\r\n]/g, ' ').slice(0, 100) }));
          if (typeof diagnostic.shared === 'string') error.sharedDiagnostic = diagnostic.shared.replace(/[\r\n]/g, ' ').slice(0, 120);
        }
        throw error;
      }
      return data;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  function receipt(data) {
    return '<details class="response-details"><summary>Response details</summary><p>' + E(data.providerName || data.provider || 'AI provider') +
      ' · ' + E(data.model || 'model not reported') + (data.fallbackCount ? ' · ' + E(String(data.fallbackCount)) + ' fallback(s)' : '') +
      (data.attribution ? '<br>' + E(data.attribution) : '') + '</p>' +
      (Array.isArray(data.toolsUsed)&&data.toolsUsed.length?'<p>Used: '+E(data.toolsUsed.slice(0,5).join(', '))+'</p>':'')+
      (Array.isArray(data.warnings)?data.warnings.slice(0,2).map(w=>'<p>'+E(w)+'</p>').join(''):'')+'</details>';
  }
  const stateNames = { ready: 'Connected · ready to try', needs_key: 'API key needed', needs_binding: 'AI binding needed', paused: 'Paused',
    free_confirmation: 'Confirm free account', development_only: 'Development access only', budget_reached: 'App budget reached', cooldown: 'Waiting for service reset' };
  function render() {
    if (!catalog) return;
    const chat = catalog.providers.filter(p => p.capabilities.includes('chat'));
    const ready = chat.filter(p => p.state === 'ready').length;
    const connected = chat.filter(p => ['ready', 'cooldown', 'budget_reached'].includes(p.state)).length;
    $('#poolSummary').textContent = ready
      ? 'Automatic AI routing · ' + ready + ' free chat service(s) ready now.'
      : connected ? 'Automatic AI routing · connected services are busy or at their free limits.'
        : 'Automatic AI routing · no free chat service is connected yet. The owner can manage connections below.';
    $('#ownerSetup').hidden = catalog.ownerSetup;
    $('#ownerUnlock').hidden = !!ownerToken;
    $('#ownerLock').hidden = !ownerToken;
    if (!ownerToken) {
      $('#connectionList').innerHTML = '<p class="muted">MICHELLE switches services automatically. Only the owner needs to configure individual API connections.</p>';
      return;
    }
    $('#connectionList').innerHTML = catalog.providers.map(p => {
      const usable = !!ownerToken;
      const usage = p.usage ? '<p class="muted">App reservations today: ' + p.usage.requestsDay + ' / ' + p.limits.requestsDay + ' calls · ' + p.usage.tokensDay.toLocaleString() + ' / ' + p.limits.tokensDay.toLocaleString() + ' tokens. Includes failed calls.</p>' : '';
      return '<details class="connection-card" data-connection="' + E(p.id) + '"><summary><strong>' + E(p.name) + '</strong><span class="connection-state ' + (p.state === 'ready' ? 'ready' : '') + '">' + E(stateNames[p.state] || p.state) + '</span></summary>' +
        '<p>' + E(p.note) + '</p><p class="muted">' + E(p.capabilities.join(' · ')) + (p.verifiedAt ? ' · Last real response: ' + E(new Date(p.verifiedAt).toLocaleString()) : ' · No successful live response recorded') + '</p>' +
        (p.retryAt ? '<p class="muted">Retry after ' + E(new Date(p.retryAt).toLocaleString()) + '</p>' : '') + usage +
        (p.signup ? '<a href="' + E(p.signup) + '" target="_blank" rel="noopener noreferrer">Provider account</a>' : '') +
        (usable ? '<label>Model<select class="connection-model">' + p.models.map(m => '<option value="' + E(m) + '"' + (m === p.model ? ' selected' : '') + '>' + E(m === 'catalog:turbo' ? 'Verified TURBO model from live catalog' : m) + '</option>').join('') + '</select></label>' +
          (p.id !== 'cloudflare' && !p.id.startsWith('pollinations') && !['ovh', 'horde-image'].includes(p.id) ? '<label>API key (leave blank to keep current key)<input class="connection-key" type="password" autocomplete="off" spellcheck="false" placeholder="' + (p.hasKey ? 'Key already stored securely' : 'Paste your provider key here') + '"></label><label class="switch"><input class="connection-free" type="checkbox"' + (p.freeConfirmed ? ' checked' : '') + '>This account has a free allowance; paid billing and automatic top-ups are disabled.</label>' : '') +
          '<label class="switch"><input class="connection-enabled" type="checkbox"' + (p.enabled ? ' checked' : '') + '>Include in MICHELLE Auto</label><div class="field-actions"><button type="button" data-save-connection="' + E(p.id) + '">Save connection</button>' +
          (p.capabilities.includes('chat') ? '<button type="button" data-test-connection="' + E(p.id) + '">Test one real reply</button>' : '') +
          (p.hasKey && !['cloudflare','pollinations','pollinations-image','ovh','horde-image'].includes(p.id) ? '<button type="button" data-remove-connection="' + E(p.id) + '">Disconnect</button>' : '') + '</div>' : '<p class="muted">Unlock owner access to manage this connection.</p>') + '</details>';
    }).join('') + '<details class="connection-card"><summary>Other researched services</summary>' + catalog.parked.map(p => '<p><strong>' + E(p.name) + '</strong> · ' + E(p.note) + '</p>').join('') + '</details>';
  }
  async function refresh() {
    try {
      catalog = await request(ownerToken ? '/api/admin/providers' : '/api/providers', { owner: !!ownerToken, timeout: 12000 });
      render(); return catalog;
    } catch (error) { $('#poolSummary').textContent = error.message; throw error; }
  }
  async function mount() {
    $('#refreshConnections').onclick = () => refresh().catch(showError);
    $('#unlockOwner').onclick = async () => {
      ownerToken = $('#ownerToken').value;
      try { await refresh(); $('#ownerToken').value = ''; $('#connectionNotice').textContent = 'Owner access unlocked for this tab. Keys are encrypted on the server.'; }
      catch (error) { ownerToken = ''; showError(error); }
    };
    $('#ownerLock').onclick = () => { ownerToken = ''; $('#ownerToken').value = ''; refresh().catch(showError); };
    $('#generateOwnerToken').onclick = () => {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      $('#newOwnerToken').value = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      $('#newOwnerToken').hidden = false; $('#copyOwnerToken').hidden = false;
    };
    $('#copyOwnerToken').onclick = async () => {
      try { await navigator.clipboard.writeText($('#newOwnerToken').value); $('#connectionNotice').textContent = 'Copied. Save it as the MIKEE_ADMIN_TOKEN Worker secret, then use it to unlock Connections.'; }
      catch { $('#newOwnerToken').select(); $('#connectionNotice').textContent = 'Select and copy the generated token.'; }
    };
    $('#connectionList').onclick = async event => {
      const button = event.target.closest('button'); if (!button) return;
      const id = button.dataset.saveConnection || button.dataset.removeConnection || button.dataset.testConnection;
      if (!id || !ownerToken) return;
      const card = button.closest('[data-connection]'), keyInput = card.querySelector('.connection-key');
      button.disabled = true; $('#connectionNotice').textContent = 'Working…';
      try {
        if (button.dataset.testConnection) {
          const reply = await request('/api/chat', { owner: true, body: { message: 'Say Ready in one short sentence.', provider: id } });
          $('#connectionNotice').textContent = 'Real response verified from ' + reply.providerName + ': ' + reply.reply;
        } else {
          await request('/api/admin/providers', { method: 'PUT', owner: true, body: {
            id, enabled: button.dataset.removeConnection ? false : card.querySelector('.connection-enabled').checked,
            freeConfirmed: card.querySelector('.connection-free')?.checked ?? true,
            model: card.querySelector('.connection-model').value,
            ...(keyInput?.value ? { key: keyInput.value.trim() } : {}), removeKey: !!button.dataset.removeConnection
          } });
          $('#connectionNotice').textContent = button.dataset.removeConnection ? 'Connection paused and its stored key removed. Usage counters are retained.' : 'Connection saved. Use “Test one real reply” to verify access.';
        }
        await refresh();
      } catch (error) { showError(error); }
      finally { if (keyInput) keyInput.value = ''; button.disabled = false; }
    };
    await refresh().catch(() => {});
  }
  function showError(error) { $('#connectionNotice').textContent = error.message || 'Connection action failed.'; }
  window.MIKEE_POOL = { request, receipt, mount, refresh, catalog: () => catalog };
})();
