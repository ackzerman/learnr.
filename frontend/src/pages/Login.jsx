import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuth } from '../hooks/useAuth';
import { ErrBox, LabelInput } from '../components/UI';

const OAUTH_ERRORS = {
  invalid_state: 'Google sign-in failed (invalid state). Please try again.',
  missing_code: 'Google sign-in was interrupted. Please try again.',
  invalid_token: 'Google sign-in failed. Please try again.',
  exchange_failed: 'Google sign-in failed. Please try again.',
  email_not_verified: 'Your Google email is not verified.',
  account_exists: 'An account with that email already exists. Sign in with email/password, then use Link Google account in Profile.',
  auth_failed: 'Google sign-in failed. Please try again.',
  account_error: 'Google sign-in failed. Please try again.',
};

export default function Login() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const [params] = useSearchParams();
  const oauthErr = OAUTH_ERRORS[params.get('oauth_error')] || (params.get('oauth_error') ? 'Google sign-in failed. Please try again.' : '');
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr]   = useState('');
  const [busy, setBusy] = useState(false);

  const F = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const d = await authAPI.login(form);
      login(d.accessToken || d.token, d.user);
      navigate('/');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#fbfaee',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 48, fontWeight: 700, color: '#181f21',
            letterSpacing: '-0.02em', lineHeight: 1,
          }}>learnr.</div>
          <p style={{
            fontFamily: "'Public Sans', sans-serif",
            color: '#747879', fontSize: 16, marginTop: 12,
          }}>Your personal learning tracker</p>
        </div>

        <div className="card fade-up" style={{ padding: 32 }}>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 24, fontWeight: 700, textAlign: 'center',
            marginBottom: 28, color: '#181f21',
          }}>
            Welcome back
          </h2>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <LabelInput label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={F('email')} required autoComplete="email" />
            <LabelInput label="Password" type="password" placeholder="••••••••" value={form.password} onChange={F('password')} required autoComplete="current-password" />
            <ErrBox msg={err || oauthErr} />
            <button type="submit" className="btn-primary" disabled={busy} style={{ width: '100%', padding: 14, fontSize: 16 }}>
              {busy ? 'Signing in…' : 'SIGN IN'}
            </button>
            <button type="button" className="btn-primary" onClick={() => authAPI.googleStart()} style={{ width: '100%', padding: 14, fontSize: 14, background: '#ffffff', color: '#181f21' }}>
              Continue with Google
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, color: '#747879', fontSize: 14 }}>
            No account?{' '}
            <Link to="/register" style={{
              color: '#181f21', fontWeight: 700, textDecoration: 'none',
              borderBottom: '2px solid #181f21', paddingBottom: 1,
            }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
