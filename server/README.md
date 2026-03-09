# 🚀 MicroFinance API Server

Node.js + Express.js + TypeScript backend for the MicroFinance SaaS platform.

---

## 📋 Prerequisites

- **Node.js** 18+
- **MongoDB** (local or Atlas)
- **npm** 9+

---

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp ../.env.example ../.env
# Edit .env with your values

# 3. Start development server (hot reload)
npm run dev

# 4. Build for production
npm run build

# 5. Start production server
npm start
```

---

## 🗂️ Project Structure

```
server/
├── src/
│   ├── app.ts                   # Express app setup (middleware, routes)
│   ├── server.ts                # Entry point — DB connection + HTTP server
│   ├── config/
│   │   ├── env.config.ts        # Centralised environment variables
│   │   └── database.config.ts   # MongoDB connection
│   ├── routes/
│   │   └── index.ts             # Mounts all module routers
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── router.ts        # Auth routes
│   │   │   ├── controller.ts    # Route handlers
│   │   │   ├── service.ts       # Business logic
│   │   │   ├── model.ts         # Mongoose User model
│   │   │   └── validation.ts    # express-validator rules
│   │   └── user/
│   │       ├── router.ts
│   │       ├── controller.ts
│   │       ├── service.ts
│   │       ├── model.ts
│   │       └── validation.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts   # JWT protect + restrictTo
│   │   ├── error.middleware.ts  # Global error handler
│   │   └── notFound.middleware.ts
│   ├── utils/
│   │   ├── ApiResponse.ts       # Consistent JSON response helper
│   │   ├── AsyncHandler.ts      # Wraps async controllers
│   │   └── AppError.ts          # Custom error class with statusCode
│   └── types/
│       └── index.ts             # TypeScript interfaces & enums
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── nodemon.json
├── package.json
└── tsconfig.json
```

---

## 📡 API Endpoints

### Health

| Method | URL           | Description   |
| ------ | ------------- | ------------- |
| GET    | `/api/health` | Server status |

### Authentication (`/api/v1/auth`)

| Method | URL                     | Description              |
| ------ | ----------------------- | ------------------------ |
| POST   | `/api/v1/auth/register` | Register a new user      |
| POST   | `/api/v1/auth/login`    | Login and get JWT        |
| GET    | `/api/v1/auth/me`       | Get current user profile |
| POST   | `/api/v1/auth/logout`   | Clear auth cookie        |

### Users (`/api/v1/users`) — requires auth

| Method | URL                 | Description                |
| ------ | ------------------- | -------------------------- |
| GET    | `/api/v1/users`     | List users (admin/manager) |
| GET    | `/api/v1/users/:id` | Get single user            |
| PATCH  | `/api/v1/users/:id` | Update user profile        |
| DELETE | `/api/v1/users/:id` | Deactivate user (admin)    |

---

## 🔧 Environment Variables

| Variable         | Default                                  | Description                                 |
| ---------------- | ---------------------------------------- | ------------------------------------------- |
| `PORT`           | `3000`                                   | HTTP server port                            |
| `NODE_ENV`       | `development`                            | Runtime environment                         |
| `MONGODB_URI`    | `mongodb://localhost:27017/microfinance` | MongoDB connection string                   |
| `JWT_SECRET`     | —                                        | JWT signing secret (required in production) |
| `JWT_EXPIRES_IN` | `7d`                                     | JWT expiration                              |
| `CORS_ORIGIN`    | `http://localhost:5173`                  | Allowed CORS origins (comma-separated)      |

---

## 🛠️ Scripts

| Script             | Description                              |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Start development server with hot reload |
| `npm run build`    | Compile TypeScript to `dist/`            |
| `npm start`        | Start production server from `dist/`     |
| `npm test`         | Run unit tests                           |
| `npm run test:e2e` | Run end-to-end tests                     |
| `npm run test:cov` | Run tests with coverage report           |
| `npm run lint`     | Lint source files                        |
| `npm run format`   | Format source files with Prettier        |


for creating new super admin 
 cd server && npm run seed:admin 2>&1