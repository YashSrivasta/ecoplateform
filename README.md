# EcoQuest – Gamified Environmental Education Platform

Express + PostgreSQL API (`server/`) and React + Vite client (`client/`).

## Run locally

Requirements: Node.js 20+, PostgreSQL, and an empty database named `ecoquest`.

Server (PowerShell):
```powershell
cd server
npm i
$env:JWT_SECRET="change-me"
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/ecoquest"
npm start        # API on :4000, tables are created automatically
```

Client:
```powershell
cd client
npm i
npm run dev      # app on :5173 (proxies /api)
```

On macOS/Linux, use `export JWT_SECRET=...` instead of `$env:`.

No demo users: sign up as a teacher, create a class (generates a code), post a mission,
then sign up as a student and join with the code.

## Roles & rules
- JWT auth, bcrypt passwords, separate student/teacher login; role checks on every route.
- Only a class's creator can approve/reject submissions, award points, post missions or reply to doubts (enforced in the API). Other teachers add the class code as view-only.
- Students with no class get 403 on quizzes, doubts and uploads.
- Points live in the `activity` table; progress bar, chart, badges and the class report are computed from it, so they update automatically.

## Environment variables (server)
| Name | Purpose |
|---|---|
| `JWT_SECRET` | Secret for signing login tokens (required) |
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `PGSSL` | Set to `true` if your database host requires SSL |
| `CLIENT_ORIGIN` | Frontend URL allowed by CORS, e.g. `https://yourapp.vercel.app` |
| `PORT` | Defaults to 4000 |

Client: `VITE_API` is the backend URL (needed in production only).

## Deploy
- **Database + API:** Render (Postgres + Web Service, root directory `server`, build `npm install`, start `npm start`).
- **Frontend:** Vercel (root directory `client`, framework Vite, set `VITE_API` to the Render URL). `client/vercel.json` handles page refreshes.
- Set `CLIENT_ORIGIN` on the API to the Vercel URL.
- Uploaded photos are saved in `server/uploads`. On hosts with an ephemeral filesystem (such as Render's free plan) they are lost on restart, so use persistent storage or a cloud image host for production.
