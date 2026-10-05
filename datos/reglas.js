/* ═══════════════════════════════════════════════════════════════════════════
   Reglas del taller. Aquí vive TODA la lógica de producción, en un solo
   lugar: qué etapas hay, quién puede firmar cada una, cómo se traduce un
   montón de puertas a "muebles", y cuándo un mueble está listo para preparar.
   La pantalla solo pregunta; nunca decide por su cuenta.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  "use strict";

  /* ── Etapas de mueble. Un mueble vive en UNA sola etapa a la vez. ── */
  const ETAPAS = {
    maquilado:   { nombre: "Mueble maquilado",      corto: "Maquilado",   tipo: "madera", orden: 1 },
    armado:      { nombre: "Mueble armado",         corto: "Armado",      tipo: "madera", orden: 2 },
    pintado:     { nombre: "Mueble pintado",        corto: "Pintado",     tipo: "madera", orden: 3 },
    mdf:         { nombre: "Mueble de MDF",         corto: "MDF",         tipo: "mdf",    orden: 1 },
    mdf_pintado: { nombre: "Mueble de MDF pintado", corto: "MDF pintado", tipo: "mdf",    orden: 2 }
  };
  const CADENA = { madera: ["maquilado", "armado", "pintado"], mdf: ["mdf", "mdf_pintado"] };

  /* ── Piezas. Las puertas llevan cadena; cajones y parches no.
     "Puertas lijadas" es UNA pestaña con dos bloques: con bisagras (arriba) y sin
     bisagras (abajo). Solo las que ya tienen bisagras pueden pasar a pintadas. ── */
  const PIEZAS = {
    puertas_uriel:            { nombre: "Puertas Uriel",          corto: "Uriel",       unidad: "puertas", cadena: "puertas", orden: 1, pestana: "puertas_uriel",    ayuda: "disponibles para que Uriel las pre lije" },
    puertas_por_lijar:        { nombre: "Puertas por lijar",      corto: "Por lijar",   unidad: "puertas", cadena: "puertas", orden: 2, pestana: "puertas_por_lijar", ayuda: "ya pasaron por Uriel; se pueden lijar" },
    puertas_lijadas:          { nombre: "Puertas lijadas",        corto: "Lijadas",     unidad: "puertas", cadena: "puertas", orden: 3, pestana: "puertas_lijadas",  ayuda: "arriba las que ya tienen bisagras; abajo las que no", bloque: "Sin bisagras" },
    puertas_lijadas_bisagras: { nombre: "Puertas lijadas con bisagras", corto: "Con bisagras", unidad: "puertas", cadena: "puertas", orden: 3, pestana: "puertas_lijadas", ayuda: "lijadas y con bisagras: listas para pintar", bloque: "Con bisagras" },
    puertas_pintadas:         { nombre: "Puertas pintadas",       corto: "Pintadas",    unidad: "puertas", cadena: "puertas", orden: 4, pestana: "puertas_pintadas", ayuda: "" },
    cajones_pintados:         { nombre: "Cajones pintados",       corto: "Cajones",     unidad: "cajones", cadena: "",        orden: 5, pestana: "cajones_pintados", ayuda: "" },
    parches_pintados:         { nombre: "Parches pintados",       corto: "Parches",     unidad: "parches", cadena: "",        orden: 6, pestana: "parches_pintados", ayuda: "" }
  };
  /* Pestañas visibles (con bisagras vive dentro de "Puertas lijadas") */
  const PESTANAS_PIEZA = ["puertas_uriel", "puertas_por_lijar", "puertas_lijadas", "puertas_pintadas", "cajones_pintados", "parches_pintados"];
  const CADENA_PUERTAS = ["puertas_uriel", "puertas_por_lijar", "puertas_lijadas", "puertas_pintadas"];
  /* Nombres viejos (versión 2.0) → nuevos, para no perder lo ya capturado */
  const PIEZAS_VIEJAS = { puertas_pre_lijadas: "puertas_por_lijar", puertas_con_bisagras: "puertas_lijadas_bisagras" };

  /* ── Quién puede firmar cada paso. Solo estos nombres, nadie más. ── */
  const PINTORES_PIEZAS = ["Brandon", "Juan", "Antelmo", "Raúl", "Ángel", "Daniel", "Jorge"];
  const RESPONSABLES = {
    maquilado:                { opciones: ["Miguel", "Luis", "Daniel"],            max: 1, campo: "maquilo", pregunta: "¿Quién lo maquiló?" },
    armado:                   { opciones: ["Giovanni", "Luis", "Daniel"],               max: 1, campo: "armo",    pregunta: "¿Quién lo armó?" },
    pintado:                  { opciones: ["Brandon", "Antelmo", "Raúl", "Juan"],  max: 2, campo: "pinto",   pregunta: "¿Quién lo pintó?" },
    mdf:                      { opciones: ["Fernando"],                            max: 1, campo: "maquilo", pregunta: "¿Quién lo hizo?" },
    mdf_pintado:              null,                                                // no se pregunta: el lote sigue siendo de Fernando
    puertas_lijadas_bisagras: { opciones: ["Miguel", "Daniel", "Luis"],            max: 1, campo: "hecho_por", pregunta: "¿Quién puso las bisagras?" },
    cajones_pintados:         { opciones: PINTORES_PIEZAS,                         max: 1, campo: "hecho_por", pregunta: "¿Quién los pintó?" },
    // En puertas no se pregunta nada más: ni a Uriel, ni al lijar, ni al pintar.
    puertas_uriel: null, puertas_por_lijar: null, puertas_lijadas: null, puertas_pintadas: null, parches_pintados: null
  };

  const tipoDe = modelo => (modelo && modelo.tipo === "mdf") ? "mdf" : "madera";
  const cadenaDe = tipo => CADENA[tipo === "mdf" ? "mdf" : "madera"];
  const primeraEtapa = tipo => cadenaDe(tipo)[0];
  function siguienteEtapa(etapa){
    const c = CADENA[(ETAPAS[etapa] || {}).tipo] || [];
    const i = c.indexOf(etapa);
    return i >= 0 && i < c.length - 1 ? c[i + 1] : null;
  }
  /* Cadena de puertas: de "lijadas sin bisagras" NO se pinta; primero se embisagra. */
  function siguientePieza(cat){
    if (cat === "puertas_lijadas") return null;
    if (cat === "puertas_lijadas_bisagras") return "puertas_pintadas";
    const i = CADENA_PUERTAS.indexOf(cat);
    return i >= 0 && i < CADENA_PUERTAS.length - 1 ? CADENA_PUERTAS[i + 1] : null;
  }
  /* De dónde llega cada sección (para registrar desde el destino y que se descuente solo). */
  function anteriorPieza(cat){
    if (cat === "puertas_pintadas") return "puertas_lijadas_bisagras";
    if (cat === "puertas_lijadas_bisagras") return "puertas_lijadas";
    const i = CADENA_PUERTAS.indexOf(cat);
    return i > 0 ? CADENA_PUERTAS[i - 1] : null;
  }
  function anteriorEtapa(etapa){
    const c = CADENA[(ETAPAS[etapa] || {}).tipo] || [];
    const i = c.indexOf(etapa);
    return i > 0 ? c[i - 1] : null;
  }
  const embisagra = cat => cat === "puertas_lijadas" ? "puertas_lijadas_bisagras" : null;
  const pestanaDe = cat => (PIEZAS[cat] || {}).pestana || cat;
  const categoriasDePestana = pestana => Object.keys(PIEZAS).filter(c => PIEZAS[c].pestana === pestana).sort((a, b) => (PIEZAS[a].bloque === "Con bisagras" ? -1 : 1) - (PIEZAS[b].bloque === "Con bisagras" ? -1 : 1));
  /* ¿Aquí se puede registrar "de la nada"? Solo en la primera etapa. */
  const admiteAlta = etapa => etapa === "maquilado" || etapa === "mdf";
  const admiteAltaPieza = cat => cat === "puertas_uriel" || cat === "cajones_pintados" || cat === "parches_pintados";
  /* Piezas extras (las que el taller agrega por nombre): entran a Uriel y llegan hasta lijadas. */
  const esExtra = modelo => !!modelo && modelo.tipo === "extra";
  const extraAdmite = cat => ["puertas_uriel", "puertas_por_lijar", "puertas_lijadas", "puertas_lijadas_bisagras"].includes(cat);
  function siguientePiezaDe(cat, modelo){ const s = siguientePieza(cat); return (esExtra(modelo) && s && !extraAdmite(s)) ? null : s; }
  const responsables = paso => RESPONSABLES[paso] || null;

  /* Nombre visible de un lote según de quién viene. */
  function origenDe(lote){
    const partes = [];
    if (lote.maquilo) partes.push((lote.etapa === "mdf" || lote.etapa === "mdf_pintado" ? "hizo " : "maquiló ") + lote.maquilo);
    if (lote.armo && lote.armo !== lote.maquilo) partes.push("armó " + lote.armo);
    if (lote.pinto && lote.pinto.length) partes.push("pintó " + lote.pinto.join(" y "));
    return partes.join(" · ") || "sin responsable registrado";
  }
  /* Etiqueta corta del lote en la etapa actual: el último responsable que lo tocó. */
  function firmaDe(lote){
    if (lote.etapa === "pintado" && lote.pinto && lote.pinto.length) return lote.pinto.join(" y ");
    if (lote.etapa === "armado" && lote.armo) return lote.armo;
    if (lote.maquilo) return lote.maquilo;
    return "sin nombre";
  }

  /* ── Traslado: validar que no se tome más de lo que hay ── */
  function validaTraslado(lotes, tomas){
    const errores = [];
    let total = 0;
    tomas.forEach(t => {
      const n = Number(t.cantidad || 0);
      if (!Number.isInteger(n) || n < 0) errores.push("Cantidad inválida");
      const l = lotes.find(x => x.id === t.lote_id);
      if (!l) { errores.push("Ese lote ya no existe"); return; }
      if (n > Number(l.cantidad || 0)) errores.push(firmaDe(l) + ": solo hay " + l.cantidad + " disponibles");
      total += n;
    });
    if (!errores.length && total <= 0) errores.push("Pon cuántos pasan");
    return { ok: !errores.length, total, errores };
  }

  /* ── Equivalencias pieza → mueble ── */
  function piezasPorMueble(modelo, categoria){
    if (!modelo || esExtra(modelo)) return null;
    const p = PIEZAS[categoria] || {};
    if (p.unidad === "puertas") return Number.isFinite(modelo.total_puertas) ? modelo.total_puertas : null;
    if (p.unidad === "cajones") return Number.isFinite(modelo.cajones) ? modelo.cajones : null;
    return null;                                          // parches: no se traducen a muebles
  }
  /* 19 puertas con 2 por mueble → 9 muebles, sobra 1, falta 1 para el siguiente */
  function equivalencia(cantidad, porMueble){
    cantidad = Number(cantidad || 0);
    if (porMueble == null) return { sinFicha: true };
    if (porMueble === 0) return { noLleva: true };
    const muebles = Math.floor(cantidad / porMueble);
    const sobran = cantidad % porMueble;
    return { muebles, sobran, faltan: sobran ? porMueble - sobran : 0, porMueble };
  }
  const singular = u => ({ puertas: "puerta", cajones: "cajón", parches: "parche", piezas: "pieza" })[u] || u.replace(/s$/, "");
  function textoEquivalencia(cantidad, categoria, modelo){
    const p = PIEZAS[categoria] || { unidad: "piezas" };
    const base = cantidad + " " + (cantidad === 1 ? singular(p.unidad) : p.unidad);
    if (categoria === "parches_pintados") return base;
    if (esExtra(modelo)) return base + " · pieza extra";
    const e = equivalencia(cantidad, piezasPorMueble(modelo, categoria));
    if (e.sinFicha) return base + " · sin ficha, no se puede calcular";
    if (e.noLleva) return base + " · este modelo no lleva " + p.unidad;
    return base + " = " + e.muebles + (e.muebles === 1 ? " juego" : " juegos") + (e.sobran ? " · sobra" + (e.sobran === 1 ? "" : "n") + " " + e.sobran + " suelta" + (e.sobran === 1 ? "" : "s") + " (falta" + (e.faltan === 1 ? "" : "n") + " " + e.faltan + " para otro juego)" : "");
  }

  /* ── Listos para preparar ──
     pintados: muebles en la última etapa; piezas: {puertas_pintadas, cajones_pintados, parches_pintados} */
  function listos(modelo, pintados, piezas){
    piezas = piezas || {};
    const r = { listos: 0, pintados, detalle: [], faltanParches: false, sinFicha: false, limitante: "" };
    if (!modelo){ r.sinFicha = true; r.detalle.push("modelo sin ficha en el catálogo"); return r; }
    const necesita = [["total_puertas", "puertas_pintadas", "puertas"], ["cajones", "cajones_pintados", "cajones"]];
    let tope = pintados;
    r.detalle.push(pintados + " pintado" + (pintados === 1 ? "" : "s"));
    for (const [campo, cat, nombre] of necesita){
      const por = modelo[campo];
      if (por == null){ r.sinFicha = true; r.detalle.push("falta en la ficha cuántas " + nombre + " lleva"); continue; }
      if (por === 0){ r.detalle.push("no lleva " + nombre); continue; }
      const hay = Number(piezas[cat] || 0);
      const alcanza = Math.floor(hay / por);
      r.detalle.push(nombre + " para " + alcanza + (alcanza === 1 ? " mueble" : " muebles") + " (" + hay + " de " + por + " por mueble)");
      if (alcanza < tope){ tope = alcanza; r.limitante = nombre; }
    }
    if (r.sinFicha){ r.listos = 0; return r; }
    r.listos = Math.max(0, tope);
    if (modelo.lleva_parches === true && Number(piezas.parches_pintados || 0) === 0) r.faltanParches = true;
    if (modelo.lleva_parches === null || modelo.lleva_parches === undefined) r.detalle.push("la ficha no dice si lleva parches");
    if (r.listos < pintados && r.limitante){
      const por = r.limitante === "puertas" ? modelo.total_puertas : modelo.cajones;
      const hay = Number(piezas[r.limitante === "puertas" ? "puertas_pintadas" : "cajones_pintados"] || 0);
      const faltan = por * (r.listos + 1) - hay;
      r.detalle.push("faltan " + faltan + " " + r.limitante + " para el siguiente");
    }
    return r;
  }

  /* ── Ficha: ¿le falta algo? ── */
  function ficha(modelo){
    const faltan = [];
    if (!modelo) return { completa: false, faltan: ["modelo"] };
    ["cajones", "total_puertas"].forEach(k => { if (modelo[k] == null) faltan.push(k); });
    if (modelo.lleva_parches == null) faltan.push("lleva_parches");
    return { completa: !faltan.length, faltan };
  }

  const R = { ETAPAS, CADENA, PIEZAS, PESTANAS_PIEZA, CADENA_PUERTAS, PIEZAS_VIEJAS, RESPONSABLES, tipoDe, cadenaDe, primeraEtapa, siguienteEtapa, anteriorEtapa,
    siguientePieza, siguientePiezaDe, anteriorPieza, embisagra, pestanaDe, categoriasDePestana, admiteAlta, admiteAltaPieza, esExtra, extraAdmite,
    responsables, origenDe, firmaDe, validaTraslado, piezasPorMueble, equivalencia, textoEquivalencia, listos, ficha };
  if (typeof module !== "undefined" && module.exports) module.exports = R;
  raiz.Reglas = R;
})(typeof window !== "undefined" ? window : globalThis);
