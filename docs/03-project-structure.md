# 📁 Project Structure

Detailed breakdown of the MicroFinance SaaS project folder organization and file structure.

---

## 📂 Complete Folder Structure

```
/microfinance-saas/
│
├── client/                          # React + TypeScript Frontend (Vite)
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   ├── pages/                   # Page components
│   │   ├── store/                   # Zustand state management
│   │   │   ├── authStore.ts
│   │   │   ├── accountStore.ts
│   │   │   └── loanStore.ts
│   │   ├── services/                # API client functions
│   │   ├── utils/                   # Helpers (validation, formatting)
│   │   ├── types/                   # TypeScript interfaces
│   │   └── App.tsx
│   ├── Dockerfile                   # Multi-stage build
│   ├── package.json
│   ├── vite.config.ts               # Vite configuration
│   └── tsconfig.json
│
├── server/                          # Node.js + Express.js Backend
│   ├── src/
│   │   ├── modules/                 # Feature modules
│   │   │   ├── health/              # Health check endpoint
│   │   │   │   ├── health.controller.ts
│   │   │   │   └── health.module.ts
│   │   │   ├── user/
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-user.dto.ts
│   │   │   │   │   └── update-user.dto.ts
│   │   │   │   ├── schemas/
│   │   │   │   │   └── user.schema.ts
│   │   │   │   ├── user.controller.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   └── user.module.ts
│   │   │   ├── account/
│   │   │   │   ├── dto/
│   │   │   │   ├── schemas/
│   │   │   │   │   └── account.schema.ts
│   │   │   │   ├── account.controller.ts
│   │   │   │   ├── account.service.ts
│   │   │   │   └── account.module.ts
│   │   │   ├── loan/
│   │   │   │   ├── dto/
│   │   │   │   ├── schemas/
│   │   │   │   │   └── loan.schema.ts
│   │   │   │   ├── loan.controller.ts
│   │   │   │   ├── loan.service.ts
│   │   │   │   └── loan.module.ts
│   │   │   ├── admin/
│   │   │   │   ├── admin.controller.ts
│   │   │   │   ├── admin.service.ts
│   │   │   │   └── admin.module.ts
│   │   │   ├── organization/
│   │   │   │   ├── dto/
│   │   │   │   ├── schemas/
│   │   │   │   │   └── organization.schema.ts
│   │   │   │   ├── organization.controller.ts
│   │   │   │   ├── organization.service.ts
│   │   │   │   └── organization.module.ts
│   │   │   └── auth/
│   │   │       ├── dto/
│   │   │       ├── guards/
│   │   │       │   ├── jwt-auth.guard.ts
│   │   │       │   ├── roles.guard.ts
│   │   │       │   └── tenant.guard.ts
│   │   │       ├── strategies/
│   │   │       │   └── jwt.strategy.ts
│   │   │       ├── auth.controller.ts
│   │   │       ├── auth.service.ts
│   │   │       └── auth.module.ts
│   │   │
│   │   ├── common/                  # Shared resources
│   │   │   ├── decorators/
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   └── current-tenant.decorator.ts
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   ├── interceptors/
│   │   │   │   ├── logging.interceptor.ts
│   │   │   │   └── transform.interceptor.ts
│   │   │   ├── pipes/
│   │   │   │   └── validation.pipe.ts
│   │   │   └── interfaces/
│   │   │
│   │   ├── config/
│   │   │   ├── database.config.ts
│   │   │   ├── jwt.config.ts
│   │   │   └── app.config.ts
│   │   │
│   │   ├── app.ts                   # Express app setup
│   │   └── server.ts                # Application entry
│   │
│   ├── test/
│   │   ├── app.e2e-spec.ts
│   │   └── jest-e2e.json
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── nginx/
│   ├── nginx.conf                   # Load balancer configuration
│   └── Dockerfile
│
├── docs/                            # Documentation
│   ├── 01-getting-started.md
│   ├── 02-architecture.md
│   └── ... (other documentation files)
│
├── docker-compose.yml               # Production-ready compose file
├── docker-compose.dev.yml           # Development environment
├── .env.example
├── .gitignore
└── README.md
```

---

## 📦 Module Breakdown

### Frontend (`client/`)

#### Components Structure

```
src/components/
├── common/              # Shared components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Modal.tsx
│   └── Card.tsx
├── layout/              # Layout components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Footer.tsx
└── features/            # Feature-specific components
    ├── AccountCard.tsx
    ├── LoanForm.tsx
    └── TransactionList.tsx
```

#### Pages Structure

```
src/pages/
├── Login.tsx
├── Register.tsx
├── Dashboard.tsx
├── Accounts.tsx
├── Loans.tsx
├── AdminPanel.tsx
└── Profile.tsx
```

### Backend (`server/`)

#### Module Pattern

Each module follows a clean Express.js router pattern:

```
module-name/
├── validators/          # Request validation schemas
│   ├── create-*.validator.ts
│   └── update-*.validator.ts
├── models/              # Mongoose models
│   └── *.model.ts
├── *.router.ts          # Express routes (HTTP endpoints)
├── *.service.ts         # Business logic
└── *.controller.ts      # Route handler functions
```

---

## 🔑 Key Files Explained

### Backend Entry Point

**`server/src/server.ts`**

```typescript
// Application bootstrap
// - Creates Express application
// - Configures middleware (helmet, CORS, cookies)
// - Registers routes and error handlers
// - Starts HTTP server
```

**`server/src/app.ts`**

```typescript
// Express app setup
// - Registers all feature routers
// - Configures database connection
// - Sets up global middleware
```

### Frontend Entry Point

**`client/src/main.tsx`**

```typescript
// React application entry
// - Renders root component
// - Sets up React Router
// - Initializes global state
```

**`client/src/App.tsx`**

```typescript
// Main application component
// - Defines routing structure
// - Wraps with providers
// - Handles authentication flow
```

---

## 🗂️ Configuration Files

### Backend Configuration

**`server/tsconfig.json`**

- TypeScript compiler options
- Path mappings
- Module resolution

**`server/package.json`**

- Dependencies (Express.js, Mongoose, jsonwebtoken, etc.)
- Scripts (dev, build, test)
- Project metadata

### Frontend Configuration

**`client/vite.config.ts`**

- Vite build configuration
- Dev server settings
- Plugin configuration

**`client/tsconfig.json`**

- TypeScript settings for React
- JSX configuration
- Path aliases

**`client/package.json`**

- Dependencies (React, Zustand, Axios, etc.)
- Build scripts
- Development tools

---

## 🐳 Docker Files

### Backend Dockerfile

**`server/Dockerfile`**

```dockerfile
# Multi-stage build
# Stage 1: Development dependencies + build
# Stage 2: Production (only runtime dependencies)
# Result: ~145MB optimized image
```

### Frontend Dockerfile

**`client/Dockerfile`**

```dockerfile
# Multi-stage build
# Stage 1: Build React app with Vite
# Stage 2: Serve with Nginx
# Result: ~25MB optimized image
```

### Nginx Configuration

**`nginx/nginx.conf`**

- Load balancing configuration
- Proxy settings for backend API
- Static file serving for frontend
- Security headers
- Gzip compression

---

## 📝 Environment Files

### `.env.example`

Template for environment variables:

```bash
# Server
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/microfinance
MONGO_USERNAME=admin
MONGO_PASSWORD=password

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRATION=7d

# CORS
CORS_ORIGIN=http://localhost:5173
```

---

## 🧪 Test Structure

### Backend Tests

```
server/test/
├── unit/                # Unit tests
│   ├── user.service.spec.ts
│   ├── account.service.spec.ts
│   └── loan.service.spec.ts
└── e2e/                 # End-to-end tests
    ├── auth.e2e-spec.ts
    ├── accounts.e2e-spec.ts
    └── loans.e2e-spec.ts
```

### Frontend Tests

```
client/src/
├── __tests__/
│   ├── components/
│   ├── pages/
│   └── utils/
└── __mocks__/
```

---

## 📚 Documentation Structure

```
docs/
├── 01-getting-started.md        # Installation & setup
├── 02-architecture.md           # System design
├── 03-project-structure.md      # This file
├── 04-docker-setup.md           # Docker configuration
├── 05-authentication.md         # Auth implementation
├── 06-database-design.md        # Database schemas
├── 07-frontend-guide.md         # React development
├── 08-backend-guide.md          # Express.js development
├── 09-api-documentation.md      # API reference
├── 10-testing.md                # Testing guide
├── 11-deployment.md             # Deployment strategies
├── 12-monitoring.md             # Logging & monitoring
├── 13-security.md               # Security practices
├── 14-performance.md            # Optimization
├── 15-troubleshooting.md        # Common issues
├── 16-contributing.md           # Contribution guide
├── 17-environment-variables.md  # Env vars reference
├── 18-ui-design-guide.md        # Design system
├── 19-faq.md                    # FAQ
└── 20-resources.md              # Learning resources
```

---

## 🎯 Naming Conventions

### Files

- **Components**: PascalCase (`UserProfile.tsx`)
- **Services**: camelCase (`auth.service.ts`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Types**: PascalCase (`User.interface.ts`)
- **Tests**: `*.spec.ts` or `*.test.tsx`

### Folders

- **Lowercase with hyphens**: `user-service/`
- **Plural for collections**: `components/`, `utils/`
- **Singular for single items**: `config/`, `common/`

### Code

- **Variables/Functions**: camelCase
- **Classes/Interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Private members**: prefix with `_`

---

## 🔍 Finding Files

### Common File Locations

| What you need    | Where to find it                            |
| ---------------- | ------------------------------------------- |
| API endpoints    | `server/src/modules/*/**.controller.ts`     |
| Business logic   | `server/src/modules/*/**.service.ts`        |
| Database schemas | `server/src/modules/*/schemas/**.schema.ts` |
| React components | `client/src/components/**/*.tsx`            |
| State management | `client/src/store/**/*.ts`                  |
| API calls        | `client/src/services/api.ts`                |
| Type definitions | `client/src/types/**/*.ts`                  |
| Configuration    | `server/src/config/**/*.ts`                 |

---

## 📚 Related Documentation

- [Architecture Overview](02-architecture.md) - System design
- [Backend Guide](08-backend-guide.md) - Express.js development
- [Frontend Guide](07-frontend-guide.md) - React development
- [Docker Setup](04-docker-setup.md) - Container configuration

---

[← Back to Architecture](02-architecture.md) | [Next: Docker Setup →](04-docker-setup.md)
