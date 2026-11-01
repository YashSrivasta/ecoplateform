// AI note suggestion for the Review page. A teacher taps a button on ONE waiting photo; the server sends that photo plus the mission
// title and instructions to Google Gemini and returns a short suggested note. The teacher always reads and edits it before sending.
// Nothing about the student (name, email, class) is sent. The feature is OFF until GEMINI_API_KEY is set.
// Mounted from index.js:  aifeedback({ app, T, wrap, get })
import fs from 'node:fs/promises';
import path from 'node:path';

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' };
// Google changes which models are free, so the name is a setting. Without one, these are tried in order until one is accepted.
const DEFAULT_MODELS = 'gemini-3-flash-preview,gemini-2.5-flash-lite,gemini-2.5-flash';
const PER_MINUTE = 8; // per teacher, to protect the free quota for everyone

const PROMPT = (title, description) => `You help a school teacher review a photo a student sent as proof of an eco-friendly mission.
Mission title: ${title}
Mission instructions: ${description || '(none given)'}

Look at the photo. Does it clearly show the student did this mission? Problems to look for: blurry or very dark photo, nothing related to the mission, a screenshot or a photo of a screen, the activity not visible.
Answer with JSON only: {"verdict": "ok" or "problem", "note": "..."}
"note" is written to the student in simple, kind English, one or two short sentences, at most 200 characters. If verdict is "problem", say what to fix. If "ok", give short praise.
Never describe, name or guess anything about any person in the photo.`;

export default function aifeedback({ app, T, wrap, get, fetchFn = globalThis.fetch, readFile = fs.readFile, env = process.env, now = Date.now, uploadsDir = path.resolve('uploads') }) {
  const recent = new Map(); // teacher id -> times of recent requests
  let working = null; // the model name that last worked

  app.get('/api/ai/status', T, (_req, res) => res.json({ enabled: !!env.GEMINI_API_KEY }));

  app.post('/api/submissions/:id/suggest-feedback', T, wrap(async (req, res) => {
    if (!env.GEMINI_API_KEY) return res.status(503).json({ error: 'AI is not set up yet. Write the note yourself.', code: 'no_key' });
    const s = await get(`SELECT s.id,s.photo,s.status,m.title,m.description,c.teacher_id FROM submissions s JOIN missions m ON m.id=s.mission_id JOIN classes c ON c.id=m.class_id WHERE s.id=?`, /^\d{1,9}$/.test(req.params.id) ? +req.params.id : 0);
    if (!s) return res.status(404).json({ error: 'Submission not found' });
    if (s.teacher_id !== req.user.id) return res.status(403).json({ error: 'Only the teacher who created this class can review' });
    if (s.status !== 'pending') return res.status(409).json({ error: 'Already reviewed' });
    if (!s.photo) return res.status(404).json({ error: 'Photo no longer available' });
    const mime = MIME[path.extname(s.photo).toLowerCase()];
    if (!mime) return res.status(415).json({ error: 'AI cannot check this kind of photo. Write the note yourself.' });

    const t = now(), times = (recent.get(req.user.id) || []).filter(x => t - x < 60000);
    if (times.length >= PER_MINUTE) return res.status(429).json({ error: 'You asked AI a lot just now. Wait a minute, or write the note yourself.' });
    recent.set(req.user.id, [...times, t]);

    let bytes; try { bytes = await readFile(path.join(uploadsDir, path.basename(s.photo))); } catch { return res.status(404).json({ error: 'Photo no longer available' }); }
    const body = JSON.stringify({
      contents: [{ parts: [{ text: PROMPT(String(s.title).slice(0, 200), String(s.description || '').slice(0, 1000)) }, { inline_data: { mime_type: mime, data: Buffer.from(bytes).toString('base64') } }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 400 },
    });
    const models = working ? [working] : (env.GEMINI_MODEL || DEFAULT_MODELS).split(',').map(x => x.trim()).filter(Boolean);
    let r = null, last = null;
    for (const model of models) {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 25000);
      try {
        const resp = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body, signal: ctl.signal });
        const data = await resp.json().catch(() => ({}));
        if (resp.status === 404 || (resp.status === 400 && /model/i.test(data?.error?.message || ''))) { last = { status: resp.status, message: data?.error?.message, model }; continue; } // this model name is not available: try the next
        r = { resp, data, model }; break;
      } catch (e) { clearTimeout(timer); console.error('AI request failed:', e.name === 'AbortError' ? 'timed out' : e.message); return res.status(504).json({ error: 'AI took too long. Try again, or write the note yourself.' }); }
      finally { clearTimeout(timer); }
    }
    if (!r) { console.error('AI: no usable model.', JSON.stringify(last)); return res.status(502).json({ error: 'AI is not working right now. Write the note yourself.', code: 'no_model' }); }
    const { resp, data, model } = r;
    if (resp.status === 429) return res.status(429).json({ error: 'AI is busy right now (free limit reached). Try again later, or write the note yourself.' });
    if (!resp.ok) { console.error('AI error', resp.status, data?.error?.message); return res.status(502).json({ error: 'AI is not working right now. Write the note yourself.' }); }
    working = model;
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
    if (!text) return res.status(422).json({ error: 'AI could not check this photo. Write the note yourself.' });
    let verdict = null, note = text;
    try { const j = JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim()); verdict = ['ok', 'problem'].includes(j.verdict) ? j.verdict : null; note = String(j.note ?? ''); } catch { /* not JSON: use the plain text as the note */ }
    note = note.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!note) return res.status(422).json({ error: 'AI could not check this photo. Write the note yourself.' });
    res.json({ verdict, note });
  }));
}
