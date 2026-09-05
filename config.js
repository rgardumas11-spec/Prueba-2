/* ═══════════════════════════════════════════════════════════════════════════
   Configuración. Es el ÚNICO archivo que hay que tocar para conectar la
   base compartida. Mientras esté vacío, la app trabaja solo en este
   aparato (sirve para probar la forma).

   De dónde salen estos datos: Firebase (console.firebase.google.com) →
   tu proyecto → engrane ⚙ Configuración del proyecto → hasta abajo,
   "Tus apps" → la app web → "Configuración del SDK" → Config.
   Se copia tal cual lo que viene entre llaves.

   Estas claves son públicas a propósito: lo que protege los datos son el
   login y las reglas de la base (datos/reglas-firestore.txt).
   ═══════════════════════════════════════════════════════════════════════════ */
window.CONFIG = {
  FIREBASE: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },
  VERSION: "1.1 · 2026-09-04",
  TALLER: "Muebles San Bernardo"
};
