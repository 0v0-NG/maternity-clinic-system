import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../hooks/useAuth';

export const metadata = {
  title: 'ANC/PNC Clinic - Appointment System',
  description: 'Book and manage antenatal and postnatal clinic appointments online.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-clinic-50 text-body">
        <Toaster position="top-center" />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
