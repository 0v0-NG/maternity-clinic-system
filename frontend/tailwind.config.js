/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Nigerian green & white palette (DESIGN)
        // `primary` keeps its numeric keys so existing classes keep resolving,
        // now anchored to the DESIGN primary green #008751.
        primary: {
          50: '#E8F5EE',   // light tint
          100: '#CDF0DA',
          200: '#ADE5C2',
          300: '#82DAAA',
          400: '#57CF92',
          500: '#008751',  // primary green
          600: '#006E3E',
          700: '#005A38',  // dark green
          800: '#00472C',
          900: '#00331E',
        },
        clinic: {
          50: '#E8F5EE',   // light tint
          100: '#CDF0DA',
          200: '#ADE5C2',
          300: '#82DAAA',
          400: '#57CF92',
          500: '#008751',  // primary green
          600: '#006E3E',
          700: '#005A38',  // dark green
          800: '#00472C',
          900: '#00331E',
        },
        'clinic-dark': '#005A38',
        'clinic-tint': '#E8F5EE',
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
