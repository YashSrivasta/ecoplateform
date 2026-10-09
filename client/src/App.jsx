import { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from './api';
import Login from './Login';
import { SDash, Quizzes, Tasks, Profile } from './Student';
import { TDash, Students, Review, Assessment, Report } from './Teacher';
import { AuthCtx, ToastCtx, Icon, useAuth } from './ui';

function Shell({ role, links }) {
  const { user, logout } = useAuth();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const reload = () => role === 'teacher' && api('/teacher/classes').then(c => { setClasses(c); setClassId(id => (c.some(x => x.id === id) ? id : c[0]?.id || null)); }).catch(() => {});
  useEffect(() => { reload(); }, []);
  if (!user) return <Navigate to="/login" />;
  if (user.role !== role) return <Navigate to={'/' + user.role} />;
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="mark"><Icon name="leaf" size={20} /></span>EcoQuest</div>
        <nav className="nav" aria-label="Main">
          {links.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/' + role}><Icon name={icon} />{label}</NavLink>)}
        </nav>
        <button className="btn btn-white logout" onClick={logout}><Icon name="logout" size={18} />Log out</button>
      </aside>
      <main><Outlet context={{ classes, classId, setClassId, reload, cls: classes.find(c => c.id === classId) }} /></main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } });
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const nav = useNavigate();
  const notify = useCallback((message, ms = 4000) => { clearTimeout(timer.current); setToast({ message, id: Date.now() }); timer.current = setTimeout(() => setToast(null), ms); }, []);
  const login = ({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); setUser(user); nav('/' + user.role); };
  const logout = () => { localStorage.clear(); setUser(null); nav('/login'); };
  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      <ToastCtx.Provider value={notify}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to={'/' + user.role} /> : <Login />} />
          <Route path="/student" element={<Shell role="student" links={[['/student', 'Dashboard', 'grid'], ['/student/quizzes', 'Quiz Hub', 'quiz'], ['/student/tasks', 'Tasks', 'tasks'], ['/student/profile', 'Profile', 'user']]} />}>
            <Route index element={<SDash />} /><Route path="quizzes" element={<Quizzes />} /><Route path="tasks" element={<Tasks />} /><Route path="profile" element={<Profile />} />
          </Route>
          <Route path="/teacher" element={<Shell role="teacher" links={[['/teacher', 'Dashboard', 'grid'], ['/teacher/students', 'Students', 'users'], ['/teacher/review', 'Review', 'eye'], ['/teacher/assessment', 'Assessment', 'bars'], ['/teacher/report', 'Report', 'doc']]} />}>
            <Route index element={<TDash />} /><Route path="students" element={<Students />} /><Route path="review" element={<Review />} /><Route path="assessment" element={<Assessment />} /><Route path="report" element={<Report />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? '/' + user.role : '/login'} />} />
        </Routes>
        {toast && <div className="toast" role="status" key={toast.id}><Icon name="check" size={18} />{toast.message}</div>}
      </ToastCtx.Provider>
    </AuthCtx.Provider>
  );
}
