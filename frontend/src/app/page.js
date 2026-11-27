'use client';

import Link from 'next/link';
import { Calendar, Clock, Bell, Shield, Users, ChevronRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Top Institutional Bar (BUK dark header-top style) */}
      <div className="bg-[#02669D] text-white text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <span className="font-medium tracking-wide">
            University Health Services · Bayero University, Kano
          </span>
          <span className="text-primary-100">
            BUK New Site, Gwarzo Road, Kano
          </span>
        </div>
      </div>

      {/* Main Navigation Header */}
      <header className="bg-white border-b border-primary-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            <h1 className="text-xl font-bold text-[#02669D]">ANC/PNC Clinic</h1>
          </div>
          <div className="flex gap-3">
            <Link href="/login" className="btn-secondary text-sm !px-4 !py-2">
              Log In
            </Link>
            <Link href="/register" className="btn-primary text-sm !px-4 !py-2">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#02669D] via-[#027AC0] to-[#08A7FD] text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Book Your Clinic Appointment Online
          </h2>
          <p className="text-xl text-primary-50 mb-8 max-w-2xl mx-auto">
            No more early morning queues. Book antenatal and postnatal appointments
            from your phone, receive SMS reminders, and check your queue position live.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-white text-[#02669D] px-8 py-4 rounded-lg font-bold text-lg hover:bg-primary-50 transition-colors inline-flex items-center justify-center gap-2 shadow-sm">
              Get Started <ChevronRight size={20} />
            </Link>
            <Link href="/login" className="border-2 border-white text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-white/15 transition-colors">
              I Have an Account
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-center text-[#02669D] mb-12">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Calendar className="text-[#02669D]" size={32} />}
              title="Book Easily"
              desc="Choose your clinic, pick a date and time slot, and book for yourself, your baby, or both."
            />
            <FeatureCard
              icon={<Bell className="text-[#08A7FD]" size={32} />}
              title="SMS Reminders"
              desc="Receive SMS reminders 24 hours and 2 hours before your appointment so you never miss a visit."
            />
            <FeatureCard
              icon={<Clock className="text-[#02669D]" size={32} />}
              title="Live Queue"
              desc="Check in at the clinic and track your queue position in real time from your phone."
            />
            <FeatureCard
              icon={<Users className="text-[#08A7FD]" size={32} />}
              title="Mother & Baby"
              desc="One appointment covers mum, baby, or both. Manage multiple baby profiles for twins."
            />
            <FeatureCard
              icon={<Shield className="text-[#02669D]" size={32} />}
              title="Safe & Private"
              desc="Your data is protected with encryption and role-based access in line with Nigerian data law."
            />
            <FeatureCard
              icon={<Calendar className="text-[#08A7FD]" size={32} />}
              title="Reschedule Anytime"
              desc="Need to change your appointment? Reschedule or cancel up to 4 hours before your visit."
            />
          </div>
        </div>
      </section>

      {/* Emergency Notice */}
      <section className="bg-red-50 border-t border-b border-red-200 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-red-800 font-semibold">
            ⚠️ For emergencies, please go directly to the Emergency Unit.
            This system is for scheduled clinic appointments only.
          </p>
        </div>
      </section>

      {/* Footer (BUK dark background style) */}
      <footer className="bg-[#02669D] text-white py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="font-semibold">&copy; {new Date().getFullYear()} ANC/PNC Clinic Appointment System</p>
          <p className="text-sm text-primary-100 mt-2">
            University Health Services, Bayero University, Kano
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="card text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 rounded-full mb-4">
        {icon}
      </div>
      <h4 className="text-lg font-bold mb-2">{title}</h4>
      <p className="text-gray-600">{desc}</p>
    </div>
  );
}
