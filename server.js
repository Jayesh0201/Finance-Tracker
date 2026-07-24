const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    sameSite: 'lax'
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

const allowedCategories = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Education', 'Entertainment', 'Other'];
const isPositiveNumber = value => Number.isFinite(Number(value)) && Number(value) >= 0;
const isValidEmail = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicUser = user => ({ id: user.id, name: user.name, email: user.email });

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}

// ---------- Auth ----------

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Please enter your name.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), passwordHash]
    );
    req.session.userId = result.id;
    res.status(201).json({ user: publicUser({ id: result.id, name: name.trim(), email: email.trim().toLowerCase() }) });
  } catch (error) { next(error); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!isValidEmail(email) || !password) return res.status(400).json({ error: 'Please enter your email and password.' });

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    const match = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!match) return res.status(401).json({ error: 'Incorrect email or password.' });

    req.session.userId = user.id;
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

app.get('/api/auth/me', async (req, res, next) => {
  try {
    if (!req.session.userId) return res.json({ user: null });
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (!user) return res.json({ user: null });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

// ---------- Dashboard data (all scoped to the signed-in user) ----------

app.get('/api/dashboard', requireAuth, async (req, res, next) => {
  try {
    const uid = req.session.userId;
    const [expenses, investments, goals, accounts] = await Promise.all([
      db.all('SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC, id DESC', [uid]),
      db.all('SELECT * FROM investments WHERE user_id = ? ORDER BY id DESC', [uid]),
      db.all('SELECT * FROM goals WHERE user_id = ? ORDER BY id DESC', [uid]),
      db.all('SELECT * FROM accounts WHERE user_id = ? ORDER BY id DESC', [uid])
    ]);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const totalInvested = investments.reduce((sum, item) => sum + item.invested_amount, 0);
    const investmentValue = investments.reduce((sum, item) => sum + item.current_value, 0);
    const cashBalance = accounts.reduce((sum, item) => sum + item.balance, 0);
    res.json({ expenses, investments, goals, accounts, summary: {
      totalExpenses, totalInvested, investmentValue, cashBalance,
      netWorth: cashBalance + investmentValue,
      investmentReturn: investmentValue - totalInvested
    }});
  } catch (error) { next(error); }
});

app.post('/api/expenses', requireAuth, async (req, res, next) => {
  try {
    const { title, category, amount, expense_date } = req.body;
    if (!title?.trim() || !allowedCategories.includes(category) || !isPositiveNumber(amount) || !expense_date) return res.status(400).json({ error: 'Please enter valid expense details.' });
    const result = await db.run('INSERT INTO expenses (user_id, title, category, amount, expense_date) VALUES (?, ?, ?, ?, ?)', [req.session.userId, title.trim(), category, Number(amount), expense_date]);
    res.status(201).json(await db.get('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [result.id, req.session.userId]));
  } catch (error) { next(error); }
});

app.post('/api/investments', requireAuth, async (req, res, next) => {
  try {
    const { name, investment_type, invested_amount, current_value } = req.body;
    if (!name?.trim() || !investment_type?.trim() || !isPositiveNumber(invested_amount) || !isPositiveNumber(current_value)) return res.status(400).json({ error: 'Please enter valid investment details.' });
    const result = await db.run('INSERT INTO investments (user_id, name, investment_type, invested_amount, current_value) VALUES (?, ?, ?, ?, ?)', [req.session.userId, name.trim(), investment_type.trim(), Number(invested_amount), Number(current_value)]);
    res.status(201).json(await db.get('SELECT * FROM investments WHERE id = ? AND user_id = ?', [result.id, req.session.userId]));
  } catch (error) { next(error); }
});

app.post('/api/goals', requireAuth, async (req, res, next) => {
  try {
    const { name, target_amount, saved_amount, target_date } = req.body;
    if (!name?.trim() || !isPositiveNumber(target_amount) || Number(target_amount) === 0 || !isPositiveNumber(saved_amount)) return res.status(400).json({ error: 'Please enter valid goal details.' });
    const result = await db.run('INSERT INTO goals (user_id, name, target_amount, saved_amount, target_date) VALUES (?, ?, ?, ?, ?)', [req.session.userId, name.trim(), Number(target_amount), Number(saved_amount), target_date || null]);
    res.status(201).json(await db.get('SELECT * FROM goals WHERE id = ? AND user_id = ?', [result.id, req.session.userId]));
  } catch (error) { next(error); }
});

app.post('/api/accounts', requireAuth, async (req, res, next) => {
  try {
    const { name, account_type, balance } = req.body;
    if (!name?.trim() || !account_type?.trim() || !isPositiveNumber(balance)) return res.status(400).json({ error: 'Please enter valid account details.' });
    const result = await db.run('INSERT INTO accounts (user_id, name, account_type, balance) VALUES (?, ?, ?, ?)', [req.session.userId, name.trim(), account_type.trim(), Number(balance)]);
    res.status(201).json(await db.get('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [result.id, req.session.userId]));
  } catch (error) { next(error); }
});

app.delete('/api/:table/:id', requireAuth, async (req, res, next) => {
  try {
    const validTables = ['expenses', 'investments', 'goals', 'accounts'];
    if (!validTables.includes(req.params.table)) return res.status(400).json({ error: 'Invalid table.' });
    await db.run(`DELETE FROM ${req.params.table} WHERE id = ? AND user_id = ?`, [req.params.id, req.session.userId]);
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post('/api/assistant', requireAuth, async (req, res, next) => {
  try {
    const uid = req.session.userId;
    const [expenseRow, investmentRow, accounts] = await Promise.all([
      db.get('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ?', [uid]),
      db.get('SELECT COALESCE(SUM(current_value - invested_amount), 0) AS gain FROM investments WHERE user_id = ?', [uid]),
      db.all('SELECT * FROM accounts WHERE user_id = ?', [uid])
    ]);
    const cash = accounts.reduce((sum, a) => sum + a.balance, 0);
    const question = (req.body.question || '').toLowerCase();
    let answer = `You have spent ₹${expenseRow.total.toFixed(2)} and currently hold ₹${cash.toFixed(2)} in your accounts.`;
    if (question.includes('invest') || question.includes('portfolio')) answer = `Your investment portfolio has a gain/loss of ₹${investmentRow.gain.toFixed(2)}. Diversify across assets and review it regularly.`;
    if (question.includes('save') || question.includes('budget')) answer = `A practical starting point is the 50/30/20 rule: 50% needs, 30% wants, and 20% savings/investments. Your recorded spending is ₹${expenseRow.total.toFixed(2)}.`;
    if (question.includes('net worth')) answer = `Your estimated net worth is ₹${(cash + investmentRow.gain).toFixed(2)} plus your original investment value. Add all accounts and investments on the dashboard for an exact view.`;
    res.json({ answer });
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => { console.error(error); res.status(500).json({ error: 'Something went wrong on the server.' }); });
app.listen(PORT, () => console.log(`WealthWise is running at http://localhost:${PORT}`));
