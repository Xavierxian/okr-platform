# OKR Management Platform (OKR 管理平台)

## Overview

This is an OKR (Objectives and Key Results) management platform built as a cross-platform mobile/web application using Expo (React Native). The app allows users to create and manage organizational objectives, define key results, track progress, and self-score outcomes. The UI is in Chinese with a light blue-white-gray theme (#2563EB primary, #F1F5F9 background, #FFFFFF cards).

The project uses a dual architecture: an Expo/React Native frontend with file-based routing (expo-router) and an Express.js backend server with PostgreSQL via Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Expo SDK 54 with React Native 0.81, targeting iOS, Android, and Web
- **Routing**: expo-router v6 with file-based routing under the `app/` directory
- **Navigation Structure**: 
  - Tab-based layout with 4 tabs: Dashboard (仪表盘), OKR list, Analytics (分析), Profile (我的)
  - Modal screens for creating objectives, creating key results, updating progress, scoring, user/department management
  - Detail screen for individual objectives at `objective/[id]`
  - Login screen shown via AuthGate when not authenticated
- **State Management**: 
  - `AuthProvider` (`lib/auth-context.tsx`) manages authentication state (login/logout/session)
  - `OKRProvider` (`lib/okr-context.tsx`) manages all OKR data via API calls, resets on user change
- **Data Fetching**: `apiRequest` from `lib/query-client.ts` for all API calls with credentials: "include" for session cookies
- **Styling**: Dark theme with custom color constants (`constants/colors.ts`), using StyleSheet API
- **Animations**: react-native-reanimated for entry animations (FadeInDown)
- **Fonts**: Inter font family via `@expo-google-fonts/inter`
- **Haptics**: expo-haptics for tactile feedback

### Backend Architecture
- **Framework**: Express.js v5 running on Node.js
- **Server Entry**: `server/index.ts`
- **Routes**: `server/routes.ts` — full CRUD APIs for auth, departments, objectives, key results, users
- **Storage Layer**: `server/storage.ts` — Drizzle ORM with PostgreSQL, full CRUD operations with department-based filtering
- **Auth**: Session-based with `express-session` + `connect-pg-simple` (PostgreSQL session store)
- **Build**: Server bundled with esbuild for production (`server_dist/`), CJS format

### Authentication & Authorization
- **Session-based auth**: express-session with PostgreSQL session store
- **Default super admin**: username=`admin`, password=`admin123`, displayName=`超级管理员`
- **Roles**: `super_admin` (full access), `dept_admin` (department admin), `member` (department-scoped)
- **Middleware**: `requireAuth` for all protected routes, `requireAdmin` for admin-only routes
- **Department scoping**: Non-admin users can only create objectives for their own department; server validates department ownership

### Data Layer
- **Database**: PostgreSQL via Drizzle ORM (`shared/schema.ts`)
- **Tables**: `users`, `departments`, `cycles`, `objectives` (with isCollaborative, collaborativeDeptIds), `key_results` (with progressHistory JSONB, collaboratorId, collaboratorName)
- **Default departments**: 技术部, 产品部, 设计部, 市场部, 运营部, 人力资源部
- **Default cycles**: Auto-seeded with current year's 4 quarters + 年度
- **Schema Validation**: drizzle-zod for generating Zod schemas

### Key Data Models
- **Department**: id, name, parentId, level (hierarchical)
- **Objective**: id, title, description, departmentId, cycle, status, isCollaborative, collaborativeDeptIds, collaborativeUserIds, createdBy, linkedToParent (boolean), okrType (text: '承诺型'|'挑战型')
- **KeyResult**: id, objectiveId, title, description, assigneeId, assigneeName, collaboratorId, collaboratorName, startDate, endDate, progress, weight, status, selfScore, selfScoreNote, progressHistory, okrType (text: '承诺型'|'挑战型')
- **User**: id, username, password (hashed), displayName, role, departmentId

### Dashboard Structure (3 Sections)
1. **我的目标** — Objectives created by the user or belonging to user's department
2. **本部门协同 KR** — KRs where the user is assigned as the executor (assigneeId). User can update progress, add notes, and self-evaluate.
3. **跨部门协同 KR** — KRs where the user is set as the cross-department collaborator (collaboratorId). View-only: user can see progress and notes but cannot modify.

### KR Collaboration Model
- **Assignee (执行人)**: Single-select from same-department users only. Shown with radio buttons.
- **Collaborator (跨部门协同人)**: Single-select from other-department users only. Shown with radio buttons in blue/info color.
- Both are optional when creating a KR.

### Excel Import (Enhanced Batch Import)
- Template format: .xlsx (Excel) — download via GET /api/import/template
- Upload endpoint: POST /api/import/parse-excel (binary body, server-side xlsx parsing)
- Template columns (ordered): 部门, 目标名称, KR名称, 执行人, 周期, OKR类型, 关联上级, 权重
- Two import modes: download Excel template or online editing (editable table in-app)
- Template auto-fills current cycle and user's department as defaults
- OKR类型 supports 承诺型/挑战型; 关联上级 supports 是/否
- 执行人 matches by displayName or username; unmatched names become warnings
- Department override restricted: non-admin users can only import to their own department
- Same-named objectives (same title + department + cycle) auto-merged
- Weight parsing preserves 0 values correctly
- npm package: `xlsx` for server-side Excel parsing and template generation

### Key Screens
- `app/login.tsx` — Login screen with username/password
- `app/(tabs)/index.tsx` — Dashboard with 3 sections: 我的目标, 本部门协同KR, 跨部门协同KR
- `app/(tabs)/okrs.tsx` — OKR list with department/cycle filters
- `app/(tabs)/analytics.tsx` — Enhanced analytics with cycle/dept filtering, department rankings (progress, self-eval, completion rate), AI analysis
- `app/(tabs)/profile.tsx` — User info, stats, admin management links, password change, logout
- `app/change-password.tsx` — Password change screen
- `app/objective/[id].tsx` — Objective detail with KR list showing assignee and collaborator info
- `app/create-objective.tsx` — Create objective (dept-scoped for non-admins)
- `app/create-kr.tsx` — Create key result with same-dept assignee picker and cross-dept collaborator picker
- `app/import-okr.tsx` — Enhanced batch import with CSV template or online editable table
- `app/manage-cycles.tsx` — Cycle CRUD management (admin only)
- `app/update-progress.tsx` — Update KR progress
- `app/score-kr.tsx` — Self-score KR
- `app/manage-departments.tsx` — Department CRUD (admin only)
- `app/manage-users.tsx` — User list and management (admin only)
- `app/create-department.tsx` — Create new department
- `app/create-user.tsx` — Create new user with role/department assignment

### API Endpoints
- `GET /api/key-results/assigned-to-me` — KRs where current user is assignee (returns {kr, objective} pairs)
- `GET /api/key-results/collaborating` — KRs where current user is collaborator (returns {kr, objective} pairs)
- `PUT /api/auth/change-password` — Change password (requires currentPassword, newPassword)
- `GET /api/analytics/department-rankings?cycle=` — Department rankings with progress, score, completion rate
- `POST /api/analytics/ai-analysis` — AI-powered OKR analysis (requires cycle, optional departmentId)
- Standard CRUD endpoints for objectives, key-results, departments, users

### Build & Development
- **Development**: Two workflows — `Start Frontend` (Expo on port 8081) and `Start Backend` (Express on port 5000)
- **Production**: Static web build + esbuild server bundle
- **Database Migrations**: `npm run db:push` uses drizzle-kit to push schema

## External Dependencies

- **PostgreSQL**: Database configured via `DATABASE_URL`, managed through Drizzle ORM
- **Expo Services**: Various Expo SDK modules (haptics, safe-area, etc.)
- **Replit Environment**: CORS setup references Replit domains; EXPO_PUBLIC_DOMAIN injected at build time
