# Project Context: Mango Tree IoT Monitoring Architecture

## 1. Architectural Overview
This project is a production-grade Full Stack web application designed to monitor IoT sensor data (Soil Moisture, pH, and TDS) from mango trees. The system utilizes a Backend-for-Frontend (BFF) pattern, supporting real-time data visualization, multi-device management, secure session-based authentication, and Over-The-Air (OTA) remote firmware updates for microcontrollers.

## 2. Tech Stack & Infrastructure
*   **Framework:** SvelteKit (App Router paradigm)
*   **Runtime:** Bun (Chosen for ultra-fast server-side execution, optimized package management, and high-throughput API endpoints)
*   **Database:** Supabase PostgreSQL
*   **ORM:** Prisma (Enforcing type safety and mitigating SQL injection vulnerabilities by design)
*   **Real-time Layer:** Supabase Realtime (WebSockets via `supabase-js` client)
*   **Styling:** TailwindCSS
*   **Hardware Client:** ESP32/ESP8266 (C++ Firmware)

## 3. Core Features & Implementation Rationale

### A. Custom Security & Authentication
*   **Mechanism:** Custom Session-Backed Authentication using `username` and `password` (No email verification).
*   **Rationale:** Provides absolute control over session invalidation compared to stateless JWTs.
*   **Implementation:** Passwords hashed via `bcryptjs`/`argon2`. Sessions stored in the Prisma database and managed via strict `HTTP-Only`, `Secure`, `SameSite=Lax` cookies handled in SvelteKit's `hooks.server.ts`.

### B. IoT Data Ingestion
*   **Mechanism:** HTTP POST endpoint (`/api/sensor-data`).
*   **Authentication:** Devices authenticate using static, cryptographically secure API Keys passed via the `x-api-key` HTTP header. 
*   **Rationale:** Stateless and lightweight authentication optimized for microcontrollers with limited resources. API keys are strictly one-time-view upon creation and hashed in the database.

### C. Real-Time UI (WebSockets)
*   **Mechanism:** The SvelteKit frontend subscribes directly to PostgreSQL table changes (`SensorData`) via Supabase WebSockets.
*   **Rationale:** Offloads the computational and bandwidth overhead of data polling from the Bun server, ensuring instant UI updates for the end user.

### D. OTA (Over-The-Air) Firmware Server
*   **Mechanism:** Dedicated GET endpoint (`/api/ota`).
*   **Flow:** Microcontrollers send current firmware version and MAC address via headers. The server compares this against the `Firmware` table and streams the latest `.bin` binary file from Supabase Storage if an update is available.

## 4. Data Modeling (Prisma Schema Reference)
Apply proper indexing, especially for time-series data, to prevent query bottlenecks at scale.
*   `User`: `id`, `username` (unique), `passwordHash`, `name`, `createdAt`.
*   `Session`: `id` (token string), `userId` (relation), `expiresAt`.
*   `Device`: `id`, `userId` (relation), `name`, `apiKey` (unique, indexed), `macAddress`, `firmwareVer`, `createdAt`.
*   `SensorData`: `id`, `deviceId` (relation), `moisture` (Float), `ph` (Float), `tds` (Float), `createdAt`. **Must include compound index:** `@@index([deviceId, createdAt])`.
*   `Firmware`: `id`, `version` (unique), `fileUrl`, `releaseNotes`, `createdAt`.

## 5. Design System (Mango Theme) & Localization
*   **Localization (Internal Language):** The application's user-facing language is strictly **Bahasa Indonesia**. All generated UI components, buttons, notifications, placeholders, and error messages MUST be written in natural, professional Indonesian.
*   **Primary (Ripe Mango):** `amber-400` (`#FBBF24`) - Primary Call-to-Actions and highlights.
*   **Secondary (Mango Leaves):** `green-600` (`#16A34A`) - "Healthy/Normal" status indicators and navigation.
*   **Accent (Unripe Mango):** `orange-500` (`#F97316`) - Mild warnings or accents.
*   **Background:** `stone-50` (`#FAFAF9`) - Clean off-white to reduce eye strain.
*   **Components:** Utilize large metric Cards for current states and Line Charts (e.g., Chart.js/D3) for historical time-series data.

## 6. AI Developer Directives & Coding Standards
When generating code for this project, strictly adhere to the following:
1.  **SvelteKit Conventions:** Use `+page.server.ts` for secure, server-side database interactions. Use `+page.svelte` strictly for client-side logic and UI representation. Place sensitive logic and Prisma initializations inside `$lib/server/`.
2.  **OWASP Compliance:** Never expose `passwordHash` or plain-text `apiKey` to the frontend client. Enforce strict server-side validation for all incoming IoT payloads and user inputs.
3.  **Localization Enforcement:** When creating UI elements in `+page.svelte` or generating user-facing HTTP responses/form validations, output text exclusively in **Bahasa Indonesia** (e.g., use `<button>Masuk</button>` instead of `Login`, or return `error: 'Kata sandi salah'` instead of `Invalid password`). Variable names and backend logic must remain in standard English for developer clarity.
4.  **Clean Code:** Apply DRY and SOLID principles. Write functional, type-safe TypeScript. Favor early returns to reduce nested conditions.
5.  **Performance:** Avoid heavy Node.js polyfills; leverage Bun's native, highly optimized APIs where applicable.