// ============================================================
// Quiniela 360 — Backend (Express)
// Reemplaza a api.php + server.js/server1.js del repo original.
// Todo el backend vive en un solo stack (Node) para simplificar hosting.
//
// Variables de entorno esperadas (.env, NUNCA lo subas a git):
//   FIREBASE_SERVICE_ACCOUNT_JSON   -> JSON de la cuenta de servicio de Firebase (como string)
//   MERCADOPAGO_ACCESS_TOKEN        -> Access token PRIVADO de Mercado Pago (nunca en el frontend)
//   APP_BASE_URL                    -> ej. https://quiniela360.app
//   PORT                            -> puerto (opcional, default 3000)
// ============================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import admin from "firebase-admin";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

// ---------- Firebase Admin ----------
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ---------- Mercado Pago ----------
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

// ---------- Catálogo de precios: la ÚNICA fuente de verdad sobre el precio.
// El cliente nunca decide cuánto se cobra, solo elige un id de este catálogo. ----------
const CATALOGO_CREDITOS = {
  p5: { creditos: 5, precioMXN: 5 },
  p10: { creditos: 10, precioMXN: 10 },
  p20: { creditos: 20, precioMXN: 20 },
};

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(".")); // sirve index.html, login.html, css/, js/, etc.

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);

// ============================================================
// Middleware: verifica el token de Firebase enviado por el cliente.
// Así el servidor sabe con certeza QUIÉN hace la petición — nunca
// confiamos en un "userId" de texto libre como en la versión anterior.
// ============================================================
async function verificarSesion(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Falta iniciar sesión" });
  try {
    req.usuario = await admin.auth().verifyIdToken(token);
    next();
  } catch (err) {
    console.error("Token inválido:", err.message);
    res.status(401).json({ error: "Sesión inválida, vuelve a iniciar sesión" });
  }
}

// ============================================================
// POST /crear-preferencia
// El cliente manda SOLO el id del paquete. El precio lo calculamos aquí.
// ============================================================
app.post("/crear-preferencia", verificarSesion, async (req, res) => {
  try {
    const { paqueteId } = req.body;
    const paquete = CATALOGO_CREDITOS[paqueteId];
    if (!paquete) return res.status(400).json({ error: "Paquete no válido" });

    const preference = new Preference(mpClient);
    const resultado = await preference.create({
      body: {
        items: [
          {
            title: `${paquete.creditos} créditos Quiniela360`,
            quantity: 1,
            unit_price: paquete.precioMXN, // <- viene del catálogo del servidor, no del cliente
            currency_id: "MXN",
          },
        ],
        metadata: {
          uid: req.usuario.uid, // identidad verificada, no un input de texto
          paqueteId,
        },
        back_urls: {
          success: `${process.env.APP_BASE_URL}/success.html`,
          failure: `${process.env.APP_BASE_URL}/compra.html`,
        },
        auto_return: "approved",
        notification_url: `${process.env.APP_BASE_URL}/webhook-mercadopago`,
      },
    });

    res.json({ init_point: resultado.init_point });
  } catch (err) {
    console.error("Error creando preferencia:", err);
    res.status(500).json({ error: "No se pudo crear el pago" });
  }
});

// ============================================================
// POST /webhook-mercadopago
// Mercado Pago llama aquí cuando el pago se aprueba. AQUÍ es donde
// realmente se suman los créditos — nunca confiamos en que el navegador
// del usuario "avise" que pagó, porque eso se puede falsificar.
// ============================================================
app.post("/webhook-mercadopago", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
    });
    const pago = await resp.json();

    if (pago.status === "approved") {
      const { uid, paqueteId } = pago.metadata || {};
      const paquete = CATALOGO_CREDITOS[paqueteId];
      if (uid && paquete) {
        const userRef = db.collection("users").doc(uid);
        await db.runTransaction(async (t) => {
          const doc = await t.get(userRef);
          if (!doc.exists) return;
          // Idempotencia: si este pago ya se acreditó antes, no lo sumamos dos veces.
          const yaAplicado = (doc.data().pagosAplicados || []).includes(String(paymentId));
          if (yaAplicado) return;
          t.update(userRef, {
            creditos: admin.firestore.FieldValue.increment(paquete.creditos),
            pagosAplicados: admin.firestore.FieldValue.arrayUnion(String(paymentId)),
          });
        });
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Error en webhook de Mercado Pago:", err);
    res.sendStatus(500);
  }
});

// ============================================================
// POST /procesar-referido
// Suma el crédito de referido del LADO DEL SERVIDOR (antes se hacía
// desde el navegador con el SDK de Firestore directamente, lo cual
// un usuario podía manipular para autoregalarse créditos).
// ============================================================
app.post("/procesar-referido", async (req, res) => {
  try {
    const { nuevoUsuarioUid, referidoPorUid } = req.body;
    if (!nuevoUsuarioUid || !referidoPorUid || nuevoUsuarioUid === referidoPorUid) {
      return res.status(400).json({ error: "Datos de referido no válidos" });
    }
    const nuevoRef = db.collection("users").doc(nuevoUsuarioUid);
    const referidorRef = db.collection("users").doc(referidoPorUid);

    await db.runTransaction(async (t) => {
      const [nuevoDoc, referidorDoc] = await Promise.all([t.get(nuevoRef), t.get(referidorRef)]);
      if (!nuevoDoc.exists || !referidorDoc.exists) return;
      if (nuevoDoc.data().referidoYaProcesado) return; // evita doble conteo
      t.update(referidorRef, { creditos: admin.firestore.FieldValue.increment(1) });
      t.update(nuevoRef, { referidoYaProcesado: true });
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Error procesando referido:", err);
    res.status(500).json({ error: "No se pudo procesar el referido" });
  }
});

// ============================================================
// Datos deportivos: tabla de posiciones y noticias, CON CACHÉ.
// Antes cada carga de página golpeaba las APIs externas en vivo;
// con tráfico real eso se cae. Aquí se refresca cada 10 minutos.
// ============================================================
let cacheTabla = { data: null, expira: 0 };
let cacheNoticias = { data: null, expira: 0 };
const DIEZ_MIN = 10 * 60 * 1000;

app.get("/api/tabla", async (req, res) => {
  try {
    if (!cacheTabla.data || Date.now() > cacheTabla.expira) {
      const r = await fetch("https://api-football-standings.azharimm.dev/leagues/mex.1/standings");
      cacheTabla = { data: await r.json(), expira: Date.now() + DIEZ_MIN };
    }
    res.json(cacheTabla.data);
  } catch (err) {
    console.error("Error obteniendo tabla:", err);
    res.status(502).json({ error: "Fuente de datos no disponible" });
  }
});

app.get("/api/noticias", async (req, res) => {
  try {
    if (!cacheNoticias.data || Date.now() > cacheNoticias.expira) {
      const r = await fetch(
        "https://api.rss2json.com/v1/api.json?rss_url=" +
          encodeURIComponent("https://www.mediotiempo.com/rss/futbol/liga-mx")
      );
      const json = await r.json();
      cacheNoticias = {
        data: (json.items || []).slice(0, 8).map((it) => ({
          title: it.title,
          link: it.link,
          img: it.thumbnail || "",
        })),
        expira: Date.now() + DIEZ_MIN,
      };
    }
    res.json(cacheNoticias.data);
  } catch (err) {
    console.error("Error obteniendo noticias:", err);
    res.json([]); // el frontend ya maneja el caso de lista vacía
  }
});

// ============================================================
// Partidos próximos / en vivo — placeholders para que conectes tu
// proveedor de datos deportivos real (ej. API-Football, Sportradar).
// ============================================================
app.get("/api/proximos-partidos", async (req, res) => {
  // TODO: sustituir por tu proveedor real de fixtures.
  res.json([]);
});

app.get("/api/partidos-vivo", async (req, res) => {
  // TODO: sustituir por tu proveedor real de marcadores en vivo.
  res.json([]);
});

// Tabla de posiciones DENTRO de una sala (aciertos y créditos por sala)
app.get("/api/tabla-sala/:id", async (req, res) => {
  try {
    const salaId = req.params.id;
    const salaDoc = await db.collection("salas").doc(salaId).get();
    if (!salaDoc.exists) return res.status(404).json({ error: "Sala no encontrada" });

    const miembros = salaDoc.data().miembros || [];
    const posiciones = [];
    for (const uid of miembros) {
      const userDoc = await db.collection("users").doc(uid).get();
      const u = userDoc.data() || {};
      posiciones.push({ uid, apodo: u.apodo || u.name || "Jugador", aciertos: u.aciertos?.[salaId] || 0, creditos: u.creditos || 0 });
    }
    posiciones.sort((a, b) => b.aciertos - a.aciertos);

    // TODO: cruzar pronósticos guardados con resultados oficiales reales.
    res.json({ posiciones, resultados: [] });
  } catch (err) {
    console.error("Error calculando tabla de sala:", err);
    res.status(500).json({ error: "No se pudo calcular la tabla" });
  }
});

// ============================================================
// Socket.io — marcadores en vivo
// ============================================================
io.on("connection", (socket) => {
  console.log("Cliente conectado a marcadores en vivo:", socket.id);
  // Aquí emitirías io.emit("partidos-actualizados", data) cuando tu
  // proveedor de datos en vivo te avise de un cambio (gol, minuto, etc).
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Quiniela360 backend corriendo en :${PORT}`));
