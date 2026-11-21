// Lets any logged-in user (student or teacher) correct their own name.
// Mount in server/index.js:  profile({ app, auth, wrap, get, run });
export default function profile({ app, auth, wrap, get, run }) {
  app.put('/api/me/name', auth(), wrap(async (req, res) => {
    const name = String(req.body.name || '').replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Name must be 2 to 60 characters' });
    await run('UPDATE users SET name=? WHERE id=?', name, req.user.id);
    const u = await get('SELECT id,role,name,email,grade,photo FROM users WHERE id=?', req.user.id);
    res.json({ user: u });
  }));
}
