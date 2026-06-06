# Rex Auction Server

A high-performance, production-ready Node.js & Express API featuring strict **TypeScript** verification, **Prisma ORM (PostgreSQL)** database integration, and a secure **MVC Architecture** with cookie-based JWT Session Authentication.

---

## 🚀 Key Features

*   **Premium MVC Architecture**: Modular design separating routers, controllers, services, DTOs, and schema configurations.
*   **Secure Session Authentication**: Dual-token strategy with rotating HTTP-only, secure, sameSite cookies to protect against XSS and CSRF attacks.
*   **Prisma ORM & NeonDB**: Fully typed PostgreSQL integration using Prisma Client with fast, index-optimized database queries.
*   **Robust DTO Validation**: Unified request body validation utilizing strict Joi schemas inside a reusable validation middleware.
*   **Global Exception & Error Handling**: Standardized error response layout with built-in Prisma error parsing (unique constraints, not found records, validation issues).
*   **Security First**: Protected with `helmet` headers, strict CORS origins, `hpp` parameter pollution prevention, and `express-rate-limit` rate limiters.
*   **Self-documenting API Specs**: Integrated interactive **Swagger UI** containing schema validation models, security requirements, and custom responses.

---

## 🛠️ Technology Stack

*   **Runtime & Server**: Node.js, Express.js (v5), TSX (TypeScript Execute)
*   **Programming Language**: TypeScript
*   **Database & ORM**: PostgreSQL, Prisma Client
*   **Security & Auth**: jsonwebtoken, bcryptjs, cookie-parser, helmet, cors, hpp, express-rate-limit
*   **Validation & Docs**: Joi, swagger-ui-express, swagger-jsdoc
*   **Logger**: Winston (customized transport system)

---

## 📁 Project Structure

```text
rex-auction-server/
├── prisma/
│   └── schema.prisma          # Database schema models (PostgreSQL)
├── src/
│   ├── app/
│   │   ├── common/            # Shared features, helpers, and utilities
│   │   │   ├── constants/     # HTTP Status codes, System response messages
│   │   │   ├── exceptions/    # Global error handlers, XSS sanitizers, custom operational errors
│   │   │   ├── guards/        # Authentication & Role restrictions, DTO validation middlewares
│   │   │   ├── interceptors/  # Success/Error payload formatters
│   │   │   └── utils/         # JWT helpers, secure cookie response utils, Winston logger instance
│   │   └── modules/           # Domain-driven features
│   │       ├── auth/          # Core Authentication module
│   │       │   ├── doc/       # Swagger specifications for Auth paths
│   │       │   ├── dto/       # Joi request validation schemas (login, register)
│   │       │   ├── interfaces/# Types & interfaces for user payload mapping
│   │       │   ├── auth.controller.ts
│   │       │   ├── auth.routes.ts
│   │       │   └── auth.service.ts
│   │       └── users/         # User module (interfaces, extensions)
│   ├── config/                # App-level configs (database, env, swagger)
│   ├── types/                 # Custom global TypeScript declaration files
│   ├── app.ts                 # Express Application bootstrapping & middleware pipelines
│   └── main.ts                # Server entry point, database connection, graceful shutdown handling
├── .env                       # Environment secrets and variable mappings
├── package.json               # Package dependencies and scripts
└── tsconfig.json              # TypeScript compilation specifications
```

---

## ⚙️ Getting Started

### 1. Prerequisites
Ensure you have **Node.js (v18+)** and **npm** installed on your system.

### 2. Install Dependencies
Run the following command at the project root to install the dependencies:
```bash
npm install
```

### 3. Environment Variables Config
Create or inspect the `.env` file in the root directory. Ensure the following environment variables are correctly assigned:
```ini
PORT=5000
DATABASE_URL="your-postgresql-connection-string"
JWT_ACCESS_SECRET="your-super-secret-access-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
NODE_ENV=development
```

### 4. Database Sync
Push your local Prisma schema to synchronize it directly with your remote database:
```bash
npx prisma db push
```

### 5. Running the Application
*   **Development mode** (with hot-reload using nodemon & tsx):
    ```bash
    npm run dev
    ```

    > [!TIP]
    > **Troubleshooting file watch limit (`ENOSPC: System limit for number of file watchers reached`)**:
    > If you encounter an `ENOSPC` error on Linux, it means your operating system's file watcher limit has been exceeded.
    > We have optimized the `dev` script to use a highly targeted `nodemon` command that only watches `src/**/*.ts` (reducing watcher usage significantly).
    > To permanently resolve this system-wide on Linux, run:
    > ```bash
    > echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
    > ```
*   **Production Build & Run**:
    ```bash
    npm run build
    npm start
    ```

---

## 🔒 Authentication Flow & Cookie Mechanics

The server implements a state-of-the-art authentication mechanism supporting both **Local Login** and **Google OAuth**. For full details, see the dedicated [**Authentication System Documentation**](./AUTH.md).

1.  **Dual Authentication Providers**:
    *   **Local Auth**: Standard encrypted Email/Password registration and login.
    *   **Google OAuth**: Seamless one-click login using `passport-google-oauth20` that dynamically links or creates user accounts.
2.  **JWT & HTTP-Only Cookies**:
    *   `accessToken` and `refreshToken` are set in the response headers as `HttpOnly`, `Secure` (in production), and `SameSite=Lax` cookies.
    *   This completely blocks frontend JavaScript from accessing the tokens, eliminating modern XSS theft vectors.
3.  **Authentication Middleware (`protect`)**:
    *   Automatically parses incoming cookies or `Authorization: Bearer <token>` headers.
    *   Validates the integrity of the JWT.
    *   Fetches the active user state from the database and attaches it to the Express request object (`req.user`).
4.  **Token Rotation (`/refresh-token`)**:
    *   When the `accessToken` expires, the client calls `/refresh-token`.
    *   The server verifies the rotating `refreshToken` against the database record, revokes old tokens, updates the database session with a new refresh token, and drops new, rotated cookies onto the client.
5.  **Logout**:
    *   The server invalidates the stored database session (`refreshToken` is set to `null`) and clears both cookies in the client browser.

---

## 📡 API Endpoints & Swagger Documentation

### Swagger UI API Explorer
Once the server is running, the interactive Swagger UI is available at:
👉 **[http://localhost:5000/api/docs](http://localhost:5000/api/docs)**

---

### Core Auth Endpoints

| Endpoint | HTTP Method | Auth Required | Description | Request Body / Cookies |
| :--- | :---: | :---: | :--- | :--- |
| **/auth/register** | `POST` | ❌ No | Creates a new user account, registers them in PostgreSQL, and generates access and refresh tokens. | **Body**: `{ name, email, password }`<br>**Sets Cookies**: `accessToken`, `refreshToken` |
| **/auth/login** | `POST` | ❌ No | Authenticates user credentials. Returns the sanitized user profile. | **Body**: `{ email, password }`<br>**Sets Cookies**: `accessToken`, `refreshToken` |
| **/auth/google** | `GET` | ❌ No | Initiates the Google OAuth consent flow. | **Redirects** to Google |
| **/auth/google/callback** | `GET` | ❌ No | Google OAuth callback URL. Generates/Updates user and redirect to frontend dashboard. | **Sets Cookies**: `accessToken`, `refreshToken` |
| **/auth/logout** | `POST` | 🔑 Yes | Revokes the current session refresh token in PostgreSQL and clears cookies on the client side. | **Headers**: `Authorization: Bearer <token>` OR **Cookies**: `accessToken` |
| **/auth/refresh-token** | `POST` | ❌ No | Rotates the refresh token session and issues a fresh set of authentication tokens. | **Cookies**: `refreshToken` OR **Body**: `{ refreshToken }`<br>**Sets Cookies**: `accessToken`, `refreshToken` (rotated) |
| **/auth/me** | `GET` | 🔑 Yes | Returns the profile data of the currently logged-in user. | **Headers**: `Authorization: Bearer <token>` OR **Cookies**: `accessToken` |

---

## 🎨 Unified API Response Schemas

### Success Structure
```json
{
  "success": true,
  "message": "Logged in successfully",
  "data": {
    "user": {
      "id": "ckv1abcde0000xxxx",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "role": "user",
      "isActive": true,
      "createdAt": "2026-05-21T03:45:00.000Z",
      "updatedAt": "2026-05-21T03:45:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Error Structure
```json
{
  "success": false,
  "message": "An account with this email already exists"
}
```

---

## 🛡️ License

This project is licensed under the ISC License.
