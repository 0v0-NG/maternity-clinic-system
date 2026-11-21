import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'ANC/PNC Clinic - Appointment System',
  description: 'Book and manage antenatal and postnatal clinic appointments online.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <Toaster position="top-center" />
        {children}
      </body>
    </html>
  );
}
