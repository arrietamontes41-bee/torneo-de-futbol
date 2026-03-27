# 🚀 Guía de Despliegue — Ver Cambios en Vivo

## OPCIÓN A — Ver cambios en tiempo real (local, sin internet)

### Instalar Live Server en VS Code
1. Abre **VS Code**
2. Ve a **Extensiones** (Ctrl+Shift+X)
3. Busca: `Live Server` (autor: Ritwick Dey)
4. Haz clic en **Instalar**

### Usar Live Server
1. Abre la carpeta `Web deportiva` en VS Code
2. Haz clic derecho sobre `index.html`
3. Selecciona **"Open with Live Server"**
4. Se abre en el navegador en `http://127.0.0.1:5500`
5. ✅ **Cada vez que guardas un archivo (Ctrl+S), el navegador se actualiza solo**

---

## OPCIÓN B — Despliegue online con GitHub + Netlify (auto-deploy)

### PASO 1 — Crear repositorio en GitHub

1. Ve a **https://github.com** y crea una cuenta (gratis)
2. Haz clic en **"New repository"** (botón verde +)
3. Llena:
   - **Repository name:** `torneo-futbol-monteria`
   - **Visibility:** Public (o Private si prefieres)
   - ⚠️ **NO** marques "Initialize this repository"
4. Haz clic en **"Create repository"**
5. GitHub te mostrará comandos — copia la URL del repositorio (ej: `https://github.com/TU_USUARIO/torneo-futbol-monteria.git`)

### PASO 2 — Conectar tu proyecto local con GitHub

Abre **PowerShell** o la terminal de VS Code en la carpeta del proyecto y ejecuta:

```powershell
git remote add origin https://github.com/TU_USUARIO/torneo-futbol-monteria.git
git branch -M main
git push -u origin main
```

*(Reemplaza TU_USUARIO con tu nombre de usuario de GitHub)*

### PASO 3 — Conectar GitHub con Netlify

1. Ve a **https://netlify.com** y créate una cuenta gratis
2. Haz clic en **"Add new site" → "Import an existing project"**
3. Selecciona **GitHub**
4. Autoriza Netlify y elige el repositorio `torneo-futbol-monteria`
5. Configuración:
   - **Branch to deploy:** `main`
   - **Build command:** *(dejar vacío)*
   - **Publish directory:** `.` *(punto — la raíz del proyecto)*
6. Haz clic en **"Deploy site"**
7. En ~30 segundos Netlify te da una URL pública: `https://algo-random.netlify.app`

### ✅ Flujo de trabajo desde ahora

```
Editas un archivo en VS Code
        ↓
Guardas (Ctrl+S)
        ↓
Live Server actualiza el navegador local
        ↓
Cuando quieres publicar online:
git add .
git commit -m "descripción del cambio"
git push
        ↓
Netlify detecta el push y despliega en ~30 segundos
        ↓
La URL pública se actualiza automáticamente ✅
```

### 🌐 Cambiar el dominio en Netlify (opcional)
- En Netlify → Site settings → Domain management
- Puedes poner: `torneo-monteria.netlify.app` (gratis)
- O conectar un dominio propio como `torneodefutbolmonteria.com`

---

## Resumen

| | Local (desarrollo) | Online (producción) |
|---|---|---|
| **Herramienta** | Live Server (VS Code) | Netlify |
| **URL** | `http://127.0.0.1:5500` | `https://tu-sitio.netlify.app` |
| **Update** | Automático al guardar | Automático al hacer `git push` |
| **Costo** | Gratis | **Gratis** |
