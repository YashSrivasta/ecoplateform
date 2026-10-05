import express from 'express'; import cors from 'cors'; import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken'; import multer from 'multer';
import fs from 'fs'; import crypto from 'crypto';
const SECRET = process.env.JWT_SECRET;
if (!SECRET) { console.error('Set JWT_SECRET'); process.exit(1); }
const db = new Database(process.env.DB_FILE || 'eco.db'); db.pragma('foreign_keys=ON');
db.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
if (!db.prepare('SELECT 1 FROM quizzes').get()) { // starter question bank (content, not users)
  const q = db.prepare('INSERT INTO quizzes(grade_min,grade_max,difficulty,question,options,answer) VALUES(?,?,?,?,?,?)');
  [[1,5,1,'Which bin is best for banana peels?',['Compost','Plastic recycling','Glass'],0],
   [1,5,1,'What do plants give us that we breathe?',['Smoke','Oxygen','Dust'],1],
   [6,8,2,'Which gas is the main driver of global warming?',['Oxygen','Nitrogen','Carbon dioxide'],2],
   [6,8,2,'What does the 3R rule stand for?',['Reduce, Reuse, Recycle','Run, Rest, Repeat','Read, Write, Record'],0],
   [9,12,3,'Which layer of the atmosphere contains the ozone layer?',['Troposphere','Stratosphere','Mesosphere'],1],
   [9,12,3,'Biodiversity hotspots are mainly defined by high endemism and…',['Low rainfall','Habitat loss','Large cities'],1],
   [13,20,4,'Which international agreement set the 1.5°C warming target?',['Kyoto Protocol','Paris Agreement','Montreal Protocol'],1],
   [13,20,4,'Eutrophication is mainly caused by excess…',['Nutrients like nitrates and phosphates','Sunlight','Salt'],0]]
  .forEach(r => q.run(r[0], r[1], r[2], r[3], JSON.stringify(r[4]), r[5]));
}
fs.mkdirSync('uploads', { recursive: true });
const upload = multer({ storage: multer.diskStorage({ destination: 'uploads', filename: (_, f, cb) => cb(null, crypto.randomUUID() + '.' + (f.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')) }),
  limits: { fileSize: 5e6 }, fileFilter: (_, f, cb) => cb(null, /^image\//.test(f.mimetype)) });
const app = express(); app.use(cors({ origin: process.env.CLIENT_ORIGIN || true })); app.use(express.json());
app.use('/uploads', express.static('uploads'));
const get = (s, ...p) => db.prepare(s).get(...p), all = (s, ...p) => db.prepare(s).all(...p), run = (s, ...p) => db.prepare(s).run(...p);
const auth = roles => (req, res, next) => {
  try { const u = jwt.verify((req.headers.authorization || '').slice(7), SECRET); if (roles && !roles.includes(u.role)) return res.status(403).json({ error: 'Not allowed for your role' }); req.user = u; next(); }
  catch { res.status(401).json({ error: 'Please log in' }); } };
const wrap = f => (req, res) => { try { f(req, res); } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); } };
const token = u => jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '7d' });
const pub = u => ({ id: u.id, role: u.role, name: u.name, email: u.email, grade: u.grade, photo: u.photo });

// ---------- auth ----------
app.post('/api/auth/register', wrap((req, res) => {
  const { role, name, email, password, grade } = req.body;
  if (!['student', 'teacher'].includes(role) || !name || !/\S+@\S+/.test(email || '') || (password || '').length < 8) return res.status(400).json({ error: 'Name, valid email and 8+ character password required' });
  if (role === 'student' && !(grade >= 1 && grade <= 20)) return res.status(400).json({ error: 'Enter your class/grade (1-12, college 13+)' });
  if (get('SELECT 1 FROM users WHERE email=?', email.toLowerCase())) return res.status(409).json({ error: 'Email already registered' });
  const id = run('INSERT INTO users(role,name,email,password_hash,grade) VALUES(?,?,?,?,?)', role, name.trim(), email.toLowerCase(), bcrypt.hashSync(password, 10), role === 'student' ? +grade : null).lastInsertRowid;
  const u = get('SELECT * FROM users WHERE id=?', id); res.json({ token: token(u), user: pub(u) }); }));
app.post('/api/auth/login', wrap((req, res) => {
  const { email, password, role } = req.body; const u = get('SELECT * FROM users WHERE email=?', (email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) return res.status(401).json({ error: 'Wrong email or password' });
  if (u.role !== role) return res.status(403).json({ error: `This is a ${u.role} account. Use the ${u.role} login.` });
  res.json({ token: token(u), user: pub(u) }); }));
app.get('/api/me', auth(), wrap((req, res) => res.json(pub(get('SELECT * FROM users WHERE id=?', req.user.id)))));
app.post('/api/me/photo', auth(), upload.single('photo'), wrap((req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Image required' }); run('UPDATE users SET photo=? WHERE id=?', '/uploads/' + req.file.filename, req.user.id); res.json({ photo: '/uploads/' + req.file.filename }); }));

// ---------- student ----------
const S = auth(['student']);
const points = id => get('SELECT COALESCE(SUM(points),0) p FROM activity WHERE student_id=?', id).p;
const myClasses = id => all('SELECT c.id,c.name,c.code,u.name teacher FROM enrollments e JOIN classes c ON c.id=e.class_id JOIN users u ON u.id=c.teacher_id WHERE e.student_id=?', id);
const needClass = (req, res, next) => myClasses(req.user.id).length ? next() : res.status(403).json({ error: 'Join a class with a class code first' });
const BADGES = [[10, 'Seedling', '🌱'], [50, 'Sprout', '🌿'], [100, 'Tree Hugger', '🌳'], [250, 'Eco Warrior', '🦸'], [500, 'Planet Guardian', '🌍']];
app.post('/api/classes/join', S, wrap((req, res) => {
  const c = get('SELECT * FROM classes WHERE code=?', (req.body.code || '').trim().toUpperCase()); if (!c) return res.status(404).json({ error: 'No class with that code' });
  run('INSERT OR IGNORE INTO enrollments VALUES(?,?)', req.user.id, c.id); res.json({ ok: true, class: c.name }); }));
app.get('/api/student/dashboard', S, wrap((req, res) => {
  const p = points(req.user.id), me = get('SELECT * FROM users WHERE id=?', req.user.id);
  res.json({ user: pub(me), classes: myClasses(me.id), points: p, level: Math.floor(p / 100) + 1, levelProgress: p % 100,
    badges: BADGES.map(([at, name, icon]) => ({ at, name, icon, earned: p >= at })), activity: all('SELECT text,points,created_at FROM activity WHERE student_id=? ORDER BY id DESC LIMIT 20', me.id),
    chart: all(`SELECT date(created_at) day, SUM(points) points FROM activity WHERE student_id=? GROUP BY day ORDER BY day DESC LIMIT 14`, me.id).reverse() }); }));
app.get('/api/quizzes', S, needClass, wrap((req, res) => {
  const g = get('SELECT grade FROM users WHERE id=?', req.user.id).grade;
  res.json(all('SELECT q.id,q.difficulty,q.question,q.options,a.correct FROM quizzes q LEFT JOIN quiz_attempts a ON a.quiz_id=q.id AND a.student_id=? WHERE ? BETWEEN grade_min AND grade_max ORDER BY q.difficulty', req.user.id, g).map(q => ({ ...q, options: JSON.parse(q.options) }))); }));
app.post('/api/quizzes/:id/answer', S, needClass, wrap((req, res) => {
  const q = get('SELECT * FROM quizzes WHERE id=?', req.params.id); if (!q) return res.status(404).json({ error: 'Quiz not found' });
  if (get('SELECT 1 FROM quiz_attempts WHERE student_id=? AND quiz_id=?', req.user.id, q.id)) return res.status(409).json({ error: 'Already answered' });
  const ok = +req.body.choice === q.answer, pts = ok ? q.difficulty * 5 : 0;
  db.transaction(() => { run('INSERT INTO quiz_attempts VALUES(?,?,?)', req.user.id, q.id, +ok); if (ok) run('INSERT INTO activity(student_id,kind,text,points) VALUES(?,?,?,?)', req.user.id, 'quiz', 'Correct quiz answer', pts); })();
  res.json({ correct: ok, answer: q.answer, points: pts }); }));
app.get('/api/missions', S, wrap((req, res) => res.json(all(`SELECT m.id,m.title,m.description,m.points,c.name class_name,
  (SELECT status FROM submissions s WHERE s.mission_id=m.id AND s.student_id=? ORDER BY s.id DESC LIMIT 1) status,
  (SELECT awarded FROM submissions s WHERE s.mission_id=m.id AND s.student_id=? ORDER BY s.id DESC LIMIT 1) awarded
  FROM missions m JOIN classes c ON c.id=m.class_id JOIN enrollments e ON e.class_id=c.id AND e.student_id=? ORDER BY m.id DESC`, req.user.id, req.user.id, req.user.id))));
app.post('/api/missions/:id/submit', S, needClass, upload.single('photo'), wrap((req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Attach a photo as evidence' });
  const m = get('SELECT m.* FROM missions m JOIN enrollments e ON e.class_id=m.class_id AND e.student_id=? WHERE m.id=?', req.user.id, req.params.id);
  if (!m) return res.status(403).json({ error: 'This mission is not in your class' });
  if (get(`SELECT 1 FROM submissions WHERE mission_id=? AND student_id=? AND status IN('pending','approved')`, m.id, req.user.id)) return res.status(409).json({ error: 'Already submitted' });
  run('INSERT INTO submissions(mission_id,student_id,photo) VALUES(?,?,?)', m.id, req.user.id, '/uploads/' + req.file.filename); res.json({ ok: true }); }));
app.post('/api/doubts', S, needClass, wrap((req, res) => {
  if (!get('SELECT 1 FROM enrollments WHERE student_id=? AND class_id=?', req.user.id, req.body.class_id) || !req.body.message) return res.status(400).json({ error: 'Pick your class and write a message' });
  run('INSERT INTO doubts(class_id,student_id,message) VALUES(?,?,?)', req.body.class_id, req.user.id, req.body.message); res.json({ ok: true }); }));
app.get('/api/doubts', S, wrap((req, res) => res.json(all('SELECT message,reply,created_at FROM doubts WHERE student_id=? ORDER BY id DESC', req.user.id))));

// ---------- teacher ----------
const T = auth(['teacher']);
const owns = (cid, tid) => !!get('SELECT 1 FROM classes WHERE id=? AND teacher_id=?', cid, tid);
const canView = (cid, tid) => owns(cid, tid) || !!get('SELECT 1 FROM class_viewers WHERE class_id=? AND teacher_id=?', cid, tid);
const view = (req, res, next) => canView(+req.params.id, req.user.id) ? next() : res.status(403).json({ error: 'No access to this class' });
const own = (req, res, next) => owns(+req.params.id, req.user.id) ? next() : res.status(403).json({ error: 'Only the teacher who created this class can do this' });
app.get('/api/teacher/classes', T, wrap((req, res) => res.json(all(`SELECT c.id,c.name,c.code,(c.teacher_id=?) owner,u.name creator,(SELECT COUNT(*) FROM enrollments e WHERE e.class_id=c.id) students
  FROM classes c JOIN users u ON u.id=c.teacher_id WHERE c.teacher_id=? OR c.id IN(SELECT class_id FROM class_viewers WHERE teacher_id=?)`, req.user.id, req.user.id, req.user.id))));
app.post('/api/teacher/classes', T, wrap((req, res) => {
  if (!req.body.name) return res.status(400).json({ error: 'Class name required' });
  for (let i = 0; i < 5; i++) { const code = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
    try { const id = run('INSERT INTO classes(name,code,teacher_id) VALUES(?,?,?)', req.body.name, code, req.user.id).lastInsertRowid; return res.json({ id, code }); } catch {} }
  res.status(500).json({ error: 'Could not generate code' }); }));
app.post('/api/teacher/classes/join', T, wrap((req, res) => { // sync another teacher's class as read-only
  const c = get('SELECT id FROM classes WHERE code=?', (req.body.code || '').trim().toUpperCase()); if (!c) return res.status(404).json({ error: 'No class with that code' });
  run('INSERT OR IGNORE INTO class_viewers VALUES(?,?)', req.user.id, c.id); res.json({ ok: true }); }));
app.get('/api/classes/:id/students', T, view, wrap((req, res) => res.json(all(`SELECT u.id,u.name,u.grade,u.photo,COALESCE((SELECT SUM(points) FROM activity WHERE student_id=u.id),0) points,
  (SELECT COUNT(*) FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE s.student_id=u.id AND m.class_id=? AND s.status='approved') missions_done
  FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.class_id=? ORDER BY points DESC`, req.params.id, req.params.id))));
app.get('/api/classes/:id/missions', T, view, wrap((req, res) => res.json(all('SELECT * FROM missions WHERE class_id=? ORDER BY id DESC', req.params.id))));
app.post('/api/classes/:id/missions', T, own, wrap((req, res) => {
  const { title, description, points } = req.body; if (!title || !(points > 0)) return res.status(400).json({ error: 'Title and points required' });
  run('INSERT INTO missions(class_id,title,description,points) VALUES(?,?,?,?)', req.params.id, title, description || '', Math.min(+points, 100)); res.json({ ok: true }); }));
app.get('/api/classes/:id/submissions', T, view, wrap((req, res) => res.json(all(`SELECT s.id,s.photo,s.status,s.awarded,s.created_at,u.name student,m.title,m.points max_points
  FROM submissions s JOIN missions m ON m.id=s.mission_id JOIN users u ON u.id=s.student_id WHERE m.class_id=? ORDER BY (s.status='pending') DESC, s.id DESC`, req.params.id))));
app.post('/api/submissions/:id/review', T, wrap((req, res) => {
  const s = get(`SELECT s.*,m.title,m.points max_points,c.teacher_id FROM submissions s JOIN missions m ON m.id=s.mission_id JOIN classes c ON c.id=m.class_id WHERE s.id=?`, req.params.id);
  if (!s) return res.status(404).json({ error: 'Submission not found' });
  if (s.teacher_id !== req.user.id) return res.status(403).json({ error: 'Only the teacher who created this class can approve or reject' });
  if (s.status !== 'pending') return res.status(409).json({ error: 'Already reviewed' });
  const approve = !!req.body.approve, pts = approve ? Math.max(0, Math.min(req.body.points == null ? s.max_points : +req.body.points, s.max_points)) : 0;
  db.transaction(() => { run('UPDATE submissions SET status=?,awarded=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?', approve ? 'approved' : 'rejected', pts, s.id);
    if (approve) run('INSERT INTO activity(student_id,kind,text,points) VALUES(?,?,?,?)', s.student_id, 'mission', 'Mission approved: ' + s.title, pts); })();
  res.json({ ok: true, points: pts }); }));
app.get('/api/classes/:id/assessment', T, view, wrap((req, res) => res.json(all(`SELECT u.name,u.grade,
  COALESCE((SELECT SUM(awarded) FROM submissions s JOIN missions m ON m.id=s.mission_id WHERE s.student_id=u.id AND m.class_id=? AND s.status='approved'),0) mission_points,
  COALESCE((SELECT SUM(points) FROM activity WHERE student_id=u.id AND kind='quiz'),0) quiz_points
  FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.class_id=? ORDER BY u.name`, req.params.id, req.params.id))));
app.get('/api/classes/:id/doubts', T, view, wrap((req, res) => res.json(all('SELECT d.id,d.message,d.reply,u.name student FROM doubts d JOIN users u ON u.id=d.student_id WHERE d.class_id=? ORDER BY d.id DESC', req.params.id))));
app.post('/api/doubts/:id/reply', T, wrap((req, res) => {
  const d = get('SELECT d.id,c.teacher_id FROM doubts d JOIN classes c ON c.id=d.class_id WHERE d.id=?', req.params.id);
  if (!d || d.teacher_id !== req.user.id) return res.status(403).json({ error: 'Only the class creator can reply' });
  run('UPDATE doubts SET reply=? WHERE id=?', req.body.reply, d.id); res.json({ ok: true }); }));

app.listen(process.env.PORT || 4000, () => console.log('API ready'));
