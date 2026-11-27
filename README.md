# Mi Tablero

App personal (PWA) de proyectos, tareas, hábitos e ideas.

- Funciona sin internet: la app se guarda en el teléfono (`sw.js`) y los datos en Firestore con copia local.
- Los cambios se suben solos cuando vuelve la señal.
- Entrar con Google; cada cuenta solo ve lo suyo (`firestore.rules`).
- Notificaciones: `scripts/reminders.mjs`, corrido cada 15 min por `.github/workflows/reminders.yml`.
  Usa el secreto del repositorio `FIREBASE_SA` (llave de cuenta de servicio de Firebase). Nunca subas esa llave al código.

## Archivos
- `index.html`: toda la app.
- `firebase-config.js`: datos públicos del proyecto de Firebase y la clave VAPID.
- `vendor/`: Firebase 13.2.0 (compat), copiado para que abra sin internet.
- `icons/`: ícono de cerebro.

Al cambiar `index.html` los teléfonos toman la versión nueva al abrir con internet.
Si cambias otros archivos, sube el número de `V` en `sw.js`.
