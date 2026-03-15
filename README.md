# Fake Zoho Projects API v2

Mock de la API de Zoho Projects V3 para UBO Insight. Desplegable en Vercel (free tier).

## Stack

- **Runtime**: Node.js 18+
- **Framework**: [Hono](https://hono.dev/) (ultraligero, edge-ready)
- **Base de datos**: [Neon Postgres](https://neon.tech/) (serverless, free tier)
- **Deploy**: [Vercel](https://vercel.com/) Functions + Static

## Quick Start (local)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar BD
cp .env.example .env
# Editar .env con tu DATABASE_URL de Neon

# 3. Seed (poblar BD)
npm run seed          # primera vez
npm run seed:fresh    # resetear y repoblar

# 4. Correr servidor local
npm run dev
# → http://localhost:3500
```

## Deploy en Vercel

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Configurar variable de entorno en Vercel
vercel env add DATABASE_URL
# Pegar tu connection string de Neon

# 5. Re-deploy con env
vercel --prod
```

## API Endpoints

Base: `/api/v3/portal/8060001`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/projects` | Listar proyectos (filtros: `group`, `status`, `custom_status`) |
| GET | `/projects/{id}` | Detalle de proyecto |
| GET | `/projects/{id}/phases` | Hitos/fases de un proyecto |
| GET | `/projects/{id}/tasks` | Tareas (filtros: `status`, `phase_id`) |
| GET | `/projectgroups` | Grupos = Vicerrectorías |

### Health

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado general |
| GET | `/health/db` | Estado BD + conteos |
| GET | `/health/endpoints` | Health check endpoints |
| GET | `/health/metrics` | Métricas de requests |

## Dashboard

Acceder a la raíz (`/`) muestra un dashboard con:
- Estado del sistema (BD, API, uptime)
- Métricas (proyectos, tareas, hitos, requests)
- Vicerrectorías (4 groups)
- Tabla de proyectos con filtros
- Referencia de endpoints

## Datos

- **4 Vicerrectorías**: VRAF, VRAC, VRV, VREC
- **16 Proyectos**: 4 por VR
- **112 Hitos**: 7 por proyecto
- **~255 Tareas**: distribuidas por fase

Datos alineados con `DashZohoProjectsSeeder` de DTIUBOCL-Laravel.

## Estructura

```
fake-zoho-v2/
├── api/
│   └── index.js          # Vercel serverless entry point
├── public/
│   ├── index.html         # Dashboard
│   ├── css/styles.css
│   └── js/dashboard.js
├── src/
│   ├── app.js             # Hono app (routes + middleware)
│   ├── server.js           # Local dev server (@hono/node-server)
│   ├── db/
│   │   ├── connection.js   # Neon Postgres connection
│   │   └── seed.js         # Database seeder
│   └── services/
│       └── zoho-formatter.js  # Zoho V3 response formatter
├── vercel.json
├── package.json
└── .env.example
```
