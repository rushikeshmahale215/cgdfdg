# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


# Frontend: Wind Forecast Desk

React single-page app for viewing day-ahead wind forecasts and their accuracy.

## Stack

- React with Vite
- React Router
- Recharts (charts)

## Pages

| Route | File | What it shows |
|---|---|---|
| `/` | `src/pages/Overview.jsx` | Pitch page: headline January numbers (MAE, P90, RMSE, bias), a plain-English buying takeaway, a daily error chart and a 3-step explanation |
| `/forecast` | `src/pages/ForecastPage.jsx` | Delivery-day and cutoff pickers, summary cards, forecast versus actual chart for the day |
| `/accuracy` | `src/pages/AccuracyPage.jsx` | Date range and cutoff pickers, metric cards, buying guidance, error by hour and by day |

## Other files

| File | Purpose |
|---|---|
| `src/main.jsx` | Entry point, wraps the app in the router |
| `src/App.jsx` | Header, navigation, footer with Elexon attribution |
| `src/api.js` | Only place that talks to the backend (`getForecast`, `getAccuracy`) |
| `src/index.css` | Global styles |
| `Dockerfile` | Container build |

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173. The backend must be running (default `http://localhost:8000`).

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Backend base URL | `http://localhost:8000` |

Create a `.env` file in this folder for a different backend:
```
VITE_API_URL=https://your-backend.example.com
```
Vite reads this at build time, so rebuild after changing it.

## Build

```bash
npm run build
npm run preview
```

## Design notes

- Every page handles loading, error and empty states, so a stopped backend shows a clear message and not a blank screen.
- Charts use a fixed set of colours. Bias bars are red when wind fell short of the forecast (shortfall risk) and amber when wind exceeded it.
- Dates are limited to January 2026 in the pickers, matching the backend validation.
- All times shown are UTC, which equals UK time in January.

## Attribution

Contains BMRS data © Elexon Limited copyright and database right. This appears in the footer.
