import { useEffect, useState } from 'react';
import { api } from './api';
import { fmtDate } from './ui';
import './announcements.css';

/** Student dashboard card: the latest notices from the teachers of the classes the student joined. Hidden when there is nothing to show. */
export default function StudentAnnouncements() {
  const [list, setList] = useState([]);
  useEffect(() => { api('/student/announcements').then(setList).catch(() => setList([])); }, []);
  if (!list.length) return null;
  return (
    <section className="card paper">
      <h2>Class announcements</h2><p className="muted">Latest notices from your teachers</p>
      <div className="stack" style={{ marginTop: '.75rem' }}>
        {list.slice(0, 3).map(a => (
          <article key={a.id}>
            <p className="muted an-date">{a.class_name} · {a.teacher} · {fmtDate(a.created_at)}</p>
            <h3 className="an-title">{a.title}</h3>
            {a.body && <p className="an-body">{a.body}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
