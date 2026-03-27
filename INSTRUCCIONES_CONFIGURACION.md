# 🚀 Guía de Configuración — Torneo de Fútbol Montería

## ¿Qué es Supabase?
Supabase es una plataforma de base de datos **PostgreSQL en la nube**, gratuita,
que permite almacenar todos los datos de forma permanente y segura en internet.
El cliente puede ver y gestionar la base de datos desde cualquier computador.

---

## PASO 1 — Crear cuenta en Supabase (gratis)

1. Ve a **https://supabase.com**
2. Haz clic en **"Start your project"**
3. Crea una cuenta con Google o tu correo
4. Haz clic en **"New project"**
5. Llena:
   - **Name:** `torneo-futbol-monteria`
   - **Database Password:** elige una contraseña segura (guárdala)
   - **Region:** `South America (São Paulo)` ← más cercana a Colombia
6. Espera ~2 minutos mientras se crea el proyecto

---

## PASO 2 — Crear las tablas (base de datos)

1. En tu proyecto de Supabase, ve al menú izquierdo: **SQL Editor**
2. Haz clic en **"New query"**
3. Copia y pega el contenido del archivo `database_schema.sql`
4. Haz clic en **"Run"** (botón verde)
5. Verás el mensaje: `Success. No rows returned`

✅ ¡La base de datos está lista! Puedes verificar en **Table Editor** que existen
las tablas: `usuarios`, `equipos` y `partidos`.

---

## PASO 3 — Obtener las credenciales

1. Ve al menú izquierdo: **Project Settings → API**
2. Copia los dos valores:
   - **Project URL** → algo como `https://xxxxx.supabase.co`
   - **anon / public** (bajo "Project API keys")

---

## PASO 4 — Configurar el proyecto

1. Abre el archivo `js/config.js` con cualquier editor de texto
2. Reemplaza los valores:

```javascript
const SUPABASE_URL  = 'https://TU-PROYECTO.supabase.co';   // ← pega aquí
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1...';               // ← pega aquí
```

3. Guarda el archivo

---

## PASO 5 — Abrir la aplicación

Simplemente **doble clic en `index.html`** para abrir en el navegador.

**Cuenta de administrador (creada automáticamente):**
- Email: `admin@torneo.com`
- Contraseña: `admin123`

---

## ¿Cómo funciona para el cliente?

| Acción | Resultado |
|--------|-----------|
| Registrar equipo | Se guarda en PostgreSQL nube |
| Programar partido | Se guarda en PostgreSQL nube |
| Ingresar resultado | Se actualiza en PostgreSQL nube |
| Tabla de posiciones | Se calcula automáticamente |
| Ver datos | Desde Supabase → Table Editor |

## ¿Cuánto cuesta?

- **Plan gratuito:** hasta **500 MB** de datos, **50,000 peticiones/mes**
- Suficiente para cientos de equipos y miles de partidos
- Si el torneo crece: plan Pro a $25 USD/mes

---

## Estructura de archivos

```
Web deportiva/
├── index.html          → Login
├── register.html       → Registro de equipos
├── dashboard.html      → Panel de administración
├── database_schema.sql → Ejecutar una sola vez en Supabase
├── css/
│   └── style.css
└── js/
    ├── config.js       ← EDITAR CON TUS CREDENCIALES
    ├── db.js           → Conexión a Supabase
    ├── auth.js         → Login
    ├── register.js     → Registro
    └── dashboard.js    → Panel completo
```
