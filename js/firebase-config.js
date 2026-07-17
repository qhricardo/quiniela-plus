// ============================================================
// Configuración de Firebase (cliente)
// Estas claves SON públicas por diseño (no son secretas): identifican
// tu proyecto de Firebase, no dan permisos por sí solas. La seguridad
// real vive en las Reglas de Firestore (Firestore Rules), no aquí.
// Reemplaza los valores con los de tu proyecto:
// Firebase Console → ⚙️ Configuración del proyecto → Tus apps → SDK config
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyA0teDfcQdgK12UbtDVZqUdQlSvSeDAlT4",
  authDomain: "quiniela-plus-3c8c0.firebaseapp.com",
  databaseURL: "https://quiniela-plus-3c8c0-default-rtdb.firebaseio.com",
  projectId: "quiniela-plus-3c8c0",
  storageBucket: "quiniela-plus-3c8c0.firebasestorage.app",
  messagingSenderId: "968249393670",
  appId: "1:968249393670:web:e61ca7b553516207373987",
  measurementId: "G-5CRWSXXMW8"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
