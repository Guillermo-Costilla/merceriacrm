# Mercería CRM — Sistema de Gestión de Inventario y Ventas

Sistema web integral de gestión y facturación diseñado para mercerías, con soporte para inventario fraccionable (metros de cinta, elástico) y discreto (unidades, paquetes), control de costos históricos, cálculo de ganancia bruta estimada, base de datos SQLite distribuida en la nube (Turso) y autenticación segura con Argon2id.

---

## Stack Tecnológico

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Motion para React, Lucide Icons.
- **Backend:** Python 3.12, FastAPI, Pydantic V2, Uvicorn, Argon2id (`argon2-cffi`).
- **Base de Datos:** Turso (libSQL / SQLite compatible en la nube sobre HTTPS).
- **Herramientas de Desarrollo:** pnpm, concurrently, Pytest, Git Bash / Windows.

---

## Requisitos Previos

1. **Node.js:** Versión 20+ (verificar con `node -v`).
2. **pnpm:** Versión 10+ (verificar con `pnpm -v`).
3. **Python:** Versión 3.12+ (verificar con `py -3.12 --version` o `python --version`).
4. **Git Bash** o terminal PowerShell en Windows.

---

## Instalación Inicial

### 1. Variables de Entorno
Copiar el archivo de plantilla y completar las credenciales de Turso:
```bash
cp .env.example .env
```
Editar `.env` y configurar `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.

### 2. Configuración del Entorno Virtual de Python
```bash
py -3.12 -m venv backend/.venv
./backend/.venv/Scripts/python -m pip install --upgrade pip
./backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
```

### 3. Instalación de Dependencias Node.js y Frontend
```bash
pnpm install
```

### 4. Ejecutar Migraciones en Turso
Crea todas las tablas, restricciones de stock e índices relacionales en la base de datos:
```bash
pnpm run migrate
```
Para verificar el estado de las migraciones:
```bash
pnpm run migrate:status
```

### 5. Crear el Usuario Administrador Inicial
Registrar de forma segura la cuenta del propietario:
```bash
pnpm run admin:create
```
El script solicitará el correo electrónico, nombre completo y contraseña de forma interactiva (mínimo 8 caracteres, con verificación de coincidencia y hash Argon2id).

---

## Ejecución en Desarrollo (Un Único Comando)

Para iniciar simultáneamente el frontend (Vite en puerto `5173`) y el backend (FastAPI en puerto `8000`):

```bash
pnpm run dev
```

La aplicación estará disponible inmediatamente en el navegador en:
`http://localhost:5173`

Vite redirige automáticamente las peticiones de `/api/*` hacia FastAPI, evitando problemas de CORS en desarrollo y garantizando que el navegador nunca tenga acceso a las credenciales secretas de Turso.

Al presionar `Ctrl + C`, ambos servicios se detienen limpiamente sin dejar puertos bloqueados.

---

## Despliegue del Frontend en Vercel

El archivo `vercel.json` configura la instalación del monorepo, la compilación del frontend y el fallback de rutas de la SPA. Importa el repositorio en Vercel dejando **Root Directory** en la raíz del repositorio; cada push a `main` desplegará el frontend.

El backend FastAPI no se despliega con esta configuración y debe estar publicado por separado. En Vercel, configura la variable de entorno `VITE_API_URL` para Production, Preview y Development con el origen público del backend, sin `/` al final ni `/api` (por ejemplo, `https://api.tudominio.com`). La variable se incorpora durante la compilación; vuelve a desplegar después de cambiarla.

En el servicio del backend configura `ENVIRONMENT=production`, una `SECRET_KEY` segura, `CORS_ORIGINS` con los orígenes exactos del frontend de Vercel (incluido el dominio personalizado si se usa) y `FRONTEND_URL` con la URL pública del frontend. Configura también `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`; no pongas credenciales del backend en variables `VITE_*`.

La autenticación usa cookies `HttpOnly`, `SameSite=Lax` y `Secure` en producción. Para que el navegador las envíe con las peticiones API, sirve frontend y backend bajo el mismo sitio (por ejemplo, `app.tudominio.com` y `api.tudominio.com`). Si se usan dominios de proveedores distintos, hay que definir una estrategia de cookies y protección CSRF antes de considerar funcional el inicio de sesión.

Verifica la API desplegada en `https://<backend>/api/health` y luego prueba el login desde el dominio de Vercel.

---

## Comandos Disponibles

| Comando | Descripción |
| :--- | :--- |
| `pnpm run dev` | Inicia frontend y backend en paralelo con recarga en vivo. |
| `pnpm run migrate` | Aplica migraciones SQL pendientes en Turso de manera atómica. |
| `pnpm run migrate:status` | Comprueba si existen migraciones pendientes sin modificar la base de datos. |
| `pnpm run admin:create` | Crea de forma interactiva la cuenta del propietario. |
| `pnpm run test:backend` | Ejecuta la suite de pruebas unitarias y de integración con Pytest. |
| `pnpm --filter frontend build` | Compila el frontend con TypeScript estricto para producción. |

---

## Seguridad Implementada

- **Hash de Contraseñas:** Argon2id (ganador del Password Hashing Competition) resistente a ataques por GPU.
- **Sesiones:** Cookies `HttpOnly`, `SameSite=Lax` y `Secure` (en producción), impidiendo el robo de tokens mediante scripts XSS.
- **Protección contra Fuerza Bruta:** Bloqueo temporal de 15 minutos tras 5 intentos fallidos consecutivos.
- **Recuperación de Contraseña:** Tokens temporales de 30 minutos con hash SHA-256 en base de datos de un solo uso.
- **Protección de Base de Datos:** 100% de consultas parametrizadas contra Turso para prevenir inyecciones SQL.
- **Restricción de Stock:** Reglas de integridad a nivel de base de datos (`CHECK current_stock >= 0`).

---

## Estructura del Monorepo

```
merceria-crm/
├── .env.example              # Variables de entorno documentadas (sin secretos)
├── .gitignore                # Protección estricta de credenciales y artefactos
├── package.json              # Orquestador monorepo raíz
├── pnpm-workspace.yaml       # Workspace pnpm
├── scripts/                  # Scripts multiplataforma para backend, pruebas y migraciones
├── backend/
│   ├── app/
│   │   ├── api/v1/           # Endpoints REST (auth, salud, etc.)
│   │   ├── core/             # Configuración, seguridad Argon2id y base de datos Turso
│   │   ├── repositories/     # Consultas SQL parametrizadas
│   │   ├── schemas/          # Modelos de validación Pydantic V2
│   │   └── services/         # Reglas de negocio y control de stock
│   ├── migrations/           # Migraciones SQL versionadas y ejecutor atómico
│   └── tests/                # Pruebas automatizadas con Pytest
└── frontend/
    ├── src/
    │   ├── components/       # Componentes visuales reutilizables
    │   ├── context/          # Contexto de autenticación
    │   ├── pages/            # Vistas (Login, Dashboard, etc.)
    │   ├── services/         # Cliente API con soporte de cookies HttpOnly
    │   └── types/            # Interfaces TypeScript
    ├── vite.config.ts        # Configuración de proxy API y servidor Vite
    └── tailwind.config.js    # Paleta de diseño personalizada
```