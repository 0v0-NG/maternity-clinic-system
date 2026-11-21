'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../lib/errorMessages';
import Button from '../../components/Button';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function RegisterPage() {
  const [step, setStep] = useState(1); // 1: register, 2: verify OTP
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    hospital_id: '',
    hmo_number: '',
    consent: false,
  });
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [pinId, setPinId] = useState('');
  const [motherId, setMotherId] = useState('');
  const [demoOtp, setDemoOtp] = useState(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const timerRef = useRef(null);
  const verifyingRef = useRef(false);
  const router = useRouter();
  const { register, verifyOTP, resendOTP } = useAuth();

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startResendTimer = () => {
    setResendSeconds(RESEND_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!form.consent) {
      return toast.error(
        'Please tick the consent box to allow us to process your and your baby\'s data (NDPA 2023).'
      );
    }
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters.');
    }
    if (form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match.');
    }

    setLoading(true);
    try {
      const result = await register({
        name: form.name,
        phone: form.phone,
        password: form.password,
        hospital_id: form.hospital_id || undefined,
        hmo_number: form.hmo_number || undefined,
        consent: true,
      });

      setPinId(result.data.pinId);
      setMotherId(result.data.motherId);

      if (result.data.demoOtp) {
        setDemoOtp(result.data.demoOtp);
        toast.success(`Demo mode: your OTP is ${result.data.demoOtp}`, { duration: 8000 });
      } else {
        toast.success('We sent a 6-digit code to your phone.');
      }

      setStep(2);
      startResendTimer();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || resending) return;
    setResending(true);
    try {
      const result = await resendOTP(form.phone);
      setPinId(result.data.pinId);
      if (result.data.demoOtp) {
        setDemoOtp(result.data.demoOtp);
        toast.success(`Demo mode: your new OTP is ${result.data.demoOtp}`, { duration: 8000 });
      } else {
        toast.success('A new code has been sent to your phone.');
      }
      setOtp(Array(OTP_LENGTH).fill(''));
      startResendTimer();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not resend the code. Please try again.'));
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (loading || verifyingRef.current) return;
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (loading || verifyingRef.current) return;
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    if (loading || verifyingRef.current) return;
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setOtp(next);
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    document.getElementById(`otp-${focusIndex}`)?.focus();
  };

  const handleVerify = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading || verifyingRef.current) return;

    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      return toast.error('Please enter all 6 digits of the code.');
    }

    verifyingRef.current = true;
    setLoading(true);
    try {
      const user = await verifyOTP(motherId, pinId, code);
      toast.success('Your account is verified. Welcome!');
      const role = user?.role || 'mother';
      if (role === 'admin') router.push('/admin');
      else if (['front_desk', 'midwife', 'doctor'].includes(role)) router.push('/staff');
      else router.push('/dashboard');
    } catch (error) {
      verifyingRef.current = false;
      toast.error(getErrorMessage(error, 'Verification failed. Please try again.'));
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
              <ShieldCheck className="text-primary-500" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-body">
              {step === 1 ? 'Create your account' : 'Verify your phone'}
            </h1>
            <p className="text-body-muted mt-1 text-base">
              {step === 1
                ? 'Register with your phone number to book clinic appointments.'
                : `Enter the 6-digit code sent to ${form.phone}.`}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-base font-medium text-body mb-1.5" htmlFor="name">
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  className="input-field text-base"
                  placeholder="e.g. Mrs. Amina Bello"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-base font-medium text-body mb-1.5" htmlFor="phone">
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  className="input-field text-base"
                  placeholder="08012345678"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-base font-medium text-body mb-1.5" htmlFor="confirmPassword">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="input-field text-base"
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                  <label className="block text-base font-medium text-body mb-1.5 whitespace-nowrap" htmlFor="hospital_id">
                    Hospital ID
                  </label>
                  <input
                    id="hospital_id"
                    type="text"
                    className="input-field text-base"
                    placeholder="Folder number (optional)"
                    value={form.hospital_id}
                    onChange={(e) => setForm({ ...form, hospital_id: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-body mb-1.5 whitespace-nowrap" htmlFor="hmo_number">
                    HMO / NHIA no.
                  </label>
                  <input
                    id="hmo_number"
                    type="text"
                    className="input-field text-base"
                    placeholder="Enrollment number (optional)"
                    value={form.hmo_number}
                    onChange={(e) => setForm({ ...form, hmo_number: e.target.value })}
                  />
                </div>
              </div>

              {/* Required NDPA 2023 consent */}
              <div className="rounded-xl border border-border bg-clinic-50 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 rounded border-border text-primary-500 focus:ring-primary-500"
                    checked={form.consent}
                    onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                  />
                  <span className="text-base text-body leading-snug">
                    I consent to the processing of my healthcare data and my baby&apos;s data in
                    accordance with the Nigeria Data Protection Act (NDPA) 2023.
                  </span>
                </label>
              </div>

              <Button type="submit" className="w-full text-base" disabled={loading || !form.consent}>
                {loading ? 'Sending code...' : 'Register'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label className="block text-base font-medium text-body mb-3 text-center">
                  Enter your 6-digit code
                </label>
                <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      disabled={loading}
                      className="w-12 h-14 text-center text-2xl font-bold text-body border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                      aria-label={`Digit ${index + 1}`}
                    />
                  ))}
                </div>

                {isDemoMode && demoOtp && (
                  <p className="text-center text-sm text-primary-700 bg-primary-50 rounded-lg px-3 py-2 mt-3">
                    Demo mode: use code <span className="font-bold tracking-widest">{demoOtp}</span>
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full text-base" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify and continue'}
              </Button>

              <div className="text-center text-base">
                {resendSeconds > 0 ? (
                  <span className="text-body-muted">
                    Resend code in {resendSeconds}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="text-primary-700 font-semibold hover:underline disabled:opacity-60"
                  >
                    {resending ? 'Resending...' : 'Resend code'}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="mx-auto flex items-center gap-1.5 text-base text-body-muted hover:text-body"
              >
                <ArrowLeft size={16} /> Use a different number
              </button>
            </form>
          )}

          <p className="text-center text-base text-body-muted mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-primary-700 font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
