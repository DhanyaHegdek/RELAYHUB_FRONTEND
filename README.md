# RelayHub Frontend

RelayHub is a React chat application frontend — real-time 1:1/group messaging with a Laravel backend, live via WebSockets (Laravel Reverb + Pusher protocol). It handles auth, a chat interface, user/notification management, and an admin user list.

## What it does

- **Auth** (`pages/login.jsx`, `pages/register.jsx`) — email/password login and registration against a Laravel API, storing a bearer token + user object in `localStorage` via `AuthContext`.
- **Route protection** (`App.jsx`) — `PrivateRoute` (must be logged in), `GuestRoute` (must be logged out), and `AdminRoute` (must have `role === "admin"`), backed by a `useAuth()` hook.
- **Chat** (`pages/chat.jsx`) — the main chat interface (by far the largest file in the app).
- **Users page** (`pages/UsersPage.jsx`) — admin-only user management view.
- **Real-time notifications** (`hooks/useNotifications.js`, `components/Toast.jsx`) — in-app toast notifications, unread-message badges per conversation, and native browser `Notification` popups when the tab isn't focused.
- **Live updates** (`echo.js`) — connects to a Laravel Reverb WebSocket server using `laravel-echo` + `pusher-js`, authenticated with the same bearer token.
- **API client** (`api/axios.js`) — an Axios instance that attaches the bearer token to every request and redirects to `/login` on a 401.

## Tech Stack

- **Framework:** React 19 + React Router 7
- **Build tool:** Vite
- **Styling:** Tailwind CSS
- **HTTP:** Axios
- **Real-time:** Laravel Echo + Pusher-js (against a Laravel Reverb server)
- **Linting:** ESLint

## Requirements

This is a **frontend only** — it expects a Laravel backend running and reachable at the URLs hardcoded into the code:

- REST API base URL: `http://relayhub.test` (see `src/api/axios.js`, `src/echo.js`)
- WebSocket broadcasting: `http://relayhub.test/api/broadcasting/auth`, via a Reverb server (see `.env`)

You'll need that backend (or your own equivalent Laravel + Reverb setup) running and configured with a matching Reverb app key for this frontend to actually work end-to-end — this repo alone won't do anything meaningful without it.

## Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/DhanyaHegdek/RELAYHUB_FRONTEND.git
cd RELAYHUB_FRONTEND
npm install
```

### 2. Environment variables

A `.env` file is already committed with local dev defaults:

```
VITE_REVERB_APP_KEY=u1xkkkmwuodsfydmxh9v
VITE_REVERB_HOST=127.0.0.1
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

Update these to match your own Laravel Reverb server's app key/host/port if different.

### 3. Point the API base URL at your backend

`src/api/axios.js` and `src/echo.js` currently hardcode `http://relayhub.test` as the API/auth host. Either:
- set up a local hosts-file entry / Valet/Herd domain named `relayhub.test` pointing at your Laravel backend, **or**
- edit `baseURL` in `api/axios.js` and `authEndpoint` in `echo.js` to point at wherever your backend actually runs (e.g. `http://localhost:8000`).

### 4. Run the dev server

```bash
npm run dev
```

Vite will print a local URL (typically `http://localhost:5173`).

### 5. Build for production

```bash
npm run build       # or: npm run build:prod
npm run preview      # or: npm run start:prod
```

## Known Issues

Worth fixing before this fully works out of the box:

- **Case-mismatched imports:** `src/App.jsx` imports `./pages/Login`, `./pages/Register`, and `./pages/Chat`, but the actual files are `login.jsx`, `register.jsx`, and `chat.jsx` (lowercase). This resolves fine on case-insensitive filesystems (macOS, Windows) but **will fail to build/run on Linux or most CI systems** (including Vite's dev server there), since those filesystems are case-sensitive. Fix by either renaming the files to match the imports or vice versa.
- **Hardcoded backend host:** `relayhub.test` is hardcoded in two places (`api/axios.js`, `echo.js`) rather than read from an environment variable — worth moving to `VITE_API_URL` / `VITE_WS_AUTH_URL` env vars for portability.
- **Auth token in `localStorage`:** the bearer token is stored in `localStorage` (readable by any JS on the page, so vulnerable to XSS-based token theft). This is a common trade-off for simplicity, but worth knowing if security hardening matters for this project.

## Project Structure

```
RELAYHUB_FRONTEND/
├── src/
│   ├── api/axios.js           # Axios instance w/ auth interceptor
│   ├── echo.js                # Laravel Echo / Reverb WebSocket client
│   ├── context/
│   │   ├── AuthContext.jsx    # Auth state (user, login, logout)
│   │   └── useAuth.js         # useAuth() hook
│   ├── hooks/useNotifications.js  # Toasts + unread badges + browser notifications
│   ├── components/
│   │   ├── Toast.jsx
│   │   └── EditProfilePanel.jsx
│   ├── pages/
│   │   ├── login.jsx
│   │   ├── register.jsx
│   │   ├── chat.jsx
│   │   └── UsersPage.jsx
│   ├── App.jsx                # Routes + route guards
│   └── main.jsx                # Entry point
├── .env
├── vite.config.js
├── tailwind.config.js
└── package.json
```
