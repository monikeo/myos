# 🌌 MyOS — Open Source Personal Operating System Workspace

<div align="center">
  <img src="/logo.svg" alt="MyOS Logo" width="120" height="120" style="filter: drop-shadow(0px 0px 20px rgba(59, 130, 246, 0.35));" />
  <h3>Unified Desktop Workspace, Dynamic RBAC, and High-Performance Productivity Core</h3>
  <p><strong>Designed & Engineered by KEO MONI</strong></p>
  <p>
    <a href="https://github.com/monikeo">
      <img src="https://img.shields.io/badge/GitHub-monikeo-blue?style=for-the-badge&logo=github" alt="GitHub Profile" />
    </a>
    <img src="https://img.shields.io/badge/CamTech-Cyber_Security-emerald?style=for-the-badge" alt="CamTech Student" />
  </p>
</div>

---

## 🌟 Purpose and Vision

**MyOS** is a premium, open-source, private personal operating system workspace custom-engineered for high-performance builders, researchers, and engineers. Modern workflows are often fragmented across dozens of discrete cloud web applications, leading to data silos, distraction, and credential leakage. MyOS consolidates your entire digital ecosystem into a single unified desktop-like dashboard.

Unlike generic layout builders, MyOS features strict **Role-Based Access Control (RBAC)**, multi-tenant organization boundaries, dynamic database checks, sandboxed files databases, and universal client telemetry catchers. Powered by a React 18 frontend, a lightweight Express.js backend, and a robust Supabase database, MyOS is designed for absolute data sovereignty, speed, and premium user experiences.

---

## 🏗️ Core Architectural Features

### 1. Advanced Collaboration & Scope Isolation
* **Multi-Tenant Organization Management**: Instantly provision isolated enterprise partitions. Each organization features distinct domain validation, dynamic workspace pools, and custom branding profiles.
* **Strict Scope-Based RBAC**: Permissions are evaluated dynamically at multiple layers (`Organization ➔ Workspace ➔ Project ➔ Task`). Guest accounts are fully isolated, blocking global database visibility and settings access.
* **Anti-Escalation Gateways**: Backend authorization checks prevent Privilege Escalation, IDOR, and payload injections at the network controller level.

### 2. Connected File Vault & Connection Locks
* **Decoupled Cloud Media Vault**: Mapped PostgreSQL databases keep light index pointers while streaming large file storage securely to sandboxed **Google Drive API v3** repositories, preventing Postgres size bloat.
* **Dynamic Connection locks**: If Google Drive integrations are unconnected, the File Vault page dynamically triggers a highly polished glassmorphic **Vault Locked Overlay**, preventing upload exploits and providing quick redirects to configurations.

### 3. Integrated Premium Productivity Suite
* **Interactive Dashboard**: Modular widget blocks providing quick system telemetry, activity graphs, pending task counts, and financial transaction matrices.
* **Finance Ledger**: Double-entry ledger monitoring income and expenses with real-time categorizations and balance gauges.
* **Frictionless Notes Engine**: Rapid-access notepad supporting Markdown parsing, pinning, and workspace categorization.
* **Task & Project Board**: Kanban-ready trackers with priority statuses, custom categories, tags, and progress bounds.
* **High-Fidelity Calendar**: High-performance scheduling tool mapping deadlines, milestones, and system events.

### 4. Client Telemetry & Diagnostic Catchers
* **React System Error Boundary**: Catches frontend rendering exceptions, runs instant environmental diagnostic checks (local storage tests, core server pinging), and supports hot-patches and one-click diagnostic report downloads.
* **Automated Exception Toasts**: Global window interceptors listen for runtime script errors or unhandled Promise rejections, displaying them instantly as user-friendly notifications.

---

## 🛠️ Complete Technical Documents

For specialized engineering blueprints, review our comprehensive sub-system matrices:
1. **[TECHSTACK.md](file:///c:/Users/darkm/OneDrive/Desktop/KEO%20MONI/myos---personal-operating-system/TECHSTACK.md)**: Deep dive into the client-server library registry, HSL design styles, esbuild server compilers, and error resiliency models.
2. **[DATABASE.md](file:///c:/Users/darkm/OneDrive/Desktop/KEO%20MONI/myos---personal-operating-system/DATABASE.md)**: Physical entity relationship diagrams (ERD), complete PostgreSQL DDL schema scripts (`database.sql`), performance-tuning GIN index specifications, and high-velocity RBAC query lookups.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js** (v18.x or higher)
* **npm** (Node Package Manager)

### 1. Repository Setup & Dependency Installation
Clone the source code repository and install the modules:
```bash
git clone https://github.com/monikeo/myos.git
cd myos
npm install
```

### 2. Environment Configuration
Create a `.env` configuration file in the root directory (based on `.env.example`) and fill in your Supabase variables:
```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Migration Deployment
Run the migration setup utility to instantly seed and deploy the PostgreSQL schema inside your Supabase project:
```bash
npm run migrate
```

### 4. Run Development Workspace
Start the hot-reloading development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) inside your web browser.

### 5. Compile & Launch for Production
Compile the client bundle via Vite and package the backend via esbuild:
```bash
npm run build
npm start
```

---

## 🧑‍💻 Creator Profile & Portfolio

MyOS is designed, engineered, and maintained by **KEO MONI**:

* 🎓 **Academic**: Cyber Security Student at **CamTech University**. Specializing in secure software architectures, cryptographic isolation, penetration testing, and infrastructure engineering.
* 🚀 **Founder of Gravzero**: An innovative cybersecurity and technology initiative focusing on robust development, security audits, and private digital workspaces.
* 🥋 **Founder of Infinity Taekwondo**: Blending discipline, martial arts, and high-performance focus to foster leadership, focus, and structural excellence.
* 🌐 **GitHub**: [github.com/monikeo](https://github.com/monikeo)

---

## 📂 Codebase Structure

```
├── components/          # Base atomic UI components (button, input, card)
├── lib/
│   ├── api.ts           # Centralized API network transport calls
│   └── utils.ts         # HSL color resolution and dynamic image utilities
├── src/
│   ├── components/      # Main views (Calendar, Finance, Settings, FileVault, Notes)
│   ├── App.tsx          # Main entry, global error capture hooks, unified event navigator
│   ├── types.ts         # Strict TypeScript interfaces and state types
│   └── index.css        # Vanilla CSS HSL tokens, scrollbar modifications, glassmorphism
├── server.ts            # High-security Node.js + Express backend & RBAC middleware
├── public/              # Brand icons, logo.svg, logo.png, and static system media
├── migrate.ts           # Database migration runner
├── package.json         # Compile commands and dependency lists
└── tsconfig.json        # TypeScript configuration settings
```

---

## 🤝 Contribution & License

Contributions, security code audits, and pull requests are welcomed. Feel free to open issues or submit custom workspace extensions.

This software is open-source and licensed under the **MIT License**. Feel free to fork, customize, and build your own personal ecosystem!
