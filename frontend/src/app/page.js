'use client';

import Link from 'next/link';
import { Calendar, Clock, Bell, Shield, Users, ChevronRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            <h1 className="text-xl font-bold text-primary-700">ANC/PNC Clinic</h1>
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
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Book Your Clinic Appointment Online
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            No more early morning queues. Book antenatal and postnatal appointments
            from your phone, receive SMS reminders, and check your queue position live.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="bg-white text-primary-700 px-8 py-4 rounded-lg font-bold text-lg hover:bg-primary-50 transition-colors inline-flex items-center justify-center gap-2">
              Get Started <ChevronRight size={20} />
            </Link>
            <Link href="/login" className="border-2 border-white text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-white/10 transition-colors">
              I Have an Account
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">How It Works</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Calendar className="text-primary-600" size={32} />}
              title="Book Easily"
              desc="Choose your clinic, pick a date and time slot, and book for yourself, your baby, or both."
            />
            <FeatureCard
              icon={<Bell className="text-primary-600" size={32} />}
              title="SMS Reminders"
              desc="Receive SMS reminders 24 hours and 2 hours before your appointment so you never miss a visit."
            />
            <FeatureCard
              icon={<Clock className="text-primary-600" size={32} />}
              title="Live Queue"
              desc="Check in at the clinic and track your queue position in real time from your phone."
            />
            <FeatureCard
              icon={<Users className="text-primary-600" size={32} />}
              title="Mother & Baby"
              desc="One appointment covers mum, baby, or both. Manage multiple baby profiles for twins."
            />
            <FeatureCard
              icon={<Shield className="text-primary-600" size={32} />}
              title="Safe & Private"
              desc="Your data is protected with encryption and role-based access in line with Nigerian data law."
            />
            <FeatureCard
              icon={<Calendar className="text-accent-600" size={32} />}
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

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p>&copy; {new Date().getFullYear()} ANC/PNC Clinic Appointment System</p>
          <p className="text-sm mt-2">Designed for Nigerian hospitals</p>
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
