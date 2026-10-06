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
    mdf_pintado: { nombre: "Mueble de MDF pintado", corto: "MDF pintado", tipo: "mdf",    orden: 2 },
    preparado:   { nombre: "Mueble preparado",      corto: "Preparado",   tipo: "ambos",  orden: 4 }
  };
  /* Preparado es la etapa final de las dos cadenas: mueble pintado + puertas, cajones y
     parches pintados se unen y salen de sus secciones. */
  const CADENA = { madera: ["maquilado", "armado", "pintado", "preparado"], mdf: ["mdf", "mdf_pintado", "preparado"] };
  const ETAPAS_VISIBLES = ["maquilado", "armado", "pintado", "mdf", "mdf_pintado", "preparado"];

  /* ── Piezas. Las puertas llevan cadena; cajones y parches no.
     "Puertas lijadas" es UNA pestaña con dos bloques: con bisagras (arriba) y sin
     bisagras (abajo). Solo las que ya tienen bisagras pueden pasar a pintadas. ── */
  const PIEZAS = {
    puertas_uriel:            { nombre: "Puertas Uriel",          corto: "Uriel",       unidad: "puertas", cadena: "puertas", orden: 1, pestana: "puertas_uriel",    ayuda: "disponibles para que Uriel las pre lije" },
    puertas_por_lijar:        { nombre: "Puertas por lijar",      corto: "Por lijar",   unidad: "puertas", cadena: "puertas", orden: 2, pestana: "puertas_por_lijar", ayuda: "ya pasaron por Uriel; se pueden lijar" },
    puertas_lijadas:          { nombre: "Puertas lijadas",        corto: "Lijadas",     unidad: "puertas", cadena: "puertas", orden: 3, pestana: "puertas_lijadas",  ayuda: "arriba las que ya tienen bisagras; abajo las que no", bloque: "Sin bisagras" },
    puertas_lijadas_bisagras: { nombre: "Puertas lijadas con bisagras", corto: "Con bisagras", unidad: "puertas", cadena: "puertas", orden: 3, pestana: "puertas_lijadas", ayuda: "lijadas y con bisagras: listas para pintar", bloque: "Con bisagras" },
    puertas_pintadas:         { nombre: "Puertas pintadas",       corto: "Pintadas",    unidad: "puertas", cadena: "puertas", orden: 4, pestana: "puertas_pintadas", ayuda: "" },
    cajones_armados:          { nombre: "Cajones armados",        corto: "C. armados",  unidad: "cajones", cadena: "cajones", orden: 5, pestana: "cajones_armados",  ayuda: "armados, todavía sin pintar" },
    cajones_pintados:         { nombre: "Cajones pintados",       corto: "C. pintados", unidad: "cajones", cadena: "cajones", orden: 6, pestana: "cajones_pintados", ayuda: "" },
    parches_por_lijar:        { nombre: "Parches por lijar",      corto: "P. por lijar", unidad: "parches", cadena: "parches", orden: 7, pestana: "parches_por_lijar", ayuda: "solo modelos cuya ficha dice cuántos parches llevan" },
    parches_lijados:          { nombre: "Parches lijados",        corto: "P. lijados",  unidad: "parches", cadena: "parches", orden: 8, pestana: "parches_lijados",  ayuda: "" },
    parches_pintados:         { nombre: "Parches pintados",       corto: "P. pintados", unidad: "parches", cadena: "parches", orden: 9, pestana: "parches_pintados", ayuda: "" }
  };
  /* Pestañas visibles (con bisagras vive dentro de "Puertas lijadas") */
  const PESTANAS_PIEZA = ["puertas_uriel", "puertas_por_lijar", "puertas_lijadas", "puertas_pintadas", "cajones_armados", "cajones_pintados", "parches_por_lijar", "parches_lijados", "parches_pintados"];
  const CADENA_PUERTAS = ["puertas_uriel", "puertas_por_lijar", "puertas_lijadas", "puertas_pintadas"];
  const CADENA_CAJONES = ["cajones_armados", "cajones_pintados"];
  const CADENA_PARCHES = ["parches_por_lijar", "parches_lijados", "parches_pintados"];
  const cadenaPieza = cat => { const p = PIEZAS[cat] || {}; return p.cadena === "cajones" ? CADENA_CAJONES : p.cadena === "parches" ? CADENA_PARCHES : CADENA_PUERTAS; };
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
    preparado:                { opciones: ["César", "Raúl", "Gabino"],             max: 1, campo: "preparo", pregunta: "¿Quién lo preparó?" },
    puertas_lijadas_bisagras: { opciones: ["Miguel", "Daniel", "Luis"],            max: 1, campo: "hecho_por", pregunta: "¿Quién puso las bisagras?" },
    cajones_pintados:         { opciones: PINTORES_PIEZAS,                         max: 1, campo: "hecho_por", pregunta: "¿Quién los pintó?" },
    // En puertas no se pregunta nada más: ni a Uriel, ni al lijar, ni al pintar. Cajones armados y parches tampoco.
    puertas_uriel: null, puertas_por_lijar: null, puertas_lijadas: null, puertas_pintadas: null,
    cajones_armados: null, parches_por_lijar: null, parches_lijados: null, parches_pintados: null
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
    const c = cadenaPieza(cat); const i = c.indexOf(cat);
    return i >= 0 && i < c.length - 1 ? c[i + 1] : null;
  }
  /* De dónde llega cada sección (para registrar desde el destino y que se descuente solo). */
  function anteriorPieza(cat){
    if (cat === "puertas_pintadas") return "puertas_lijadas_bisagras";
    if (cat === "puertas_lijadas_bisagras") return "puertas_lijadas";
    const c = cadenaPieza(cat); const i = c.indexOf(cat);
    return i > 0 ? c[i - 1] : null;
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
  const admiteAltaPieza = cat => cat === "puertas_uriel" || cat === "cajones_armados" || cat === "parches_por_lijar";
  /* ¿Al entrar aquí se pinta? (se pide color) */
  const sePintaEn = destino => destino === "pintado" || destino === "mdf_pintado" || destino === "puertas_pintadas" || destino === "cajones_pintados" || destino === "parches_pintados";
  /* Cuántos parches lleva un modelo: número nuevo, o lo viejo (sí/no) si no se ha puesto número. */
  const parchesDe = modelo => !modelo ? null : Number.isFinite(modelo.parches) ? modelo.parches : (modelo.lleva_parches === false ? 0 : null);
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
    if (lote.preparo) partes.push("preparó " + lote.preparo);
    if (lote.etapa === "preparado" && lote.partes) partes.push("con " + Object.keys(lote.partes).filter(k => lote.partes[k]).join(", "));
    return partes.join(" · ") || "sin responsable registrado";
  }
  /* Etiqueta corta del lote en la etapa actual: el último responsable que lo tocó. */
  function firmaDe(lote){
    if (lote.etapa === "preparado" && lote.preparo) return lote.preparo;
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
    if (p.unidad === "parches") return parchesDe(modelo);
    return null;
  }
  /* ── Preparar como lego: cada parte se pone cuando se puede. ──
     componentes(modelo): lo que la ficha dice que lleva (solo eso). respaldo no tiene stock. */
  const COMPONENTES = [
    { k: "puertas",  nombre: "Puertas pintadas", cat: "puertas_pintadas", por: m => Number.isFinite(m.total_puertas) ? m.total_puertas : null },
    { k: "cajones",  nombre: "Cajones pintados", cat: "cajones_pintados", por: m => Number.isFinite(m.cajones) ? m.cajones : null },
    { k: "parches",  nombre: "Parches pintados", cat: "parches_pintados", por: m => parchesDe(m) },
    { k: "respaldo", nombre: "Respaldo",         cat: null,               por: m => m.lleva_respaldo === true ? 1 : m.lleva_respaldo === false ? 0 : null }
  ];
  function componentes(modelo){
    if (!modelo) return [];
    return COMPONENTES.map(c => ({ k: c.k, nombre: c.nombre, cat: c.cat, por: c.por(modelo) })).filter(c => c.por == null || c.por > 0);
  }
  const partesDe = lote => (lote && lote.partes) || {};
  const faltanPartes = (modelo, lote) => componentes(modelo).filter(c => c.por !== null && !partesDe(lote)[c.k]);
  const partesTexto = (modelo, lote) => componentes(modelo).filter(c => partesDe(lote)[c.k]).map(c => c.k).join(", ");
  const completo = (modelo, lote) => !!modelo && componentes(modelo).every(c => c.por === null || partesDe(lote)[c.k]);
  /* Qué piezas pintadas se descuentan al preparar n muebles con estas partes. null = la ficha no lo dice. */
  function necesitaParaPreparar(modelo, n, partes){
    n = Number(n || 0); partes = partes || { puertas: true, cajones: true, parches: true };
    const r = {};
    componentes(modelo).forEach(c => { if (c.cat && partes[c.k]) r[c.cat] = c.por == null ? null : c.por * n; });
    return r;
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
    const parches = parchesDe(modelo);
    if (parches > 0){
      const hayP = Number(piezas.parches_pintados || 0); const alcanzaP = Math.floor(hayP / parches);
      r.detalle.push("parches para " + alcanzaP + (alcanzaP === 1 ? " mueble" : " muebles") + " (" + hayP + " de " + parches + " por mueble)");
      if (alcanzaP < r.listos){ r.listos = alcanzaP; r.limitante = "parches"; }
      if (hayP === 0) r.faltanParches = true;
    }
    if (parches == null) r.detalle.push("la ficha no dice cuántos parches lleva");
    if (r.listos < pintados && r.limitante){
      const por = r.limitante === "puertas" ? modelo.total_puertas : r.limitante === "parches" ? parchesDe(modelo) : modelo.cajones;
      const hay = Number(piezas[r.limitante === "puertas" ? "puertas_pintadas" : r.limitante === "parches" ? "parches_pintados" : "cajones_pintados"] || 0);
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
    if (parchesDe(modelo) == null) faltan.push("parches");
    return { completa: !faltan.length, faltan };
  }

  const R = { ETAPAS, ETAPAS_VISIBLES, CADENA, PIEZAS, PESTANAS_PIEZA, CADENA_PUERTAS, CADENA_CAJONES, CADENA_PARCHES, PIEZAS_VIEJAS, RESPONSABLES, tipoDe, cadenaDe, primeraEtapa, siguienteEtapa, anteriorEtapa,
    siguientePieza, siguientePiezaDe, anteriorPieza, cadenaPieza, embisagra, pestanaDe, categoriasDePestana, admiteAlta, admiteAltaPieza, sePintaEn, parchesDe, necesitaParaPreparar, componentes, faltanPartes, partesTexto, completo, esExtra, extraAdmite,
    responsables, origenDe, firmaDe, validaTraslado, piezasPorMueble, equivalencia, textoEquivalencia, listos, ficha };
  if (typeof module !== "undefined" && module.exports) module.exports = R;
  raiz.Reglas = R;
})(typeof window !== "undefined" ? window : globalThis);
