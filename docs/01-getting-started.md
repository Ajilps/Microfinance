# 📖 Getting Started Guide

Complete guide to installing and running the MicroFinance SaaS platform.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js** 18+ and npm
- **Docker** and Docker Compose
- **Git**

### Verify Installation

```bash
# Check Node.js version
node --version  # Should be v18.0.0 or higher

# Check npm version
npm --version

# Check Docker version
docker --version
docker-compose --version

# Check Git version
git --version
```

---

## 🚀 Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/Ajilps/Microfinance.git
cd Microfinance
```

### 2. Create Environment Files

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values
# Required variables:
# - JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
# - MONGO_USERNAME=admin
# - MONGO_PASSWORD=secure_password_123
```

**Important Environment Variables:**
```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/microfinance
MONGO_USERNAME=admin
MONGO_PASSWORD=secure_password

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_min_32_characters
JWT_EXPIRATION=7d

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

### 3. Start Development Environment

#### Option A: Using Docker (Recommended)

```bash
# Start all services with Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

#### Option B: Manual Setup

**Terminal 1 - Backend:**
```bash
cd server
npm install
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm install
npm run dev
```

**Terminal 3 - MongoDB (if not using Docker):**
```bash
# Install MongoDB locally or use MongoDB Atlas
mongod --dbpath /path/to/data
```

### 4. Access the Application

Once running, access:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

---

## 🔧 Development Workflow

### Backend Development

```bash
cd server

# Install dependencies
npm install

# Start development server with hot reload
npm run start:dev

# Run tests
npm run test

# Run E2E tests
npm run test:e2e

# Build for production
npm run build

# Start production build
npm run start:prod
```

### Frontend Development

```bash
cd client

# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Lint code
npm run lint
```

---

## 🐳 Docker Development Setup

### Development Docker Compose

Create `docker-compose.dev.yml`:

```yaml
version: '3.8'

services:
  # MongoDB with exposed port for local development
  mongodb:
    image: mongo:7.0
    ports:
      - "27017:27017"  # Exposed for local access
    volumes:
      - mongo-data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
      - MONGO_INITDB_DATABASE=microfinance
    networks:
      - dev-network

  # Backend in development mode
  backend:
    build:
      context: ./server
      target: development
    ports:
      - "3000:3000"
    volumes:
      - ./server:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongodb:27017/microfinance
      - JWT_SECRET=dev_secret_key
    depends_on:
      - mongodb
    networks:
      - dev-network
    command: npm run start:dev

  # Frontend in development mode
  frontend:
    build:
      context: ./client
      target: development
    ports:
      - "5173:5173"
    volumes:
      - ./client:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:3000/api
    networks:
      - dev-network
    command: npm run dev

volumes:
  mongo-data:

networks:
  dev-network:
    driver: bridge
```

### Useful Docker Commands

```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb

# Restart a service
docker-compose restart backend

# Stop all services
docker-compose down

# Remove volumes (clean database)
docker-compose down -v

# Rebuild containers
docker-compose build --no-cache

# Access MongoDB shell
docker exec -it microfinance-mongodb mongosh

# Access backend container
docker exec -it microfinance-backend sh
```

---

## 📊 Database Setup

### MongoDB Initialization

The database will be automatically initialized when you first run the application. However, you can also seed it with sample data:

```bash
# Create seed script
cd server
npm run seed

# Or manually via MongoDB shell
docker exec -it microfinance-mongodb mongosh

# In MongoDB shell:
use microfinance

# Create sample organization
db.organizations.insertOne({
  name: "Demo Finance",
  subdomain: "demo",
  subscriptionPlan: "premium",
  settings: {
    loanInterestRate: 5.5,
    minSavingsForLoan: 1000
  }
})

# Create sample admin user
db.users.insertOne({
  organizationId: ObjectId("your_org_id"),
  email: "admin@demo.com",
  password: "$2b$10$hashedpassword",  // Use bcrypt to hash
  fullName: "Admin User",
  role: "admin",
  isActive: true
})
```

---

## 🧪 Verify Installation

### 1. Check Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    }
  }
}
```

### 2. Test Authentication

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "fullName": "Test User",
    "organizationId": "your_org_id"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

### 3. Access Frontend

Open http://localhost:5173 in your browser and verify:
- Login page loads correctly
- Can register a new user
- Can login with credentials
- Dashboard displays after login

---

## 🎯 Quick Start Commands Reference

```bash
# Development
npm run dev              # Start dev server (backend)
npm run start:dev        # Start with watch mode (backend)
npm run dev              # Start Vite dev server (frontend)

# Build
npm run build            # Build for production
docker-compose build     # Build Docker images

# Testing
npm run test             # Run unit tests
npm run test:e2e         # Run end-to-end tests
npm run test:cov         # Run tests with coverage

# Deployment
docker-compose up -d                    # Start production
docker-compose up -d --scale backend=5  # Start with 5 backend instances
docker-compose down                     # Stop services
docker-compose logs -f                  # View logs

# Database
docker exec -it microfinance-mongodb mongosh  # Access MongoDB shell
npm run migration:run                         # Run migrations
npm run seed                                  # Seed database

# Utilities
npm run lint             # Lint code
npm run format           # Format code with Prettier
npm run type-check       # TypeScript type checking
```

---

## 🐛 Common Setup Issues

### Issue: Port Already in Use

```bash
# Find process using port (Windows)
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F

# Or change port in .env
PORT=3001
```

### Issue: MongoDB Connection Failed

```bash
# Check if MongoDB is running
docker ps | grep mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Verify connection string
echo $MONGODB_URI
```

### Issue: Docker Build Fails

```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache

# Check disk space
docker system df
```

### Issue: npm Install Fails

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 Next Steps

Now that you have the application running:

1. **Explore the Architecture** - Read [Architecture Overview](02-architecture.md)
2. **Understand the Database** - Check [Database Design](06-database-design.md)
3. **Review Security** - See [Authentication Guide](05-authentication.md)
4. **Start Developing** - Follow [Frontend Guide](07-frontend-guide.md) or [Backend Guide](08-backend-guide.md)
5. **Deploy to Production** - Read [Deployment Guide](11-deployment.md)

---

## 🆘 Getting Help

If you encounter issues:
- Check [Troubleshooting Guide](15-troubleshooting.md)
- Read [FAQ](19-faq.md)
- Open an issue on [GitHub](https://github.com/Ajilps/Microfinance/issues)
- Join our [Discord community](https://discord.gg/yourserver)

---

[← Back to Main README](../README.md) | [Next: Architecture →](02-architecture.md)
