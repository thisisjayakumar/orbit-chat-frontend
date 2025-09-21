# Orbit Messenger Frontend

Modern real-time chat application built with Next.js and React.

## Features

- Real-time messaging via MQTT
- User authentication with Keycloak
- File attachments support
- Typing indicators
- User presence tracking
- Responsive design

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment (see SETUP.md)
cp .env.example .env.local

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Documentation

See [SETUP.md](./SETUP.md) for detailed setup instructions.

## Tech Stack

- **Framework:** Next.js 15
- **Language:** JavaScript
- **Styling:** TailwindCSS
- **Real-time:** MQTT.js
- **Authentication:** Keycloak
- **State:** React Context

## License

MIT
