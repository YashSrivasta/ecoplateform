CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, role TEXT NOT NULL CHECK(role IN('student','teacher')), name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, grade INTEGER, photo TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS classes(id INTEGER PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS enrollments(student_id INTEGER REFERENCES users(id), class_id INTEGER REFERENCES classes(id), PRIMARY KEY(student_id,class_id));
-- other teachers can view (not approve) a class
CREATE TABLE IF NOT EXISTS class_viewers(teacher_id INTEGER REFERENCES users(id), class_id INTEGER REFERENCES classes(id), PRIMARY KEY(teacher_id,class_id));
CREATE TABLE IF NOT EXISTS quizzes(id INTEGER PRIMARY KEY, grade_min INTEGER, grade_max INTEGER, difficulty INTEGER, question TEXT, options TEXT, answer INTEGER);
CREATE TABLE IF NOT EXISTS quiz_attempts(student_id INTEGER, quiz_id INTEGER, correct INTEGER, PRIMARY KEY(student_id,quiz_id));
CREATE TABLE IF NOT EXISTS missions(id INTEGER PRIMARY KEY, class_id INTEGER REFERENCES classes(id), title TEXT, description TEXT, points INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY, mission_id INTEGER REFERENCES missions(id), student_id INTEGER REFERENCES users(id),
  photo TEXT NOT NULL, status TEXT DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')), awarded INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT);
-- every point ever earned; progress, charts and badges are computed from this
CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY, student_id INTEGER REFERENCES users(id), kind TEXT, text TEXT, points INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS doubts(id INTEGER PRIMARY KEY, class_id INTEGER REFERENCES classes(id), student_id INTEGER REFERENCES users(id), message TEXT, reply TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
