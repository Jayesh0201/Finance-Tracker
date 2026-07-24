const money = (value, opts = {}) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, ...opts }).format(value || 0);
const today = new Date().toISOString().split('T')[0];
document.querySelector('[name="expense_date"]').value = today;
document.querySelector('#statementDate').textContent = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const CATEGORY_COLORS = {
  Food: '#ee6f57', Transport: '#2f6f5e', Shopping: '#d7a92d', Bills: '#6b7267',
  Health: '#8a5a7a', Education: '#4f7a8a', Entertainment: '#9db93a', Other: '#a97452'
};

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, credentials: 'include', ...options });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error((data && data.error) || 'Request failed');
  return data;
}

// ---------- Auth ----------

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0].toUpperCase()).join('');
}

function showAuthScreen() {
  document.querySelector('#authScreen').classList.remove('hidden');
  document.querySelector('#appShell').classList.add('hidden');
  document.querySelector('#footer').classList.add('hidden');
  document.querySelector('#userArea').classList.add('hidden');
  document.querySelector('#statementDateWrap').classList.add('hidden');
}

function showApp(user) {
  document.querySelector('#authScreen').classList.add('hidden');
  document.querySelector('#appShell').classList.remove('hidden');
  document.querySelector('#footer').classList.remove('hidden');
  document.querySelector('#userArea').classList.remove('hidden');
  document.querySelector('#statementDateWrap').classList.remove('hidden');
  document.querySelector('#userAvatar').textContent = initials(user.name || user.email);
  document.querySelector('#userName').textContent = user.name;
  document.querySelector('#userEmail').textContent = user.email;
  loadDashboard();
}

function setAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.auth-form-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tab));
  document.querySelector('#authSwitchLogin').classList.toggle('hidden', tab !== 'register');
  document.querySelector('#authSwitchRegister').classList.toggle('hidden', tab !== 'login');
  document.querySelector('#authError').classList.remove('visible');
}
document.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => setAuthTab(el.dataset.tab)));

function showAuthError(message) {
  const el = document.querySelector('#authError');
  el.textContent = message;
  el.classList.add('visible');
}

document.querySelector('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  try {
    const { user } = await request('/api/auth/login', { method: 'POST', body: JSON.stringify(values) });
    showApp(user);
  } catch (error) { showAuthError(error.message); }
});

document.querySelector('#registerForm').addEventListener('submit', async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  try {
    const { user } = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(values) });
    showApp(user);
  } catch (error) { showAuthError(error.message); }
});

document.querySelector('#logoutButton').addEventListener('click', async () => {
  await request('/api/auth/logout', { method: 'POST' });
  showAuthScreen();
});

async function checkSession() {
  try {
    const { user } = await request('/api/auth/me');
    if (user) showApp(user); else showAuthScreen();
  } catch (error) { showAuthScreen(); }
}

function row({ dotColor, title, subtitle, valueText, valueSub, valueClass, table, id }) {
  const dot = dotColor ? `<span class="dot" style="background:${dotColor}"></span>` : '';
  return `<div class="row">
    ${dot}
    <div class="info"><b>${title}</b><small>${subtitle}</small></div>
    <div class="value ${valueClass || ''}">${valueText}${valueSub ? `<small>${valueSub}</small>` : ''}</div>
    <button class="del" title="Delete" onclick="removeItem('${table}', ${id})">×</button>
  </div>`;
}

function empty(message) { return `<div class="empty">${message}</div>`; }

async function removeItem(table, id) {
  await request(`/api/${table}/${id}`, { method: 'DELETE' });
  loadDashboard();
}

function renderStats(s) {
  const items = [
    { label: 'Net worth', value: s.netWorth, delta: null },
    { label: 'Cash balance', value: s.cashBalance, delta: null },
    { label: 'Portfolio value', value: s.investmentValue, delta: { amount: s.investmentReturn, positive: s.investmentReturn >= 0 } },
    { label: 'Total expenses', value: s.totalExpenses, delta: null }
  ];
  document.querySelector('#stats').innerHTML = items.map(item => `
    <div class="stat">
      <p>${item.label}</p>
      <strong>${money(item.value)}</strong>
      ${item.delta ? `<span class="delta ${item.delta.positive ? 'up' : 'down'}">${item.delta.positive ? '▲' : '▼'} ${money(Math.abs(item.delta.amount))}</span>` : ''}
    </div>
  `).join('');

  document.querySelector('#heroNetWorth').textContent = money(s.netWorth);
  document.querySelector('#heroNetWorthNote').textContent = `${money(s.cashBalance)} cash + ${money(s.investmentValue)} invested`;
}

function renderExpenses(expenses) {
  document.querySelector('#expenseCount').textContent = expenses.length ? `${expenses.length} logged` : '';
  document.querySelector('#expensesList').innerHTML = expenses.length
    ? expenses.slice(0, 8).map(e => row({
        dotColor: CATEGORY_COLORS[e.category] || '#999',
        title: e.title,
        subtitle: `${e.category} · ${new Date(e.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`,
        valueText: money(e.amount),
        table: 'expenses', id: e.id
      })).join('')
    : empty('No expenses logged yet. Add your first transaction on the left to start the ledger.');
}

function renderBreakdown(expenses) {
  const totals = {};
  let total = 0;
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; total += e.amount; });
  const categories = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  document.querySelector('#breakdownList').innerHTML = categories.length
    ? categories.map(cat => {
        const pct = total ? (totals[cat] / total * 100) : 0;
        return `<div class="breakdown-row">
          <div class="breakdown-label"><b>${cat}</b><span>${money(totals[cat])} · ${pct.toFixed(0)}%</span></div>
          <div class="breakdown-track"><div class="breakdown-fill" style="width:${pct}%;background:${CATEGORY_COLORS[cat] || '#999'}"></div></div>
        </div>`;
      }).join('')
    : empty('Once you log expenses, their category split will appear here.');
}

function renderPortfolio(investments) {
  document.querySelector('#investmentCount').textContent = investments.length ? `${investments.length} holdings` : '';
  document.querySelector('#portfolioList').innerHTML = investments.length
    ? investments.map(i => {
        const gain = i.current_value - i.invested_amount;
        return row({
          title: i.name,
          subtitle: i.investment_type,
          valueText: money(i.current_value),
          valueSub: `${gain >= 0 ? '+' : ''}${money(gain)}`,
          valueClass: gain >= 0 ? 'up' : 'down',
          table: 'investments', id: i.id
        });
      }).join('')
    : empty('No investments added yet. Log a mutual fund, stock, or FD to track its gain or loss.');
}

function renderGoals(goals) {
  document.querySelector('#goalCount').textContent = goals.length ? `${goals.length} active` : '';
  document.querySelector('#goalsList').innerHTML = goals.length
    ? goals.map(g => {
        const percent = Math.min(100, g.target_amount ? (g.saved_amount / g.target_amount * 100) : 0);
        return `<div class="goal">
          <div class="goal-top"><b>${g.name}</b><span>${percent.toFixed(0)}%</span></div>
          <div class="progress"><span style="width:${percent}%"></span></div>
          <div class="goal-top" style="margin-top:8px;margin-bottom:0">
            <span>${money(g.saved_amount)} of ${money(g.target_amount)}</span>
            <button class="del" title="Delete goal" onclick="removeItem('goals', ${g.id})">×</button>
          </div>
        </div>`;
      }).join('')
    : empty('No savings goals yet. Create one to track progress toward a target.');
}

async function loadDashboard() {
  try {
    const data = await request('/api/dashboard');
    renderStats(data.summary);
    renderExpenses(data.expenses);
    renderBreakdown(data.expenses);
    renderPortfolio(data.investments);
    renderGoals(data.goals);
  } catch (error) {
    if (error.message.includes('sign in')) { showAuthScreen(); return; }
    alert(error.message);
  }
}

function attachForm(id, endpoint) {
  document.querySelector(id).addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    try {
      await request(endpoint, { method: 'POST', body: JSON.stringify(values) });
      event.target.reset();
      if (id === '#expenseForm') document.querySelector('[name="expense_date"]').value = today;
      loadDashboard();
    } catch (error) { alert(error.message); }
  });
}
attachForm('#expenseForm', '/api/expenses');
attachForm('#investmentForm', '/api/investments');
attachForm('#goalForm', '/api/goals');
attachForm('#accountForm', '/api/accounts');

async function askAssistant(question) {
  const reply = document.querySelector('#assistantReply');
  reply.textContent = 'Thinking…';
  try {
    reply.textContent = (await request('/api/assistant', { method: 'POST', body: JSON.stringify({ question }) })).answer;
  } catch (error) { reply.textContent = error.message; }
}
document.querySelector('#assistantForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('#question');
  askAssistant(input.value);
});
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelector('#question').value = chip.dataset.q;
    askAssistant(chip.dataset.q);
  });
});

checkSession();
