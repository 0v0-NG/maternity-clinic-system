'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { authAPI } from '../../lib/api';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await authAPI.login({ phone, password });
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));

      toast.success('Login successful!');

      // Redirect based on role
      const role = data.data.user.role;
      if (role === 'admin') router.push('/admin');
      else if (['front_desk', 'midwife', 'doctor'].includes(role)) router.push('/staff');
      else router.push('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-4xl">🏥</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Welcome Back</h1>
          <p className="text-gray-500 mt-1">Log in to manage your appointments</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              className="input-field"
              placeholder="08012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary-600 font-semibold hover:underline">
            Sign Up
          </Link>
        </p>

        {/* Demo Fast Logins for Testing - only in demo mode */}
        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs font-bold text-body-muted uppercase text-center mb-3">
              🧪 Prototype Fast Logins (1-Click)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => { setPhone('+2348012345678'); setPassword('password123'); }}
                className="p-2 border rounded-lg bg-primary-50 hover:bg-primary-100 text-left font-medium text-clinic-dark"
              >
                👩 Mother (Amina)
              </button>
              <button
                type="button"
                onClick={() => { setPhone('+2340000000004'); setPassword('password123'); }}
                className="p-2 border rounded-lg bg-primary-50 hover:bg-primary-100 text-left font-medium text-clinic-dark"
              >
                🧑‍💼 Front Desk
              </button>
              <button
                type="button"
                onClick={() => { setPhone('+2340000000002'); setPassword('password123'); }}
                className="p-2 border rounded-lg bg-primary-50 hover:bg-primary-100 text-left font-medium text-clinic-dark"
              >
                🩺 Doctor (Adebayo)
              </button>
              <button
                type="button"
                onClick={() => { setPhone('+2340000000001'); setPassword('password123'); }}
                className="p-2 border rounded-lg bg-primary-50 hover:bg-primary-100 text-left font-medium text-clinic-dark"
              >
                🔧 Administrator
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
