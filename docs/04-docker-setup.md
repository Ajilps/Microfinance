# 🐳 Docker Setup & Deployment

Complete guide to Docker configuration, containerization, and scaling strategies for the MicroFinance SaaS platform.

---

## 📋 Overview

The application uses Docker for:

- **Consistent environments** across development and production
- **Easy deployment** with docker-compose
- **Horizontal scaling** of backend instances
- **Network isolation** for security
- **Multi-stage builds** for optimized images

---

## 🏗️ Docker Architecture

```
┌─────────────────────────────────────────┐
│         Nginx (Port 80/443)             │
│      Load Balancer + Reverse Proxy      │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
┌──────▼──────┐ ┌─────▼──────┐
│  Backend 1  │ │ Backend 2  │  ... (scalable)
│  (Port 3000)│ │(Port 3000) │
└──────┬──────┘ └─────┬──────┘
       │              │
       └──────┬───────┘
              │
       ┌──────▼──────┐
       │   MongoDB   │
       │ (Port 27017)│
       │ (Internal)  │
       └─────────────┘
```

---

## 📦 Production Docker Compose

**`docker-compose.yml`**

```yaml
version: "3.8"

services:
  # Nginx Load Balancer
  nginx:
    build: ./nginx
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
      - frontend
    networks:
      - microfinance-network
    restart: unless-stopped

  # React Frontend (Multi-stage build)
  frontend:
    build:
      context: ./client
      dockerfile: Dockerfile
      target: production
    expose:
      - "80"
    networks:
      - microfinance-network
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  # Express.js Backend (Scalable)
  backend:
    build: ./server
    expose:
      - "3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/microfinance
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mongodb
    networks:
      - microfinance-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  # MongoDB Database (Internal Network Only)
  mongodb:
    image: mongo:7.0
    expose:
      - "27017" # Internal network only, NOT exposed to host
    volumes:
      - mongo-data:/data/db
      - ./mongo-init:/docker-entrypoint-initdb.d
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_USERNAME}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASSWORD}
      - MONGO_INITDB_DATABASE=microfinance
    networks:
      - microfinance-network
    restart: unless-stopped

volumes:
  mongo-data:

networks:
  microfinance-network:
    driver: bridge
```

### Scaling Backend Instances

```bash
# Scale backend to 5 instances
docker-compose up -d --scale backend=5

# View running instances
docker-compose ps

# Check logs from all backend instances
docker-compose logs -f backend
```

**Note:** MongoDB port is only exposed within the Docker network for security. For local development access, use `docker-compose.dev.yml` instead.

---

## 🔧 Nginx Configuration (Load Balancer)

**`nginx/nginx.conf`**

```nginx
upstream backend_servers {
    least_conn;  # Load balancing algorithm
    server backend:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name microfinance.local;

    # Security Headers
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;
    gzip_comp_level 6;

    # Frontend (React App)
    location / {
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API (Load Balanced)
    location /api/ {
        proxy_pass http://backend_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://backend_servers/health;
        proxy_set_header Host $host;
    }
}
```

---

## 📦 Express.js Backend Dockerfile

**`server/Dockerfile`**

```dockerfile
# Stage 1: Development dependencies
FROM node:18-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from development stage
COPY --from=development /app/dist ./dist

# Expose Express.js default port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/main"]
```

**Size Optimization Result**: ~145MB (vs 1GB+ without multi-stage)

---

## 🎨 React Multi-Stage Dockerfile (Optimized for Vite)

**`client/Dockerfile`**

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Build production bundle (outputs to /app/dist with Vite)
RUN npm run build

# Stage 2: Production
FROM nginx:alpine AS production

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

**Client-side Nginx Configuration (`client/nginx.conf`):**

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Size Optimization Result**: ~25MB (vs 1GB+ without multi-stage)

**Note:** This assumes you're using **Vite** as the build tool (output directory: `dist`). If using Create React App, change the build output path to `build`.

---

## 🔧 Development Docker Compose

**`docker-compose.dev.yml`**

```yaml
version: "3.8"

services:
  # MongoDB with exposed port for local development
  mongodb:
    image: mongo:7.0
    ports:
      - "27017:27017" # Exposed for local access
    volumes:
      - mongo-data-dev:/data/db
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
    command: npm run dev

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
  mongo-data-dev:

networks:
  dev-network:
    driver: bridge
```

---

## 🚀 Docker Commands Reference

### Basic Operations

```bash
# Build all services
docker-compose build

# Build without cache
docker-compose build --no-cache

# Start services
docker-compose up -d

# Start with logs
docker-compose up

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart a service
docker-compose restart backend
```

### Scaling

```bash
# Scale backend to 5 instances
docker-compose up -d --scale backend=5

# Scale backend to 10 instances
docker-compose up -d --scale backend=10

# View running instances
docker-compose ps
```

### Logs

```bash
# View all logs
docker-compose logs

# Follow logs
docker-compose logs -f

# View specific service logs
docker-compose logs backend
docker-compose logs -f backend

# View last 100 lines
docker-compose logs --tail=100 backend
```

### Container Management

```bash
# List running containers
docker ps

# List all containers
docker ps -a

# Access container shell
docker exec -it microfinance-backend sh
docker exec -it microfinance-mongodb mongosh

# View container stats
docker stats

# Inspect container
docker inspect microfinance-backend
```

### Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a

# Check disk usage
docker system df
```

---

## 🔒 Production SSL/TLS Setup

Update `nginx/nginx.conf` for HTTPS:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Rest of configuration...
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

**Mount SSL certificates in docker-compose.yml:**

```yaml
nginx:
  volumes:
    - ./ssl:/etc/nginx/ssl:ro
```

---

## 📊 Health Checks

### Backend Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

### Frontend Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1
```

### Check Health Status

```bash
# View health status
docker ps

# Inspect health
docker inspect --format='{{.State.Health.Status}}' microfinance-backend
```

---

## 🎯 Best Practices

### 1. Multi-Stage Builds

✅ Use multi-stage builds to minimize image size
✅ Separate development and production stages
✅ Only include production dependencies in final image

### 2. Layer Caching

✅ Copy package.json before source code
✅ Install dependencies before copying code
✅ Leverage Docker layer caching

### 3. Security

✅ Use specific image versions (not `latest`)
✅ Run containers as non-root user
✅ Scan images for vulnerabilities
✅ Keep base images updated

### 4. Networking

✅ Use custom networks for isolation
✅ Don't expose database ports to host
✅ Use environment variables for configuration

### 5. Volumes

✅ Use named volumes for persistent data
✅ Mount source code in development
✅ Exclude node_modules from mounts

---

## 📚 Related Documentation

- [Getting Started](01-getting-started.md) - Installation guide
- [Deployment Guide](11-deployment.md) - Cloud deployment
- [Troubleshooting](15-troubleshooting.md) - Common Docker issues

---

[← Back to Project Structure](03-project-structure.md) | [Next: Authentication →](05-authentication.md)
