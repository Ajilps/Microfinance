w# Microfinance Management System

A full-stack web application for managing microfinance operations, including user savings, loans, attendance tracking, and automated interest calculations. Built with a **React** frontend and a **Node.js/Express** REST API backend backed by **MongoDB**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
  - [4. Running in Development](#4-running-in-development)
  - [5. Production Build](#5-production-build)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
  - [Admin Workflow](#admin-workflow)
  - [User Workflow](#user-workflow)
  - [API Quick Reference](#api-quick-reference)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)
- [Contact & Support](#contact--support)

---

## Features

### Admin

- **Analytics Dashboard** — Live financial KPIs plus responsive charts for six-month fund activity, loan principal position, savings leaders, attendance trends, and bank movement.
- **Find by User** — Search members and open one consolidated workspace for savings, loans, calculated interest, repayments, fines, profit allocations, charts, and exact-date attendance history.
- **User Management** — Create, view, update, and deactivate member accounts.
- **Savings Management** — Record and review deposit/withdrawal transactions for any member.
- **Loan Management** — Issue loans, record repayments, and monitor outstanding balances.
- **Attendance Tracking** — Log and review member attendance with fine management for absences.
- **Weekly Transactions** — Review Monday–Sunday cash in, cash out, and non-cash accrued charges with separate weekly and category totals.
- **Income & Expenses** — Add, edit, filter, and total additional income and business expenses with mandatory transaction dates and sources/reasons.
- **Bank Transactions** — Maintain a dated bank ledger with particulars, cheque details, deposits, withdrawals, filters, and automatically recalculated running balances.
- **Profit & Distribution** — Review accrued and cash profit, prevent duplicate payouts, allocate by savings, safely reverse allocations, and permanently lock confirmed payouts against reversal.
- **Reports** — Export data to CSV for offline analysis.
- **Automated Interest** — A background cron job applies 1 % monthly interest (every 28 days) to outstanding loan balances automatically.

### Member (User)

- **Personal Dashboard** — View own savings balance, loan balance, and recent transactions.
- **My Savings** — Browse full savings transaction history.
- **My Loans** — Browse full loan transaction history including interest entries.
- **My Attendance** — Review personal attendance and fine records.

### General

- JWT-based authentication with role separation (admin / user).
- Secure password hashing with **bcryptjs**.
- HTTP security headers via **Helmet**.
- Form validation on the frontend with **React Hook Form** + **Yup**.
- SweetAlert2 and React Toastify notifications.
- Fully responsive UI.

---

## Tech Stack

| Layer      | Technology                                        |
| ---------- | ------------------------------------------------- |
| Frontend   | React 19, Vite, React Router v7, Axios            |
| UI / Forms | React Hook Form, Yup, SweetAlert2, React Toastify |
| Backend    | Node.js, Express 4                                |
| Database   | MongoDB with Mongoose 8                           |
| Auth       | JSON Web Tokens (JWT), bcryptjs                   |
| Scheduling | node-cron                                         |
| Security   | Helmet, CORS                                      |

---

## Project Structure

```
Microfinance/
├── Backend/                  # Express REST API
│   ├── src/
│   │   ├── config/           # Database connection
│   │   ├── controllers/      # Route handler logic
│   │   ├── middleware/       # Auth, admin, error middleware
│   │   ├── models/           # Mongoose schemas
│   │   ├── routes/           # API route definitions
│   │   └── utils/            # Cron jobs & helpers
│   ├── dist/                 # Built frontend assets (served by Express)
│   ├── .env                  # Environment config (not committed)
│   └── package.json
├── Frontend/                 # React / Vite SPA
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── context/          # React context (AuthContext)
│   │   ├── layouts/          # Admin, User, and Public layouts
│   │   ├── pages/            # Route-level page components
│   │   ├── routes/           # Protected / Guest / Admin route guards
│   │   ├── services/         # Axios API service layer
│   │   └── utils/            # Frontend utilities
│   └── package.json
└── README.md
```

---

## Prerequisites

Ensure the following are installed on your machine before proceeding:

| Requirement                         | Minimum Version | Notes                                         |
| ----------------------------------- | --------------- | --------------------------------------------- |
| [Node.js](https://nodejs.org/)      | 18 LTS          | Includes npm                                  |
| [MongoDB](https://www.mongodb.com/) | 6.x             | Local instance **or** a MongoDB Atlas cluster |
| npm                                 | 9+              | Comes with Node.js                            |

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/microfinance.git
cd microfinance
```

### 2. Backend Setup

```bash
cd Backend
npm install
```

Copy the example environment file and fill in your values:

```bash
cp env.example.txt .env
```

Edit `.env` — see [Environment Variables](#environment-variables) for details.

### 3. Frontend Setup

```bash
cd ../Frontend
npm install
```

### 4. Running in Development

#### Docker Compose (recommended)

The default Compose configuration builds the React frontend, copies the
generated `dist` directory into the backend image, and starts the Express
backend as the only container. Express serves both the API and the compiled
frontend on port 4000.

```bash
docker compose up -d
```

Open `http://localhost:4000`. The MongoDB connection is read from `MONGO_URI`
in `Backend/.env`; the default Compose configuration does not start a database
container. The image is rebuilt each time `docker compose up` is run so the
served frontend bundle matches the current source.

To stop the application:

```bash
docker compose down
```

For Vite live reload and the optional local MongoDB backup restore workflow,
use the separate development configuration:

```bash
docker compose -f compose.dev.yaml up --build
```

Open **two terminals**:

**Terminal 1 — Backend (API server on port 4000)**

```bash
cd Backend
npm run dev
```

**Terminal 2 — Frontend (Vite dev server on port 5173)**

```bash
cd Frontend
npm run dev
```

Navigate to `http://localhost:5173` in your browser.

> **Tip:** The Vite dev server is pre-configured to proxy `/api` requests to `http://localhost:4000`, so no cross-origin issues occur during development.

#### Render Deployment

The repository includes `render.yaml` for a single native Node web service.
Render must have **Root Directory left blank** so the build can access both
`Frontend` and `Backend`. Use these service commands:

```text
Build Command: npm run render-build
Start Command: npm start
```

The build installs both applications and writes the Vite production bundle to
`Backend/dist`, which Express serves together with the API. Configure
`MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` as secret Render
environment variables.

### 5. Production Build

Build the React app and copy the output into the backend's `dist/` folder so Express can serve it:

```bash
# From the Frontend directory
cd Frontend
npm run build

# Copy the build output to the backend
cp -r dist ../Backend/dist
```

Then start the production server:

```bash
cd ../Backend
npm start
```

The application will be available at `http://localhost:4000`.

---

## Environment Variables

Create a `.env` file in the `Backend/` directory based on `env.example.txt`:

```dotenv
# Server
PORT=4000
NODE_ENV=development          # "production" for live deployments

# Database
MONGO_URI=mongodb://localhost:27017/microfinance

# Authentication
JWT_SECRET=your_strong_secret_key_here

# Seed admin credentials (used only when no admin exists in the DB)
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@1234

# Idempotent interest automation
INTEREST_CRON_ENABLED=true
INTEREST_CRON_RUN_ON_STARTUP=true
INTEREST_CRON_SCHEDULE=10 0 * * *
INTEREST_CRON_TIMEZONE=Asia/Kolkata
```

| Variable         | Required | Description                                                                |
| ---------------- | -------- | -------------------------------------------------------------------------- |
| `PORT`           | Optional | HTTP port the server listens on. Defaults to `4000`.                       |
| `MONGO_URI`      | **Yes**  | MongoDB connection string.                                                 |
| `JWT_SECRET`     | **Yes**  | Secret key for signing JWT tokens. Use a long random string in production. |
| `NODE_ENV`       | Optional | Switches between `development` and `production` modes.                     |
| `ADMIN_NAME`     | Optional | Display name for the auto-seeded admin account.                            |
| `ADMIN_EMAIL`    | Optional | Email for the auto-seeded admin account.                                   |
| `ADMIN_PASSWORD` | Optional | Password for the auto-seeded admin account.                                |
| `INTEREST_CRON_ENABLED` | Optional | Enables automatic completed-period interest application. Defaults to `true`. |
| `INTEREST_CRON_RUN_ON_STARTUP` | Optional | Runs a safe catch-up scan whenever the backend starts. Defaults to `true`. |
| `INTEREST_CRON_SCHEDULE` | Optional | Cron schedule. Defaults to `10 0 * * *` (12:10 AM daily). |
| `INTEREST_CRON_TIMEZONE` | Optional | Timezone used by the scheduler. Defaults to `Asia/Kolkata`. |

The profit allocation preview is available by default, while recording a
distribution is disabled. To enable its button, add this to `Frontend/.env`
and restart the frontend:

```dotenv
VITE_ENABLE_PROFIT_DISTRIBUTION=true
```

> ⚠️ **Security:** Never commit your `.env` file. It is already listed in `.gitignore`.

---

## Usage

### Admin Workflow

1. Log in with the admin credentials defined in your `.env` file.
2. Navigate to **Manage Users** to register new members.
3. Use **Manage Savings** to record deposits and withdrawals.
4. Use **Manage Loans** to disburse loans and record repayments.
5. Use **Manage Attendance** to mark member presence and manage fines.
6. Visit **Dashboard** for live portfolio KPIs and visual trends across savings, loans, attendance, and bank activity.
7. Use **Find by User** when you want to review or update one member without moving between the separate management pages.

### User Workflow

1. Register via the public **Register** page or ask your admin to create an account.
2. Log in to access your personal **Dashboard**.
3. Browse **My Savings**, **My Loans**, and **My Attendance** for a full history of your account.

### API Quick Reference

The full API documentation is available in [`Backend/API_DOCUMENTATION.md`](Backend/API_DOCUMENTATION.md).

**Base URL:** `http://localhost:4000`

All protected endpoints require the following header:

```http
Authorization: Bearer <jwt_token>
```

#### Authentication

| Method | Endpoint              | Access | Description             |
| ------ | --------------------- | ------ | ----------------------- |
| `POST` | `/api/users/register` | Public | Register a new user     |
| `POST` | `/api/users/login`    | Public | Login and receive a JWT |

**Example — Login:**

```bash
curl -X POST http://localhost:4000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "password123"}'
```

```json
{
  "_id": "64abc123...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "token": "<jwt_token>"
}
```

#### Savings

| Method | Endpoint                     | Access | Description                     |
| ------ | ---------------------------- | ------ | ------------------------------- |
| `GET`  | `/api/users/savings`         | User   | Get own savings transactions    |
| `GET`  | `/api/admin/savings/:userId` | Admin  | Get savings for a specific user |
| `POST` | `/api/admin/savings/:userId/payment` | Admin | Add a weekly savings deposit |
| `POST` | `/api/admin/savings/:userId/withdrawal` | Admin | Record a savings withdrawal |
| `PUT` | `/api/admin/savings/:userId/withdrawal/:withdrawalId` | Admin | Update a withdrawal |
| `DELETE` | `/api/admin/savings/:userId/withdrawal/:withdrawalId` | Admin | Delete a withdrawal with audit history |

#### Loans

| Method | Endpoint                   | Access | Description                   |
| ------ | -------------------------- | ------ | ----------------------------- |
| `GET`  | `/api/users/loans`         | User   | Get own loan transactions     |
| `GET`  | `/api/admin/loans/:userId` | Admin  | Get loans for a specific user |
| `POST` | `/api/admin/loans/:userId` | Admin  | Add a loan transaction        |

#### Attendance

| Method | Endpoint                | Access | Description                |
| ------ | ----------------------- | ------ | -------------------------- |
| `GET`  | `/api/users/attendance` | User   | Get own attendance records |
| `GET`  | `/api/admin/attendance` | Admin  | Get all attendance records |
| `POST` | `/api/admin/attendance` | Admin  | Mark attendance            |

#### Dashboard Analytics

| Method | Endpoint                        | Access | Description                                                          |
| ------ | ------------------------------- | ------ | -------------------------------------------------------------------- |
| `GET`  | `/api/admin/dashboard/overview` | Admin  | Get dashboard KPIs, six-month trends, savings leaders, and activity. |

#### Member Workspace

| Method | Endpoint                                  | Access | Description                                                            |
| ------ | ----------------------------------------- | ------ | ---------------------------------------------------------------------- |
| `GET`  | `/api/admin/members`                      | Admin  | List members with savings, outstanding balances, and attendance rates. |
| `GET`  | `/api/admin/members/:userId/workspace`    | Admin  | Get one member's complete histories, summaries, timeline, and charts.   |

> See [`Backend/API_DOCUMENTATION.md`](Backend/API_DOCUMENTATION.md) for the complete request/response schemas and all available endpoints.

---

## Configuration

### Vite Proxy (Frontend)

The Vite dev server proxies API calls so you do not need to hard-code `localhost:4000` in your React code. This is configured in [`Frontend/vite.config.js`](Frontend/vite.config.js):

```js
server: {
  proxy: {
    '/api': 'http://localhost:4000'
  }
}
```

### Interest Cron Job

Automatic interest performs a catch-up scan when the backend starts and then
runs daily at **12:10 AM Asia/Kolkata** by default. It reads the loan ledger in
one batch, calculates the existing **1% per completed 28-day period** rule, and
uses atomic MongoDB upserts keyed by member and period start. Re-running the job,
running multiple server instances, or using the manual **Apply unrecorded**
button at the same time cannot create the same interest period twice.

Only completed periods are written. Partial periods remain projections. The
existing manual Calculate, single-period Record, and Apply-all controls remain
available. Configure the schedule with the environment variables above. The
scheduler lives in [`Backend/src/utils/interestCron.js`](Backend/src/utils/interestCron.js),
and the shared persistence logic lives in
[`Backend/src/services/interestAutomationService.js`](Backend/src/services/interestAutomationService.js).

Admins can use **Close loan** in either Manage Loans or Find by User. It previews
the full payment through a selected date, including any missed completed periods
and the prorated final partial period. Confirming it means the displayed cash was
received: one auditable closure entry pays the remaining principal and interest,
sets both balances to zero, and prevents that loan cycle from being closed or
charged for the partial period twice. Any later loan starts a fresh 28-day cycle.

### CORS

CORS is currently configured to allow all origins (`"*"`). For production deployments, restrict this to your actual frontend domain in [`Backend/src/app.js`](Backend/src/app.js):

```js
app.use(cors({ origin: "https://your-production-domain.com" }));
```

---

## Contributing

Contributions are welcome! Please follow the steps below:

1. **Fork** the repository and create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Make your changes** — ensure code style is consistent and new features are covered by appropriate comments.
3. **Test** your changes end-to-end (both backend and frontend).
4. **Commit** with a descriptive message:
   ```bash
   git commit -m "feat: add export to PDF for reports"
   ```
5. **Push** your branch and open a **Pull Request** against `main`:
   ```bash
   git push origin feature/your-feature-name
   ```

### Guidelines

- Follow the existing code structure and naming conventions.
- Keep pull requests focused — one feature or fix per PR.
- Write meaningful commit messages (prefer [Conventional Commits](https://www.conventionalcommits.org/)).
- Do not commit `.env` files or secrets.
- Ensure `npm run lint` passes in the `Frontend/` directory before submitting.

---

## License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2024 Microfinance Project Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---
