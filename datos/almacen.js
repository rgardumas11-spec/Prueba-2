/* ═══════════════════════════════════════════════════════════════════════════
   Almacén — la capa de datos. Una sola cara para la pantalla, dos respaldos:
     · NUBE  (Firebase / Firestore): compartida entre todos, en vivo.
     · LOCAL (este aparato): cuando no hay llaves, no se ha entrado, o en
       modo práctica.
   La pantalla nunca sabe cuál está usando; solo pregunta `Almacen.modo`.

   Qué guarda:
     modelo      el catálogo (ficha de cada mueble), editable en la app
     lote        muebles en una etapa, con quién los maquiló / armó / pintó
     pieza       puertas, cajones y parches por modelo y color
     producto    material (cubetas y tambos)
     movimiento  bitácora: cada paso con fecha, hora, persona y responsables
     pedido, recado, persona

   Sin señal no hace falta cola propia: Firestore guarda lo que se hace y
   lo sube solo al volver. Las sumas y restas usan `increment`, que la
   base aplica de su lado, así que dos personas al mismo tiempo se suman
   en vez de pisarse. Los traslados entre etapas van en UN solo batch:
   o se hace todo o no se hace nada.
   ═══════════════════════════════════════════════════════════════════════════ */
window.Almacen = (() => {
  "use strict";
  const TABLAS = ["modelo", "lote", "pieza", "producto", "movimiento", "recado", "persona", "pedido"];
  const LIMITE = { movimiento: 600, recado: 200, pedido: 400, persona: 200, producto: 2000, modelo: 600, lote: 4000, pieza: 4000 };
  let fb = null;
  let db = null, auth = null;
  let modo = "local";
  let practica = false;
  let sesion = null;
  const prefijo = "alm.";
  const memoria = {};
  const oyentes = {};
  const estadoCb = [];
  let sueltas = [];
  let pendientes = 0;
  let sembrandoModelos = false;

  /* ── utilidades ── */
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random()*16|0; return (c === "x" ? r : (r&3|8)).toString(16); }));
  const llave = t => prefijo + (practica ? "practica." : "") + t;
  function leerLocal(t){ try { return JSON.parse(localStorage.getItem(llave(t)) || "{}"); } catch(e){ return {}; } }
  function guardarLocal(t){ try { localStorage.setItem(llave(t), JSON.stringify(memoria[t] || {})); } catch(e){} }
  function lista(t){ return Object.values(memoria[t] || {}); }
  function avisar(t){ (oyentes[t] || []).forEach(f => { try { f(lista(t)); } catch(e){ console.error(e); } }); }
  function avisarEstado(){ estadoCb.forEach(f => { try { f(); } catch(e){} }); }
  const ahora = () => new Date().toISOString();
  const enLinea = () => navigator.onLine !== false;
  const idDe = (t, f) => t === "persona" ? f.nombre : f.id;
  const slug = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  /* Las llaves de lote y pieza son deterministas: mismo origen → mismo documento.
     Así dos aparatos que suman "5 de Daniel" caen en el mismo lote y se suman. */
  const claveLote = l => ["l", l.modelo_id, slug(l.color), l.etapa, slug(l.maquilo), slug(l.armo), (l.pinto || []).map(slug).sort().join("+")].join("~");
  const clavePieza = p => ["p", p.modelo_id, slug(p.color), p.categoria].join("~");

  function cargarTodoLocal(){ TABLAS.forEach(t => { memoria[t] = leerLocal(t); }); migraPiezasViejas(); TABLAS.forEach(avisar); }

  /* Las secciones de puertas cambiaron de nombre en la versión 2.1. Lo que se haya
     capturado con el nombre viejo se pasa al nuevo (misma cantidad) y el documento
     viejo se borra. Se hace una sola vez por documento. */
  const migradas = new Set();
  function migraPiezasViejas(){
    const V = (window.Reglas || {}).PIEZAS_VIEJAS || {};
    const viejas = lista("pieza").filter(p => V[p.categoria] && !migradas.has(p.id));
    if (!viejas.length) return;
    const escrituras = [], movs = [];
    viejas.forEach(p => {
      migradas.add(p.id);
      const n = Number(p.cantidad || 0);
      const nueva = { modelo_id: p.modelo_id, modelo: p.modelo, color: p.color || "", categoria: V[p.categoria], minimo: Number(p.minimo || 0) };
      nueva.id = clavePieza(nueva);
      delete memoria.pieza[p.id];
      if (n > 0){
        escrituras.push(["pieza", nueva.id, incrementaLocal("pieza", nueva, n)]);
        movs.push({ id: uuid(), tipo: "ajuste", pieza_id: nueva.id, modelo_id: p.modelo_id, nombre: p.modelo, color: p.color || "", categoria: nueva.categoria,
          delta: 0, resultado: memoria.pieza[nueva.id].cantidad, persona: "sistema", motivo: "sección renombrada en la versión 2.1", origen: "", creado: ahora() });
      }
      if (modo === "nube" && db) enCamino(db.collection("pieza").doc(p.id).delete());
    });
    guardarLocal("pieza"); movs.forEach(movLocal);
    mandaBatch(escrituras, movs);
  }

  function enCamino(promesa){
    pendientes++; avisarEstado();
    return promesa.catch(falla).finally(() => { pendientes--; avisarEstado(); });
  }

  /* ── NUBE: escuchar ── */
  function consulta(t){
    let q = db.collection(t);
    if (t === "producto") return q.where("activo", "==", true).limit(LIMITE.producto);
    if (t === "persona" || t === "modelo" || t === "pieza") return q.limit(LIMITE[t]);
    if (t === "lote") return q.where("cantidad", ">", 0).limit(LIMITE.lote);
    return q.orderBy("creado", "desc").limit(LIMITE[t] || 300);
  }
  function escuchar(){
    dejarDeEscuchar();
    TABLAS.forEach(t => {
      const suelta = consulta(t).onSnapshot(
        snap => {
          const mapa = {};
          snap.forEach(d => { mapa[d.id] = Object.assign({}, d.data(), {id: d.id}); });
          memoria[t] = mapa;
          if (t === "pieza") migraPiezasViejas();
          guardarLocal(t);
          avisar(t);
          if (t === "modelo" && !Object.keys(mapa).length) sembrarModelos();
        },
        err => {
          console.warn("nube", t, err && err.code);
          if (err && (err.code === "permission-denied" || err.code === "unauthenticated")){
            modo = "local"; avisarEstado();
          }
        }
      );
      sueltas.push(suelta);
    });
  }
  function dejarDeEscuchar(){ sueltas.forEach(f => { try { f(); } catch(e){} }); sueltas = []; }

  /* ── arranque ── */
  async function arranca(){
    practica = localStorage.getItem("alm.practica") === "1";
    const C = window.CONFIG || {};
    const cfg = C.FIREBASE || {};
    const hayLlaves = cfg.apiKey && cfg.projectId && window.firebase;
    if (hayLlaves){
      try {
        fb = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
        auth = firebase.auth();
        db = firebase.firestore();
        try { await db.enablePersistence({ synchronizeTabs: true }); } catch(e){ /* otra pestaña ya la tiene */ }
        await new Promise(ok => {
          const q = auth.onAuthStateChanged(u => {
            sesion = u || null;
            if (!practica){ modo = u ? "nube" : "local"; if (u) conectar(); else dejarDeEscuchar(); }
            avisarEstado(); ok(); q();
          });
        });
        auth.onAuthStateChanged(u => {
          sesion = u || null;
          if (!practica){ modo = u ? "nube" : "local"; if (u) conectar(); else dejarDeEscuchar(); }
          avisarEstado();
        });
      } catch(e){ console.warn("firebase", e); fb = db = auth = null; modo = "local"; }
    } else {
      modo = "local";
    }
    cargarTodoLocal();
    if (modo === "local" && !lista("modelo").length) sembrarModelos();
    if (practica && !lista("lote").length && !lista("producto").length) sembrarPractica();
    if (modo === "nube") conectar();
    window.addEventListener("online", avisarEstado);
    window.addEventListener("offline", avisarEstado);
    avisarEstado();
    return modo;
  }
  function conectar(){ if (db && sesion && !practica) escuchar(); }

  /* ── sesión ── */
  const necesitaEntrar = () => !!auth && !sesion && !practica;
  async function entra(correo, clave){
    if (!auth) throw new Error("sin base");
    const cred = await auth.signInWithEmailAndPassword(correo.trim(), clave);
    sesion = cred.user; modo = "nube";
    conectar(); avisarEstado();
  }
  async function sale(){
    dejarDeEscuchar();
    if (auth) await auth.signOut();
    sesion = null; modo = "local"; avisarEstado();
  }

  /* ── modo práctica ── */
  async function setPractica(on){
    practica = !!on;
    localStorage.setItem("alm.practica", practica ? "1" : "0");
    if (practica){
      dejarDeEscuchar();
      modo = "local";
      cargarTodoLocal();
      if (!lista("modelo").length) sembrarModelos();
      if (!lista("lote").length && !lista("producto").length) sembrarPractica();
    } else {
      cargarTodoLocal();
      if (db && sesion){ modo = "nube"; conectar(); }
      else if (!lista("modelo").length) sembrarModelos();
    }
    avisarEstado();
  }

  /* El catálogo de arranque se sube UNA vez; después vive en la base y se edita en la app. */
  function sembrarModelos(){
    if (sembrandoModelos) return;
    const C = window.CATALOGO || {};
    const fichas = C.fichas || [];
    if (!fichas.length) return;
    sembrandoModelos = true;
    const t = ahora();
    memoria.modelo = memoria.modelo || {};
    const b = (modo === "nube" && db) ? db.batch() : null;
    fichas.forEach(f => {
      const m = Object.assign({}, f, { creado: t, actualizado: t, editado_por: "catálogo de arranque" });
      memoria.modelo[m.id] = m;
      if (b) b.set(db.collection("modelo").doc(m.id), m, {merge:true});
    });
    guardarLocal("modelo"); avisar("modelo");
    if (b) enCamino(b.commit()).finally(() => { sembrandoModelos = false; });
    else sembrandoModelos = false;
  }

  function sembrarPractica(){
    const C = window.CATALOGO || {};
    const yo = "Práctica";
    const mod = n => (C.fichas || []).find(f => f.nombre === n) || { id: slug(n), nombre: n };
    const lotes = [
      ["Monarca Midas", "Negro completo", "maquilado", 5, "Daniel", "", []],
      ["Monarca Midas", "Negro completo", "maquilado", 5, "Miguel", "", []],
      ["Monarca Midas", "Negro completo", "armado", 3, "Daniel", "Giovanni", []],
      ["Monarca Midas", "Negro completo", "pintado", 2, "Daniel", "Giovanni", ["Brandon", "Juan"]],
      ["Mariana Cisne", "Negro puertas cafés", "maquilado", 4, "Luis", "", []],
      ["Ropero Deysi", "Blanco completo", "pintado", 1, "Miguel", "Rafael", ["Antelmo"]],
      ["Monarca Círculo", "Negro completo", "pintado", 2, "Daniel", "Rafael", ["Raúl"]],
      ["Alacena Midas", "Blanco completo", "mdf", 3, "Fernando", "Fernando", []],
      ["Tocador Kitty", "Rosa con blanco", "mdf_pintado", 1, "Fernando", "Fernando", []]
    ];
    lotes.forEach(([n, color, etapa, cantidad, maquilo, armo, pinto]) => {
      const m = mod(n);
      const l = { modelo_id: m.id, modelo: m.nombre, color, etapa, cantidad, maquilo, armo, pinto, creado: ahora(), actualizado: ahora() };
      l.id = claveLote(l);
      memoria.lote = memoria.lote || {}; memoria.lote[l.id] = l;
    });
    const piezas = [
      ["Monarca Midas", "Negro completo", "puertas_pintadas", 19], ["Monarca Midas", "Negro completo", "cajones_pintados", 8],
      ["Monarca Midas", "Negro completo", "puertas_lijadas", 12], ["Monarca Midas", "Negro completo", "puertas_lijadas_bisagras", 6],
      ["Monarca Midas", "Negro completo", "puertas_por_lijar", 30], ["Monarca Midas", "Negro completo", "puertas_uriel", 40],
      ["Ropero Deysi", "Blanco completo", "puertas_pintadas", 6], ["Ropero Deysi", "Blanco completo", "cajones_pintados", 2],
      ["Monarca Círculo", "Negro completo", "puertas_pintadas", 20], ["Monarca Círculo", "Negro completo", "cajones_pintados", 9],
      ["Mariana Cisne", "Negro puertas cafés", "puertas_uriel", 10]
    ];
    piezas.forEach(([n, color, categoria, cantidad]) => {
      const m = mod(n);
      const p = { modelo_id: m.id, modelo: m.nombre, color, categoria, cantidad, minimo: 0, creado: ahora(), actualizado: ahora() };
      p.id = clavePieza(p);
      memoria.pieza = memoria.pieza || {}; memoria.pieza[p.id] = p;
    });
    guardarLocal("lote"); guardarLocal("pieza"); avisar("lote"); avisar("pieza");
    const cants = [2, 4, 1, 0, 2, 8];
    (C.arranqueMaterial || []).forEach((m, i) => pon("producto", Object.assign({
      tipo:"material", color:"", cantidad: cants[i] != null ? cants[i] : 3, minimo:2, por_quien:yo }, m)));
  }

  /* ── escritura genérica ── */
  function normaliza(t, fila){
    const f = Object.assign({}, fila);
    if (t === "persona"){ f.nombre = String(f.nombre || "").trim(); f.creado = f.creado || ahora(); return f; }
    if (!f.id) f.id = uuid();
    f.creado = f.creado || ahora();
    if (t === "producto"){ f.tocado = ahora(); f.activo = f.activo !== false; f.apodos = (f.apodos || []).slice(0,3); }
    if (t === "modelo"){ f.actualizado = ahora(); f.activo = f.activo !== false; }
    return f;
  }
  async function pon(t, fila){
    const f = normaliza(t, fila);
    const k = idDe(t, f);
    memoria[t] = memoria[t] || {};
    memoria[t][k] = f; guardarLocal(t); avisar(t);
    if (modo === "nube" && db) enCamino(db.collection(t).doc(k).set(f, {merge:true}));
    return f;
  }
  async function parcha(t, id, cambio){
    memoria[t] = memoria[t] || {};
    if (!memoria[t][id]) return;
    const c = Object.assign({}, cambio, t === "producto" ? {tocado: ahora()} : t === "modelo" ? {actualizado: ahora()} : {});
    if (t === "producto" && c.apodos) c.apodos = c.apodos.slice(0,3);
    memoria[t][id] = Object.assign({}, memoria[t][id], c);
    guardarLocal(t); avisar(t);
    if (modo === "nube" && db) enCamino(db.collection(t).doc(id).update(c));
  }
  async function borra(t, id){
    if (memoria[t]) delete memoria[t][id];
    guardarLocal(t); avisar(t);
    if (modo === "nube" && db) enCamino(db.collection(t).doc(id).delete());
  }

  /* Bitácora */
  function movLocal(mov){
    memoria.movimiento = memoria.movimiento || {};
    memoria.movimiento[mov.id] = mov; podar();
    guardarLocal("movimiento"); avisar("movimiento");
  }
  async function anota(mov){
    const f = Object.assign({ id: uuid(), creado: ahora(), delta:0, tipo:"ajuste" }, mov);
    movLocal(f);
    if (modo === "nube" && db) enCamino(db.collection("movimiento").doc(f.id).set(f));
    return f;
  }
  function podar(){
    const ids = Object.keys(memoria.movimiento || {});
    if (ids.length <= 1500) return;
    ids.sort((a,b) => memoria.movimiento[a].creado < memoria.movimiento[b].creado ? -1 : 1)
       .slice(0, ids.length - 1200).forEach(i => delete memoria.movimiento[i]);
  }

  /* Suma `delta` a un documento de lote/pieza en memoria y devuelve lo que
     hay que mandar a la nube (set con merge + increment). Si no existe, lo crea. */
  const firebaseInc = n => (window.firebase && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.increment(n) : n;
  function incrementaLocal(t, base, delta){
    memoria[t] = memoria[t] || {};
    const id = base.id;
    const ex = memoria[t][id];
    const t0 = ahora();
    if (ex){ ex.cantidad = Math.max(0, Number(ex.cantidad || 0) + delta); ex.actualizado = t0; }
    else memoria[t][id] = Object.assign({}, base, { cantidad: Math.max(0, delta), creado: t0, actualizado: t0 });
    const doc = Object.assign({}, base, { actualizado: t0, cantidad: firebaseInc(delta) });
    if (!ex) doc.creado = t0;
    return doc;
  }
  function mandaBatch(escrituras, movs){
    if (modo === "nube" && db){
      const b = db.batch();
      escrituras.forEach(([t, id, doc]) => b.set(db.collection(t).doc(id), doc, {merge:true}));
      movs.forEach(m => b.set(db.collection("movimiento").doc(m.id), m));
      enCamino(b.commit());
    }
  }
  const firmaDe = l => window.Reglas ? Reglas.firmaDe(l) : (l.maquilo || "");
  const origenDe = l => window.Reglas ? Reglas.origenDe(l) : (l.maquilo || "");

  /* ── MUEBLES: alta en la primera etapa ── */
  async function registra(d, persona, origen){
    const l = { modelo_id: d.modelo_id, modelo: d.modelo, color: d.color || "", etapa: d.etapa,
      maquilo: d.maquilo || "", armo: d.armo || "", pinto: (d.pinto || []).slice(0, 2) };
    l.id = claveLote(l);
    const n = Math.max(0, Math.floor(Number(d.cantidad || 0)));
    if (!n) return null;
    const doc = incrementaLocal("lote", l, n);
    const mov = { id: uuid(), tipo: "alta", lote_id: l.id, modelo_id: l.modelo_id, nombre: l.modelo, color: l.color,
      etapa_a: l.etapa, delta: n, resultado: memoria.lote[l.id].cantidad, persona, origen: origen || "",
      hecho_por: [l.maquilo, l.armo].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(" y "), motivo: d.motivo || "", creado: ahora() };
    guardarLocal("lote"); avisar("lote"); movLocal(mov);
    mandaBatch([["lote", l.id, doc]], [mov]);
    return memoria.lote[l.id];
  }

  /* ── MUEBLES: pasar de una etapa a la siguiente. Un solo batch. ── */
  async function traslada(d, persona, origen){
    const tomas = (d.tomas || []).map(t => ({ lote_id: t.lote_id, cantidad: Math.floor(Number(t.cantidad || 0)) })).filter(t => t.cantidad > 0);
    if (!tomas.length) throw new Error("Pon cuántos pasan");
    // Primero se valida todo contra lo que hay; si algo falla, no se toca nada.
    for (const t of tomas){
      const o = (memoria.lote || {})[t.lote_id];
      if (!o) throw new Error("Ese lote ya no existe");
      if (t.cantidad > Number(o.cantidad || 0)) throw new Error(firmaDe(o) + ": solo hay " + o.cantidad + " disponibles");
    }
    const escrituras = [], desglose = [];
    let total = 0, resultado = 0, ejemplo = null;
    for (const t of tomas){
      const o = memoria.lote[t.lote_id];
      ejemplo = o;
      const destino = { modelo_id: o.modelo_id, modelo: o.modelo, color: o.color, etapa: d.etapa_a,
        maquilo: o.maquilo || "", armo: d.armo != null ? d.armo : (o.armo || ""), pinto: d.pinto ? d.pinto.slice(0, 2) : (o.pinto || []) };
      destino.id = claveLote(destino);
      const origenBase = { modelo_id: o.modelo_id, modelo: o.modelo, color: o.color, etapa: o.etapa, maquilo: o.maquilo || "", armo: o.armo || "", pinto: o.pinto || [], id: o.id };
      escrituras.push(["lote", o.id, incrementaLocal("lote", origenBase, -t.cantidad)]);
      escrituras.push(["lote", destino.id, incrementaLocal("lote", destino, t.cantidad)]);
      desglose.push({ de: origenDe(o), lote_id: o.id, cantidad: t.cantidad });
      total += t.cantidad; resultado = memoria.lote[destino.id].cantidad;
    }
    const firma = [d.armo, ...(d.pinto || [])].filter(Boolean).join(" y ");
    const mov = { id: uuid(), tipo: "traslado", modelo_id: ejemplo.modelo_id, nombre: ejemplo.modelo, color: ejemplo.color,
      etapa_de: ejemplo.etapa, etapa_a: d.etapa_a, delta: total, resultado, desglose, hecho_por: firma, persona, origen: origen || "", motivo: d.motivo || "", creado: ahora() };
    guardarLocal("lote"); avisar("lote"); movLocal(mov);
    mandaBatch(escrituras, [mov]);
    return mov;
  }

  /* ── MUEBLES: corrección de un lote (se rompió, se contó mal). Siempre con motivo. ── */
  async function ajustaLote(id, delta, persona, motivo, origen){
    const o = (memoria.lote || {})[id]; if (!o) return null;
    delta = Math.floor(Number(delta || 0));
    const real = Math.max(0, Number(o.cantidad || 0) + delta) - Number(o.cantidad || 0);
    if (!real) return o.cantidad;
    const base = { modelo_id: o.modelo_id, modelo: o.modelo, color: o.color, etapa: o.etapa, maquilo: o.maquilo || "", armo: o.armo || "", pinto: o.pinto || [], id: o.id };
    const doc = incrementaLocal("lote", base, real);
    const mov = { id: uuid(), tipo: "ajuste", lote_id: id, modelo_id: o.modelo_id, nombre: o.modelo, color: o.color, etapa_a: o.etapa,
      delta: real, resultado: memoria.lote[id].cantidad, persona, motivo: motivo || "", origen: origen || "", hecho_por: firmaDe(o), creado: ahora() };
    guardarLocal("lote"); avisar("lote"); movLocal(mov);
    mandaBatch([["lote", id, doc]], [mov]);
    return memoria.lote[id].cantidad;
  }

  /* ── PIEZAS: alta, ajuste y paso a la siguiente sección ── */
  function basePieza(d){
    const p = { modelo_id: d.modelo_id, modelo: d.modelo, color: d.color || "", categoria: d.categoria, minimo: Number(d.minimo || 0) };
    p.id = clavePieza(p); return p;
  }
  async function ajustaPieza(d, delta, persona, motivo, origen, hechoPor, tipo){
    const p = basePieza(d);
    const ex = (memoria.pieza || {})[p.id];
    if (ex) p.minimo = Number(ex.minimo || 0);
    delta = Math.floor(Number(delta || 0));
    const antes = ex ? Number(ex.cantidad || 0) : 0;
    const real = Math.max(0, antes + delta) - antes;
    if (!real) return antes;
    const doc = incrementaLocal("pieza", p, real);
    const mov = { id: uuid(), tipo: tipo || (real > 0 ? "entrada" : "salida"), pieza_id: p.id, modelo_id: p.modelo_id, nombre: p.modelo, color: p.color,
      categoria: p.categoria, delta: real, resultado: memoria.pieza[p.id].cantidad, persona, motivo: motivo || "", origen: origen || "", hecho_por: hechoPor || "", creado: ahora() };
    guardarLocal("pieza"); avisar("pieza"); movLocal(mov);
    mandaBatch([["pieza", p.id, doc]], [mov]);
    return memoria.pieza[p.id].cantidad;
  }
  async function trasladaPieza(d, persona, origen){
    const o = (memoria.pieza || {})[d.pieza_id]; if (!o) throw new Error("Esa sección ya no existe");
    const n = Math.floor(Number(d.cantidad || 0));
    if (n <= 0) throw new Error("Pon cuántas pasan");
    if (n > Number(o.cantidad || 0)) throw new Error("Solo hay " + o.cantidad + " disponibles");
    const origenBase = basePieza(o); origenBase.minimo = Number(o.minimo || 0);
    const destino = basePieza({ modelo_id: o.modelo_id, modelo: o.modelo, color: o.color, categoria: d.categoria_a });
    const exd = (memoria.pieza || {})[destino.id]; if (exd) destino.minimo = Number(exd.minimo || 0);
    const escrituras = [["pieza", o.id, incrementaLocal("pieza", origenBase, -n)], ["pieza", destino.id, incrementaLocal("pieza", destino, n)]];
    const mov = { id: uuid(), tipo: "traslado", pieza_id: destino.id, modelo_id: o.modelo_id, nombre: o.modelo, color: o.color,
      categoria: d.categoria_a, etapa_de: o.categoria, etapa_a: d.categoria_a, delta: n, resultado: memoria.pieza[destino.id].cantidad,
      hecho_por: d.hecho_por || "", persona, origen: origen || "", motivo: d.motivo || "", creado: ahora() };
    guardarLocal("pieza"); avisar("pieza"); movLocal(mov);
    mandaBatch(escrituras, [mov]);
    return mov;
  }

  /* ── MATERIAL: sumar o restar envases ── */
  async function ajusta(id, delta, persona, motivo, origen, hechoPor){
    const p = (memoria.producto || {})[id];
    if (!p) return null;
    const antes = Number(p.cantidad || 0);
    const nuevo = Math.max(0, antes + delta);
    const real = nuevo - antes;
    p.cantidad = nuevo; p.tocado = ahora(); p.por_quien = persona;
    guardarLocal("producto"); avisar("producto");
    const mov = { id: uuid(), producto_id:id, nombre:p.nombre, color:p.color || "",
      tipo: real > 0 ? "entrada" : "salida", delta: real, resultado: nuevo,
      persona, motivo: motivo || "", origen: origen || "", hecho_por: hechoPor || "", creado: ahora() };
    if (real === 0) return nuevo;
    if (modo === "nube" && db){
      const lote = db.batch();
      lote.update(db.collection("producto").doc(id), { cantidad: firebaseInc(real), tocado: ahora(), por_quien: persona });
      lote.set(db.collection("movimiento").doc(mov.id), mov);
      enCamino(lote.commit());
    } else movLocal(mov);
    return nuevo;
  }

  /* ── Lo que quedó de la versión anterior (artículos de mueble sueltos) ── */
  const viejos = () => lista("producto").filter(p => p.tipo === "mueble" && p.activo !== false);

  function falla(e){
    console.warn("almacén:", e);
    const c = String(e && e.code || "");
    if (!window.grita) return;
    if (/permission-denied|unauthenticated/.test(c)) grita("Se perdió la sesión. Vuelve a entrar.");
    else if (/unavailable/.test(c)) grita("Sin señal: se guardó aquí y se sube después.");
    else if (/quota|resource-exhausted/.test(c)) grita("La base llegó a su límite del día.");
    else grita("No se pudo guardar en la nube.");
  }

  return {
    get modo(){ return modo; },
    get practica(){ return practica; },
    get sesion(){ return sesion; },
    get pendientes(){ return pendientes; },
    get enLinea(){ return enLinea(); },
    get hayNube(){ return !!db; },
    arranca, necesitaEntrar, entra, sale, setPractica,
    mira(t, cb){ (oyentes[t] = oyentes[t] || []).push(cb); cb(lista(t)); },
    onEstado(cb){ estadoCb.push(cb); },
    lista, dame(t, id){ return (memoria[t] || {})[id] || null; },
    pon, parcha, borra, anota, ajusta,
    registra, traslada, ajustaLote, ajustaPieza, trasladaPieza, viejos,
    claveLote, clavePieza
  };
})();
