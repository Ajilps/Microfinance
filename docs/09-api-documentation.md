# 📡 API Documentation

Complete reference for the MicroFinance SaaS REST API.

---

## 📋 Table of Contents

- [Base URL](#base-url)
- [Authentication Overview](#authentication-overview)
  - [JWT Flow](#jwt-access-token-flow)
  - [Google OAuth 2.0 Flow](#google-oauth-20-flow)
  - [Sending the Bearer Token](#sending-the-bearer-token)
- [Rate Limiting](#rate-limiting)
- [Common Error Codes](#common-error-codes)
- [Response Format](#response-format)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Auth — Local (Email/Password)](#auth--local-emailpassword)
    - [POST /auth/register](#post-authregister)
    - [POST /auth/login](#post-authlogin)
    - [GET /auth/me](#get-authme)
    - [POST /auth/logout](#post-authlogout)
  - [Auth — Google OAuth 2.0](#auth--google-oauth-20)
    - [GET /auth/google](#get-authgoogle)
    - [GET /auth/google/callback](#get-authgooglecallback)
    - [GET /auth/google/failure](#get-authgooglefailure)
  - [Users](#users)
    - [GET /users](#get-users)
    - [GET /users/:id](#get-usersid)
    - [PATCH /users/:id](#patch-usersid)
    - [DELETE /users/:id](#delete-usersid)
- [Example Requests](#example-requests)

---

## Base URL

| Environment   | URL                            |
| ------------- | ------------------------------ |
| Development   | `http://localhost:3000/api`    |
| API v1 prefix | `http://localhost:3000/api/v1` |
| Production    | `https://yourdomain.com/api`   |

All feature endpoints use the `/api/v1` prefix.  
The health check lives at `/api/health` (no version prefix).

---

## Authentication Overview

### JWT Access Token Flow

```
1. Client   →  POST /api/v1/auth/login  { email, password, organizationId }
2. Server   →  200 OK  { token, user }   +  Sets HttpOnly cookie `token`
3. Client   →  Include token in subsequent requests:
               Authorization: Bearer <token>
               — OR —
               Cookie: token=<token>  (set automatically by the browser)
```

- Tokens are signed with `JWT_SECRET` and expire after `JWT_EXPIRES_IN` (default **7 days**).
- The token is also set as an **HttpOnly, SameSite=Strict** cookie for browser clients.
- Each endpoint that requires authentication accepts the token from either source.

### Google OAuth 2.0 Flow

```
1. Client   →  Redirect browser to GET /api/v1/auth/google
2. Google   →  User grants permission
3. Google   →  Redirect to GET /api/v1/auth/google/callback?code=…
4. Server   →  Exchanges code for user info, upserts User in DB
5. Server   →  Signs JWT, sets HttpOnly cookie
6. Server   →  Redirect to FRONTEND_URL/auth/callback?token=<jwt>
7. Client   →  Stores token, uses it for subsequent API calls
```

### Sending the Bearer Token

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Rate Limiting

All `/api/*` routes are rate-limited to **100 requests per 15 minutes** per IP address.

| Header                | Description                              |
| --------------------- | ---------------------------------------- |
| `RateLimit-Limit`     | Maximum requests allowed in the window   |
| `RateLimit-Remaining` | Requests remaining in the current window |
| `RateLimit-Reset`     | Unix timestamp when the window resets    |

When exceeded, the server responds with **429 Too Many Requests**.

---

## Common Error Codes

| Status | Meaning                                                       |
| ------ | ------------------------------------------------------------- |
| `400`  | Bad Request — validation failed or malformed input            |
| `401`  | Unauthorized — missing, invalid, or expired token             |
| `403`  | Forbidden — authenticated but lacks permission                |
| `404`  | Not Found — resource does not exist                           |
| `409`  | Conflict — duplicate resource (e.g. email already registered) |
| `429`  | Too Many Requests — rate limit exceeded                       |
| `500`  | Internal Server Error — unexpected server failure             |

---

## Response Format

All responses follow a consistent envelope:

### Success

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": {
    /* payload */
  }
}
```

### Error

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": [
    /* validation errors array or null */
  ]
}
```

---

## Endpoints

---

### Health

#### `GET /api/health`

Returns the server status.

- **Auth:** Public

**Response `200 OK`**

```json
{
  "success": true,
  "message": "MicroFinance API is running",
  "timestamp": "2026-03-08T07:00:00.000Z",
  "uptime": 3600.25
}
```

---

### Auth — Local (Email/Password)

Base path: `/api/v1/auth`

---

#### `POST /auth/register`

Register a new user within an existing organization.

- **Auth:** Public

**Request Headers**

```
Content-Type: application/json
```

**Request Body**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ | Valid email format, normalized to lowercase |
| `password` | string | ✅ | Min 8 chars, must contain uppercase, lowercase, and a number |
| `fullName` | string | ✅ | 2–100 characters |
| `organizationId` | string | ✅ | Valid MongoDB ObjectId |
| `phone` | string | ❌ | Valid mobile phone number |
| `role` | string | ❌ | One of: `member`, `manager`, `admin`, `super_admin`. Defaults to `member` |

**Example Request Body**

```json
{
  "email": "jane.doe@example.com",
  "password": "SecurePass1",
  "fullName": "Jane Doe",
  "organizationId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "phone": "+91 98765 43210"
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d2",
      "email": "jane.doe@example.com",
      "fullName": "Jane Doe",
      "role": "member",
      "organizationId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "isActive": true,
      "createdAt": "2026-03-08T07:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Also sets:

```
Set-Cookie: token=<jwt>; HttpOnly; SameSite=Strict; Max-Age=604800
```

**Error Responses**

`400 Bad Request` — Validation failed

```json
{
  "success": false,
  "message": "Validation failed",
  "error": [
    { "field": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

`409 Conflict` — Email already registered in organization

```json
{
  "success": false,
  "message": "An account with this email already exists in this organization.",
  "error": null
}
```

---

#### `POST /auth/login`

Authenticate a user and receive a JWT token.

- **Auth:** Public

**Request Headers**

```
Content-Type: application/json
```

**Request Body**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | string | ✅ | Valid email |
| `password` | string | ✅ | Non-empty |
| `organizationId` | string | ✅ | Valid MongoDB ObjectId |

**Example Request Body**

```json
{
  "email": "jane.doe@example.com",
  "password": "SecurePass1",
  "organizationId": "65f1a2b3c4d5e6f7a8b9c0d1"
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d2",
      "email": "jane.doe@example.com",
      "fullName": "Jane Doe",
      "role": "member",
      "organizationId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Also sets:

```
Set-Cookie: token=<jwt>; HttpOnly; SameSite=Strict; Max-Age=604800
```

**Error Responses**

`401 Unauthorized` — Invalid credentials

```json
{
  "success": false,
  "message": "Invalid email or password.",
  "error": null
}
```

---

#### `GET /auth/me`

Returns the profile of the currently authenticated user.

- **Auth:** 🔒 Bearer token required

**Request Headers**

```
Authorization: Bearer <token>
```

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Profile fetched successfully",
  "data": {
    "user": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d2",
      "email": "jane.doe@example.com",
      "fullName": "Jane Doe",
      "phone": "+91 98765 43210",
      "role": "member",
      "organizationId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "isActive": true,
      "createdAt": "2026-03-08T07:00:00.000Z",
      "updatedAt": "2026-03-08T07:00:00.000Z"
    }
  }
}
```

**Error Responses**

`401 Unauthorized` — Token missing or invalid

```json
{
  "success": false,
  "message": "Access denied. No token provided.",
  "error": null
}
```

---

#### `POST /auth/logout`

Clears the auth cookie on the server side.

- **Auth:** 🔒 Bearer token required

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": null
}
```

Also clears:

```
Set-Cookie: token=; Max-Age=0
```

---

### Auth — Google OAuth 2.0

---

#### `GET /auth/google`

Initiates the Google OAuth 2.0 login flow.

- **Auth:** Public
- **Usage:** Navigate the user's browser to this URL directly (not via `fetch`/`axios`).

```
GET http://localhost:3000/api/v1/auth/google
```

**Behavior:** Performs an HTTP redirect to Google's authorization endpoint with the configured scopes (`profile`, `email`).

---

#### `GET /auth/google/callback`

Google's redirect URI after the user grants or denies access. Handled internally by Passport.

- **Auth:** Public (called by Google)
- **Do not call this directly from your frontend code.**

**On success:** Redirects to `FRONTEND_URL/auth/callback?token=<jwt>` and sets HttpOnly cookie.

**On failure:** Redirects to `GET /auth/google/failure`.

---

#### `GET /auth/google/failure`

Returns a JSON error response when Google authentication fails.

- **Auth:** Public

**Response `401 Unauthorized`**

```json
{
  "success": false,
  "message": "Google authentication failed. Please try again."
}
```

---

### Users

Base path: `/api/v1/users`

> All user endpoints require authentication. Access to certain endpoints is restricted by role.

---

#### `GET /users`

Returns a paginated list of active users in the authenticated user's organization.

- **Auth:** 🔒 Bearer token required
- **Roles:** `admin`, `super_admin`, `manager`

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max 100) |
| `sort` | string | `-createdAt` | Sort field (prefix `-` for descending) |

**Example Request**

```
GET /api/v1/users?page=1&limit=10&sort=-createdAt
Authorization: Bearer <token>
```

**Response `200 OK`**

```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": {
    "data": [
      {
        "_id": "65f1a2b3c4d5e6f7a8b9c0d2",
        "email": "jane.doe@example.com",
        "fullName": "Jane Doe",
        "role": "member",
        "isActive": true,
        "createdAt": "2026-03-08T07:00:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

**Error Responses**

`403 Forbidden` — Insufficient role

```json
{
  "success": false,
  "message": "You do not have permission to perform this action.",
  "error": null
}
```

---

#### `GET /users/:id`

Returns a single user by their MongoDB ObjectId.

- **Auth:** 🔒 Bearer token required
- **Roles:** Any authenticated user (scoped to the same organization)

**URL Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Response `200 OK`**

```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "user": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d2",
      "email": "jane.doe@example.com",
      "fullName": "Jane Doe",
      "phone": "+91 98765 43210",
      "role": "member",
      "organizationId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "isActive": true,
      "createdAt": "2026-03-08T07:00:00.000Z",
      "updatedAt": "2026-03-08T07:00:00.000Z"
    }
  }
}
```

**Error Responses**

`400 Bad Request` — Invalid ObjectId

```json
{
  "success": false,
  "message": "Validation failed",
  "error": [{ "field": "id", "message": "Invalid user ID" }]
}
```

`404 Not Found`

```json
{
  "success": false,
  "message": "User not found.",
  "error": null
}
```

---

#### `PATCH /users/:id`

Updates a user's `fullName` and/or `phone`. Non-admin users can only update their own profile.

- **Auth:** 🔒 Bearer token required
- **Roles:** Self-service (own profile) or `admin` / `super_admin` (any user in the organization)

**URL Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId |

**Request Headers**

```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body** (all fields optional)
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `fullName` | string | ❌ | 2–100 characters |
| `phone` | string | ❌ | Valid mobile phone number |

**Example Request Body**

```json
{
  "fullName": "Jane Smith",
  "phone": "+91 90000 00000"
}
```

**Response `200 OK`**

```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "user": {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d2",
      "email": "jane.doe@example.com",
      "fullName": "Jane Smith",
      "phone": "+91 90000 00000",
      "role": "member",
      "isActive": true,
      "updatedAt": "2026-03-08T08:00:00.000Z"
    }
  }
}
```

**Error Responses**

`403 Forbidden` — Attempting to update another user's profile without admin role

```json
{
  "success": false,
  "message": "You can only update your own profile.",
  "error": null
}
```

---

#### `DELETE /users/:id`

Soft-deactivates a user (sets `isActive: false`). The user record is retained in the database.

- **Auth:** 🔒 Bearer token required
- **Roles:** `admin`, `super_admin`

**URL Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId |

**Response `200 OK`**

```json
{
  "success": true,
  "message": "User deactivated successfully",
  "data": null
}
```

---

## Example Requests

### Using `fetch`

```javascript
// Login
const { data } = await fetch("http://localhost:3000/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // Send/receive cookies
  body: JSON.stringify({
    email: "jane.doe@example.com",
    password: "SecurePass1",
    organizationId: "65f1a2b3c4d5e6f7a8b9c0d1",
  }),
}).then((res) => res.json());

const token = data.token;

// Authenticated request
const profile = await fetch("http://localhost:3000/api/v1/auth/me", {
  headers: { Authorization: `Bearer ${token}` },
}).then((res) => res.json());
```

### Using `axios`

```typescript
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000/api/v1",
  withCredentials: true, // Send/receive cookies
});

// Login
const { data } = await api.post("/auth/login", {
  email: "jane.doe@example.com",
  password: "SecurePass1",
  organizationId: "65f1a2b3c4d5e6f7a8b9c0d1",
});

// Set token on all subsequent requests
api.defaults.headers.common["Authorization"] = `Bearer ${data.data.token}`;

// Fetch current user
const me = await api.get("/auth/me");

// Get paginated users list (admin)
const users = await api.get("/users", {
  params: { page: 1, limit: 20, sort: "-createdAt" },
});

// Update own profile
await api.patch(`/users/${me.data.data.user._id}`, {
  fullName: "Jane Smith",
});

// Google OAuth — initiates browser redirect
window.location.href = "http://localhost:3000/api/v1/auth/google";
```

---

[← Back to Main README](../README.md) | [Next: Testing Guide →](10-testing.md)
