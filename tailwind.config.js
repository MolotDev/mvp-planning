/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        md: "0 4px 6px -1px rgb(0 0 0 / 0.65), 0 10px 24px -4px rgb(0 0 0 / 0.7)",
      },
      colors: {
        primitive: {
          neutral: {
            0: "var(--color-primitive-neutral-0)",
            50: "var(--color-primitive-neutral-50)",
            100: "var(--color-primitive-neutral-100)",
            200: "var(--color-primitive-neutral-200)",
            300: "var(--color-primitive-neutral-300)",
            500: "var(--color-primitive-neutral-500)",
            600: "var(--color-primitive-neutral-600)",
            700: "var(--color-primitive-neutral-700)",
            800: "var(--color-primitive-neutral-800)",
            850: "var(--color-primitive-neutral-850)",
            900: "var(--color-primitive-neutral-900)",
            950: "var(--color-primitive-neutral-950)",
            1000: "var(--color-primitive-neutral-1000)",
          },
          green: {
            500: "var(--color-primitive-green-500)",
          },
          red: {
            500: "var(--color-primitive-red-500)",
          },
          blue: {
            500: "var(--color-primitive-blue-500)",
          },
        },
      },
    },
  },
  plugins: [],
};
