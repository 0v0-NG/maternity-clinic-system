/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Bayero University Kano (buk.edu.ng) official blue & sky-turquoise palette
        // Extracted from buk.edu.ng Showcase+ color-blue.css:
        // Base color: #08A7FD (primary-400) | Dark institutional color: #02669D (primary-500 / clinic-dark)
        primary: {
          50: '#EFF8FF',   // ultra-light sky tint
          100: '#D9F0FE',  // soft sky badge tint
          200: '#B5E2FD',  // subtle sky border
          300: '#75CBFC',  // medium sky highlight
          400: '#08A7FD',  // BUK official base sky-turquoise blue (#08a7fd)
          500: '#02669D',  // BUK official institutional dark blue (#02669d)
          600: '#025B8C',
          700: '#014D78',  // deeper hover & heading tone
          800: '#013C5E',
          900: '#002942',
        },
        clinic: {
          50: '#EFF8FF',   // light BUK sky tint
          100: '#D9F0FE',
          200: '#B5E2FD',
          300: '#75CBFC',
          400: '#08A7FD',  // BUK official base sky-turquoise blue (#08a7fd)
          500: '#02669D',  // BUK official institutional dark blue (#02669d)
          600: '#025B8C',
          700: '#014D78',
          800: '#013C5E',
          900: '#002942',
        },
        'clinic-dark': '#02669D',
        'clinic-tint': '#EFF8FF',
        body: '#1F2937',        // body text
        'body-muted': '#6B7280', // muted text
        border: '#E5E7EB',      // borders
        // Status colours
        'status-waiting': '#F59E0B',      // amber = waiting
        'status-consultation': '#14B8A6', // teal = in consultation
        'status-booked': '#22C55E',       // soft green = booked / completed
        'status-completed': '#22C55E',
        'status-cancelled': '#EF4444',    // red = cancelled
        'status-no-show': '#EF4444',      // red = no-show
        'status-emergency': '#EF4444',    // red = emergency notice
        'status-late': '#F59E0B',         // amber = late badge
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
    plugins: [],
  },
};
