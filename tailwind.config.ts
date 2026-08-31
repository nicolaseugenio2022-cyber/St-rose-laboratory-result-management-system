import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/rendering/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Only `sans` is redefined. `mono` and `serif` keep Tailwind's defaults, which
      // is what preserves font-mono for accession numbers, result values, timestamps,
      // error digests and technical identifiers.
      // Elevation is deliberately collapsed to two levels. sm/DEFAULT are the low step;
      // md/lg/xl all resolve to the single overlay step, so the five-size shadow ramp that
      // made everything look like a floating card cannot be reached by accident.
      //
      // The overlay step is reserved for genuinely temporary, floating UI, and after
      // UX-10F4-B8-R2-R1 every remaining consumer is one: the Modal dialog, the Sidebar and
      // NavRail mobile drawers, the Actions disclosure popover, the two focused skip-links,
      // and the print-fidelity diagnostic overlay. Ordinary page cards - login, first-login,
      // forgot-password and the segment error card - use shadow-low; they sit in the page,
      // they do not float above it.
      boxShadow: {
        low: "var(--shadow-low)",
        overlay: "var(--shadow-overlay)",
        sm: "var(--shadow-low)",
        DEFAULT: "var(--shadow-low)",
        md: "var(--shadow-overlay)",
        lg: "var(--shadow-overlay)",
        xl: "var(--shadow-overlay)",
      },
      fontFamily: {
        sans: ["var(--font-source-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          primary: "var(--color-primary)",
          "primary-hover": "var(--color-primary-hover)",
          "primary-foreground": "var(--color-primary-foreground)",
          tint: "var(--color-tint)",
          // Deep navy identity colour and its on-navy text pair.
          navy: "var(--color-navy)",
          "navy-hover": "var(--color-navy-hover)",
          "navy-foreground": "var(--color-navy-foreground)",
          "navy-muted": "var(--color-navy-muted)",
          "decorative-pink": "var(--color-decorative-pink)",
          "accessible-rose": "var(--color-accessible-rose)",
          secondary: "var(--color-secondary)",
          "secondary-hover": "var(--color-secondary-hover)",
          "secondary-foreground": "var(--color-secondary-foreground)",
          // Three-surface system: canvas (ground) / surface (working) / structural.
          canvas: "var(--color-canvas)",
          structural: "var(--color-structural)",
          "structural-hover": "var(--color-structural-hover)",
          background: "var(--color-background)",
          surface: "var(--color-surface)",
          "surface-hover": "var(--color-surface-hover)",
          border: "var(--color-border)",
          "border-strong": "var(--color-border-strong)",
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
