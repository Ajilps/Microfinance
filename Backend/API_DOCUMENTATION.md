# Microfinance Backend — API Documentation

Base URL: `http://localhost:4000`

> In the Docker development stack, the backend is exposed at
> `http://localhost:4001` by default.

## Admin Profile

These routes act only on the currently authenticated administrator and require
an admin Bearer token.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/profile` | Return the logged-in admin's profile. |
| `PUT` | `/api/admin/profile` | Update the logged-in admin's name and email address. |
| `PUT` | `/api/admin/profile/password` | Verify the current password and set a strong new password. |

Profile updates accept `name` and `email`. Password changes accept
`currentPassword` and `newPassword`; the new password must contain at least
eight characters, uppercase and lowercase letters, a number, and a special
character. Successful updates return a refreshed token. A password change also
increments the account's token version, immediately invalidating sessions on
other browsers and devices while allowing the requesting browser to continue
with the newly returned token.

## Dashboard Analytics (Admin)

All dashboard analytics routes require an admin Bearer token.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard/overview` | Return the dashboard snapshot in one request. |

The response contains:

- `summary`: member, savings, loan, interest, bank, profit, collection-rate,
  savings-coverage, and latest-attendance KPIs.
- `monthlyActivity`: six calendar months of savings received, loans distributed,
  and principal repayments.
- `loanComposition`: total principal repaid and still outstanding.
- `attendanceTrend`: the latest eight recorded meetings, grouped by status.
- `bankTrend`: six calendar months of deposits, withdrawals, and closing balance.
- `topSavers`: the six members with the largest current savings balances.
- `recentMembers`: the five most recently created member accounts.

Money values are returned as numbers rounded to two decimal places. Rates are
percentages rounded to two decimal places.

## Member Workspace (Admin)

These endpoints power the **Find by User** section and require an admin Bearer
token.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/members` | Return every member with current savings, principal due, interest due, attendance rate, and latest activity date. |
| `GET` | `/api/admin/members/:userId/workspace` | Return the complete workspace for one member. |

The workspace response includes the member profile, current savings and loan
summary, attendance and fine summary, active profit allocations, twelve-month
chart series, complete savings/loan/attendance/fine histories, profit allocation
history, and one combined financial activity timeline.

The page records updates through the existing savings, loan, calculated-interest,
attendance, and attendance-fine endpoints. This means repayment balance checks,
weekly savings uniqueness, interest-period idempotency, and attendance weekly
upserts behave identically in both the dedicated management pages and the member
workspace.

## Interest Automation (Admin)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/interest-automation/status` | Return whether automation is enabled, its schedule/timezone, running state, next run, and last result/error. |

The backend runs a startup catch-up scan by default and then follows
`INTEREST_CRON_SCHEDULE`. It writes only completed, unrecorded 28-day periods.
Manual and automatic application share the same server-side calculation and
atomic upsert path. The unique database index on member plus interest-period
start provides an additional concurrency guard.

## Loan Closure (Admin)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/loans/:userId/close/preview?closeDate=YYYY-MM-DD` | Preview the full settlement without changing the ledger. |
| `POST` | `/api/admin/loans/:userId/close` | Apply missed completed interest and record the full settlement. |

The preview returns the outstanding principal, existing unpaid interest/fines,
unrecorded completed-period interest, final partial-period interest, and total
cash to collect. Partial interest is prorated as
`principal at period start × 1% × elapsed days ÷ 28`.

The close request must use the total from a current preview:

```json
{
  "closeDate": "2026-08-14",
  "expectedTotal": 10150,
  "note": "Receipt 1042"
}
```

Completed periods are posted through the same idempotent interest service used
by the scheduler. The final partial period and complete payment are stored in a
single `closure` ledger record. A unique loan-cycle key prevents a concurrent or
repeated request from closing the same cycle twice. A successful response has
zero principal, interest, and total outstanding balances. A later disbursement
starts a new independent 28-day interest cycle.

## Finance Routes (Admin)

All finance routes require an admin Bearer token.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/finance/entries?type=all&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | List additional income and expenses with filtered totals. |
| `POST` | `/api/admin/finance/entries` | Add an income or expense record. |
| `PUT` | `/api/admin/finance/entries/:id` | Edit an income or expense record. |
| `GET` | `/api/admin/finance/weekly?date=YYYY-MM-DD` | Get the combined Monday–Sunday transaction report. |

Create and update bodies use the following shape:

```json
{
  "type": "expense",
  "amount": 500,
  "transactionDate": "2026-08-12",
  "sourceOrReason": "Office stationery",
  "note": "Optional details"
}
```

`sourceOrReason`, `transactionDate`, `type`, and a positive `amount` are
required. The weekly report returns separate cash-in, cash-out, and non-cash
totals together with total activity, category totals, and transaction rows.

---

## Authentication

Protected routes require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are returned upon successful login or registration.

---

## User Routes

### Register a New User

**POST** `/api/users/register`

**Access:** Public

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response — `201 Created`:**

```json
{
  "_id": "64abc123...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "token": "<jwt_token>"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `400` | Please provide name, email, and password |
| `409` | User with this email already exists |

---

### Login User

**POST** `/api/users/login`

**Access:** Public

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response — `200 OK`:**

```json
{
  "_id": "64abc123...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "token": "<jwt_token>"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `400` | Please provide email and password |
| `401` | Invalid credentials |

---

### Get All Users

**GET** `/api/users`

**Access:** Private (requires valid JWT)

**Success Response — `200 OK`:**

```json
[
  {
    "_id": "64abc123...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `401` | Not authorized, invalid token |

---

### Get User by ID

**GET** `/api/users/:id`

**Access:** Private (requires valid JWT)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Success Response — `200 OK`:**

```json
{
  "_id": "64abc123...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `404` | User not found |

---

### Update User

**PUT** `/api/users/:id`

**Access:** Private (requires valid JWT)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Request Body (all fields optional):**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "newpassword123",
  "role": "user"
}
```

**Success Response — `200 OK`:**

```json
{
  "_id": "64abc123...",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "user"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `404` | User not found |

---

### Delete User

**DELETE** `/api/users/:id`

**Access:** Private (requires valid JWT)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Success Response — `200 OK`:**

```json
{
  "message": "User deleted successfully"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `404` | User not found |

---

### Get My Loan Summary

**GET** `/api/users/loans/me`

**Access:** Private (requires valid user JWT)

**Success Response — `200 OK`:**

```json
{
  "totalLoanTaken": 5000,
  "totalPaid": 1000,
  "currentBalance": 4050,
  "repayments": [
    { "date": "2026-03-10T00:00:00.000Z", "amount": 1000 }
  ]
}
```

> **Note:** Users see only their repayment history. Interest, fines, and full ledger are admin-only.

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |

---

### Get My Savings Summary

**GET** `/api/users/savings/me`

**Access:** Private (requires valid user JWT)

**Success Response — `200 OK`:**

```json
{
  "totalSavings": 800,
  "currentWeekPaid": true,
  "payments": [
    {
      "weekStartDate": "2026-03-09T00:00:00.000Z",
      "paidOn": "2026-03-10T00:00:00.000Z",
      "amount": 200,
      "note": ""
    }
  ]
}
```

> **Note:** Savings interest is not shown to users — it is admin-only.

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |

---

### Get My Attendance Summary

**GET** `/api/users/attendance/me?month=3&year=2026`

**Access:** Private (requires valid user JWT)

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | Integer | Yes | Month number (1–12) |
| `year` | Integer | Yes | Full year (e.g., 2026) |

**Success Response — `200 OK`:**

```json
{
  "month": 3,
  "year": 2026,
  "totalWeeks": 4,
  "present": 3,
  "absent": 1,
  "late": 0,
  "leave": 0,
  "fineOwed": 20,
  "totalPaid": 20,
  "fineBalance": 0,
  "finePayments": [
    { "amount": 20, "paidOn": "2026-03-20T00:00:00.000Z", "note": "Paid in cash" }
  ],
  "weeklyRecords": [
    {
      "weekStartDate": "2026-03-09T00:00:00.000Z",
      "attendanceDate": "2026-03-10T00:00:00.000Z",
      "status": "present",
      "note": ""
    }
  ]
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `400` | month and year query params are required |
| `401` | Not authorized, no token |

---

## Admin Routes

> All admin routes require a valid JWT token belonging to a user with `role: "admin"`.

**Headers required for all admin routes:**

```
Authorization: Bearer <admin_jwt_token>
```

---

### Get All Users (Admin)

**GET** `/api/admin/users`

**Access:** Private/Admin

**Success Response — `200 OK`:**

```json
[
  {
    "_id": "64abc123...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `401` | Not authorized, invalid token |
| `403` | Forbidden: Admin access required |

---

### Get User by ID (Admin)

**GET** `/api/admin/users/:id`

**Access:** Private/Admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Success Response — `200 OK`:**

```json
{
  "_id": "64abc123...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `403` | Forbidden: Admin access required |
| `404` | User not found |

---

### Update User (Admin)

**PUT** `/api/admin/users/:id`

**Access:** Private/Admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Request Body (all fields optional):**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "newpassword123",
  "role": "admin"
}
```

**Success Response — `200 OK`:**

```json
{
  "_id": "64abc123...",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "admin"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `403` | Forbidden: Admin access required |
| `404` | User not found |

---

### Delete User (Admin)

**DELETE** `/api/admin/users/:id`

**Access:** Private/Admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Success Response — `200 OK`:**

```json
{
  "message": "User deleted successfully"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `403` | Forbidden: Admin access required |
| `404` | User not found |

---

### Create Admin Account

**POST** `/api/admin/create`

**Access:** Private/Admin

**Request Body:**

```json
{
  "name": "Super Admin",
  "email": "superadmin@example.com",
  "password": "adminpassword123"
}
```

**Success Response — `201 Created`:**

```json
{
  "_id": "64xyz789...",
  "name": "Super Admin",
  "email": "superadmin@example.com",
  "role": "admin",
  "token": "<jwt_token>"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `400` | Please provide name, email, and password |
| `401` | Not authorized, no token |
| `403` | Forbidden: Admin access required |
| `409` | User with this email already exists |

---

### Get All Admins

**GET** `/api/admin/all`

**Access:** Private/Admin

**Success Response — `200 OK`:**

```json
[
  {
    "_id": "64xyz789...",
    "name": "Super Admin",
    "email": "superadmin@example.com",
    "role": "admin",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `403` | Forbidden: Admin access required |

---

## Attendance & Fines (Admin)

> All attendance routes require a valid JWT token belonging to a user with `role: "admin"`.

### Mark / Update Weekly Attendance

**POST** `/api/admin/attendance`

**Access:** Private/Admin

**Request Body:**

```json
{
  "attendanceDate": "2026-03-16T10:00:00.000Z",
  "weekStartDay": 0,
  "records": [
    {
      "userId": "64abc123...",
      "status": "present",
      "note": ""
    },
    {
      "userId": "64def456...",
      "status": "absent",
      "note": "Unreachable"
    }
  ]
}
```

**Success Response — `200 OK`:**

```json
{
  "message": "Attendance marked successfully",
  "weekStart": "2026-03-15T00:00:00.000Z"
}
```

---

### Get Attendance by Date (Weekly)

**GET** `/api/admin/attendance?date=2026-03-16&weekStartDay=0`

**Access:** Private/Admin

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | Date string | Yes | Any date within the week you want to fetch |
| `weekStartDay` | Integer | No | `0` = Sunday, `1` = Monday. Default `0` |

**Success Response — `200 OK`:**

```json
{
  "weekStart": "2026-03-15T00:00:00.000Z",
  "records": [
    {
      "_id": "64xyz...",
      "user": {
        "_id": "64abc123...",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "weekStartDate": "2026-03-15T00:00:00.000Z",
      "attendanceDate": "2026-03-16T10:00:00.000Z",
      "status": "present",
      "note": ""
    }
  ]
}
```

---

### Get Monthly Attendance & Fine Summary

**GET** `/api/admin/attendance/monthly?month=3&year=2026`

**Access:** Private/Admin

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | Integer | Yes | Month number (1-12) |
| `year` | Integer | Yes | Full year (e.g., 2026) |

**Success Response — `200 OK`:**

```json
{
  "month": 3,
  "year": 2026,
  "summary": [
    {
      "userId": "64abc123...",
      "name": "John Doe",
      "email": "john@example.com",
      "totalWeeks": 4,
      "present": 3,
      "absent": 1,
      "late": 0,
      "leave": 0,
      "fineOwed": 20,
      "totalPaid": 0,
      "balance": 20
    }
  ]
}
```

---

### Download Monthly Attendance CSV

**GET** `/api/admin/attendance/download?month=3&year=2026`

**Access:** Private/Admin

**Returns:** A `.csv` file attachment containing the month's summary and fine calculations for all users.

---

### Record Fine Payment

**POST** `/api/admin/attendance/fine/payment`

**Access:** Private/Admin

**Request Body:**

```json
{
  "userId": "64abc123...",
  "amount": 20,
  "month": 3,
  "year": 2026,
  "paidOn": "2026-03-20T14:30:00.000Z",
  "note": "Paid in cash"
}
```

**Success Response — `201 Created`:**

```json
{
  "message": "Fine payment recorded",
  "payment": {
    "_id": "64ghi...",
    "user": "64abc123...",
    "amount": 20,
    "month": 3,
    "year": 2026,
    "paidOn": "2026-03-20T14:30:00.000Z"
  }
}
```

---

### Get User Fine Report

**GET** `/api/admin/attendance/fine/:userId?month=3&year=2026`

**Access:** Private/Admin

**Success Response — `200 OK`:**

```json
{
  "userId": "64abc123...",
  "name": "John Doe",
  "email": "john@example.com",
  "month": 3,
  "year": 2026,
  "totalWeeks": 4,
  "present": 3,
  "absent": 1,
  "late": 0,
  "leave": 0,
  "fineOwed": 20,
  "totalPaid": 20,
  "balance": 0,
  "payments": [
    {
      "_id": "64ghi...",
      "amount": 20,
      "paidOn": "2026-03-20T14:30:00.000Z"
    }
  ]
}
```

---

## Loan Management (Admin)

> All loan write routes are admin-only. Users can only read their own summary.

### Add a Loan Transaction

**POST** `/api/admin/loans/:userId/transaction`

**Access:** Private/Admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | MongoDB ObjectId of the target user |

**Request Body:**

```json
{
  "type": "loan",
  "amount": 5000,
  "date": "2026-03-01",
  "note": "Initial loan disbursement"
}
```

**`type` values:**

| Value | Effect on Balance |
|-------|-------------------|
| `loan` | Increases balance (new disbursement) |
| `repayment` | Decreases balance (user payment) |
| `interest` | Increases balance (manual override; auto-applied by cron) |
| `fine` | Increases balance (optional penalty) |

**Success Response — `201 Created`:**

```json
{
  "_id": "64tx001...",
  "user": "64abc123...",
  "type": "loan",
  "amount": 5000,
  "date": "2026-03-01T00:00:00.000Z",
  "note": "Initial loan disbursement",
  "recordedBy": "64admin...",
  "createdAt": "2026-03-01T08:00:00.000Z"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `400` | type, amount, and date are required |
| `403` | Forbidden: Admin access required |
| `404` | User not found |

---

### Get User Loan Ledger

**GET** `/api/admin/loans/:userId`

**Access:** Private/Admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | MongoDB ObjectId of the target user |

**Success Response — `200 OK`:**

```json
{
  "user": {
    "_id": "64abc123...",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "summary": {
    "totalLoan": 5000,
    "totalRepayment": 1000,
    "totalInterest": 40,
    "totalFine": 0,
    "currentBalance": 4040
  },
  "transactions": [
    {
      "_id": "64tx001...",
      "type": "loan",
      "amount": 5000,
      "date": "2026-03-01T00:00:00.000Z",
      "note": "Initial loan disbursement",
      "recordedBy": { "name": "Admin" }
    },
    {
      "_id": "64tx002...",
      "type": "repayment",
      "amount": 1000,
      "date": "2026-03-10T00:00:00.000Z",
      "note": ""
    },
    {
      "_id": "64tx003...",
      "type": "interest",
      "amount": 40,
      "date": "2026-03-29T00:00:00.000Z",
      "note": "Auto interest: 1% of balance ₹4000.00"
    }
  ]
}
```

> **Balance formula:** `totalLoan + totalInterest + totalFine - totalRepayment`

**Error Responses:**
| Status | Message |
|--------|---------|
| `403` | Forbidden: Admin access required |
| `404` | User not found |

---

### Get All Users' Loan Overview

**GET** `/api/admin/loans`

**Access:** Private/Admin

**Success Response — `200 OK`:**

```json
[
  {
    "userId": "64abc123...",
    "name": "John Doe",
    "email": "john@example.com",
    "totalLoan": 5000,
    "totalRepayment": 1000,
    "totalInterest": 40,
    "totalFine": 0,
    "currentBalance": 4040
  }
]
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `403` | Forbidden: Admin access required |

---

## Savings Management (Admin)

> Savings interest is **admin-only** — users cannot see it.

Savings balances are calculated as `total deposits − total withdrawals`.
Withdrawals are separate audited ledger records, so the existing one-deposit-
per-week rule is unchanged.

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/admin/savings/:userId/withdrawal` | Record a savings withdrawal. |
| `PUT` | `/api/admin/savings/:userId/withdrawal/:withdrawalId` | Correct an existing withdrawal. |
| `DELETE` | `/api/admin/savings/:userId/withdrawal/:withdrawalId` | Delete a withdrawal with an audit record. |

Create and update withdrawal bodies use:

```json
{
  "amount": 500,
  "withdrawalDate": "2026-08-14",
  "reason": "Medical expenses",
  "paymentMethod": "bank",
  "referenceNumber": "TXN-1042",
  "note": "Optional additional details"
}
```

`amount`, `withdrawalDate`, and `reason` are required. `paymentMethod` is
`cash`, `bank`, or `other`. A withdrawal is rejected if it exceeds the savings
available on the selected date. Editing or deleting an earlier deposit is also
rejected when a later withdrawal depends on that deposit.

### Record Weekly Savings Payment

**POST** `/api/admin/savings/:userId/payment`

**Access:** Private/Admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | MongoDB ObjectId of the target user |

**Request Body:**

```json
{
  "amount": 200,
  "paidOn": "2026-03-10",
  "weekStartDate": "2026-03-09",
  "note": "Week 10 savings"
}
```

> `weekStartDate` is optional — if omitted, it is derived from `paidOn` (normalized to Monday).

**Success Response — `201 Created`:**

```json
{
  "_id": "64sv001...",
  "user": "64abc123...",
  "weekStartDate": "2026-03-09T00:00:00.000Z",
  "paidOn": "2026-03-10T00:00:00.000Z",
  "amount": 200,
  "note": "Week 10 savings",
  "recordedBy": "64admin..."
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `400` | amount and paidOn are required |
| `403` | Forbidden: Admin access required |
| `404` | User not found |
| `409` | Savings for this week already recorded. Use update if needed. |

---

### Update a Savings Entry

**PUT** `/api/admin/savings/:userId/payment/:paymentId`

**Access:** Private/Admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | MongoDB ObjectId of the target user |
| `paymentId` | string | MongoDB ObjectId of the savings payment to update |

**Request Body (all fields optional):**

```json
{
  "amount": 250,
  "paidOn": "2026-03-11",
  "note": "Corrected amount"
}
```

**Success Response — `200 OK`:** Returns the updated savings document.

**Error Responses:**
| Status | Message |
|--------|---------|
| `403` | Forbidden: Admin access required |
| `404` | Savings payment not found |

---

### Get User Savings Detail (Admin)

**GET** `/api/admin/savings/:userId`

**Access:** Private/Admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | MongoDB ObjectId of the target user |

**Success Response — `200 OK`:**

```json
{
  "user": {
    "_id": "64abc123...",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "totalSavings": 800,
  "savingsInterest": 8.00,
  "currentWeekPaid": true,
  "payments": [
    {
      "_id": "64sv001...",
      "weekStartDate": "2026-03-09T00:00:00.000Z",
      "paidOn": "2026-03-10T00:00:00.000Z",
      "amount": 200,
      "note": "",
      "recordedBy": { "name": "Admin" }
    }
  ]
}
```

> `savingsInterest` = `totalSavings × 0.01` — **admin-only field**.

**Error Responses:**
| Status | Message |
|--------|---------|
| `403` | Forbidden: Admin access required |
| `404` | User not found |

---

### Get All Users' Savings Overview (Admin)

**GET** `/api/admin/savings`

**Access:** Private/Admin

**Success Response — `200 OK`:**

```json
[
  {
    "userId": "64abc123...",
    "name": "John Doe",
    "email": "john@example.com",
    "totalSavings": 800,
    "savingsInterest": 8.00,
    "paymentsCount": 4,
    "lastPaidOn": "2026-03-10T00:00:00.000Z"
  }
]
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `403` | Forbidden: Admin access required |

---

## Downloadable Reports

All report endpoints require an admin bearer token.

### Attendance CSV

- Monthly: **GET** `/api/admin/attendance/download?month=8&year=2026`
- Till now: **GET** `/api/admin/attendance/download/all`

### Loan Reports

- Preview: **GET** `/api/admin/reports/loans?scope=monthly&month=8&year=2026`
- All-time preview: **GET** `/api/admin/reports/loans?scope=all`
- CSV: **GET** `/api/admin/reports/loans/download` with the same query parameters

Monthly loan reports show activity during the selected month and balances
calculated through that month's end.

### Savings Reports

- Preview: **GET** `/api/admin/reports/savings?scope=monthly&month=8&year=2026`
- All-time preview: **GET** `/api/admin/reports/savings?scope=all`
- CSV: **GET** `/api/admin/reports/savings/download` with the same query parameters

Monthly savings reports show deposits during the selected month and savings
balances calculated through that month's end.

---

## Bank Transactions

All bank transaction endpoints require an admin bearer token.

### Bank Ledger

**GET** `/api/admin/finance/bank-transactions?startDate=2026-08-01&endDate=2026-08-31`

Returns transactions in newest-first display order. Every transaction includes
the running bank balance calculated from the complete chronological ledger, so
date filtering does not reset the balance. The response also includes the
current all-time balance and deposit/withdrawal totals for the selected range.

### Add Bank Transaction

**POST** `/api/admin/finance/bank-transactions`

```json
{
  "transactionDate": "2026-08-14",
  "particulars": "Profit payout transfer",
  "chequeNumber": "10024",
  "chequeName": "Member One",
  "withdrawal": 2500,
  "deposit": 0
}
```

Exactly one of `withdrawal` or `deposit` must be greater than zero. Cheque
number and cheque name are optional. Balance is calculated by the server and
is not accepted as an input.

### Edit Bank Transaction

**PUT** `/api/admin/finance/bank-transactions/:id`

Accepts the same fields as the create endpoint. Editing a dated entry causes
all later running balances to be recalculated when the ledger is requested.

---

## Profit & Distribution

All profit endpoints require an admin bearer token.

### Profit Overview and Allocation Preview

**GET** `/api/admin/finance/profit?asOfDate=2026-08-12&amount=10000`

The amount is optional. When omitted, the API previews all currently
distributable cash profit. The response includes:

- loan distribution and repayment totals;
- generated and collected interest;
- outstanding principal and interest;
- loan fines, attendance-fine income, other income, and other expenses;
- accrued revenue, expenses, and profit;
- cash profit remaining after earlier distributions;
- a cent-accurate member allocation based on savings through the selected date.

### Record Profit Distribution

**POST** `/api/admin/finance/profit/distributions`

```json
{
  "asOfDate": "2026-08-12",
  "amount": 10000
}
```

The server recalculates availability and member shares before saving. A
calculation fingerprint prevents the same active allocation from being
recorded twice, including simultaneous duplicate requests. A distribution is
stored as a payout snapshot and does not change weekly savings balances.

### Distribution History

**GET** `/api/admin/finance/profit/distributions`

Returns recorded distributions with member savings, percentages, allocated
amounts, status, and the admin who recorded each payout. Reversed allocations
remain in the history for auditing but are excluded from previously distributed
profit totals.

### Un-allocate Profit Distribution

**PATCH** `/api/admin/finance/profit/distributions/:id/unallocate`

```json
{
  "reason": "Recorded against the wrong payout date"
}
```

Marks an active distribution as reversed. Its amount becomes available for a
future allocation again. The original member allocation snapshot, reversing
admin, timestamp, and optional reason remain in distribution history.

Un-allocation is rejected when it has been permanently disabled for the
distribution.

### Permanently Disable Un-allocation

**PATCH** `/api/admin/finance/profit/distributions/:id/lock-unallocate`

Marks an active distribution as final and permanently disables its
un-allocation action. This is intended for use after the payout has been
confirmed. The distribution remains deducted from available profit, and the
locking administrator and timestamp are retained in history. This action
cannot be undone.

---

## Data Models

### User

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `_id` | ObjectId | Auto | — |
| `name` | String | Yes | — |
| `email` | String | Yes (unique) | — |
| `password` | String | Yes (min 6 chars, hidden) | — |
| `role` | String (`"user"` \| `"admin"`) | No | `"user"` |
| `createdAt` | Date | Auto | — |
| `updatedAt` | Date | Auto | — |

### Attendance

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | — |
| `user` | ObjectId (ref: User) | Yes | Member marked |
| `weekStartDate` | Date | Yes | Normalized to start of week |
| `attendanceDate` | Date | Yes | Actual day admin took attendance |
| `status` | String | Yes | `"present"`, `"absent"`, `"late"`, `"leave"` |
| `markedBy` | ObjectId (ref: User) | No | Admin who marked |
| `note` | String | No | — |

_Compound unique index on `{ user, weekStartDate }`._

### FinePayment

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | — |
| `user` | ObjectId (ref: User) | Yes | Member paying |
| `amount` | Number | Yes (min: 1) | Amount in ₹ |
| `month` | Number | Yes | 1–12 |
| `year` | Number | Yes | — |
| `paidOn` | Date | Auto | Date of payment |
| `recordedBy` | ObjectId (ref: User) | No | Admin who recorded |
| `note` | String | No | — |

### LoanTransaction

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | — |
| `user` | ObjectId (ref: User) | Yes | Target member |
| `type` | String | Yes | `"loan"`, `"repayment"`, `"interest"`, `"fine"` |
| `amount` | Number | Yes (min: 0.01) | Always positive |
| `date` | Date | Yes | Admin-controlled transaction date |
| `note` | String | No | — |
| `recordedBy` | ObjectId (ref: User) | No | Admin who entered; `null` if auto-generated by cron |

_Indexes on `{ user, date }` and `{ user, type }`._

**Balance formula:** `currentBalance = totalLoan + totalInterest + totalFine − totalRepayment`

### SavingsPayment

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `_id` | ObjectId | Auto | — |
| `user` | ObjectId (ref: User) | Yes | Target member |
| `weekStartDate` | Date | Yes | Normalized to Monday of the week |
| `paidOn` | Date | Yes | Actual date admin records payment |
| `amount` | Number | Yes (min: 1) | Variable — entered by admin each week |
| `note` | String | No | — |
| `recordedBy` | ObjectId (ref: User) | No | Admin who recorded |

_Compound unique index on `{ user, weekStartDate }` (one entry per user per week)._

**Savings interest formula:** `savingsInterest = totalSavings × 0.01` _(admin-only)_

---

## Automatic Interest Cron

Loan interest is applied **automatically every 28 days** per user:

- Runs daily at **00:00 IST** (server timezone: `Asia/Kolkata`)
- For each user with `currentBalance > 0`, checks if ≥ 28 days have elapsed since:
  - The last `interest` transaction, or
  - The first `loan` transaction (if no interest has been applied yet)
- If 28 days have passed, creates a new `interest` transaction: `amount = currentBalance × 0.01`
- Safe against duplicate application even after server restarts

---

## Error Response Format

All error responses follow this structure:

```json
{
  "message": "Error description here"
}
```

---

## Health Check

**GET** `/`

**Access:** Public

**Success Response — `200 OK`:**

```json
{
  "message": "User Management API is running"
}
```


---

## Authentication

Protected routes require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are returned upon successful login or registration.

---

## User Routes

### Register a New User

**POST** `/api/users/register`

**Access:** Public

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response — `201 Created`:**

```json
{
  "_id": "64abc123...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "token": "<jwt_token>"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `400` | Please provide name, email, and password |
| `409` | User with this email already exists |

---

### Login User

**POST** `/api/users/login`

**Access:** Public

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Success Response — `200 OK`:**

```json
{
  "_id": "64abc123...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "token": "<jwt_token>"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `400` | Please provide email and password |
| `401` | Invalid credentials |

---

### Get All Users

**GET** `/api/users`

**Access:** Private (requires valid JWT)

**Success Response — `200 OK`:**

```json
[
  {
    "_id": "64abc123...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `401` | Not authorized, invalid token |

---

### Get User by ID

**GET** `/api/users/:id`

**Access:** Private (requires valid JWT)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Success Response — `200 OK`:**

```json
{
  "_id": "64abc123...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `404` | User not found |

---

### Update User

**PUT** `/api/users/:id`

**Access:** Private (requires valid JWT)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Request Body (all fields optional):**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "newpassword123",
  "role": "user"
}
```

**Success Response — `200 OK`:**

```json
{
  "_id": "64abc123...",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "user"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `404` | User not found |

---

### Delete User

**DELETE** `/api/users/:id`

**Access:** Private (requires valid JWT)

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Success Response — `200 OK`:**

```json
{
  "message": "User deleted successfully"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `404` | User not found |

---

## Admin Routes

> All admin routes require a valid JWT token belonging to a user with `role: "admin"`.

**Headers required for all admin routes:**

```
Authorization: Bearer <admin_jwt_token>
```

---

### Get All Users (Admin)

**GET** `/api/admin/users`

**Access:** Private/Admin

**Success Response — `200 OK`:**

```json
[
  {
    "_id": "64abc123...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `401` | Not authorized, invalid token |
| `403` | Forbidden: Admin access required |

---

### Get User by ID (Admin)

**GET** `/api/admin/users/:id`

**Access:** Private/Admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Success Response — `200 OK`:**

```json
{
  "_id": "64abc123...",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `403` | Forbidden: Admin access required |
| `404` | User not found |

---

### Update User (Admin)

**PUT** `/api/admin/users/:id`

**Access:** Private/Admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Request Body (all fields optional):**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "newpassword123",
  "role": "admin"
}
```

**Success Response — `200 OK`:**

```json
{
  "_id": "64abc123...",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "admin"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `403` | Forbidden: Admin access required |
| `404` | User not found |

---

### Delete User (Admin)

**DELETE** `/api/admin/users/:id`

**Access:** Private/Admin

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | MongoDB ObjectId of the user |

**Success Response — `200 OK`:**

```json
{
  "message": "User deleted successfully"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `403` | Forbidden: Admin access required |
| `404` | User not found |

---

### Create Admin Account

**POST** `/api/admin/create`

**Access:** Private/Admin

**Request Body:**

```json
{
  "name": "Super Admin",
  "email": "superadmin@example.com",
  "password": "adminpassword123"
}
```

**Success Response — `201 Created`:**

```json
{
  "_id": "64xyz789...",
  "name": "Super Admin",
  "email": "superadmin@example.com",
  "role": "admin",
  "token": "<jwt_token>"
}
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `400` | Please provide name, email, and password |
| `401` | Not authorized, no token |
| `403` | Forbidden: Admin access required |
| `409` | User with this email already exists |

---

### Get All Admins

**GET** `/api/admin/all`

**Access:** Private/Admin

**Success Response — `200 OK`:**

```json
[
  {
    "_id": "64xyz789...",
    "name": "Super Admin",
    "email": "superadmin@example.com",
    "role": "admin",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Error Responses:**
| Status | Message |
|--------|---------|
| `401` | Not authorized, no token |
| `403` | Forbidden: Admin access required |

---

## Attendance & Fines (Admin)

> All attendance routes require a valid JWT token belonging to a user with `role: "admin"`.

### Mark / Update Weekly Attendance

**POST** `/api/admin/attendance`

**Access:** Private/Admin

**Request Body:**

```json
{
  "attendanceDate": "2026-03-16T10:00:00.000Z",
  "weekStartDay": 0,
  "records": [
    {
      "userId": "64abc123...",
      "status": "present",
      "note": ""
    },
    {
      "userId": "64def456...",
      "status": "absent",
      "note": "Unreachable"
    }
  ]
}
```

**Success Response — `200 OK`:**

```json
{
  "message": "Attendance marked successfully",
  "weekStart": "2026-03-15T00:00:00.000Z"
}
```

---

### Get Attendance by Date (Weekly)

**GET** `/api/admin/attendance?date=2026-03-16&weekStartDay=0`

**Access:** Private/Admin

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | Date string | Yes | Any date within the week you want to fetch |
| `weekStartDay` | Integer | No | `0` = Sunday, `1` = Monday. Default `0` |

**Success Response — `200 OK`:**

```json
{
  "weekStart": "2026-03-15T00:00:00.000Z",
  "records": [
    {
      "_id": "64xyz...",
      "user": {
        "_id": "64abc123...",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "weekStartDate": "2026-03-15T00:00:00.000Z",
      "attendanceDate": "2026-03-16T10:00:00.000Z",
      "status": "present",
      "note": ""
    }
  ]
}
```

---

### Get Monthly Attendance & Fine Summary

**GET** `/api/admin/attendance/monthly?month=3&year=2026`

**Access:** Private/Admin

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | Integer | Yes | Month number (1-12) |
| `year` | Integer | Yes | Full year (e.g., 2026) |

**Success Response — `200 OK`:**

```json
{
  "month": 3,
  "year": 2026,
  "summary": [
    {
      "userId": "64abc123...",
      "name": "John Doe",
      "email": "john@example.com",
      "totalWeeks": 4,
      "present": 3,
      "absent": 1,
      "late": 0,
      "leave": 0,
      "fineOwed": 20,
      "totalPaid": 0,
      "balance": 20
    }
  ]
}
```

---

### Download Monthly Attendance CSV

**GET** `/api/admin/attendance/download?month=3&year=2026`

**Access:** Private/Admin

**Returns:** A `.csv` file attachment containing the month's summary and fine calculations for all users.

---

### Record Fine Payment

**POST** `/api/admin/attendance/fine/payment`

**Access:** Private/Admin

**Request Body:**

```json
{
  "userId": "64abc123...",
  "amount": 20,
  "month": 3,
  "year": 2026,
  "paidOn": "2026-03-20T14:30:00.000Z",
  "note": "Paid in cash"
}
```

**Success Response — `201 Created`:**

```json
{
  "message": "Fine payment recorded",
  "payment": {
    "_id": "64ghi...",
    "user": "64abc123...",
    "amount": 20,
    "month": 3,
    ...
  }
}
```

---

### Get User Fine Report

**GET** `/api/admin/attendance/fine/:userId?month=3&year=2026`

**Access:** Private/Admin

**Success Response — `200 OK`:**

```json
{
  "userId": "64abc123...",
  "name": "John Doe",
  "email": "john@example.com",
  "month": 3,
  "year": 2026,
  "totalWeeks": 4,
  "present": 3,
  "absent": 1,
  "late": 0,
  "leave": 0,
  "fineOwed": 20,
  "totalPaid": 20,
  "balance": 0,
  "payments": [
    {
      "_id": "64ghi...",
      "amount": 20,
      "paidOn": "2026-03-20T14:30:00.000Z"
    }
  ]
}
```

---

## Data Models

### User

| Field       | Type                           | Required                  | Default  |
| ----------- | ------------------------------ | ------------------------- | -------- |
| `_id`       | ObjectId                       | Auto                      | —        |
| `name`      | String                         | Yes                       | —        |
| `email`     | String                         | Yes (unique)              | —        |
| `password`  | String                         | Yes (min 6 chars, hidden) | —        |
| `role`      | String (`"user"` \| `"admin"`) | No                        | `"user"` |
| `createdAt` | Date                           | Auto                      | —        |
| `updatedAt` | Date                           | Auto                      | —        |

### Attendance

| Field       | Type                           | Required                  | Notes  |
| ----------- | ------------------------------ | ------------------------- | -------- |
| `_id`       | ObjectId                       | Auto                      | —        |
| `user`      | ObjectId (ref: User)           | Yes                       | Member marked |
| `weekStartDate`| Date                        | Yes                       | Standardized to start of week |
| `attendanceDate`| Date                       | Yes                       | Actual day admin took attendance |
| `status`    | String                         | Yes                       | `"present"`, `"absent"`, `"late"`, `"leave"` |
| `markedBy`  | ObjectId (ref: User)           | No                        | Admin who marked |
| `note`      | String                         | No                        | —        |

_Includes a compound unique index on `{ user, weekStartDate }`._

### FinePayment

| Field       | Type                           | Required                  | Notes  |
| ----------- | ------------------------------ | ------------------------- | -------- |
| `_id`       | ObjectId                       | Auto                      | —        |
| `user`      | ObjectId (ref: User)           | Yes                       | Member paying |
| `amount`    | Number                         | Yes (min: 1)              | Amount in ₹ |
| `month`     | Number                         | Yes                       | 1-12 |
| `year`      | Number                         | Yes                       | — |
| `paidOn`    | Date                           | Auto                      | Date of payment |
| `recordedBy`| ObjectId (ref: User)           | No                        | Admin who recorded |
| `note`      | String                         | No                        | —        |

---

## Error Response Format

All error responses follow this structure:

```json
{
  "message": "Error description here"
}
```

---

## Health Check

**GET** `/`

**Access:** Public

**Success Response — `200 OK`:**

```json
{
  "message": "User Management API is running"
}
```
