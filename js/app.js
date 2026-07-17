// ============================================================
// app.js — utilidades compartidas por todas las páginas internas
// Requiere que firebase-config.js ya se haya cargado antes que este archivo.
// ============================================================

/** Muestra un mensaje flotante corto (toast) en la parte inferior. */
function mostrarToast(mensaje, duracionMs = 2600) {
  let toast = document.getElementById("toast-global");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-global";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = mensaje;
  toast.classList.add("mostrar");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("mostrar"), duracionMs);
}

/**
 * Protege una página: si no hay sesión, manda a login.html conservando
 * a dónde quería ir el usuario (?next=). Si hay sesión, ejecuta el callback
 * con (user, datosUsuarioFirestore).
 */
function requerirSesion(callback) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      const destino = encodeURIComponent(location.pathname + location.search);
      location.href = `login.html?next=${destino}`;
      return;
    }
    try {
      const doc = await db.collection("users").doc(user.uid).get();
      const datos = doc.exists ? doc.data() : null;
      pintarSaldoEnTopbar(datos ? datos.creditos : 0);
      callback(user, datos);
    } catch (err) {
      console.error("Error cargando datos de usuario:", err);
      callback(user, null);
    }
  });
}

/** Actualiza el chip de créditos que aparece en la barra superior, si existe. */
function pintarSaldoEnTopbar(creditos) {
  const el = document.getElementById("saldo-creditos");
  if (el) el.textContent = (creditos ?? 0).toString();
}

/** Cierra sesión y regresa al login. */
function cerrarSesion() {
  auth.signOut().then(() => (location.href = "login.html"));
}

/** Arma el link de invitación del usuario actual. */
function obtenerLinkInvitacion(uid) {
  const base = location.origin + location.pathname.replace(/[^/]+$/, "login.html");
  return `${base}?ref=${uid}`;
}

/** Copia texto al portapapeles con feedback. */
async function copiarAlPortapapeles(texto, mensajeOk = "Copiado ✔") {
  try {
    await navigator.clipboard.writeText(texto);
    mostrarToast(mensajeOk);
  } catch {
    mostrarToast("No se pudo copiar, cópialo manualmente");
  }
}

/** Muestra el modal de bienvenida (3 pasos) solo la primera vez que el usuario entra. */
function mostrarOnboardingSiEsNuevo(datosUsuario) {
  if (!datosUsuario || datosUsuario.onboardingVisto) return;
  const overlay = document.getElementById("onboarding");
  if (!overlay) return;
  overlay.hidden = false;
  let pasoActual = 1;
  const pasos = overlay.querySelectorAll(".paso");
  const puntos = overlay.querySelectorAll(".puntos-paso span");
  const btn = document.getElementById("onboarding-siguiente");

  function pintar() {
    pasos.forEach((p, i) => p.classList.toggle("activo", i === pasoActual - 1));
    puntos.forEach((p, i) => p.classList.toggle("activo", i === pasoActual - 1));
    btn.textContent = pasoActual === pasos.length ? "Empezar" : "Siguiente";
  }
  btn.onclick = async () => {
    if (pasoActual < pasos.length) {
      pasoActual++;
      pintar();
    } else {
      overlay.hidden = true;
      const user = auth.currentUser;
      if (user) {
        db.collection("users").doc(user.uid).update({ onboardingVisto: true }).catch(() => {});
      }
    }
  };
  pintar();
}
