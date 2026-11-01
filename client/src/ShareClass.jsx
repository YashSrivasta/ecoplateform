import { useToast } from './ui';
import './shareclass.css';

export const joinLink = (code, origin = window.location.origin) => `${origin}/join/${code}`;
// the message a teacher sends to students (WhatsApp, SMS, class group...)
export const shareText = (name, code, origin) => `Join my class "${name}" on EcoQuest.\nOpen this link: ${joinLink(code, origin)}\nOr enter the class code: ${code}`;

// navigator.clipboard only works on secure pages, so an old-style copy is the fallback
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* try the fallback below */ }
  try {
    const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); document.body.removeChild(t); return ok;
  } catch { return false; }
}

/** Copy code, copy link, WhatsApp (and the phone's own Share menu when it has one) for one class. */
export function ShareButtons({ code, name, native }) {
  const toast = useToast();
  const doCopy = async (text, what) => toast((await copy(text)) ? `${what} copied` : 'Could not copy. Please select the text and copy it yourself.');
  const msg = shareText(name, code);
  return (
    <span className="share-row">
      <button type="button" className="btn btn-line" onClick={() => doCopy(code, 'Class code')} aria-label={`Copy class code for ${name}`}>Copy code</button>
      <button type="button" className="btn btn-line" onClick={() => doCopy(joinLink(code), 'Class link')} aria-label={`Copy join link for ${name}`}>Copy link</button>
      <a className="btn btn-line" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" aria-label={`Share ${name} on WhatsApp (opens WhatsApp)`}>WhatsApp</a>
      {native && typeof navigator !== 'undefined' && navigator.share && (
        <button type="button" className="btn btn-line" onClick={() => navigator.share({ title: 'Join my EcoQuest class', text: msg }).catch(() => {})}>Share…</button>
      )}
    </span>
  );
}

/** Shown right after a class is created: the code in big letters and the share buttons. */
export function NewClassPanel({ name, code, onClose }) {
  return (
    <div className="share-fresh" role="status">
      <p style={{ margin: 0 }}><b>Class created: {name}</b></p>
      <p className="muted" style={{ margin: '.25rem 0 0' }}>Class code</p>
      <div className="share-code" aria-label={`Class code ${code.split('').join(' ')}`}>{code}</div>
      <p className="muted">Send students the link. They open it, log in as a student and tap Join. They can also type the code under "Join a class".</p>
      <ShareButtons code={code} name={name} native />
      <div className="row"><button type="button" className="btn btn-line" onClick={onClose}>Done</button></div>
    </div>
  );
}
