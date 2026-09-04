/* ═══════════════════════════════════════════════════════════════════════════
   Configuración. Es el ÚNICO archivo que hay que tocar para conectar la
   base compartida. Mientras las dos llaves estén vacías, la app trabaja
   solo en este aparato (sirve para probar la forma).

   De dónde salen: Supabase → tu proyecto → Project Settings → API
     URL       → "Project URL"
     LLAVE     → "anon public"  (esta llave es pública a propósito; lo que
                  protege los datos son las reglas de la base y el login)
   ═══════════════════════════════════════════════════════════════════════════ */
window.CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_LLAVE: "",
  VERSION: "1.0 · 2026-09-04",
  TALLER: "Muebles San Bernardo"
};
