# Project Open

Goals of this project

- Learn Microservices
- Learn git and git work flow
- Team work
- Docker

---

# 🏦 MicroFinance Web Application Documentation

**Architecture:** MERN Stack + Docker + TypeScript + Microservices

**Methodology:** Agile SCRUM

**Author:** Ajil PS (Full Stack Developer – MERN)

**Version:** 1.0.0

---

## 📘 1. Project Overview

### 🎯 Objective

The **MicroFinance Web Application** is a modular, containerized financial management system where:

- **Users** can create accounts, deposit money, and apply for loans based on their savings balance.
- **Admins** can manage users, approve loans, edit payment records, and monitor transactions.

The system is built for **scalability and extensibility**, following the **microservice architecture** using **MERN + TypeScript** and **Docker**.

Future modules (e.g. Notifications, Analytics, Payment Gateways) can be seamlessly added as independent services.

---

## 🧩 2. System Architecture

### 🔹 Technology Stack

| Layer                | Technology                     | Description                                     |
| -------------------- | ------------------------------ | ----------------------------------------------- |
| **Frontend**         | React + TypeScript             | User/Admin UI with component-based architecture |
| **Backend**          | Node.js + Express + TypeScript | REST APIs divided into microservices            |
| **Database**         | MongoDB                        | NoSQL data store (one per service)              |
| **Containerization** | Docker + Docker Compose        | For consistent, isolated environments           |
| **API Gateway**      | Nginx                          | Reverse proxy routing between microservices     |
| **Auth**             | JWT + bcrypt                   | Secure authentication and authorization         |
| **Version Control**  | Git + GitHub                   | Source control and CI/CD integration            |
| **Workflow**         | Agile SCRUM                    | Iterative, sprint-based development             |

---

## 🏗️ 3. Microservice Architecture Design

The application is split into **independent microservices**, each running in its own Docker container.

### 📦 Core Services

| Service              | Description                                                                       | Port   | Database      |
| -------------------- | --------------------------------------------------------------------------------- | ------ | ------------- |
| **User Service**     | Handles registration, authentication, and user profile data.                      | `5001` | `users-db`    |
| **Account Service**  | Manages deposits, withdrawals, and balances.                                      | `5002` | `accounts-db` |
| **Loan Service**     | Calculates loan eligibility, processes loan applications, and tracks repayments.  | `5003` | `loans-db`    |
| **Admin Service**    | Enables admins to manage users, update loan/payment records, and view dashboards. | `5004` | `admin-db`    |
| **API Gateway**      | Routes requests from the frontend to the correct microservice.                    | `80`   | —             |
| **Frontend (React)** | Web interface for users and admins.                                               | `3000` | —             |

---

### 🧭 Service Interaction Diagram

```
       [ React Frontend ]
                ↓
        [ Nginx API Gateway ]
     ↙         ↓          ↘
[User Service] [Account Service] [Loan Service]
        ↓             ↓              ↓
     [users-db]   [accounts-db]   [loans-db]
                ↓
          [Admin Service]
                ↓
             [admin-db]

```

**Communication:**

- Services communicate using **REST (HTTP)** for simplicity.
- In future, **Message Queues (e.g. RabbitMQ)** can be introduced for async communication (e.g. when processing loan approvals).

---

## ⚙️ 4. Folder Structure

```
/microfinance-app/
│
├── client/                     # React + TypeScript Frontend
│   ├── src/
│   ├── Dockerfile
│
├── gateway/                    # Nginx API Gateway
│   ├── nginx.conf
│   ├── Dockerfile
│
├── services/
│   ├── user-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── tsconfig.json
│   │
│   ├── account-service/
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── tsconfig.json
│   │
│   ├── loan-service/
│   ├── admin-service/
│
├── docker-compose.yml
├── .env
└── README.md

```

---

## 🧱 5. Example Docker Compose Setup

**`docker-compose.yml`**

```yaml
version: "3.8"

services:
  api-gateway:
    build: ./gateway
    ports:
      - "80:80"
    depends_on:
      - user-service
      - account-service
      - loan-service
      - admin-service

  user-service:
    build: ./services/user-service
    ports:
      - "5001:5001"
    environment:
      - MONGO_URI=mongodb://user-db:27017/users
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - user-db

  account-service:
    build: ./services/account-service
    ports:
      - "5002:5002"
    environment:
      - MONGO_URI=mongodb://account-db:27017/accounts
    depends_on:
      - account-db

  loan-service:
    build: ./services/loan-service
    ports:
      - "5003:5003"
    environment:
      - MONGO_URI=mongodb://loan-db:27017/loans
    depends_on:
      - loan-db

  admin-service:
    build: ./services/admin-service
    ports:
      - "5004:5004"
    environment:
      - MONGO_URI=mongodb://admin-db:27017/admin
    depends_on:
      - admin-db

  user-db:
    image: mongo
    volumes:
      - ./data/user:/data/db

  account-db:
    image: mongo
    volumes:
      - ./data/account:/data/db

  loan-db:
    image: mongo
    volumes:
      - ./data/loan:/data/db

  admin-db:
    image: mongo
    volumes:
      - ./data/admin:/data/db
```

Run everything with:

```bash
docker-compose up --build

```

---

## 🧩 6. Service Responsibilities

### 👤 **User Service**

- Register & authenticate users (JWT)
- Update user profiles
- Manage user roles (user/admin)
- Handle password encryption with `bcrypt`

---

### 💰 **Account Service**

- Create and manage user savings accounts
- Deposit / withdraw money
- Maintain transaction history
- Calculate current balance

---

### 💳 **Loan Service**

- Check user loan eligibility (based on savings)
- Create new loan applications
- Track repayments
- Handle interest calculation

---

### 🧑‍💼 **Admin Service**

- Manage all users and accounts
- Approve or reject loans
- Edit or update payments
- Generate basic reports

---

## 💻 7. Technology Details (TypeScript + Express)

Example `server.ts` for Account Service:

```tsx
import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();
const app = express();
app.use(express.json());

app.get("/api/account/health", (req, res) => res.send("Account Service OK"));

mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => console.log("Mongo Connected"))
  .catch((err) => console.log(err));

app.listen(5002, () => console.log("Account Service on 5002"));
```

---

## 🔐 8. Authentication & Authorization Flow

1. User registers through **User Service** → gets JWT token.
2. JWT token stored in localStorage (frontend) and attached to all requests.
3. Middleware in each microservice validates JWT using a shared `JWT_SECRET`.
4. Admin routes are protected via role-based middleware.

---

## 🧠 9. Agile SCRUM Workflow

### 🔹 Project Roles

| Role              | Responsibility                                  |
| ----------------- | ----------------------------------------------- |
| **Product Owner** | Defines project goals & backlog (you or client) |
| **Scrum Master**  | Ensures sprint flow & resolves blockers         |
| **Developers**    | Build features across services (you + team)     |

---

### 🔹 Sprint Breakdown (Example 6-Sprint Plan)

| Sprint       | Duration | Deliverables                             |
| ------------ | -------- | ---------------------------------------- |
| **Sprint 1** | 2 weeks  | Project setup, Docker environment, CI/CD |
| **Sprint 2** | 2 weeks  | User Service + Auth                      |
| **Sprint 3** | 2 weeks  | Account Service + Transactions           |
| **Sprint 4** | 2 weeks  | Loan Service + Eligibility Logic         |
| **Sprint 5** | 2 weeks  | Admin Service + Dashboard                |
| **Sprint 6** | 2 weeks  | Integration, Testing, Deployment         |

---

### 🔹 Agile Artifacts

- **Product Backlog:** Full list of user stories
- **Sprint Backlog:** Subset for each sprint
- **Daily Scrum:** 15-min update meeting
- **Sprint Review:** Demo progress
- **Sprint Retrospective:** Evaluate what to improve

---

### 🧾 Example User Stories

| ID   | User Story                                                     | Priority |
| ---- | -------------------------------------------------------------- | -------- |
| US01 | As a user, I want to register and log in securely.             | High     |
| US02 | As a user, I want to see my account balance and deposit money. | High     |
| US03 | As a user, I want to apply for a loan based on my balance.     | High     |
| US04 | As an admin, I want to approve or reject loan applications.    | Medium   |
| US05 | As an admin, I want to edit user payment records.              | Medium   |
| US06 | As a user, I want to view my loan repayment history.           | Low      |

---

## 📊 10. Deployment & Scaling

- Use **Docker Compose** in development.
- For production, migrate to **Kubernetes** or **Docker Swarm**.
- CI/CD via **GitHub Actions** → build → test → push Docker images.
- Deploy on **AWS EC2**, **Render**, or **DigitalOcean**.
- Use **MongoDB Atlas** for production database hosting.

---

## 📈 11. Future Enhancements

- Payment gateway (Razorpay/Stripe)
- Notification Service (Email/SMS)
- Analytics & Reporting Service
- Microservice Event Bus (Kafka/RabbitMQ)
- Role-based dashboard (React Admin Panel)
- Logging & monitoring with Prometheus + Grafana

---

## ✅ 12. Summary

| Feature         | Current                  | Future                 |
| --------------- | ------------------------ | ---------------------- |
| Auth & Roles    | ✅ Done (User/Admin)     | ⬜ Add OAuth/2FA       |
| Savings Account | ✅ Done                  | ⬜ Integrate payments  |
| Loan System     | ✅ Basic Eligibility     | ⬜ Add interest engine |
| Admin Panel     | ✅ CRUD Control          | ⬜ Add Analytics       |
| Docker          | ✅ Multi-container setup | ⬜ Kubernetes scaling  |
| SCRUM Workflow  | ✅ Active                | ⬜ Add Jira Automation |

---

- Basic microservice boilerplates
- Gateway config
- Docker setup
- TypeScript setup for each service
