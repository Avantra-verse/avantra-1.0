import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#05050f",
        starlight: "#f2f0ff",
        "rift-purple": "#7b2ff7",
        "rift-pink": "#f72fb6",
        "rift-cyan": "#2ff7e0",
      },
    },
  },
  plugins: [],
};
export default config;
