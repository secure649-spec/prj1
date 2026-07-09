(function () {
  let state = {
    tab: 'vote',
    employeeId: '',
    suggestions: [],
    myVote: null,
    loading: true,
    banner: null, // {type, text}
    adminUnlocked: false,
    adminCode: null,
    adminLoading: false,
    adminError: '',
    adminResults: { suggestions: [], totalVotes: 0 },
  };

  function setState(patch) { Object.assign(state, patch); render(); }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function api(path, options) {
    const res = await fetch(path, options);
    let data = null;
    try { data = await res.json(); } catch (e) { /* 본문이 없을 수 있음 */ }
    if (!res.ok) {
      const message = (data && data.error) || `요청이 실패했습니다. (${res.status})`;
      throw new Error(message);
    }
    return data;
  }

  // ---------- 데이터 로딩 ----------
  async function loadSuggestions() {
    try {
      return await api('/api/suggestions');
    } catch (e) {
      setState({ banner: { type: 'error', text: e.message } });
      return [];
    }
  }

  async function loadMyVote(empId) {
    if (!empId) return null;
    try {
      const data = await api('/api/votes/me?employeeId=' + encodeURIComponent(empId));
      return data.suggestionId;
    } catch (e) {
      return null;
    }
  }

  async function init() {
    document.getElementById('gv-ticket-no').textContent = 'NO. ' + new Date().getFullYear();
    const list = await loadSuggestions();
    setState({ suggestions: list, loading: false });
  }

  // ---------- 액션 ----------
  window.gvSwitchTab = function (tab) {
    setState({ tab });
  };

  window.gvSetEmployeeId = async function (val) {
    state.employeeId = val.trim();
    if (state.employeeId) {
      const v = await loadMyVote(state.employeeId);
      setState({ myVote: v });
    } else {
      setState({ myVote: null });
    }
  };

  window.gvSubmitSuggestion = async function () {
    const nameInput = document.getElementById('gv-new-name');
    const descInput = document.getElementById('gv-new-desc');
    const name = nameInput.value.trim();
    const desc = descInput.value.trim();

    if (!state.employeeId) {
      setState({ banner: { type: 'error', text: '먼저 사번을 입력해주세요.' } });
      return;
    }
    if (!name) {
      setState({ banner: { type: 'error', text: '선물 이름을 입력해주세요.' } });
      return;
    }
    try {
      await api('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc, employeeId: state.employeeId }),
      });
      const list = await loadSuggestions();
      nameInput.value = '';
      descInput.value = '';
      setState({ suggestions: list, banner: { type: 'info', text: '선물 제안이 등록되었습니다.' } });
    } catch (e) {
      setState({ banner: { type: 'error', text: e.message } });
    }
  };

  window.gvVote = async function (suggestionId) {
    if (!state.employeeId) {
      setState({ banner: { type: 'error', text: '먼저 사번을 입력해주세요.' } });
      return;
    }
    if (state.myVote === suggestionId) return;
    try {
      await api('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: state.employeeId, suggestionId }),
      });
      setState({ myVote: suggestionId, banner: { type: 'info', text: '투표가 반영되었습니다.' } });
    } catch (e) {
      setState({ banner: { type: 'error', text: e.message } });
    }
  };

  window.gvAdminUnlock = async function () {
    const input = document.getElementById('gv-admin-code');
    const code = input.value;
    try {
      await api('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      setState({ adminUnlocked: true, adminCode: code, adminError: '' });
      await gvRefreshAdmin();
    } catch (e) {
      setState({ adminError: e.message });
    }
  };

  window.gvRefreshAdmin = async function () {
    setState({ adminLoading: true });
    try {
      const data = await api('/api/admin/results', {
        headers: { 'x-admin-code': state.adminCode },
      });
      setState({ adminResults: data, adminLoading: false });
    } catch (e) {
      setState({ adminLoading: false, banner: { type: 'error', text: e.message } });
    }
  };

  window.gvExportCsv = async function () {
    try {
      const res = await fetch('/api/admin/export.csv', {
        headers: { 'x-admin-code': state.adminCode },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'CSV 다운로드에 실패했습니다.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '창립기념일_선물투표_결과_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setState({ banner: { type: 'error', text: e.message } });
    }
  };

  window.gvResetAll = async function () {
    if (!confirm('모든 제안과 투표 기록이 삭제됩니다. 계속할까요?')) return;
    if (!confirm('되돌릴 수 없습니다. 정말 초기화할까요?')) return;
    try {
      await api('/api/admin/reset', {
        method: 'POST',
        headers: { 'x-admin-code': state.adminCode },
      });
      const list = await loadSuggestions();
      await gvRefreshAdmin();
      setState({ suggestions: list, banner: { type: 'info', text: '초기화되었습니다.' } });
    } catch (e) {
      setState({ banner: { type: 'error', text: e.message } });
    }
  };

  // ---------- 렌더링 ----------
  function renderVotePanel() {
    const el = document.getElementById('gv-panel-vote');
    if (state.loading) {
      el.innerHTML = '<div class="gv-empty">불러오는 중입니다…</div>';
      return;
    }
    const bannerHtml = state.banner
      ? `<div class="gv-banner ${state.banner.type}">${escapeHtml(state.banner.text)}</div>` : '';

    const ranked = [...state.suggestions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const myVoteName = state.myVote
      ? (state.suggestions.find((s) => s.id === state.myVote)?.name || null)
      : null;

    el.innerHTML = `
      ${bannerHtml}
      <div class="gv-card">
        <h3>사번 확인</h3>
        <div class="gv-field">
          <label for="gv-emp-id">사번</label>
          <input class="gv-input" id="gv-emp-id" placeholder="예: 20231234" value="${escapeHtml(state.employeeId)}" />
        </div>
        ${myVoteName ? `<div class="gv-banner">현재 <b>${escapeHtml(myVoteName)}</b>에 투표 중이에요. 다른 항목을 선택하면 자동으로 바뀝니다.</div>` : ''}
      </div>

      <div class="gv-card">
        <h3>선물 제안하기</h3>
        <div class="gv-field">
          <label for="gv-new-name">선물 이름</label>
          <input class="gv-input" id="gv-new-name" placeholder="예: 무선 이어폰" />
        </div>
        <div class="gv-field">
          <label for="gv-new-desc">설명 (선택)</label>
          <textarea class="gv-textarea" id="gv-new-desc" placeholder="브랜드, 색상 등 원하는 옵션을 적어주세요"></textarea>
        </div>
        <button class="gv-btn gv-btn-cta" onclick="gvSubmitSuggestion()">제안 등록하기</button>
      </div>

      <div>
        ${ranked.length === 0
          ? '<div class="gv-empty">아직 등록된 제안이 없습니다. 첫 번째 제안을 남겨보세요.</div>'
          : ranked.map((s) => renderStub(s)).join('')}
      </div>
    `;

    const empInput = document.getElementById('gv-emp-id');
    empInput.addEventListener('change', (e) => gvSetEmployeeId(e.target.value));
    empInput.addEventListener('blur', (e) => gvSetEmployeeId(e.target.value));
  }

  function renderStub(s) {
    const isMine = state.myVote === s.id;
    return `
      <div class="gv-stub ${isMine ? 'mine' : ''}">
        <div class="gv-stub-main">
          <p class="gv-stub-name">${escapeHtml(s.name)}</p>
          ${s.description ? `<p class="gv-stub-desc">${escapeHtml(s.description)}</p>` : ''}
          <p class="gv-stub-meta">제안자 ${escapeHtml(s.proposed_by)}</p>
        </div>
        <div class="gv-stub-divider"></div>
        <div class="gv-stub-stamp">
          <button class="gv-vote-btn ${isMine ? 'voted' : ''}" onclick="gvVote(${s.id})" ${isMine ? 'disabled' : ''}>
            ${isMine ? '투표 완료 ✓' : '투표하기'}
          </button>
        </div>
      </div>
    `;
  }

  function renderAdminPanel() {
    const el = document.getElementById('gv-panel-admin');
    if (!state.adminUnlocked) {
      el.innerHTML = `
        <div class="gv-lock gv-card">
          <h3 style="text-align:center;">관리자 코드 입력</h3>
          <div class="gv-field">
            <input class="gv-input" id="gv-admin-code" type="password" placeholder="코드" />
          </div>
          ${state.adminError ? `<div class="gv-banner error">${escapeHtml(state.adminError)}</div>` : ''}
          <button class="gv-btn" style="width:100%;" onclick="gvAdminUnlock()">확인</button>
        </div>
      `;
      return;
    }
    if (state.adminLoading) {
      el.innerHTML = '<div class="gv-empty">집계 중입니다…</div>';
      return;
    }
    const ranked = [...state.adminResults.suggestions].sort((a, b) => b.vote_count - a.vote_count);
    const maxCount = ranked.length ? Math.max(...ranked.map((s) => s.vote_count), 1) : 1;

    el.innerHTML = `
      <div class="gv-stats">
        <div class="gv-stat"><div class="gv-stat-num">${state.adminResults.suggestions.length}</div><div class="gv-stat-label">등록된 제안</div></div>
        <div class="gv-stat"><div class="gv-stat-num">${state.adminResults.totalVotes}</div><div class="gv-stat-label">누적 투표 수</div></div>
      </div>

      <div class="gv-card">
        <div class="gv-row" style="margin-bottom:16px;">
          <button class="gv-btn" onclick="gvExportCsv()">CSV로 내보내기</button>
          <button class="gv-btn gv-btn-ghost" onclick="gvRefreshAdmin()">새로고침</button>
          <button class="gv-btn gv-btn-danger" onclick="gvResetAll()">전체 초기화</button>
        </div>
        ${ranked.length === 0
          ? '<div class="gv-empty">아직 데이터가 없습니다.</div>'
          : ranked.map((s) => `
            <div class="gv-bar-row">
              <div class="gv-bar-top">
                <span class="gv-bar-name">${escapeHtml(s.name)}</span>
                <span class="gv-bar-count">${s.vote_count}표</span>
              </div>
              <div class="gv-bar-track"><div class="gv-bar-fill" style="width:${(s.vote_count / maxCount) * 100}%;"></div></div>
            </div>
          `).join('')}
      </div>
    `;
  }

  function render() {
    document.getElementById('gv-tab-vote').className = 'gv-tab' + (state.tab === 'vote' ? ' active' : '');
    document.getElementById('gv-tab-admin').className = 'gv-tab' + (state.tab === 'admin' ? ' active' : '');
    document.getElementById('gv-panel-vote').style.display = state.tab === 'vote' ? '' : 'none';
    document.getElementById('gv-panel-admin').style.display = state.tab === 'admin' ? '' : 'none';
    renderVotePanel();
    renderAdminPanel();
  }

  init();
  render();
})();
