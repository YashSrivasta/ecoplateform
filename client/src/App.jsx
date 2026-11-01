import { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import Login from './Login';
import { SDash, Quizzes, Tasks, Profile } from './Student';
import Leaderboard from './Leaderboard';
import Analytics from './Analytics';
import Projects from './Projects';
import QuizBuilder from './QuizBuilder';
import Footprint from './Footprint';
import Announcements from './Announcements';
import TeamChallenges from './TeamChallenges';
import JoinLink from './JoinLink';
import { TDash, Students, Review, Assessment, Report } from './Teacher';
import { AuthCtx, ToastCtx, Icon, useAuth } from './ui';
import { A11yBar, useA11y } from './a11y';
import { CelebrateProvider } from './Celebrate';

function Shell({ role, links }) {
  const { user, logout } = useAuth();
  const a11y = useA11y();
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const first = useRef(true);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const reload = () => role === 'teacher' && api('/teacher/classes').then(c => { setClasses(c); setClassId(id => (c.some(x => x.id === id) ? id : c[0]?.id || null)); }).catch(() => {});
  useEffect(() => { reload(); }, []);
  useEffect(() => { // new page: stop reading, and move keyboard / screen-reader focus to the page content
    a11y?.stop();
    if (first.current) { first.current = false; return; }
    mainRef.current?.focus({ preventScroll: true }); window.scrollTo(0, 0);
  }, [pathname]);
  if (!user) return <Navigate to="/login" />;
  if (user.role !== role) return <Navigate to={'/' + user.role} />;
  return (
    <div className="shell">
      <a className="skip" href="#main" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>Skip to content</a>
      <aside className="side">
        <div className="brand"><img src="/logo-full.png" alt="EcoQuest" width="172" height="64" /></div>
        <nav className="nav" aria-label="Main">
          {links.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/' + role}><Icon name={icon} />{label}</NavLink>)}
        </nav>
        <button className="btn btn-white logout" onClick={logout}><Icon name="logout" size={18} />Log out</button>
      </aside>
      <main id="main" ref={mainRef} tabIndex={-1}>
        <A11yBar />
        <Outlet context={{ classes, classId, setClassId, reload, cls: classes.find(c => c.id === classId) }} />
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(sessionStorage.getItem('user') || 'null'); } catch { return null; } });
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const nav = useNavigate();
  const notify = useCallback((message, ms = 4000) => { clearTimeout(timer.current); setToast({ message, id: Date.now() }); timer.current = setTimeout(() => setToast(null), ms); }, []);
  const login = ({ token, user }) => {
    // sessionStorage = per browser tab, so a teacher tab and a student tab never share a login
    sessionStorage.setItem('token', token); sessionStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    let dest = '/' + user.role; // a student who came from a class share link goes back to it to join
    if (user.role === 'student') { try { const c = sessionStorage.getItem('joinCode'); if (c) dest = '/join/' + c; } catch {} }
    nav(dest);
  };
  const logout = () => { sessionStorage.clear(); setUser(null); nav('/login'); }; // keeps text-size choice (localStorage)
  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <ToastCtx.Provider value={notify}>
       <CelebrateProvider>
        <Routes>
          <Route path="/join/:code" element={<JoinLink />} />
          <Route path="/login" element={user ? <Navigate to={'/' + user.role} /> : <Login />} />
          <Route path="/student" element={<Shell role="student" links={[['/student', 'Dashboard', 'grid'], ['/student/quizzes', 'Quiz Hub', 'quiz'], ['/student/tasks', 'Tasks', 'tasks'], ['/student/footprint', 'Footprint', 'leaf'], ['/student/leaderboard', 'Leaderboard', 'trophy'], ['/student/profile', 'Profile', 'user']]} />}>
            <Route index element={<SDash />} /><Route path="quizzes" element={<Quizzes />} /><Route path="tasks" element={<Tasks />} /><Route path="footprint" element={<Footprint />} /><Route path="leaderboard" element={<Leaderboard />} /><Route path="profile" element={<Profile />} />
          </Route>
          <Route path="/teacher" element={<Shell role="teacher" links={[['/teacher', 'Dashboard', 'grid'], ['/teacher/analytics', 'Analytics', 'chart'], ['/teacher/students', 'Students', 'users'], ['/teacher/review', 'Review', 'eye'], ['/teacher/quizzes', 'Quiz builder', 'quiz'], ['/teacher/announcements', 'Announcements', 'chat'], ['/teacher/challenges', 'Team challenges', 'flame'], ['/teacher/projects', 'Projects', 'folder'], ['/teacher/assessment', 'Assessment', 'bars'], ['/teacher/report', 'Report', 'doc']]} />}>
            <Route index element={<TDash />} /><Route path="analytics" element={<Analytics />} /><Route path="students" element={<Students />} /><Route path="review" element={<Review />} /><Route path="quizzes" element={<QuizBuilder />} /><Route path="announcements" element={<Announcements />} /><Route path="challenges" element={<TeamChallenges />} /><Route path="projects" element={<Projects />} /><Route path="assessment" element={<Assessment />} /><Route path="report" element={<Report />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? '/' + user.role : '/login'} />} />
        </Routes>
        <div className="toast-region" role="status" aria-live="polite">
          {toast && <div className="toast" key={toast.id}><Icon name="check" size={18} />{toast.message}</div>}
        </div>
       </CelebrateProvider>
      </ToastCtx.Provider>
    </AuthCtx.Provider>
  );
}
