# OKR Management Platform (OKR 管理平台)

## Overview

This is an OKR (Objectives and Key Results) management platform built as a cross-platform mobile/web application using Expo (React Native). The app allows users to create and manage organizational objectives, define key results, track progress, and self-score outcomes. The UI is in Chinese, targeting Chinese-speaking users.

The project follows a dual architecture: an Expo/React Native frontend with file-based routing (expo-router) and an Express.js backend server. Currently, the app stores OKR data locally using AsyncStorage on the client side, with a PostgreSQL database schema defined via Drizzle ORM that is not yet fully integrated into the OKR workflow.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Expo SDK 54 with React Native 0.81, targeting iOS, Android, and Web
- **Routing**: expo-router v6 with file-based routing under the `app/` directory
- **Navigation Structure**: 
  - Tab-based layout with 4 tabs: Dashboard (仪表盘), OKR list, Analytics (分析), Profile (我的)
  - Modal screens for creating objectives, creating key results, updating progress, and scoring
  - Detail screen for individual objectives at `objective/[id]`
- **State Management**: React Context (`OKRProvider` in `lib/okr-context.tsx`) manages all OKR state (departments, objectives, key results) with local AsyncStorage persistence
- **Data Fetching**: `@tanstack/react-query` is set up with an API client (`lib/query-client.ts`) but is not currently used for OKR data — OKR data flows through the context/AsyncStorage layer
- **Styling**: Dark theme with custom color constants (`constants/colors.ts`), using StyleSheet API directly (no styling library)
- **Animations**: react-native-reanimated for entry animations (FadeInDown)
- **Fonts**: Inter font family via `@expo-google-fonts/inter`
- **Haptics**: expo-haptics for tactile feedback on save actions

### Backend Architecture
- **Framework**: Express.js v5 running on Node.js
- **Server Entry**: `server/index.ts` — handles CORS for Replit domains and localhost, serves static builds in production
- **Routes**: `server/routes.ts` — currently a skeleton with no API routes defined
- **Storage Layer**: `server/storage.ts` — in-memory storage (`MemStorage`) implementing a user CRUD interface; not yet connected to OKR operations
- **Build**: Server is bundled with esbuild for production (`server_dist/`)

### Data Layer
- **Client-side Storage**: AsyncStorage (`lib/storage.ts`) stores departments, objectives, and key results as JSON. Includes seed data for departments. All CRUD operations happen client-side.
- **Database Schema**: Drizzle ORM with PostgreSQL (`shared/schema.ts`) — currently only defines a `users` table. The OKR entities (objectives, key results, departments) are NOT yet in the database schema.
- **Schema Validation**: drizzle-zod for generating Zod schemas from Drizzle table definitions
- **Migration**: Drizzle Kit configured to push schema to PostgreSQL via `DATABASE_URL` environment variable

### Key Data Models (Client-side)
- **Department**: id, name, parentId, level (hierarchical organization structure)
- **Objective**: id, title, description, departmentId, cycle (e.g., "2025-Q1"), parentObjectiveId, status (draft/active/completed/archived)
- **KeyResult**: id, objectiveId, title, description, assignee, startDate, endDate, progress (0-100), weight, status (normal/behind/completed/overdue/paused), selfScore (0-1 scale), progressHistory

### Build & Development
- **Development**: Two processes — `expo:dev` for the Expo bundler and `server:dev` for the Express server (via tsx)
- **Production**: Static web build via custom `scripts/build.js` (builds iOS/Android bundles + Expo web export to `static-build/web/`), server bundle via esbuild. The server detects `static-build/web/index.html` and serves the web app directly to browsers instead of the Expo Go landing page.
- **Database Migrations**: `npm run db:push` uses drizzle-kit to push schema

### Important Architectural Gap
The OKR data currently lives entirely in client-side AsyncStorage. The Express server and PostgreSQL database are set up but not wired to serve OKR data. To make this a proper multi-user application, the OKR models need to be added to the Drizzle schema, API routes need to be created in `server/routes.ts`, and the client needs to switch from AsyncStorage to API calls.

## External Dependencies

- **PostgreSQL**: Database configured via `DATABASE_URL` environment variable, managed through Drizzle ORM. Currently only has a users table.
- **Expo Services**: Uses various Expo SDK modules (haptics, image picker, location, crypto, etc.)
- **Replit Environment**: The app is designed to run on Replit — CORS setup references `REPLIT_DEV_DOMAIN` and `REPLIT_DOMAINS`, and the build script checks `REPLIT_INTERNAL_APP_DOMAIN`
- **No external auth service**: No authentication is currently implemented beyond a basic user schema
- **No external APIs**: The app is self-contained with no third-party API integrations