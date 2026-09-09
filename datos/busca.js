/* ═══════════════════════════════════════════════════════════════════════════
   Búsqueda tolerante. Perdona acentos, mayúsculas y letras cambiadas
   ("Maliana Sisne" encuentra "Mariana Cisne"), pero si nada se parece de
   verdad, no inventa: devuelve vacío para que la pantalla diga "no encontré".
   ═══════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  "use strict";
  const normaliza = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
  /* Como suena, no como se escribe: "Sisne" y "Cisne", "Petakero" y "Petaquero" quedan iguales. */
  const fonetico = w => w.replace(/qu/g, "k").replace(/c(?=[ei])/g, "s").replace(/z/g, "s").replace(/c/g, "k").replace(/v/g, "b").replace(/ll/g, "y").replace(/h/g, "").replace(/ñ/g, "ni").replace(/(.)\1+/g, "$1");

  /* Distancia de edición con transposición (Damerau-Levenshtein), acotada. */
  function distancia(a, b, tope){
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > tope) return tope + 1;
    const la = a.length, lb = b.length;
    let prev2 = null, prev = [], cur;
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++){
      cur = [i];
      let mejor = i;
      for (let j = 1; j <= lb; j++){
        const costo = a[i-1] === b[j-1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + costo);
        if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) v = Math.min(v, prev2[j-2] + 1);
        cur[j] = v; if (v < mejor) mejor = v;
      }
      if (mejor > tope) return tope + 1;
      prev2 = prev; prev = cur;
    }
    return prev[lb];
  }

  /* Qué tan bien una palabra buscada encaja en una palabra del texto: 0 = nada. */
  function puntoPalabra(q, w){
    if (!q || !w) return 0;
    if (w === q) return 1;
    if (w.startsWith(q)) return 0.9;
    const tope = q.length <= 4 ? 1 : 2;
    const d = distancia(q, w, tope);
    if (d <= tope) return d === 1 ? 0.7 : 0.55;
    if (q.length >= 4 && w.includes(q)) return 0.5;
    return 0;
  }

  /* Cada palabra buscada debe encajar con ALGUNA palabra del texto. */
  function puntaje(q, texto){
    const qs = normaliza(q).split(" ").filter(Boolean).map(fonetico);
    if (!qs.length) return 1;
    const ws = normaliza(texto).split(" ").filter(Boolean).map(fonetico);
    if (!ws.length) return 0;
    let total = 0;
    for (const p of qs){
      let mejor = 0;
      for (const w of ws){ const s = puntoPalabra(p, w); if (s > mejor) mejor = s; }
      if (mejor === 0) return 0;
      total += mejor;
    }
    return total / qs.length;
  }

  /* busca("maliana sisne", lista, x => x.nombre + " " + x.color) → los que se parecen, mejores primero */
  function busca(q, lista, textoDe, umbral){
    umbral = umbral == null ? 0.6 : umbral;
    if (!normaliza(q)) return lista.slice();
    return lista.map((x, i) => ({ x, i, s: puntaje(q, textoDe(x)) }))
      .filter(r => r.s >= umbral)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map(r => r.x);
  }

  const B = { normaliza, fonetico, distancia, puntaje, busca };
  if (typeof module !== "undefined" && module.exports) module.exports = B;
  raiz.Busca = B;
})(typeof window !== "undefined" ? window : globalThis);
