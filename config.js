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
    apiKey: "AIzaSyD6OfbCi7PAxxuXyMuLOG0u0bdV3cluHCw",
    authDomain: "almacen-san-bernardo.firebaseapp.com",
    projectId: "almacen-san-bernardo",
    storageBucket: "almacen-san-bernardo.firebasestorage.app",
    messagingSenderId: "395213548379",
    appId: "1:395213548379:web:a3dacad90292462154487e"
  },
  VERSION: "2.2 · 2026-10-02",
  TALLER: "Muebles San Bernardo"
};
