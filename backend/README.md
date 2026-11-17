# PALMLOCK Backend — Security Operations & Emergency Assistance API

Node.js, Express, MongoDB (Mongoose), and Socket.IO backend service for PALMLOCK: an accessibility-focused QR payment security and emergency assistance web platform for visually impaired individuals.

---

## 1. System Architecture

```
PALMLOCK Full-Stack Topology
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Mobile User Application     │       │     Desktop Admin Dashboard     │
│       frontend/index.html       │       │       frontend/admin.html       │
│  (IndexedDB Offline Resilient)  │       │     (Live WebSockets SOC)       │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 │ HTTP / REST / WebSockets                │ HTTP / REST / WebSockets
                 ▼                                         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│              PALMLOCK Backend Service (Node.js & Express)                 │
│  - Port: 5000 (Default)                                                   │
│  - Security: Helmet, CORS (Credentials), CookieParser, Express Rate-Limit │
│  - Authentication: JWT in HttpOnly Cookie / Authorization Bearer Header   │
│  - Real-time: Socket.IO (Authenticated, room:admins, room:user:<id>)      │
│  - SLA Engine: Persistent 5m/10m Escalation Scheduler (Restart-Safe)      │
│  - SMS/OTP Gateway: Simulated Telemetry Dispatch to +91 Contacts          │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │  MongoDB Database Cluster │
                        │  (Atlas or Local Mongoose)│
                        │  Collections: Users,      │
                        │  Alerts, TrustedContacts, │
                        │  Transactions, Merchants, │
                        │  PaymentRequests, AuditLog│
                        └───────────────────────────┘
```

---

## 2. Security Protocols & Cryptography

1. **Salted Bcrypt Hashing**: Passwords and PIN codes are hashed using individual random salts via `bcryptjs`. Hashes are never returned in responses (`select: false` on Mongoose models).
2. **Standard PIN vs. Duress PIN**:
   - **Standard PIN (`2520` by default)**: Up (2) -> Right (5) -> Up (2) -> Single Tap (0). Verifies user and authorizes payment.
   - **Duress PIN (`7744` by default)**: Down (7) -> Down (7) -> Left (4) -> Left (4). Discreetly intercepted:
     - Dispatches live incident to Admin SOC via WebSockets (`incident:created`).
     - Logs simulated SMS dispatch to trusted guardians.
     - Intercepts funds (no balance deducted).
     - Returns **HTTP 504 Gateway Timeout** with covert error payload mimicking banking failure so perpetrators suspect nothing.
3. **Brute-Force Protection & Progressive Locks**:
   - Strict rate limiter on `/api/pin/verify` (10 requests/min).
   - After 3 consecutive incorrect PIN entries: 2-minute account lock.
   - After 5 consecutive incorrect PIN entries: 15-minute lock.
4. **Role-Based Authorization**:
   - Public registration strictly creates `role: 'user'`.
   - Admin accounts are created securely through the administrative seed script.
5. **Restart-Safe 5m/10m Escalation SLA**:
   - Evaluates incident timestamps directly from the database.
   - 0 min: Tier 1 emergency (Primary guardian notified, live SOC telemetry).
   - 5 min: Tier 2 emergency (Secondary guardians notified if unacknowledged/unresolved).
   - 10 min: Tier 3 critical emergency (Operator action required, audio siren broadcast).

---

## 3. API Endpoints Reference

### Health & Telemetry
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service uptime, database connectivity state (`connected`, `disconnected`, `pending_credentials`). |

### Authentication & Profiles
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user. Sets salted password and standard/duress PINs. |
| `POST` | `/api/auth/login` | Email/password login. Issues JWT stored in HttpOnly cookie or bearer token. |
| `POST` | `/api/auth/logout` | Clears authentication token. |
| `GET` | `/api/auth/me` | Returns current user profile (never returns hashes). |

### Tactile PIN & Covert Duress
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/pin/setup` | Configure standard and duress PINs (validates that both cannot be identical). |
| `POST` | `/api/pin/verify` | Verifies PIN sequence. Standard returns 200; Duress triggers covert emergency and returns HTTP 504 Timeout. |

### Emergency Contacts & OTP
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/contacts` | Retrieve trusted contacts for user. |
| `POST` | `/api/contacts` | Add new emergency contact. Dispatches simulated OTP. |
| `PATCH` | `/api/contacts/:id` | Update contact information. |
| `DELETE` | `/api/contacts/:id` | Remove trusted contact. |
| `POST` | `/api/contacts/verify` | Verify contact phone number with OTP (Demo bypass: `123456`). |

### Merchants & Payments
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/merchants` | List verified Indian merchants (CMRL, Nilgiris, Apollo Pharmacy, etc.). |
| `GET` | `/api/merchants/:id` | Get merchant details. |
| `POST` | `/api/merchants/verify` | Verify scanned QR code payload against certified merchants. |
| `GET` | `/api/payment-requests/:id` | Get dynamic simulated payment request in INR (₹). |

### Transactions
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/transactions/simulate` | Process payment, update balance, record in ledger, broadcast to admins. |
| `GET` | `/api/transactions/user` | Retrieve user transaction history. |
| `GET` | `/api/admin/transactions` | Admin endpoint: Search, filter (`status`, `isDuress`), and paginate all transactions. |

### Emergency Alerts & Admin SOC
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/alerts/duress` | Covert duress trigger with idempotency support. |
| `POST` | `/api/alerts/sos` | Active emergency SOS trigger from tactile UI. |
| `POST` | `/api/alerts/false-alarm` | Stand down emergency with PIN verification and incident reason. |
| `GET` | `/api/admin/alerts` | Admin endpoint: List alerts filtered by status, severity, or tier. |
| `GET` | `/api/admin/alerts/:id` | Detailed alert view with timeline and guardian delivery status. |
| `POST` | `/api/admin/alerts/:id/acknowledge` | Acknowledge alert, record operator identity. |
| `PATCH` | `/api/admin/alerts/:id/status` | Update incident status (`active`, `acknowledged`, `escalated`, `resolved`). |
| `POST` | `/api/admin/alerts/:id/notes` | Append internal operator note to timeline. |

### Audit Logging
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/audit-logs` | Immutable log of security events and administrative operations. |

---

## 4. Setup & Running

### Prerequisites
- Node.js 18+ (tested on Node v20/v22/v24)
- npm 9+

### Environment Configuration
Copy `.env.example` to `.env` inside `backend/`:
```bash
cp backend/.env.example backend/.env
```
Fill in your configuration:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/palmlock
JWT_SECRET=your_secure_random_jwt_secret_key
ADMIN_EMAIL=admin@palmlock.security
ADMIN_PASSWORD=Palmlock@Admin2026
```
> **Note on MongoDB**: If `MONGODB_URI` is unconfigured or unreachable, the server continues running gracefully with `database: pending_credentials` and full in-memory fallback support so local testing and offline evaluation never crash.

### Install Dependencies
```bash
cd backend
npm install
```

### Database Seeding
To populate MongoDB with the security admin, demo users, certified merchants, and initial telemetry:
```bash
npm run seed
```

### Start Server
```bash
# Start backend server
npm start

# Run from project root
npm run server
```

Server starts at: `http://localhost:5000`
Health check: `http://localhost:5000/api/health`

---

## 5. Automated Testing

Run the comprehensive automated test suite (includes Health, Auth, Contacts, PIN verification, Covert Duress 504 Timeout, Merchants, Transactions, Alerts, Escalation SLA, and Audit logs):

```bash
# Run backend tests only
npm --prefix backend test

# Run from project root
npm run test:backend

# Run full project test suite (Frontend + Backend)
npm run test:all
```
