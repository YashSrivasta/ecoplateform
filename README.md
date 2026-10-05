# EcoQuest – Gamified Environmental Education Platform
Express + SQLite API (`server/`) and React + Vite client (`client/`).
## Run
```
cd server && npm i && JWT_SECRET=change-me npm start      # API on :4000
cd client && npm i && npm run dev                          # app on :5173 (proxies /api)
```
No demo users: sign up as a teacher, create a class (generates a code), then sign up as a student and join with it.
## Roles & rules
- JWT auth, bcrypt passwords, separate student/teacher login; role checks on every route.
- Only a class's creator can approve/reject submissions, award points, post missions or reply to doubts (enforced in the API). Other teachers add the class code as view-only.
- Students with no class get 403 on quizzes, doubts and uploads.
- Points live in the `activity` table; progress bar, chart and badges are computed from it, so they update automatically.
## Cloud deploy
Client: `npm run build` -> static host (set `VITE_API`). Server: any Node host/container with `JWT_SECRET`, `CLIENT_ORIGIN`, `DB_FILE` on a persistent volume. For multi-instance scale, swap SQLite for Postgres (schema.sql ports directly) and `uploads/` for S3.
