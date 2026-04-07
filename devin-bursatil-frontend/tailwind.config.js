/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			border: 'hsl(var(--border, 220 13% 91%))',
  			input: 'hsl(var(--input, 220 13% 91%))',
  			ring: 'hsl(var(--ring, 224 71% 45%))',
  			background: 'hsl(var(--background, 0 0% 100%))',
  			foreground: 'hsl(var(--foreground, 222 84% 5%))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary, 222 84% 5%))',
  				foreground: 'hsl(var(--primary-foreground, 210 40% 98%))',
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary, 210 40% 96%))',
  				foreground: 'hsl(var(--secondary-foreground, 222 84% 5%))',
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive, 0 84% 60%))',
  				foreground: 'hsl(var(--destructive-foreground, 210 40% 98%))',
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted, 210 40% 96%))',
  				foreground: 'hsl(var(--muted-foreground, 215 16% 47%))',
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent, 210 40% 96%))',
  				foreground: 'hsl(var(--accent-foreground, 222 84% 5%))',
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover, 0 0% 100%))',
  				foreground: 'hsl(var(--popover-foreground, 222 84% 5%))',
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card, 0 0% 100%))',
  				foreground: 'hsl(var(--card-foreground, 222 84% 5%))',
  			},
  		}
  	}
  },
  plugins: [import("tailwindcss-animate")],
}

