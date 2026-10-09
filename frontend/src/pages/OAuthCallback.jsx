import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccessToken, refreshSession } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from '../components/UI';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Session was established by the backend callback via HttpOnly cookie.
        // Single-flight shares the rotation with AuthProvider's own restore call,
        // so StrictMode remounts and racers can't invalidate each other.
        const d = await refreshSession();
        if (cancelled) return;
        setAccessToken(d.accessToken || d.token || null);
        login(d.accessToken || d.token, d.user);
        navigate('/', { replace: true });
      } catch (e) {
        if (!cancelled) {
          setErr('Google sign-in failed. Please try again.');
          setTimeout(() => navigate('/login?oauth_error=auth_failed', { replace: true }), 1200);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (err) return <p style={{ textAlign: 'center', padding: 80, color: '#ba1a1a' }}>{err}</p>;
  return <Spinner pad={120} />;
}
