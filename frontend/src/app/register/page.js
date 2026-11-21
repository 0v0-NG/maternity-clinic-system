'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { authAPI } from '../../lib/api';

export default function RegisterPage() {
  const [step, setStep] = useState(1); // 1: register, 2: verify OTP
  const [form, setForm] = useState({ phone: '', name: '', password: '', confirmPassword: '' });
  const [otp, setOtp] = useState('');
  const [pinId, setPinId] = useState('');
  const [motherId, setMotherId] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match.');
    }
    setLoading(true);

    try {
      const { data } = await authAPI.register({
        phone: form.phone,
        name: form.name,
        password: form.password,
      });

      setPinId(data.data.pinId);
      setMotherId(data.data.motherId);
      setStep(2);
      if (data.data.demoOtp) {
        toast.success(`Demo Mode: Your OTP code is ${data.data.demoOtp}`, { duration: 8000 });
        setOtp(data.data.demoOtp);
      } else {
        toast.success('OTP sent to your phone!');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await authAPI.verifyOTP({ pinId, otp, motherId });
      localStorage.setItem('token', data.data.token);
      toast.success('Account verified! Welcome!');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-4xl">🏥</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Create Account</h1>
          <p className="text-gray-500 mt-1">
            {step === 1 ? 'Register with your phone number' : 'Enter the OTP sent to your phone'}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Mrs. Amina Bello"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                className="input-field"
                placeholder="08012345678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Sending OTP...' : 'Register'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
              <input
                type="text"
                className="input-field text-center text-2xl tracking-widest"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                A 6-digit code was sent to {form.phone}
              </p>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-primary-600 font-semibold hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
