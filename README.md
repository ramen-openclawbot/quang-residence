# ZenHome Dashboard

Mobile-first household management dashboard for Mr. Quang.

## Screens
- **ZenHome** — Overview: spending summary, ambiance status, today's agenda
- **Wealth Analytics** — Spending breakdown, budget chart, investments
- **Ambiance** — Security cameras, lighting control, climate, smart devices
- **Agenda** — Driver & Secretary daily schedule

## Quick Start (pre-built)
Just open `index.html` with a local server:
```
npx serve .
# or
python3 -m http.server 8080
```
Then open http://localhost:8080

## Rebuild from source (after editing dashboard.jsx)
```
npm install
npx esbuild entry.jsx --bundle --outfile=bundle.js --loader:.jsx=jsx --jsx=automatic
```

## Tech Stack
- React 19 + inline styles (no Tailwind needed)
- Recharts for charts
- Custom SVG icons
- Design: ZenHome by Stitch (green #56c91d, Manrope font)
