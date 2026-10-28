-- EcoQuest v2 upgrade. Idempotent: safe on a fresh DB and on an existing v1 DB. Never drops data.
-- Run after schema.sql (index.js does this on every start).

-- ---------- subjects ----------
CREATE TABLE IF NOT EXISTS subjects(
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, icon TEXT NOT NULL);
INSERT INTO subjects(slug,name,color,icon) VALUES
  ('math','Math','#4da3ff','➗'),
  ('science','Science','#b583ff','🔬'),
  ('environment','Environment','#d6ff00','🌍'),
  ('coding','Coding','#ff9f43','💻'),
  ('literature','Literature','#ff6b9d','📚')
ON CONFLICT(slug) DO NOTHING;

-- quizzes belong to a subject (old questions become Environment)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id);
UPDATE quizzes SET subject_id=(SELECT id FROM subjects WHERE slug='environment') WHERE subject_id IS NULL;

-- attempts remember when, how many points, and whether it was the daily challenge
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS is_daily BOOLEAN DEFAULT FALSE;

-- every point is tagged with a subject (impact tracker reads this)
ALTER TABLE activity ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id);
UPDATE activity SET subject_id=(SELECT id FROM subjects WHERE slug='environment') WHERE subject_id IS NULL;

-- ---------- daily challenge: one quiz per subject per day, double points ----------
CREATE TABLE IF NOT EXISTS daily_challenges(
  day DATE NOT NULL, subject_id INTEGER NOT NULL REFERENCES subjects(id), quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
  grade_band INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,subject_id,grade_band));

-- ---------- streaks (cached; recomputed when a student earns points) ----------
CREATE TABLE IF NOT EXISTS streaks(
  student_id INTEGER PRIMARY KEY REFERENCES users(id), current INTEGER NOT NULL DEFAULT 0,
  best INTEGER NOT NULL DEFAULT 0, last_day DATE);

-- ---------- missions: deadline, subjects (cross-subject splits points evenly), project link ----------
ALTER TABLE missions ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS project_id INTEGER;
CREATE TABLE IF NOT EXISTS mission_subjects(
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id), PRIMARY KEY(mission_id,subject_id));
INSERT INTO mission_subjects(mission_id,subject_id)
  SELECT m.id,(SELECT id FROM subjects WHERE slug='environment') FROM missions m
  WHERE NOT EXISTS(SELECT 1 FROM mission_subjects x WHERE x.mission_id=m.id);

-- ---------- collaboration: a project spans classes; the other class's teacher must accept ----------
CREATE TABLE IF NOT EXISTS projects(
  id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
  owner_id INTEGER NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS project_classes(
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','accepted','declined')),
  invited_by INTEGER REFERENCES users(id), responded_at TIMESTAMPTZ, PRIMARY KEY(project_id,class_id));
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='missions_project_fk') THEN
    ALTER TABLE missions ADD CONSTRAINT missions_project_fk FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL;
  END IF; END $$;

-- ---------- login rate limit ----------
CREATE TABLE IF NOT EXISTS login_attempts(
  key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, window_start TIMESTAMPTZ NOT NULL DEFAULT NOW());

-- ---------- google sign-in ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- ---------- indexes for the heavy reads ----------
CREATE INDEX IF NOT EXISTS idx_activity_student_day ON activity(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_subject ON activity(subject_id);
CREATE INDEX IF NOT EXISTS idx_enroll_class ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_missions_class ON missions(class_id);
CREATE INDEX IF NOT EXISTS idx_sub_mission ON submissions(mission_id, student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_subject_grade ON quizzes(subject_id, grade_min, grade_max);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON quiz_attempts(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_doubts_class ON doubts(class_id);
