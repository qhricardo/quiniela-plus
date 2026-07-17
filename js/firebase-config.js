// ============================================================
// Configuración de Firebase (cliente)
// Estas claves SON públicas por diseño (no son secretas): identifican
// tu proyecto de Firebase, no dan permisos por sí solas. La seguridad
// real vive en las Reglas de Firestore (Firestore Rules), no aquí.
// Reemplaza los valores con los de tu proyecto:
// Firebase Console → ⚙️ Configuración del proyecto → Tus apps → SDK config
// ============================================================
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxx"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
