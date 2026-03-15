import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        electric: {
          blue:   '#00d2ff',
          purple: '#7b2ff7',
          orange: '#ff6b35',
        },
        metallic: {
          silver: '#c0c0c0',
          light:  '#e8e8e8',
        },
        bg: {
          deep:    '#0a0a14',
          card:    '#10101e',
          surface: '#151528',
        },
      },
      animation: {
        'electric-shimmer': 'electric-shimmer 4s ease infinite',
        'metallic-border':  'metallic-border 6s ease infinite',
        'electric-pulse':   'electric-pulse 2s ease-in-out infinite',
        'fade-in':          'fade-in 0.25s ease forwards',
        'spin-slow':        'spin-slow 3s linear infinite',
      },
      keyframes: {
        'electric-shimmer': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':       { backgroundPosition: '100% 50%' },
        },
        'metallic-border': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':       { backgroundPosition: '100% 50%' },
        },
        'electric-pulse': {
          '0%, 100%': { opacity: '1',   boxShadow: '0 0 6px 1px rgba(99,179,237,0.35)' },
          '50%':       { opacity: '0.8', boxShadow: '0 0 16px 4px rgba(99,179,237,0.6)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

