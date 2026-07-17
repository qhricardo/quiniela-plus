# Quiniela 360

App de quinielas de la Liga MX: salas entre amigos, pronósticos, créditos y compra de créditos con Mercado Pago.

## Qué cambió respecto a la versión anterior

| Antes | Ahora | Por qué |
|---|---|---|
| El precio de los créditos lo mandaba el navegador (`monto`) | El navegador solo manda un `paqueteId`; el servidor calcula el precio con `CATALOGO_CREDITOS` | Evita que alguien pague menos de lo que le corresponde |
| `userId` era un campo de texto libre en `compra.html` | Se usa el token de sesión de Firebase (`Authorization: Bearer`) | Evita que alguien impersone la cuenta de otro usuario |
| El crédito por referido se sumaba desde el navegador con el SDK de Firestore | Se suma en el backend (`/procesar-referido`) | Evita que alguien se autoregale créditos desde la consola del navegador |
| La tabla de posiciones era un arreglo fijo escrito a mano | Se pide a una API real y se cachea 10 min en el servidor | La tabla mostrada es real, no inventada |
| `api.php` (PHP) + `server.js` (Node) mezclados | Todo el backend vive en `server.js` (Express) | Un solo stack para desplegar y mantener |
| Sin reglas de Firestore documentadas | `firestore.rules` bloquea que un usuario edite su propio saldo | Cierra el hueco de seguridad a nivel base de datos, no solo por convención |
| Usuario nuevo entraba con 0 créditos | Entra con 10 créditos de bienvenida | Puede jugar su primer pronóstico sin pagar primero |
| Sin onboarding | Modal de 3 pasos la primera vez que entra a `interfaz.html` | Reduce el abandono en el primer uso |
| Link de referido invisible | Botón "Invita amigos" visible en el inicio, con WhatsApp directo | Es tu mejor palanca de crecimiento orgánico |

## Estructura

```
index.html              landing pública
login.html               login con Google (simplificado)
register.html             completar apodo/perfil
interfaz.html              dashboard: saldo, accesos, invitar, tabla real, noticias
sala.html                  crear/unirse a salas
guardar-pronostico.html    hacer pronósticos de la jornada
resultados.html            resultados + tabla de tu sala
live.html                  marcadores en vivo (Socket.io)
compra.html                comprar créditos (precio validado en servidor)
success.html               confirmación de pago
server.js                  backend Express (única fuente de verdad del dinero y los créditos)
firestore.rules            reglas de seguridad de la base de datos
css/style.css               sistema de diseño compartido
js/firebase-config.js        config de Firebase (claves públicas, edítalas con las tuyas)
js/app.js                    utilidades compartidas (sesión, toasts, onboarding)
```

## Cómo correrlo

1. **Firebase**
   - Crea un proyecto en [Firebase Console](https://console.firebase.google.com).
   - Activa **Authentication → Google** y **Firestore Database**.
   - Copia la config del SDK web a `js/firebase-config.js`.
   - Genera una cuenta de servicio (Configuración del proyecto → Cuentas de servicio) y pon su JSON en `FIREBASE_SERVICE_ACCOUNT_JSON` dentro de tu `.env`.
   - Sube `firestore.rules` desde la consola o con `firebase deploy --only firestore:rules`.

2. **Mercado Pago**
   - Saca tu `PUBLIC_KEY` (para `compra.html`) y tu `ACCESS_TOKEN` privado (para `.env`, nunca en el frontend) desde tu panel de Mercado Pago.

3. **Variables de entorno**
   ```bash
   cp .env.example .env
   # llena FIREBASE_SERVICE_ACCOUNT_JSON, MERCADOPAGO_ACCESS_TOKEN, APP_BASE_URL
   ```

4. **Instalar y correr**
   ```bash
   npm install
   npm run dev   # o: npm start
   ```

5. **Pendientes para producción**
   - Conectar un proveedor real de partidos/marcadores en vivo en `/api/proximos-partidos` y `/api/partidos-vivo` (hoy devuelven listas vacías con un `TODO`).
   - Cruzar pronósticos guardados contra resultados oficiales en `/api/tabla-sala/:id` para calcular aciertos automáticamente.
   - Configurar el dominio real en `APP_BASE_URL` para que el webhook de Mercado Pago funcione.
