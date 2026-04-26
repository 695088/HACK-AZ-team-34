# UAdvisor

A web app that helps **University of Arizona** students discover and compare courses. It uses your interests, schedule, and filters to surface relevant sections and show reviews and instructor context.

Stack: **Vite**, **React 18**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui** components.

---

## Prerequisites

- **Node.js** 18 or newer (20 LTS recommended)
- **npm** (comes with Node), or **bun** if you use the `bun.lockb` in this repo
- **Python 3.9+** (only if you need to [rebuild the course dataset](#rebuilding-the-dataset))

---

## Run the app (development)

1. **Open a terminal** and go to the UAdvisor project folder:

   ```bash
   cd UAdvisor
   ```

2. **Install dependencies**

   With npm:

   ```bash
   npm install
   ```

   Or with bun:

   ```bash
   bun install
   ```

3. **Start the dev server**

   ```bash
   npm run dev
   ```

   The app is served at **http://localhost:8080** (port is set in `vite.config.ts`).

4. **Open the app** in your browser at that URL. Hot reload is enabled while the dev server runs.

To stop the server, press `Ctrl+C` in the terminal.

---

## Production build and preview

Build static assets into `dist/`:

```bash
npm run build
```

Preview the production build locally (serves the `dist` folder):

```bash
npm run preview
```

Follow the URL printed in the terminal (Vite’s default preview port is often 4173).

---

## Rebuilding the dataset

Course data, reviews, and merged sections are compiled into `public/dataset.json` by a Python script. A checked-in `dataset.json` is enough to run the UI; use this when you change files under `data-sources/`.

```bash
python3 scripts/build_dataset.py
```

Re-run the dev server (or refresh the browser) after regenerating the file.

---

## Other commands

| Command          | Description                    |
| ---------------- | ------------------------------ |
| `npm run lint`   | Run ESLint                     |
| `npm run test`   | Run Vitest tests once          |
| `npm run test:watch` | Run Vitest in watch mode  |

---

## Project layout (short)

- `src/` — React app, pages, components, match logic
- `public/dataset.json` — Built catalog used at runtime
- `data-sources/` — Raw CSV/JSON inputs for the build script
- `scripts/build_dataset.py` — Merges sources into `public/dataset.json`

---

## License

See the repository’s top-level license (if any).
