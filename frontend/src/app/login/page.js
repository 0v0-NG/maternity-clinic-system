'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../lib/errorMessages';
import Button from '../../components/Button';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(phone, password);
      toast.success('Logged in successfully.');

      // Role-based redirect after login.
      const role = user?.role || 'mother';
      if (role === 'admin') router.push('/admin');
      else if (['front_desk', 'midwife', 'doctor'].includes(role)) router.push('/staff');
      else router.push('/dashboard');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Login failed. Please check your details and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-clinic-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl border border-border shadow-sm p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mb-3">
              <LogIn className="text-primary-500" size={26} />
            </div>
            <h1 className="text-2xl font-bold text-body">Welcome back</h1>
            <p className="text-body-muted mt-1 text-base">Log in to manage your appointments.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-base font-medium text-body mb-1.5" htmlFor="phone">
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                className="input-field text-base"
                placeholder="08012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-base font-medium text-body mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="input-field text-base"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full text-base" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </Button>
          </form>

          <p className="text-center text-base text-body-muted mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-primary-700 font-semibold hover:underline">
              Register
            </Link>
          </p>

          {/* Demo Fast Logins - only when demo mode is enabled */}
          {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-xs font-bold text-body-muted uppercase text-center mb-3">
                Prototype fast logins (1-click)
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => { setPhone('+2348012345678'); setPassword('password123'); }}
                  className="p-2.5 border border-border rounded-xl bg-primary-50 hover:bg-primary-100 text-left font-medium text-clinic-dark"
                >
                  Mother (Amina)
                </button>
                <button
                  type="button"
                  onClick={() => { setPhone('+2340000000004'); setPassword('password123'); }}
                  className="p-2.5 border border-border rounded-xl bg-primary-50 hover:bg-primary-100 text-left font-medium text-clinic-dark"
                >
                  Front Desk
                </button>
                <button
                  type="button"
                  onClick={() => { setPhone('+2340000000002'); setPassword('password123'); }}
                  className="p-2.5 border border-border rounded-xl bg-primary-50 hover:bg-primary-100 text-left font-medium text-clinic-dark"
                >
                  Doctor (Adebayo)
                </button>
                <button
                  type="button"
                  onClick={() => { setPhone('+2340000000001'); setPassword('password123'); }}
                  className="p-2.5 border border-border rounded-xl bg-primary-50 hover:bg-primary-100 text-left font-medium text-clinic-dark"
                >
                  Administrator
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
