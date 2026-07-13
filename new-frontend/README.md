# CRD13 New Frontend

Experimental React + TypeScript + Vite + Material UI base.

## Stack

- React 18
- TypeScript
- Vite 5
- Material UI 6
- React Router 6
- Axios

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Start and stop

```bash
./start.sh
./stop.sh
```

You can also run the project through npm:

```bash
npm run start:project
npm run stop:project
```

By default, the frontend starts at `http://127.0.0.1:5173/`. To use another port:

```bash
./start.sh --port 5174
./stop.sh --ports 5174
```

## Backend

The HTTP client lives in `src/lib/api.ts`. To point it to another backend, create a `.env` file with:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Structure

- `src/app`: theme and application configuration
- `src/components`: shared components
- `src/pages`: routed pages and work surfaces
- `src/lib`: integrations and utilities
