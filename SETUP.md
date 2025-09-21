# Orbit Messenger Frontend - Setup Guide

A modern Next.js chat application with real-time messaging capabilities.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Backend services running (Auth, Chat, Presence, Media)
- MQTT broker (EMQX) on port 8083

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create `.env.local`:
   ```env
   NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:8080
   NEXT_PUBLIC_CHAT_SERVICE_URL=http://localhost:8003
   NEXT_PUBLIC_PRESENCE_SERVICE_URL=http://localhost:8002
   NEXT_PUBLIC_MEDIA_SERVICE_URL=http://localhost:8004
   NEXT_PUBLIC_MQTT_BROKER_URL=ws://localhost:8083/mqtt
   NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
   NEXT_PUBLIC_KEYCLOAK_REALM=master
   NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=orbit-messenger
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Production Build

```bash
npm run build
npm start
```

## Features

- **Real-time messaging** via MQTT
- **User authentication** with Keycloak
- **File attachments** support
- **Typing indicators**
- **User presence** tracking
- **Responsive design**

## Project Structure

```
src/
├── app/                 # Next.js pages
├── components/          # React components
├── contexts/           # State management
└── utils/              # API utilities
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_AUTH_SERVICE_URL` | Authentication service | `http://localhost:8080` |
| `NEXT_PUBLIC_CHAT_SERVICE_URL` | Chat API service | `http://localhost:8003` |
| `NEXT_PUBLIC_PRESENCE_SERVICE_URL` | Presence service | `http://localhost:8002` |
| `NEXT_PUBLIC_MEDIA_SERVICE_URL` | Media/file service | `http://localhost:8004` |
| `NEXT_PUBLIC_MQTT_BROKER_URL` | MQTT broker WebSocket | `ws://localhost:8083/mqtt` |

## Troubleshooting

### Common Issues

1. **MQTT Connection Failed**
   - Verify EMQX broker is running on port 8083
   - Check WebSocket support

2. **Authentication Errors**
   - Ensure Keycloak is running on port 8080
   - Verify client configuration

3. **API Errors**
   - Check backend services are running
   - Verify CORS configuration

### Support

For issues, check:
- Browser console for errors
- Network tab for failed requests
- Backend service logs

---

**Built with Next.js, React, and TailwindCSS**
