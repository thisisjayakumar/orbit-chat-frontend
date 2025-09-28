# Orbit Messenger Frontend

Modern real-time chat application built with Next.js and React.

## Features

- Real-time messaging via MQTT
- User authentication with Keycloak
- File attachments support
- Typing indicators
- User presence tracking
- Responsive design
- Message persistence across page refreshes

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Environment Configuration

Create `.env.local` file with the following variables:

```bash
# API Service URLs
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:8080
NEXT_PUBLIC_CHAT_SERVICE_URL=http://localhost:8003
NEXT_PUBLIC_PRESENCE_SERVICE_URL=http://localhost:8002
NEXT_PUBLIC_MEDIA_SERVICE_URL=http://localhost:8004

# MQTT Configuration
NEXT_PUBLIC_MQTT_BROKER_URL=ws://localhost:8083/mqtt

# Keycloak Configuration
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8090
NEXT_PUBLIC_KEYCLOAK_REALM=master
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=orbit-messenger

# App Configuration
NEXT_PUBLIC_APP_NAME=Orbit Messenger
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## Tech Stack

- **Framework:** Next.js 15
- **Language:** JavaScript
- **Styling:** TailwindCSS
- **Real-time:** MQTT.js
- **Authentication:** Keycloak
- **State:** React Context

## License

MIT
