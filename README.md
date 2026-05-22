# MyOS — Open Source Personal Operating System Workspace

<div align="center">
  <h3>Unified Desktop Workspace, Dynamic RBAC, and High-Performance Productivity Core</h3>
  <p><strong>Developed & Curated by KEO MONI</strong></p>
  <p>
    <a href="https://github.com/monikeo">
      <img src="https://img.shields.io/badge/GitHub-monikeo-blue?style=for-the-badge&logo=github" alt="GitHub Profile" />
    </a>
    <img src="https://img.shields.io/badge/CamTech-Cyber_Security-emerald?style=for-the-badge" alt="CamTech Student" />
  </p>
</div>

---

## 🌟 Purpose and Vision

**MyOS** is an open-source, private, personal operating system dashboard designed for high-performance builders, engineers, and researchers. As modern workflows grow increasingly fragmented across dozens of discrete web apps, MyOS consolidates your entire digital workspace into a unified, secure web-native dashboard.

At its core, MyOS handles multi-tenant workspace isolation using a custom, high-security **Role-Based Access Control (RBAC)** framework. Built using a Node.js + Express backend, Supabase database, and a highly polished React + Tailwind CSS client, MyOS brings structure, efficiency, and absolute data control to your personal and organizational workflows.

---

## 🛠️ Key Architectural Features

1. **Strict Container & Role Isolation**:
   * **Multi-Tenant Organization Management**: Provision custom organizations with distinct domains and branding.
   * **Custom RBAC Engine**: Granular permission validation across structural containers (Organizations ➔ Workspaces ➔ Projects ➔ Tasks).
   * **Isolated Guest Roles**: Add external collaborators as "Guests". Guests are strictly isolated—they cannot list organizational rosters, view broad settings, or access any workspace/project unless explicitly whitelisted.
   * **Anti-Escalation & IDOR Protection**: Backend-enforced write checks that prevent unauthorized role changes, resource injections, or credential leaks.

2. **Core Productivity Modules**:
   * **Calendar View**: High-fidelity scheduler to log core timeline events.
   * **Finance View**: Clean, double-entry style financial transaction ledger to monitor capital flows.
   * **File Vault**: Secure static asset storage and categorization.
   * **Notes Engine**: Frictionless notepad with markdown parsing support.
   * **Task & Project Board**: Kanban-ready item trackers with custom priority, tags, and progress bounds.
   * **Notification Center**: Real-time secure alerts with direct path-redirection to pending invitations and system events.

3. **Harmonious Premium Design**:
   * Outfitted with sleek dark-mode glassmorphism, tailored corporate-node tint gradients, and fluid micro-animations.

---

## 🧑‍💻 Creator Profile & Portfolio

MyOS is designed, developed, and maintained by **KEO MONI**:

* 🎓 **Academic**: Cyber Security Student at **CamTech University**. Specializing in secure software architectures, cryptographic isolation, penetration testing, and infrastructure engineering.
* 🚀 **Founder of Gravzero**: An innovative cybersecurity and technology initiative focusing on robust development, security audits, and private digital workspaces.
* 🥋 **Founder of Infinity Taekwondo**: Blending discipline, martial arts, and high-performance focus to foster leadership, focus, and structural excellence.

* 🌐 **GitHub**: [github.com/monikeo](https://github.com/monikeo)

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **npm** (Node Package Manager)

### 1. Repository Setup & Install
Clone the repository and install the production and development dependencies:
```bash
git clone https://github.com/monikeo/myos.git
cd myos
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory (using `.env.example` as a template) and populate your Supabase credentials:
```env
PORT=3000
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Initialize & Deploy DB Migrations
Run the database setup script to provision database schemas:
```bash
npm run migrate
```

### 4. Boot Up Development Server
Run the local dev environment:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### 5. Compiling for Production
Build both the optimized frontend assets bundle (via Vite) and bundle the server using esbuild:
```bash
npm run build
npm start
```

---

## 📂 Codebase Overview

```
├── components/          # Standard UI primitives (buttons, inputs, card layouts)
├── lib/
│   ├── api.ts           # Centralized API network transport functions 
│   └── utils.ts         # Image resolution and text layout utilities
├── src/
│   ├── components/      # Key productivity views (Calendar, Finance, Workspaces, Settings)
│   ├── App.tsx          # Router, session state management, and page layout loader
│   ├── types.ts         # Strong TypeScript type bindings for application items
│   └── index.css        # Core custom tailwind declarations and glassmorphic utilities
├── server.ts            # Node.js + Express backend hosting the RBAC filter engine
├── package.json         # Build pipeline dependencies and commands
└── tsconfig.json        # TypeScript configuration settings
```

---

## 🤝 Contribution & License

Contributions, audits, and custom component proposals are highly appreciated. Feel free to open issues or submit pull requests directly to the repository.

This project is open-source and licensed under the MIT License. Feel free to use, modify, and build upon it!
