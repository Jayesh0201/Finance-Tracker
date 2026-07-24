# WealthWise – Personal Finance Dashboard

This is a complete college mini project: a personal finance website with **user accounts (sign up / sign in)**, expense tracking, investments, bank balances, saving goals, net-worth calculation, portfolio summaries, and an AI-style finance assistant — all private to the signed-in user.

The frontend follows a "bank statement / ledger" visual identity — hairline dividers, tabular mono numerals for money, colour-coded categories, and a passbook-styled sign-in screen — instead of a generic dashboard look, so it reads as a purpose-built finance tool rather than a template.


| File | Purpose |
|---|---|
| `public/index.html` | The visible page: headings, forms, dashboard sections. |
| `public/style.css` | Design system: colour tokens, typography (Playfair Display / Manrope / DM Mono), statement-style layout, and mobile responsiveness. |
| `public/app.js` | Frontend logic. It gets data from the backend and sends form entries. |
| `server.js` | Backend API. Handles sign-up/sign-in sessions, validates requests, and responds with dashboard data scoped to the signed-in user. |
| `database.js` | Connects Node.js to the SQLite database and provides query helper functions. |
| `schema.sql` | Database blueprint: a `users` table plus expenses/investments/goals/accounts, each linked to a `user_id`. |
| `finance.db` | Created automatically on first run. This is the actual saved database. |
| `package.json` | Lists required packages and start commands. |

## 4. How authentication works

- Passwords are hashed with **bcrypt** before being stored — the plain password is never saved.
- Signing in creates a server-side **session**, stored in an `httpOnly` cookie, so it cannot be read by frontend JavaScript.
- Every dashboard route checks the session and only returns/modifies data belonging to that `user_id`.
- Copy `.env.example` to `.env` and set `SESSION_SECRET` to a long random string before deploying anywhere beyond your own laptop.

## 5. How the database is linked

`app.js` → calls an endpoint such as `POST /api/expenses` → `server.js` checks the value → `database.js` runs an SQL INSERT query → `finance.db` stores it.

When the page opens: `app.js` → `GET /api/dashboard` → `server.js` reads SQL tables → sends JSON → `app.js` displays cards and lists.



- **Problem:** Students and young professionals often record expenses, savings, and investments in separate places.
- **Solution:** WealthWise provides one simple dashboard and intelligent financial insights.
- **Frontend:** Responsive HTML/CSS/JavaScript UI.
- **Backend:** Node.js and Express REST API for secure validation and business calculations.
- **Database:** SQLite relational database with separate Expenses, Investments, Goals, and Accounts tables.
- **Future work:**  real bank API integration, charts, recurring expenses, and an LLM API such as OpenAI for natural conversational guidance.

## Important note

This is an educational tracker, not financial advice. The current assistant is a rules-based AI-style assistant that examines stored totals. For a production AI assistant, keep API keys only on the backend and never in browser JavaScript.
