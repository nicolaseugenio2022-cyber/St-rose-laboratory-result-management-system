import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--color-primary)",
          "primary-hover": "var(--color-primary-hover)",
          "primary-foreground": "var(--color-primary-foreground)",
          tint: "var(--color-tint)",
          "decorative-pink": "var(--color-decorative-pink)",
          "accessible-rose": "var(--color-accessible-rose)",
          secondary: "var(--color-secondary)",
          "secondary-hover": "var(--color-secondary-hover)",
          "secondary-foreground": "var(--color-secondary-foreground)",
          background: "var(--color-background)",
          surface: "var(--color-surface)",
          "surface-hover": "var(--color-surface-hover)",
          border: "var(--color-border)",
          "border-subtle": "var(--color-border-subtle)",
          text: "var(--color-text)",
          "text-muted": "var(--color-text-muted)",
          "text-subtle": "var(--color-text-subtle)",
          success: "var(--color-success)",
          "success-bg": "var(--color-success-bg)",
          "success-border": "var(--color-success-border)",
          warning: "var(--color-warning)",
          "warning-bg": "var(--color-warning-bg)",
          "warning-border": "var(--color-warning-border)",
          danger: "var(--color-danger)",
          "danger-bg": "var(--color-danger-bg)",
          "danger-border": "var(--color-danger-border)",
          info: "var(--color-info)",
          "info-bg": "var(--color-info-bg)",
          "info-border": "var(--color-info-border)",
          sidebar: "var(--color-sidebar)",
          "sidebar-active": "var(--color-sidebar-active)",
          "sidebar-active-text": "var(--color-sidebar-active-text)",
          "sidebar-text": "var(--color-sidebar-text)",
          card: "var(--color-card)",
          "card-border": "var(--color-card-border)",
          "focus-ring": "var(--color-focus-ring)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
