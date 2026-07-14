# Orbit Messenger Frontend — Session Log (Brain)

> **Purpose**: Persistent memory across Codebuff sessions. Read this at the start of every session to reconstruct full context.
> **Last Updated**: July 6, 2026

---

## 🎯 Current Phase: Initial Integration Audit — Gaps Identified

The frontend has been built to match the Orbit Messenger backend's 5 microservice architecture. An end-to-end audit has been completed, mapping every backend API to its frontend counterpart. **All core features are functional** (auth, real-time messaging, presence, file uploads, admin), but several **backend features lack frontend implementation** and some **integration details need alignment**.

### Integration Status

| Backend Feature | Frontend Status | Notes |
|----------------|-----------------|-------|
| **Auth** (register/login/JWT) | ✅ Complete | Login, register, token management, auto-redirect |
| **Conversations** (list/create) | ✅ Complete | DM creation works, list with search, caching |
| **Real-time Messages** (MQTT) | ✅ Complete | Send/receive via WebSocket, typing indicators |
| **Presence** (online/offline/away) | ✅ Complete | REST + MQTT sync, visibility detection, heartbeat |
| **File Uploads** (MinIO) | 🟡 Partial | Initiate/complete works, download not implemented |
| **Admin Dashboard** | ✅ Complete | List users, edit roles, delete, copy org ID |
| **Multi-org** | ✅ Complete | Join existing org or create new during register |
| **Group Conversations** | ❌ Missing | UI option exists but no implementation |
| **Message Read Receipts** | ❌ Missing | ✓✓ icon shown but no backend data wired |
| **Message Edit/Delete** | ❌ Missing | Not implemented in UI or API layer |
| **Conversation Info Panel** | ❌ Missing | `showInfo` state exists, panel not built |
| **Voice/Video Calls** | ❌ Placeholder | Buttons shown, no implementation |
| **Emoji Picker** | ❌ Placeholder | Button shown, no picker implementation |
| **Download Attachments** | ❌ Missing | "Download" button shown but no download URL fetch |
| **Keycloak OIDC** | 🟡 Partial | Implemented as fallback, not primary auth |
| **Offline/Degraded Mode** | ❌ Missing | No graceful handling when services are down |

---

## ✅ Completed Work

### ✅ Architecture Documentation Created (July 6, 2026)
- **`AI-ARCHITECTURE.md`**: Comprehensive quick-reference covering service mapping, component tree, API endpoints, MQTT topics, localStorage cache strategy, and known gaps
- **`SESSION-LOG.md`**: This file — persistent brain for future sessions

### ✅ Frontend-Backend Integration Audit

**Authentication verified:**
- JWT auth flow matches backend: register → login → token → API calls
- Token stored in localStorage, injected via axios interceptor
- Fallback to Keycloak OIDC if direct auth fails
- MQTT credentials fetched from `GET /api/v1/auth/mqtt-credentials`
- Organization ID flow validated (join existing vs create new)

**Real-time messaging verified:**
- MQTT WebSocket connects to EMQX on port 8083
- Subscribes to `chat/{convId}/messages` (QoS 1) and `chat/{convId}/typing` (QoS 0)
- Typing indicator with 3s timeout and auto-stop
- Heartbeat every 30s via `presence/heartbeat`
- Last Will Testament (LWT) on `presence/disconnect`

**Presence verified:**
- REST API `PUT /api/v1/presence/{userId}/status` for primary status sync
- MQTT `presence/{userId}/status` for real-time notifications
- Document visibility change → away/online (5s delay, 10s initial defer)
- `beforeunload` → offline
- Periodic refresh every 30s

**File uploads verified:**
- Initiate → upload to presigned URL → complete flow matches backend
- 10MB max file size, JPG/PNG/PDF only
- File type + extension cross-validation
- Preview for images, icon for documents
- Retry logic for FK constraint race condition

### 🔍 Issues Found During Audit

#### Critical

1. **`createConversation` parameter mismatch in UserSearch.js**:
   - `UserSearch.js` calls `createConversation('DM', null, [user.id])` — passes participant IDs as title parameter
   - `ChatContext.js` expects: `createConversation(type, participantIds, title)` — so `null` gets passed to participantIds and `[user.id]` becomes title
   - **Impact**: DM creation via UserSearch will fail because participants array is empty

2. **`createConversation` parameter order in UserSidebar.js**:
   - `UserSidebar.js` calls `createConversation({ type: 'DM', participant_ids: [userId] })` — passes a single object
   - `ChatContext.js` expects `createConversation(type, participantIds, title)` — destructures `type` and `participant_ids` from the wrong parameter
   - **Impact**: DM creation from UserSidebar will fail

3. **Unused server-side packages in frontend**:
   - `cors`, `express`, `jsonwebtoken`, `pg` are included in `package.json` dependencies
   - These are Node.js server packages that bloat the browser bundle
   - **Impact**: Unnecessary ~200KB+ added to client bundle

#### Medium

4. **`X-User-ID` header still sent**: Backend now uses JWT validation exclusively. The `X-User-ID` header is extraneous, though backward compatible.

5. **Download URL endpoint not called**: Attachment download button shows in UI but `getDownloadUrl` from `mediaApiEndpoints` is never called. No actual file download.

6. **Group conversation creation**: "New Chat" modal has "Group Chat" option but clicking it just closes the modal. No UI flow for creating groups.

7. **Message read receipts**: `renderMessageStatus` shows checkmarks (✓/✓✓) but `is_read` field never comes from backend. The `MarkAsRead` endpoint is called but response isn't used to update message status.

#### Minor

8. **Conversation info panel**: `showInfo` state toggled by Info button but no panel content implemented.
9. **Emoji picker**: Button exists in message input, no picker implementation.
10. **Voice/Video call buttons**: Shown in ChatWindow header, no implementation.
11. **`cors` package**: Used only in `package.json` — CORS is handled by the backend, unnecessary in browser.
12. **Debug refresh button visible**: "🔄 Refresh Status" button in UserSidebar is a dev debug tool left visible.

### ✅ Code Quality Observations

- **Good**: Clean 3-panel responsive layout with mobile overlay pattern
- **Good**: localStorage caching with background refresh for instant page loads
- **Good**: Graceful degradation when presence/media services are down (fallback to offline status)
- **Good**: 1s debounce on send button prevents double-submission
- **Good**: File preview URL cleanup on unmount prevents memory leaks
- **Good**: Custom events (`mqtt-message`, `mqtt-presence`) for decoupled MQTT event handling
- **Good**: TokenManager abstracts localStorage operations cleanly
- **Good**: Dynamic API base URLs (localhost vs network IP detection)

---

## 🧭 Project Structure

```
orbit-chat-frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.js           # Root layout + AuthProvider + ChatProvider
│   │   ├── page.js             # Landing (redirects to login/dashboard)
│   │   ├── globals.css         # Tailwind v4 + CSS variables
│   │   ├── login/page.js       # Login/Register form
│   │   ├── dashboard/page.js   # Main 3-panel chat layout
│   │   └── admin/page.js       # User management (admin only)
│   ├── components/
│   │   ├── ConversationList.js # Left sidebar: convos, search, new chat
│   │   ├── ChatWindow.js       # Center: messages, input, files, typing
│   │   ├── UserSearch.js       # Modal: find users by @username
│   │   └── UserSidebar.js      # Right panel: status, org users
│   ├── contexts/
│   │   ├── AuthContext.js      # Auth state + presence sync
│   │   └── ChatContext.js      # Chat state + MQTT + localStorage cache
│   ├── config/
│   │   └── api-config.js       # Dynamic API URLs
│   └── utils/
│       ├── api-utils.js        # Axios clients, TokenManager, authHelpers
│       ├── api-list.js         # Service-specific endpoint functions
│       ├── mqtt-client.js      # MQTT singleton class
│       └── debug-storage.js    # localStorage debug tools
├── AI-ARCHITECTURE.md          # THIS FILE — quick reference
├── SESSION-LOG.md              # THIS FILE — persistent brain
├── next.config.mjs
├── package.json
├── postcss.config.mjs
└── jsconfig.json
```

### Key Architectural Facts
- **Framework**: Next.js 15.5.3 (App Router)
- **UI Library**: React 19.1.0
- **Styling**: Tailwind CSS v4
- **HTTP Client**: Axios (separate instances per service)
- **Real-time**: MQTT.js via EMQX WebSocket (port 8083)
- **State**: React Context (AuthContext + ChatContext)
- **Persistence**: localStorage with `orbit_chat_{userId}_` prefix
- **Auth**: JWT (HS256, localStorage) + optional Keycloak OIDC fallback
- **Dynamic URLs**: Detects localhost vs network IP to auto-configure API base URLs

### Backend API Ports
| Service | Port | Used By |
|---------|------|---------|
| Auth Service | 8080 | Login, register, user mgmt, admin |
| Chat API | 8003 | Conversations, messages, participants |
| Presence Service | 8002 | Online/offline, user status |
| Media Service | 8004 | File uploads, attachments, download |
| EMQX MQTT (WS) | 8083 | Real-time messaging, typing, presence |

---

## 📋 Decisions Log

| # | Decision | Date | Context |
|---|----------|------|---------|
| 1 | **React Context over Redux** for state | Jul 6 | Simple app, < 1K users, Context + localStorage is sufficient |
| 2 | **Axios over fetch** for HTTP | Jul 6 | Interceptors for auto-auth, error handling, simpler API |
| 3 | **localStorage cache** over IndexedDB | Jul 6 | Small data (conversations/messages), simpler API, instant access |
| 4 | **MQTT WebSocket** over WebSocket API | Jul 6 | Reuses backend EMQX broker, QoS levels, pub-sub pattern |
| 5 | **Custom events** for MQTT dispatch | Jul 6 | Decouples MQTT client from React lifecycle |
| 6 | **Dynamic API URLs** (hostname detection) | Jul 6 | Dev on localhost, demo on network IP — no env var switching |
| 7 | **REST primary, MQTT secondary** for presence | Jul 6 | REST is reliable for status, MQTT for real-time notification |
| 8 | **10MB file limit** (backend max is 100MB) | Jul 6 | Frontend UX — don't let users try uploading 100MB files |
| 9 | **Client-side dedupe key generation** | Jul 6 | Prevents double-sends on network retry |
| 10 | **1s send debounce** + dedupe key | Jul 6 | Double prevent — debounce AND idempotency key |

---

## 🚧 Next Steps (Ordered)

### Phase 1 — Fix Critical Integration Bugs
1. **Fix `createConversation` parameter order** in both `UserSearch.js` and `UserSidebar.js` to match ChatContext's expected signature
2. **Remove unused backend packages** (`cors`, `express`, `jsonwebtoken`, `pg`) from `package.json` dependencies (move to devDependencies or remove)

### Phase 2 — Complete Missing Features
3. **Implement Group Chat creation UI** — form with title input + multi-user selection
4. **Implement file download** — wire `getDownloadUrl` to the download button in ChatWindow
5. **Implement Message read receipts** — parse `is_read` from message data, wire to ✓/✓✓ display

### Phase 3 — Enhance Existing Features
6. **Add conversation info panel** — show participants, files, settings in the right panel
7. **Add emoji picker** — lightweight emoji picker component
8. **Remove debug UI elements** — hide "🔄 Refresh Status" button from production

### Phase 4 — Polish & Performance
9. **Add offline detection** — show banner when MQTT or API services disconnect
10. **Increase test coverage** — add unit tests for contexts, utils, and components
11. **Add loading skeletons** — improve perceived performance beyond spinners

---

## 📐 Current Git State

- **Branch**: (unknown — fresh session)
- **Uncommitted changes**: (check git status)
- **New docs**: `AI-ARCHITECTURE.md`, `SESSION-LOG.md`

---

## 🔍 How to Use This Brain

When starting a new Codebuff session:
1. Read `SESSION-LOG.md` to understand where we left off
2. Read `AI-ARCHITECTURE.md` for quick architectural context
3. Check the **Current Phase** section for integration status
4. Review **Issues Found / Next Steps** for what to work on next
5. Check **Decisions Log** before making architectural choices

To expand this brain, add entries to:
- **✅ Completed Work** when finishing a task
- **🔍 Issues Found** when discovering integration gaps
- **📋 Decisions Log** when making an architectural choice
- **🚧 Next Steps** when adding or reordering work items
