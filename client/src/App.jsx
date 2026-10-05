import { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from './api';
import Login from './Login'; import { SDash, Quizzes, Tasks, Profile } from './Student'; import { TDash, Students, Review, Assessment } from './Teacher';
const Auth = createContext(); export const useAuth = () => useContext(Auth);

function Shell({ role, links }) {
  const { user, logout } = useAuth(); const [classes, setClasses] = useState([]); const [classId, setClassId] = useState(null);
  const reload = () => role === 'teacher' && api('/teacher/classes').then(c => { setClasses(c); setClassId(id => id || c[0]?.id || null); });
  useEffect(() => { reload(); }, []);
  if (!user) return <Navigate to="/login" />; if (user.role !== role) return <Navigate to={'/' + user.role} />;
  return <div className="shell"><nav className="side"><h2>🌿 EcoQuest</h2>
    {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/' + role}>{label}</NavLink>)}
    <button className="ghost" onClick={logout}>Log out</button></nav>
    <main><Outlet context={{ classes, classId, setClassId, reload, cls: classes.find(c => c.id === classId) }} /></main></div>;
}
export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null')); const nav = useNavigate();
  const login = ({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); setUser(user); nav('/' + user.role); };
  const logout = () => { localStorage.clear(); setUser(null); nav('/login'); };
  return <Auth.Provider value={{ user, login, logout }}><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/student" element={<Shell role="student" links={[['/student', 'Dashboard'], ['/student/quizzes', 'Quiz Hub'], ['/student/tasks', 'Tasks'], ['/student/profile', 'Profile']]} />}>
      <Route index element={<SDash />} /><Route path="quizzes" element={<Quizzes />} /><Route path="tasks" element={<Tasks />} /><Route path="profile" element={<Profile />} /></Route>
    <Route path="/teacher" element={<Shell role="teacher" links={[['/teacher', 'Dashboard'], ['/teacher/students', 'Students'], ['/teacher/review', 'Review'], ['/teacher/assessment', 'Assessment']]} />}>
      <Route index element={<TDash />} /><Route path="students" element={<Students />} /><Route path="review" element={<Review />} /><Route path="assessment" element={<Assessment />} /></Route>
    <Route path="*" element={<Navigate to={user ? '/' + user.role : '/login'} />} />
  </Routes></Auth.Provider>;
}
