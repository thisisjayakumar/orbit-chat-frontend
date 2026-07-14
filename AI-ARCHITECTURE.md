# ORBIT MESSENGER FRONTEND — AI Architecture QuickRef

## SYSTEM OVERVIEW
Next.js 15 (App Router) chat frontend with real-time MQTT WebSocket via EMQX. Connects to 5 Go backend microservices. Tailwind CSS v4 + lucide-react icons.

## SERVICE MAPPING (Backend → Frontend)

```
Backend Service         Port    Frontend Usage
───────────────────────────────────────────────────────
auth-service:8080       REST   → Login, register, user mgmt, admin
chat-api:8003          REST   → Conversations, messages, participants, typing
presence-service:8002  REST   → Online/offline status, user sessions
media-service:8004     REST   → File uploads, attachments, download URLs
EMQX:8083 (WS)         MQTT   → Real-time messages, typing indicators, presence
```

## PROJECT STRUCTURE

```
src/
  app/                          # Next.js App Router pages
    layout.js                   → Root layout with providers
    page.js                     → Landing page (redirects to /login or /dashboard)
    globals.css                 → Tailwind v4 imports + CSS vars
    login/page.js               → Login/Register form
    dashboard/page.js           → Main chat interface (3-panel layout)
    admin/page.js               → Org user management dashboard

  components/
    ConversationList.js          → Left sidebar: search, conversations, new chat modal
    ChatWindow.js               → Center: messages, input, typing, file uploads
    UserSearch.js               → Modal: find users by @username or name
    UserSidebar.js              → Right panel: user status, org users, online count

  contexts/
    AuthContext.js              → Auth state, login/register/logout, presence sync
    ChatContext.js              → Conversations, messages, MQTT events, localStorage cache

  config/
    api-config.js              → Dynamic base URLs (localhost vs network IP)

  utils/
    api-utils.js               → Axios instances, TokenManager, authHelpers
    api-list.js                → Service-specific API endpoints (chat, presence, media)
    mqtt-client.js             → MQTT singleton: connect, subscribe, publish, heartbeat
    debug-storage.js           → Dev tools: inspect/clear localStorage cache
```

## AUTH FLOW

```
Register → POST /api/v1/auth/register → JWT → localStorage('orbit_token')
Login    → POST /api/v1/auth/login    → JWT → localStorage('orbit_token')
               ↓ (fallback)
           Keycloak OIDC password grant → access_token

Token stored in localStorage:
  - orbit_token         → JWT string
  - orbit_user          → User JSON { id, email, display_name, username, org_id, role }
  - orbit_organization  → Org JSON { id, name }

API clients (axios) inject:
  - Authorization: Bearer {token}
  - X-User-ID: {user.id}              ← Legacy header (kept for compatibility)
  - X-Organization-ID: {org.id}

401 response → auto-redirect to /login
```

## COMPONENT TREE & STATE FLOW

```
RootLayout
  AuthProvider (AuthContext)
    ChatProvider (ChatContext)
      page.js → redirect
      /login → LoginPage
      /dashboard → DashboardPage
        ConversationList (left panel)
        ChatWindow (center panel)
        UserSidebar (right panel)
          UserSearch (modal)
      /admin → AdminDashboard
        EditUserModal
        DeleteUserModal
```

### AuthContext State
```js
{
  user, organization, isAuthenticated, isLoading, mqttConnected,
  login(), register(), logout(), updatePresence(), getMqttClient()
}
```

### ChatContext State
```js
{
  conversations[], activeConversation, messages{}, participants{},
  presenceData{}, typingUsers{}, isLoading, error,
  loadConversations(), loadMessages(), selectConversation(),
  sendMessage(), sendMessageWithFiles(), sendTypingIndicator(),
  createConversation(), getConversation(), getMessages(),
  getParticipants(), getTypingUsers(), getUserPresence()
}
```

## REAL-TIME (MQTT WebSocket)

```
Connection: ws://hostname:8083/mqtt (EMQX WebSocket)
Auth: MQTT credentials from GET /api/v1/auth/mqtt-credentials

Subscribe topics:
  chat/{convId}/messages     → Real-time message delivery
  chat/{convId}/typing       → Typing indicators
  presence/{userId}/status   → Presence changes
  presence/+/status          → All presence updates (wildcard)

Publish topics:
  chat/{convId}/typing       → Send typing indicator (QoS 0)
  presence/{userId}/status   → Update own status (QoS 1)
  presence/heartbeat         → Heartbeat (30s interval)
  presence/disconnect        → Last Will Testament (LWT)

Event dispatch:
  mqtt-message  → ChatContext.handleNewMessage
  mqtt-typing   → ChatContext.handleTypingIndicator
  mqtt-presence → ChatContext.handlePresenceUpdate
```

## UI LAYOUT

```
┌──────────────┬──────────────────────────────┬────────────┐
│              │                              │            │
│ Conversation │    Chat Messages             │  User      │
│   List       │    (scrollable)              │  Sidebar   │
│              │                              │            │
│  - DM convs  │  ┌─────────────────────┐     │  - My      │
│  - Group     │  │ Date separator      │     │    status  │
│    convs     │  ├─────────────────────┤     │  - Org     │
│  - Search    │  │ Message bubbles     │     │    users   │
│  - New Chat  │  │ (own=right, indigo) │     │  - Search  │
│    button    │  │ (other=left, gray)  │     │  - Online  │
│              │  └─────────────────────┘     │    count   │
│              │                              │            │
│              │  [📎] [Type message...] [😊] │            │
│              │  [              Send ➤]     │            │
└──────────────┴──────────────────────────────┴────────────┘
    w-80               flex-1                        w-80
  (mobile: overlay)                       (mobile: overlay)
```

## API ENDPOINTS USED

### Auth Service (/api/v1/auth)
```
POST   /register              → Register new user
POST   /login                 → Login (email + password)
GET    /me                    → Get current user
GET    /users                 → List org users (admin)
GET    /users/search?q=&limit → Search users
GET    /users/username/:uname → Get user by @username
GET    /mqtt-credentials      → Get MQTT creds
POST   /validate              → Validate token
PUT    /users/:id             → Update user (admin)
DELETE /users/:id             → Delete user (admin)
```

### Chat API (/api/v1)
```
GET    /conversations                   → List user conversations
POST   /conversations                   → Create conversation
GET    /conversations/:id               → Get conversation details
PUT    /conversations/:id               → Update conversation
GET    /conversations/:id/messages      → Get messages (limit+offset)
POST   /conversations/:id/messages      → Send message
GET    /conversations/:id/participants  → Get participants
POST   /conversations/:id/participants  → Add participant
POST   /conversations/:id/read          → Mark as read
POST   /conversations/:id/typing        → Send typing indicator
DELETE /conversations/:id/participants/:userId
```

### Presence Service (/api/v1/presence)
```
GET    /:userId        → Get user presence
PUT    /:userId/status → Set user status
POST   /bulk           → Get multiple user presence
GET    /:userId/sessions → Get user sessions
```

### Media Service (/api/v1)
```
POST   /upload/initiate         → Initiate file upload
POST   /upload/:id/complete     → Complete upload
GET    /attachments/:id         → Get attachment info
GET    /attachments/:id/download→ Get download URL
DELETE /attachments/:id         → Delete attachment
POST   /attachments/:id/associate→ Link attach to message
GET    /messages/:id/attachments→ Get message attachments
```

## KEY BUSINESS RULES (Frontend)

### Login/Register
- Login requires email + password (org auto-detected by backend)
- Register requires email, username, password, display_name
- Can join existing org (provide org_id) or create new (provide org_name)
- Username: 3-30 chars, a-z0-9._ only (validated by pattern attribute)
- Password min 6 chars

### Conversation Rules
- DM: creator + 1 other participant (total 2)
- Group: creator + any number
- New conversations auto-selected after creation
- Active conversation persists in localStorage

### Message Rules
- Text messages: content_type='text/plain', content=string
- File messages: content_type='attachment', meta includes file info
- Dedupe key: `${msg-${timestamp}-${random}}` prevents double-sends
- Files validated: JPG, PNG, PDF only, max 10MB
- 1s debounce on send button to prevent double-clicks
- 3s typing indicator timeout with auto-stop
- Messages grouped by date with separators

### Presence Rules
- Set to 'online' on login and MQTT connect
- Document visibility → 'away' after 5s hidden, 'online' on visible (10s delay)
- Set to 'offline' on beforeunload and logout
- Periodic refresh every 30s
- 5min delay before visibility change handler activates

### Admin Rules
- Only users with role='admin' can access /admin
- Can edit display_name, role, avatar_url
- Can delete users (except self)
- Copy org ID for inviting new members

## LOCALSTORAGE CACHE STRATEGY

```
Pattern: orbit_chat_{userId}_{key}

Keys:
  conversations       → Array of conversation objects (with participants)
  activeConversation  → Current conversation ID
  messages            → Object { [convId]: message[] }
  participants        → Object { [convId]: participant[] }

Triggers:
  Save: on every state change (useEffect)
  Load: on mount when user available
  Clear: on logout (all orbit_chat_* keys)

Purpose: On page refresh, show cached data immediately,
         then refresh in background after 2s.
```

## CURRENT KNOWN GAPS / ISSUES

1. **X-User-ID header still sent**: Backend migrated to JWT-only, but frontend still sends header (backward compatible, no-op)
2. **Group chat creation UI**: New Chat modal has "Group Chat" button but no implementation
3. **Download URL**: Attachment status shows "Ready"/"Download" but actual download not implemented
4. **Conversation info panel**: `showInfo` state exists but panel not implemented
5. **Message read receipts**: Read status (✓✓) shown but no real data from backend
6. **Message editing/deletion**: Not implemented in UI
7. **Voice/video calls**: Buttons shown but no implementation
8. **Emoji picker**: Button shown but no implementation
9. **Keycloak OIDC**: Fallback implemented but backend integration not fully tested
10. **Offline mode**: No graceful handling when backend services are down

## NON-FUNCTIONAL

- **Responsive**: 3-panel layout collapses to overlay sidebars on mobile (< lg)
- **Loading states**: Skeleton loaders, spinner overlays, pulse animations
- **Error handling**: Toast-style error display, graceful service degradation
- **Caching**: localStorage cache for conversations/messages/participants
- **Debug mode**: `window.chatContext`, `window.authContext`, `window.debugStorage` in dev
- **Packages**: Next.js 15, React 19, Tailwind v4, Axios, MQTT.js, date-fns, lucide-react

## PACKAGE DEPENDENCIES (package.json)

```json
{
  "next": "15.5.3",          // React framework
  "react": "19.1.0",         // UI library
  "tailwindcss": "^4",       // CSS utility framework
  "axios": "^1.12.2",        // HTTP client
  "mqtt": "^5.14.1",         // MQTT WebSocket client
  "date-fns": "^4.1.0",      // Date formatting
  "lucide-react": "^0.544.0",// Icon library
  "cors": "^2.8.5",          // (unused in browser - remove)
  "express": "^5.1.0",       // (unused in browser - remove)
  "jsonwebtoken": "^9.0.2",  // (unused in browser - remove)
  "pg": "^8.16.3",           // (unused in browser - remove)
  "uuid": "^13.0.0"          // UUID generation
}
```

## ENV VARIABLES (Next.js)

```env
NEXT_PUBLIC_AUTH_SERVICE_URL    = http://localhost:8080
NEXT_PUBLIC_CHAT_SERVICE_URL    = http://localhost:8003
NEXT_PUBLIC_PRESENCE_SERVICE_URL= http://localhost:8002
NEXT_PUBLIC_MEDIA_SERVICE_URL   = http://localhost:8004
NEXT_PUBLIC_MQTT_BROKER_URL     = ws://localhost:8083/mqtt
NEXT_PUBLIC_KEYCLOAK_URL        = http://localhost:8080
NEXT_PUBLIC_KEYCLOAK_REALM      = master
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID  = orbit-messenger
```
