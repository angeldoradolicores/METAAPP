# 🎓 Goretti Social — I.E.M. María Goretti Pasto

Red social oficial del colegio. App estilo Instagram para publicar noticias y eventos.

---

## 🔐 Credenciales de Administrador

| Campo       | Valor       |
|-------------|-------------|
| **Usuario** | `admin`     |
| **Contraseña** | `G0r3tt!8` |

> **Guárdalas en un lugar seguro. No las compartas.**

---

## ⚙️ Paso 1 — Crear proyecto Firebase

1. Ve a **https://console.firebase.google.com**
2. Haz clic en **"Agregar proyecto"** → nombre: `goretti-social`
3. Desactiva Google Analytics (no es necesario) → **Crear proyecto**

---

## 🔥 Paso 2 — Configurar Firestore

1. En el menú izquierdo: **Compilación → Firestore Database**
2. Clic en **"Crear base de datos"**
3. Selecciona **modo producción** → Siguiente
4. Elige ubicación: `us-east1` → **Habilitar**
5. Ve a la pestaña **Reglas** → Copia el contenido de `firestore.rules` → **Publicar**

---

## 🔑 Paso 3 — Configurar Authentication 

1. En el menú: **Compilación → Authentication**
2. Clic **"Comenzar"** → pestaña **"Sign-in method"**
3. Habilita **"Correo electrónico/Contraseña"** → Guardar
4. Ve a pestaña **"Usuarios"** → **"Agregar usuario"**:
   - Email: `admin@goretti.edu.co`
   - Contraseña: `G0r3tt!8`
5. Clic **"Agregar usuario"**

---

## 📋 Paso 4 — Obtener configuración de Firebase

1. En la pantalla principal del proyecto → ícono ⚙️ → **"Configuración del proyecto"**
2. Baja hasta **"Tus apps"** → clic en ícono **`</>`** (Web)
3. Nombre de app: `goretti-social-web` → **Registrar app**
4. Copia los valores de `firebaseConfig`
5. Abre el archivo `firebase-config.js` y reemplaza cada valor:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",       // ← tu apiKey
  authDomain:        "goretti-social.firebaseapp.com",
  projectId:         "goretti-social",
  storageBucket:     "goretti-social.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc"
};
```

---

## 🖼️ Paso 5 — Agregar el Logo

Copia la imagen del logo del colegio y guárdala como `logo.png` en la carpeta raíz del proyecto (junto a `index.html`).

---

## 🚀 Paso 6 — Subir a Vercel

1. Crea cuenta en **https://vercel.com** (gratis con GitHub)
2. Sube la carpeta del proyecto a GitHub:
   ```bash
   git init
   git add .
   git commit -m "Goretti Social v1.0"
   git remote add origin https://github.com/TU_USUARIO/goretti-social.git
   git push -u origin main
   ```
3. En Vercel → **"New Project"** → importa el repositorio de GitHub
4. Configuración:
   - Framework Preset: **Other**
   - Root Directory: `./`
   - Build Command: *(dejar vacío)*
   - Output Directory: `./`
5. Clic **"Deploy"**
6. ¡Tu app estará disponible en `https://goretti-social.vercel.app`!

---

## ✅ Funcionalidades

### Para visitantes (estudiantes, padres)
- ✅ Ver todas las publicaciones sin necesidad de cuenta
- ✅ Comentar en cualquier publicación (solo ponen su nombre)
- ✅ Enviar mensajes privados al administrador
- ✅ Dar "Me gusta" ❤️ a publicaciones

### Para el Administrador
- ✅ Login seguro con usuario y contraseña
- ✅ Crear publicaciones con título, texto, imagen, video o PDF
- ✅ Editar publicaciones existentes
- ✅ Eliminar publicaciones
- ✅ Ver bandeja de mensajes de estudiantes
- ✅ Marcar mensajes como leídos
- ✅ Cambiar el logo del colegio
- ✅ Eliminar comentarios inapropiados

### Filtro de lenguaje
- ✅ Los comentarios con palabras inapropiadas son bloqueados automáticamente

---

## 📁 Estructura del proyecto

```
goretti-social/
├── index.html          # Estructura de la app
├── styles.css          # Estilos premium
├── app.js              # Lógica principal (Firebase)
├── firebase-config.js  # ⚠️ COMPLETAR con tus credenciales Firebase
├── firestore.rules     # Reglas de seguridad Firestore
├── vercel.json         # Configuración Vercel
├── logo.png            # ⚠️ AGREGAR el logo del colegio
├── manifest.json       # PWA
├── service-worker.js   # PWA cache
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 🆘 Soporte

Si tienes problemas con la configuración, revisa:
- Firebase Console: https://console.firebase.google.com
- Vercel Dashboard: https://vercel.com/dashboard
- final 17 de mayo 2026
