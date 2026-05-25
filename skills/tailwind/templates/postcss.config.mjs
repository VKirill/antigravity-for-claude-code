// postcss.config.mjs — Tailwind 4 PostCSS configuration
//
// Use this ONLY for non-Vite pipelines (webpack, CRA, custom build tools).
// For Vite projects, use @tailwindcss/vite plugin instead (see config-css-first.md).
//
// Install:
//   npm install tailwindcss @tailwindcss/postcss
//
// Notes:
// - autoprefixer is NOT needed — Tailwind 4 handles vendor prefixes internally
// - postcss-import is NOT needed — @tailwindcss/postcss handles @import resolution
// - No tailwind.config.js — all config lives in your CSS via @theme

export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
