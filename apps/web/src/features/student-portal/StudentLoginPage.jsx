import { useState } from 'react';
import { studentLogin } from '../../lib/auth.js';

export default function StudentLoginPage({ onSuccess, onSwitchToStaff }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (pin.length !== 6) { setError('PIN must be 6 digits'); return; }
    setLoading(true);
    try {
      const data = await studentLogin({ phone, pin });
      onSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .sl-page { min-height:100dvh; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at center, #1e293b 0%, #0f172a 100%); padding:20px; font-family:'Inter',system-ui,-apple-system,sans-serif; }
        .sl-card { background:rgba(255,255,255,0.98); border-radius:28px; padding:28px 24px; width:100%; max-width:340px; box-shadow:0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1); text-align:center; position:relative; overflow:hidden; }
        .sl-card::before { content:''; position:absolute; top:0; left:0; right:0; height:4px; background:linear-gradient(90deg,#1f4b8f,#3b82f6); }
        .sl-header { display:flex; align-items:center; gap:14px; margin-bottom:32px; text-align:left; }
        .sl-logo { width:48px; height:48px; border-radius:12px; object-fit:cover; box-shadow:0 4px 10px rgba(31,75,143,0.1); flex-shrink:0; }
        .sl-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; letter-spacing:-0.5px; line-height:1.2; }
        .sl-subtitle { font-size:11.5px; color:#64748b; margin:0; font-weight:600; line-height:1.2; }
        .sl-field { text-align:left; margin-bottom:14px; }
        .sl-label { display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:#334155; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.4px; }
        .sl-input { width:100%; padding:12px 14px; border:1.5px solid #e2e8f0; border-radius:12px; font-size:15px; outline:none; transition:all 0.2s; box-sizing:border-box; font-family:inherit; background:#f8fafc; }
        .sl-input:focus { border-color:#1f4b8f; background:#fff; box-shadow:0 0 0 4px rgba(31,75,143,0.08); }
        .sl-btn { width:100%; padding:14px; border:none; border-radius:12px; background:#1f4b8f; color:#fff; font-size:15px; font-weight:700; cursor:pointer; transition:all 0.2s; margin-top:10px; font-family:inherit; }
        .sl-btn:hover { background:#1e3a8a; transform:translateY(-1px); box-shadow:0 4px 12px rgba(31,75,143,0.2); }
        .sl-btn:active { transform:translateY(0); }
        .sl-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; box-shadow:none; }
        .sl-error { color:#e11d48; font-size:13px; margin:14px 0 0; font-weight:600; padding:10px; background:#fff1f2; border-radius:10px; }
        .sl-footer { margin-top:18px; padding-top:16px; border-top:1px solid #f1f5f9; display:flex; flex-direction:column; gap:8px; }
        .sl-action-link { font-size:13px; color:#1f4b8f; cursor:pointer; text-decoration:none; font-weight:600; background:none; border:none; padding:0; font-family:inherit; transition:color 0.2s; }
        .sl-action-link:hover { color:#2563eb; text-decoration:underline; }
        .sl-forgot-msg { background:#fef9c3; border:1px solid #fef08a; border-radius:12px; padding:12px; font-size:12px; color:#854d0e; margin-top:12px; line-height:1.5; text-align:left; }

        .sl-hero { display:none; }
        @media (min-width: 1024px) {
          .sl-page { display:grid; grid-template-columns:1.1fr 1fr; padding:0; background:#fff; align-items:stretch; }
          .sl-hero { display:flex; flex-direction:column; justify-content:center; padding:80px; background:radial-gradient(circle at top right, #1e3a8a 0%, #0f172a 100%); color:#fff; position:relative; overflow:hidden; }
          .sl-hero::after { content:''; position:absolute; bottom:-100px; right:-100px; width:400px; height:400px; background:rgba(31,75,143,0.1); border-radius:50%; filter:blur(80px); }
          .sl-hero-tag { display:inline-block; padding:6px 14px; background:rgba(255,255,255,0.1); border-radius:100px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:24px; border:1px solid rgba(255,255,255,0.15); animation:sl-tag-pulse 2s infinite; }
          @keyframes sl-tag-pulse { 0% { box-shadow:0 0 0 0 rgba(255,255,255,0.2); } 70% { box-shadow:0 0 0 10px rgba(255,255,255,0); } 100% { box-shadow:0 0 0 0 rgba(255,255,255,0); } }
          .sl-hero h2 { font-size:52px; font-weight:800; margin:0 0 20px; letter-spacing:-1.5px; line-height:1.05; }
          .sl-hero p { font-size:19px; color:rgba(255,255,255,0.7); max-width:440px; line-height:1.5; margin:0; }
          .sl-form-side { display:flex; align-items:center; justify-content:center; background:#f8fafc; padding:40px; }
          .sl-card { background:#fff; box-shadow:0 10px 25px rgba(0,0,0,0.05); border:1px solid #e2e8f0; }
        }
      `}} />

      <main className="sl-page">
        <section className="sl-hero">
          <span className="sl-hero-tag">Official Student Portal</span>
          <h2>Empowering your <br />learning journey.</h2>
          <p>Access your materials, track your progress, and connect with your teachers in one secure place.</p>
        </section>

        <section className="sl-form-side">
          <div className="sl-card">
            <header className="sl-header">
              <img src="/icon-192.png" alt="Edusolve" className="sl-logo" />
              <div>
                <h1 className="sl-title">Edusolve</h1>
                <p className="sl-subtitle">Student & Parent Portal</p>
              </div>
            </header>

            <form onSubmit={onSubmit}>
              <div className="sl-field">
                <label className="sl-label">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px', marginTop: '-2px' }}>
                    <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
                    <path d="M12 18h.01"/>
                  </svg>
                  Phone Number
                </label>
                <input
                  className="sl-input"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Enter registered phone number"
                  required
                  autoComplete="tel"
                />
              </div>

              <div className="sl-field">
                <label className="sl-label">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px', marginTop: '-2px' }}>
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  6-Digit PIN
                </label>
                <input
                  className="sl-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 6) setPin(v); }}
                  placeholder="● ● ● ● ● ●"
                  required
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '20px', fontWeight: 700 }}
                />
              </div>

              <button type="submit" className="sl-btn" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              {error && <p className="sl-error">{error}</p>}
            </form>

            <div className="sl-footer">
              <button className="sl-action-link" onClick={() => setShowForgot(!showForgot)}>
                Forgot PIN?
              </button>
              {showForgot && (
                <div className="sl-forgot-msg">
                  Contact your <strong>Academic Coordinator</strong> to reset your PIN securely.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
