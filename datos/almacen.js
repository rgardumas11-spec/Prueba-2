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
  const TABLAS = ["modelo", "lote", "pieza", "producto", "movimiento", "recado", "persona", "pedido", "meta", "plan"];
  const LIMITE = { movimiento: 1500, recado: 300, pedido: 400, persona: 200, producto: 2000, modelo: 600, lote: 4000, pieza: 4000, meta: 50, plan: 400 };
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
  const sinPermiso = {};   // colecciones a las que Firebase negó el acceso (falta su regla)

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
  const partesClave = p => Object.keys(p || {}).filter(k => p[k]).sort().join("+");
  const claveLote = l => ["l", l.modelo_id, slug(l.color), l.etapa, slug(l.maquilo), slug(l.armo), (l.pinto || []).map(slug).sort().join("+")].concat(l.preparo ? [slug(l.preparo)] : []).concat(l.etapa === "preparado" ? ["c" + partesClave(l.partes)] : []).join("~");
  const baseLote = o => Object.assign({ modelo_id: o.modelo_id, modelo: o.modelo, color: o.color || "", etapa: o.etapa, maquilo: o.maquilo || "", armo: o.armo || "", pinto: o.pinto || [], preparo: o.preparo || "", id: o.id }, o.etapa === "preparado" ? { partes: o.partes || {} } : {});
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
    if (t === "persona" || t === "modelo" || t === "pieza" || t === "meta" || t === "plan") return q.limit(LIMITE[t]);
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
          if (err && err.code === "unauthenticated"){ modo = "local"; avisarEstado(); }
          else if (err && err.code === "permission-denied"){ sinPermiso[t] = true; avisarEstado(); }   // una colección sin regla no tumba la sesión
        }
      );
      sueltas.push(suelta);
    });
  }
  function dejarDeEscuchar(){ sueltas.forEach(f => { try { f(); } catch(e){} }); sueltas = []; Object.keys(sinPermiso).forEach(k => delete sinPermiso[k]); }

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
      ["Ropero Deysi", "Blanco completo", "pintado", 1, "Miguel", "Giovanni", ["Antelmo"]],
      ["Monarca Círculo", "Negro completo", "pintado", 2, "Daniel", "Giovanni", ["Raúl"]],
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
    let total = 0, resultado = 0, ejemplo = null, ultimoDestino = null;
    for (const t of tomas){
      const o = memoria.lote[t.lote_id];
      ejemplo = o;
      const destino = { modelo_id: o.modelo_id, modelo: o.modelo, color: d.color_a != null ? d.color_a : (o.color || ""), etapa: d.etapa_a,
        maquilo: o.maquilo || "", armo: d.armo != null ? d.armo : (o.armo || ""), pinto: d.pinto ? d.pinto.slice(0, 2) : (o.pinto || []), preparo: d.preparo != null ? d.preparo : (o.preparo || "") };
      destino.id = claveLote(destino);
      const origenBase = baseLote(o);
      escrituras.push(["lote", o.id, incrementaLocal("lote", origenBase, -t.cantidad)]);
      escrituras.push(["lote", destino.id, incrementaLocal("lote", destino, t.cantidad)]);
      desglose.push({ de: origenDe(o), lote_id: o.id, cantidad: t.cantidad });
      total += t.cantidad; resultado = memoria.lote[destino.id].cantidad; ultimoDestino = destino.id;
    }
    const firma = [d.armo, ...(d.pinto || []), d.preparo].filter(Boolean).join(" y ");
    const mov = { id: uuid(), tipo: "traslado", modelo_id: ejemplo.modelo_id, nombre: ejemplo.modelo, color: d.color_a != null ? d.color_a : (ejemplo.color || ""),
      etapa_de: ejemplo.etapa, etapa_a: d.etapa_a, delta: total, resultado, desglose, lote_a: ultimoDestino, hecho_por: firma, persona, origen: origen || "", motivo: d.motivo || "", creado: ahora() };
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
    const base = baseLote(o);
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
    const destino = basePieza({ modelo_id: o.modelo_id, modelo: o.modelo, color: d.color_a != null ? d.color_a : (o.color || ""), categoria: d.categoria_a });
    const exd = (memoria.pieza || {})[destino.id]; if (exd) destino.minimo = Number(exd.minimo || 0);
    const escrituras = [["pieza", o.id, incrementaLocal("pieza", origenBase, -n)], ["pieza", destino.id, incrementaLocal("pieza", destino, n)]];
    const mov = { id: uuid(), tipo: "traslado", pieza_id: destino.id, modelo_id: o.modelo_id, nombre: o.modelo, color: destino.color,
      categoria: d.categoria_a, etapa_de: o.categoria, etapa_a: d.categoria_a, delta: n, resultado: memoria.pieza[destino.id].cantidad, pieza_de: o.id,
      hecho_por: d.hecho_por || "", persona, origen: origen || "", motivo: d.motivo || "", creado: ahora() };
    guardarLocal("pieza"); avisar("pieza"); movLocal(mov);
    mandaBatch(escrituras, [mov]);
    return mov;
  }


  /* ── PREPARAR: mueble pintado + puertas, cajones y parches pintados → Mueble preparado.
     Un solo batch. Si no alcanza algo, no se toca nada y se dice qué falta. ── */
  function piezasPara(modelo_id, color, categoria){
    // Como lego: sirven las piezas del modelo de CUALQUIER color. Se toman primero las del
    // mismo color, luego las que no tienen color, luego las demás (las que más haya).
    const peso = p => (p.color || "") === (color || "") ? 0 : !p.color ? 1 : 2;
    return lista("pieza").filter(p => p.modelo_id === modelo_id && p.categoria === categoria && Number(p.cantidad || 0) > 0)
      .sort((a, b) => peso(a) - peso(b) || Number(b.cantidad || 0) - Number(a.cantidad || 0));
  }
  function revisaPreparar(lote, n, cuales){
    const Rg = window.Reglas; const m = (memoria.modelo || {})[lote.modelo_id] || null;
    const nec = Rg.necesitaParaPreparar(m, n, cuales);
    const partes = [], faltan = [], sinFicha = [];
    Object.keys(nec).forEach(cat => {
      const necesita = nec[cat];
      if (necesita == null){ sinFicha.push(cat); return; }
      if (necesita === 0) return;
      const fuentes = piezasPara(lote.modelo_id, lote.color, cat);
      const hay = fuentes.reduce((s, p) => s + Number(p.cantidad || 0), 0);
      partes.push({ cat, necesita, hay, fuentes });
      if (hay < necesita) faltan.push({ cat, faltan: necesita - hay, hay, necesita });
    });
    return { modelo: m, partes, faltan, sinFicha };
  }
  async function prepara(d, persona, origen){
    const o = (memoria.lote || {})[d.lote_id]; if (!o) throw new Error("Ese lote ya no existe");
    const n = Math.floor(Number(d.cantidad || 0)); if (n <= 0) throw new Error("Pon cuántos se prepararon");
    if (n > Number(o.cantidad || 0)) throw new Error("Solo hay " + o.cantidad + (o.etapa === "preparado" ? " preparados" : " pintados"));
    const partes = d.partes || { puertas: true, cajones: true, parches: true, respaldo: true };
    const ya = o.etapa === "preparado" ? (o.partes || {}) : {};
    const nuevas = {}; Object.keys(partes).forEach(k => { if (partes[k] && !ya[k]) nuevas[k] = true; });
    if (!Object.keys(nuevas).length) throw new Error("Marca qué se le puso");
    const rev = revisaPreparar(o, n, nuevas);
    if (rev.faltan.length){ const f = rev.faltan[0]; const Rg = window.Reglas; throw new Error("Faltan " + f.faltan + " " + Rg.PIEZAS[f.cat].nombre.toLowerCase() + " (hay " + f.hay + ", se necesitan " + f.necesita + ")"); }
    const escrituras = [], desglose = [];
    escrituras.push(["lote", o.id, incrementaLocal("lote", baseLote(o), -n)]);
    const union = Object.assign({}, ya); Object.keys(nuevas).forEach(k => union[k] = true);
    const destino = Object.assign(baseLote(o), { etapa: "preparado", preparo: d.preparo || o.preparo || "", partes: union }); delete destino.id; destino.id = claveLote(destino);
    escrituras.push(["lote", destino.id, incrementaLocal("lote", destino, n)]);
    rev.partes.forEach(pt => {
      let resta = pt.necesita;
      pt.fuentes.forEach(p => {
        if (resta <= 0) return;
        const toma = Math.min(resta, Number(p.cantidad || 0)); resta -= toma;
        const base = basePieza(p); base.minimo = Number(p.minimo || 0);
        escrituras.push(["pieza", p.id, incrementaLocal("pieza", base, -toma)]);
        desglose.push({ de: window.Reglas.PIEZAS[pt.cat].nombre + (p.color ? " · " + p.color : ""), pieza_id: p.id, cantidad: toma });
      });
    });
    const mov = { id: uuid(), tipo: "preparado", lote_id: destino.id, lote_de: o.id, modelo_id: o.modelo_id, nombre: o.modelo, color: o.color || "", etapa_de: o.etapa, etapa_a: "preparado",
      delta: n, resultado: memoria.lote[destino.id].cantidad, desglose, hecho_por: d.preparo || o.preparo || "", persona, origen: origen || "",
      motivo: "se puso: " + Object.keys(nuevas).join(", ") + (rev.sinFicha.length ? " · la ficha no dice cuántos " + rev.sinFicha.map(c => window.Reglas.PIEZAS[c].unidad).join(" ni ") + " lleva; no se descontaron" : ""), creado: ahora() };
    guardarLocal("lote"); guardarLocal("pieza"); avisar("lote"); avisar("pieza"); movLocal(mov);
    await manda(escrituras, [mov]);
    return mov;
  }

  /* ── PLAN DEL DÍA: se descuenta del origen ahora y queda pendiente hasta que alguien
     diga "listo" (entra al destino) o lo quite (regresa al origen). ── */
  function origenPlan(p){
    const t = p.tipo === "lote" ? "lote" : "pieza";
    const ex = (memoria[t] || {})[p.origen_id];
    const base = ex ? (t === "lote" ? baseLote(ex) : Object.assign(basePieza(ex), { minimo: Number(ex.minimo || 0) })) : Object.assign({}, p.base, { id: p.origen_id });
    return { t, base };
  }
  async function alPlan(d, persona, origen){
    const t = d.tipo === "lote" ? "lote" : "pieza";
    const o = (memoria[t] || {})[d.origen_id]; if (!o) throw new Error("Eso ya no está en el inventario");
    const n = Math.floor(Number(d.cantidad || 0)); if (n <= 0) throw new Error("Pon cuántas");
    if (n > Number(o.cantidad || 0)) throw new Error("Solo hay " + o.cantidad);
    const base = t === "lote" ? baseLote(o) : Object.assign(basePieza(o), { minimo: Number(o.minimo || 0) });
    const plan = { id: uuid(), tipo: t, origen_id: o.id, modelo_id: o.modelo_id, modelo: o.modelo, color: o.color || "", de: t === "lote" ? o.etapa : o.categoria, a: d.a,
      cantidad: n, juegos: d.juegos || null, autorizo: d.autorizo || "", de_quien: persona, creado: ahora(), base: Object.assign({}, base, { id: undefined }) };
    delete plan.base.id;
    const escrituras = [[t, o.id, incrementaLocal(t, base, -n)], ["plan", plan.id, plan]];
    memoria.plan = memoria.plan || {}; memoria.plan[plan.id] = plan;
    const mov = { id: uuid(), tipo: "plan", [t + "_id"]: o.id, modelo_id: o.modelo_id, nombre: o.modelo, color: o.color || "", etapa_de: plan.de, etapa_a: d.a, delta: -n,
      resultado: memoria[t][o.id].cantidad, persona, origen: origen || "", motivo: "al plan del día" + (d.autorizo ? " · " + d.autorizo : ""), creado: ahora() };
    guardarLocal(t); guardarLocal("plan"); avisar(t); avisar("plan"); movLocal(mov);
    await manda(escrituras, [mov]);
    return plan;
  }
  async function planListo(id, hechas, extra, persona, origen){
    const p = (memoria.plan || {})[id]; if (!p) throw new Error("Ese pendiente ya no está");
    hechas = Math.floor(Number(hechas || 0)); if (hechas < 0 || hechas > p.cantidad) throw new Error("Pon entre 0 y " + p.cantidad);
    extra = extra || {};
    const { t, base } = origenPlan(p);
    const escrituras = [["plan", id, null]], movs = [];
    const sobran = p.cantidad - hechas;
    if (hechas > 0){
      let destino;
      if (t === "lote"){
        destino = Object.assign({}, base, { etapa: p.a, color: extra.color != null ? extra.color : base.color, armo: extra.armo != null ? extra.armo : base.armo, pinto: extra.pinto ? extra.pinto.slice(0, 2) : base.pinto, preparo: extra.preparo != null ? extra.preparo : base.preparo });
        delete destino.id; destino.id = claveLote(destino);
      } else {
        destino = basePieza({ modelo_id: base.modelo_id, modelo: base.modelo, color: extra.color != null ? extra.color : base.color, categoria: p.a });
        const exd = (memoria.pieza || {})[destino.id]; destino.minimo = exd ? Number(exd.minimo || 0) : 0;
      }
      escrituras.push([t, destino.id, incrementaLocal(t, destino, hechas)]);
      movs.push({ id: uuid(), tipo: "traslado", [t + "_id"]: destino.id, modelo_id: base.modelo_id, nombre: base.modelo, color: destino.color, categoria: t === "pieza" ? p.a : undefined,
        etapa_de: p.de, etapa_a: p.a, delta: hechas, resultado: memoria[t][destino.id].cantidad, hecho_por: extra.hecho_por || "", persona, origen: origen || "", motivo: "plan del día" + (p.autorizo ? " · " + p.autorizo : ""), creado: ahora() });
    }
    if (sobran > 0){
      escrituras.push([t, base.id, incrementaLocal(t, base, sobran)]);
      movs.push({ id: uuid(), tipo: "ajuste", [t + "_id"]: base.id, modelo_id: base.modelo_id, nombre: base.modelo, color: base.color, categoria: t === "pieza" ? p.de : undefined,
        etapa_a: p.de, delta: sobran, resultado: memoria[t][base.id].cantidad, persona, origen: origen || "", motivo: "regresó del plan del día (no se hizo)", creado: ahora() });
    }
    delete memoria.plan[id];
    guardarLocal(t); guardarLocal("plan"); avisar(t); avisar("plan"); movs.forEach(movLocal);
    await manda(escrituras, movs);
    return { hechas, sobran };
  }
  async function planCambia(id, nueva, persona, origen){
    const p = (memoria.plan || {})[id]; if (!p) throw new Error("Ese pendiente ya no está");
    nueva = Math.floor(Number(nueva || 0)); if (nueva <= 0) throw new Error("Pon cuántas (o quítalo con la ✕)");
    const dif = nueva - p.cantidad; if (!dif) return p;
    const { t, base } = origenPlan(p);
    const disponible = Number(((memoria[t] || {})[base.id] || {}).cantidad || 0);
    if (dif > disponible) throw new Error("Solo quedan " + disponible + " en el inventario");
    p.cantidad = nueva; if (p.juegos && p.base) p.juegos = null;
    const escrituras = [[t, base.id, incrementaLocal(t, base, -dif)], ["plan", id, { cantidad: nueva, juegos: p.juegos }]];
    const mov = { id: uuid(), tipo: "plan", [t + "_id"]: base.id, modelo_id: base.modelo_id, nombre: base.modelo, color: base.color, etapa_de: p.de, etapa_a: p.a, delta: -dif,
      resultado: memoria[t][base.id].cantidad, persona, origen: origen || "", motivo: "cambió la cantidad del plan del día", creado: ahora() };
    guardarLocal(t); guardarLocal("plan"); avisar(t); avisar("plan"); movLocal(mov);
    await manda(escrituras, [mov]);
    return p;
  }
  async function planQuita(id, persona, origen){
    const p = (memoria.plan || {})[id]; if (!p) return;
    const { t, base } = origenPlan(p);
    const escrituras = [[t, base.id, incrementaLocal(t, base, p.cantidad)], ["plan", id, null]];
    const mov = { id: uuid(), tipo: "ajuste", [t + "_id"]: base.id, modelo_id: base.modelo_id, nombre: base.modelo, color: base.color, categoria: t === "pieza" ? p.de : undefined, etapa_a: p.de, delta: p.cantidad,
      resultado: memoria[t][base.id].cantidad, persona, origen: origen || "", motivo: "se quitó del plan del día", creado: ahora() };
    delete memoria.plan[id];
    guardarLocal(t); guardarLocal("plan"); avisar(t); avisar("plan"); movLocal(mov);
    await manda(escrituras, [mov]);
  }


  /* ── DESHACER un movimiento: deja las cosas como estaban antes de él. ── */
  function sePinta(k){ return window.Reglas ? Reglas.sePintaEn(k) : false; }
  function piezaOrigenDe(mov){
    if (mov.pieza_de && (memoria.pieza || {})[mov.pieza_de]) return (memoria.pieza || {})[mov.pieza_de];
    const cands = lista("pieza").filter(p => p.modelo_id === mov.modelo_id && p.categoria === mov.etapa_de);
    const mismo = cands.filter(p => (p.color || "") === (mov.color || ""));
    if (mismo.length === 1) return mismo[0];
    const sin = cands.filter(p => !p.color);
    if (sin.length === 1) return sin[0];
    if (cands.length === 1) return cands[0];
    if (!cands.length) return basePieza({ modelo_id: mov.modelo_id, modelo: mov.nombre, color: sePinta(mov.etapa_a) ? "" : (mov.color || ""), categoria: mov.etapa_de });
    return null;
  }
  async function deshaz(mov_id, persona, origen){
    const mov = (memoria.movimiento || {})[mov_id]; if (!mov) throw new Error("Ese movimiento ya no está en la bitácora");
    if (mov.deshecho) throw new Error("Ese movimiento ya se deshizo");
    const escrituras = []; const tocadas = new Set();
    const ajustaDoc = (t, base, delta) => { const doc = incrementaLocal(t, base, delta); escrituras.push([t, base.id, doc]); tocadas.add(t); };
    const baseDeMov = () => {
      if (mov.pieza_id){ const ex = (memoria.pieza || {})[mov.pieza_id]; if (ex) return ["pieza", Object.assign(basePieza(ex), { minimo: Number(ex.minimo || 0) })]; const b = basePieza({ modelo_id: mov.modelo_id, modelo: mov.nombre, color: mov.color || "", categoria: mov.categoria || mov.etapa_a }); b.id = mov.pieza_id; return ["pieza", b]; }
      if (mov.lote_id){ const ex = (memoria.lote || {})[mov.lote_id]; if (ex) return ["lote", baseLote(ex)]; return null; }
      return null;
    };
    const d = Number(mov.delta || 0);
    if (mov.tipo === "ajuste" || mov.tipo === "alta" || mov.tipo === "entrada" || mov.tipo === "salida"){
      if (mov.producto_id) throw new Error("El material se corrige con − y +");
      const b = baseDeMov(); if (!b) throw new Error("No encuentro a qué renglón pertenece");
      if (!d) throw new Error("Ese movimiento no cambió cantidades");
      ajustaDoc(b[0], b[1], -d);
    } else if (mov.tipo === "traslado" && mov.pieza_id){
      const dest = (memoria.pieza || {})[mov.pieza_id]; const bd = dest ? Object.assign(basePieza(dest), { minimo: Number(dest.minimo || 0) }) : Object.assign(basePieza({ modelo_id: mov.modelo_id, modelo: mov.nombre, color: mov.color || "", categoria: mov.categoria || mov.etapa_a }), { id: mov.pieza_id });
      const ori = piezaOrigenDe(mov); if (!ori) throw new Error("Hay varias secciones de origen posibles; corrígelo a mano");
      ajustaDoc("pieza", bd, -d); ajustaDoc("pieza", Object.assign(basePieza(ori), { minimo: Number(ori.minimo || 0) }), d);
    } else if (mov.tipo === "traslado" && mov.desglose){
      if (mov.producto_id) throw new Error("Los tambos se corrigen con − y +");
      let destId = mov.lote_a;
      if (!destId){ const o = (memoria.lote || {})[(mov.desglose[0] || {}).lote_id]; if (!o) throw new Error("No encuentro el lote de origen"); const dd = Object.assign(baseLote(o), { etapa: mov.etapa_a, color: mov.color || o.color }); delete dd.id; destId = claveLote(dd); }
      const dest = (memoria.lote || {})[destId]; if (!dest) throw new Error("No encuentro el lote al que llegó");
      ajustaDoc("lote", baseLote(dest), -d);
      mov.desglose.forEach(x => { const o = (memoria.lote || {})[x.lote_id]; if (!o) throw new Error("No encuentro el lote de origen " + (x.de || "")); ajustaDoc("lote", baseLote(o), Number(x.cantidad || 0)); });
    } else if (mov.tipo === "preparado"){
      const dest = (memoria.lote || {})[mov.lote_id]; if (!dest) throw new Error("No encuentro el lote preparado");
      let ori = mov.lote_de ? (memoria.lote || {})[mov.lote_de] : null;
      if (!ori){ const bo = baseLote(dest); bo.etapa = mov.etapa_de; bo.preparo = ""; delete bo.partes; delete bo.id; bo.id = claveLote(bo); ori = (memoria.lote || {})[bo.id] || bo; }
      ajustaDoc("lote", baseLote(dest), -d); ajustaDoc("lote", baseLote(ori), d);
      (mov.desglose || []).forEach(x => { if (!x.pieza_id) return; const pz = (memoria.pieza || {})[x.pieza_id]; if (!pz) throw new Error("No encuentro la pieza " + (x.de || "")); ajustaDoc("pieza", Object.assign(basePieza(pz), { minimo: Number(pz.minimo || 0) }), Number(x.cantidad || 0)); });
    } else throw new Error("Ese tipo de movimiento no se deshace desde aquí");
    mov.deshecho = true; mov.deshecho_por = persona; escrituras.push(["movimiento", mov.id, { deshecho: true, deshecho_por: persona }]);
    const nuevo = { id: uuid(), tipo: "deshecho", de_mov: mov.id, modelo_id: mov.modelo_id, nombre: mov.nombre, color: mov.color || "", etapa_a: mov.etapa_de || mov.etapa_a || mov.categoria, categoria: mov.categoria, delta: -d,
      persona, origen: origen || "", motivo: "deshizo: " + (mov.tipo === "traslado" ? "paso " + (mov.etapa_de || "") + " → " + (mov.etapa_a || "") : mov.tipo) + " de " + (mov.persona || "?") + (mov.motivo ? " (" + mov.motivo + ")" : ""), creado: ahora() };
    tocadas.forEach(t => { guardarLocal(t); avisar(t); }); movLocal(mov); movLocal(nuevo);
    await manda(escrituras, [nuevo]);
    return nuevo;
  }

  /* ── FUSIONAR NOMBRES (migración): todo lo que esté con un nombre "mal escrito" pasa
     al modelo correcto del catálogo: renglones de pedidos, lotes y piezas. ── */
  async function fusionaModelo(de, aId, persona, origen){
    // de: { nombre, modelo_id? }  aId: id del modelo correcto
    const a = (memoria.modelo || {})[aId]; if (!a) throw new Error("No existe el modelo destino");
    const nombreDe = String(de.nombre || "").trim(); const idDe = de.modelo_id || null;
    const escrituras = [], movs = []; let n = 0;
    const mismoNombre = x => sinAcentoL(x) === sinAcentoL(nombreDe);
    // pedidos
    lista("pedido").forEach(p => {
      let toco = false;
      const lineas = (p.lineas || []).map(l => { if (!l.surtido && l.modelo && mismoNombre(l.modelo)){ toco = true; return Object.assign({}, l, { modelo: a.nombre }); } return l; });
      if (toco){ p.lineas = lineas; escrituras.push(["pedido", p.id, { lineas }]); n++; }
    });
    // lotes y piezas
    ["lote", "pieza"].forEach(t => {
      lista(t).filter(x => (idDe && x.modelo_id === idDe) || (!idDe && mismoNombre(x.modelo))).forEach(x => {
        const cant = Number(x.cantidad || 0);
        const nuevo = t === "lote" ? baseLote(Object.assign({}, x, { modelo_id: a.id, modelo: a.nombre })) : Object.assign(basePieza(Object.assign({}, x, { modelo_id: a.id, modelo: a.nombre })), { minimo: Number(x.minimo || 0) });
        delete nuevo.id; nuevo.id = t === "lote" ? claveLote(nuevo) : clavePieza(nuevo);
        delete memoria[t][x.id]; escrituras.push([t, x.id, null]);
        if (cant > 0){
          escrituras.push([t, nuevo.id, incrementaLocal(t, nuevo, cant)]);
          movs.push({ id: uuid(), tipo: "ajuste", [t + "_id"]: nuevo.id, modelo_id: a.id, nombre: a.nombre, color: x.color || "", etapa_a: t === "lote" ? x.etapa : x.categoria, categoria: t === "pieza" ? x.categoria : undefined,
            delta: 0, resultado: memoria[t][nuevo.id].cantidad, persona, origen: origen || "", motivo: "corrección de nombre: «" + x.modelo + "» → «" + a.nombre + "»", creado: ahora() });
        }
        n++;
      });
    });
    // el modelo viejo (genérico / por revisar) se desactiva si existía
    if (idDe && idDe !== a.id && memoria.modelo[idDe]){
      memoria.modelo[idDe] = Object.assign({}, memoria.modelo[idDe], { activo: false, editado_por: persona, actualizado: ahora(), nota: "fusionado con " + a.nombre });
      escrituras.push(["modelo", idDe, { activo: false, editado_por: persona, actualizado: ahora(), nota: "fusionado con " + a.nombre }]);
    }
    movs.push({ id: uuid(), tipo: "catalogo", modelo_id: a.id, nombre: a.nombre, persona, origen: origen || "", motivo: "«" + nombreDe + "» se fusionó con «" + a.nombre + "» (" + n + " renglones)", creado: ahora() });
    ["pedido", "lote", "pieza", "modelo"].forEach(t => { guardarLocal(t); avisar(t); }); movs.forEach(movLocal);
    await manda(escrituras, movs);
    return n;
  }
  const sinAcentoL = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  /* ── Correcciones fijas a pedidos ya cargados (una vez, con meta) ── */
  async function arreglaPedidos(arreglo, persona){
    const escrituras = []; let n = 0;
    lista("pedido").forEach(p => {
      let toco = false; let lineas = (p.lineas || []).slice();
      (arreglo.cambios || []).forEach(c => {
        if (c.cliente && sinAcentoL(p.cliente) !== sinAcentoL(c.cliente)) return;
        lineas = lineas.map(l => {
          if (!l || sinAcentoL(l.modelo) !== sinAcentoL(c.modelo)) return l;
          if (c.color != null && (l.color || "") !== c.color) return l;
          toco = true; n++;
          if (c.borrar) return null;
          return Object.assign({}, l, c.pon || {});
        }).filter(Boolean);
      });
      if (toco){
        lineas = lineas.map(l => Object.assign({}, l, { entregado: Math.min(Number(l.cantidad || 0), Number(l.entregado || 0)) }));
        const completo = lineas.length && lineas.every(l => Number(l.entregado || 0) >= Number(l.cantidad || 0));
        p.lineas = lineas; p.estado = completo ? "entregado" : "pendiente";
        escrituras.push(["pedido", p.id, { lineas, estado: p.estado }]);
      }
    });
    const meta = { id: arreglo.id, hecho: ahora(), por: persona, renglones: n };
    memoria.meta = memoria.meta || {}; memoria.meta[meta.id] = meta; escrituras.push(["meta", meta.id, meta]);
    guardarLocal("pedido"); avisar("pedido"); guardarLocal("meta"); avisar("meta");
    await manda(escrituras, []);
    return n;
  }

  /* ── Semana del taller: sábado → viernes. El domingo a las 12 de la noche (lunes 00:00)
     se borra lo de la semana pasada: recados ya hechos y movimientos; lotes y piezas en 0. ── */
  function inicioSemana(d){
    const x = new Date(d || Date.now()); x.setHours(0, 0, 0, 0);
    const dia = x.getDay(); // 0 dom … 6 sáb
    x.setDate(x.getDate() - ((dia + 1) % 7));
    return x;
  }
  let limpiada = false;
  async function limpiaSemana(){
    if (limpiada) return 0; limpiada = true;
    const sab = inicioSemana(); const lun = new Date(sab); lun.setDate(lun.getDate() + 2);
    if (Date.now() < lun.getTime()) return 0;  // sábado y domingo: la semana pasada todavía se ve
    const corte = sab.toISOString(), corteRec = lun.toISOString();
    const escrituras = []; let n = 0;
    lista("recado").filter(r => r.hecho && (r.hecho_en || r.creado) < corteRec).forEach(r => { delete memoria.recado[r.id]; escrituras.push(["recado", r.id, null]); n++; });
    lista("movimiento").filter(m => (m.creado || "") < corte).forEach(m => { delete memoria.movimiento[m.id]; escrituras.push(["movimiento", m.id, null]); n++; });
    ["lote", "pieza"].forEach(t => lista(t).filter(x => Number(x.cantidad || 0) <= 0 && (x.actualizado || x.creado || "") < corte).forEach(x => { delete memoria[t][x.id]; escrituras.push([t, x.id, null]); n++; }));
    if (!n) return 0;
    ["recado", "movimiento", "lote", "pieza"].forEach(t => { guardarLocal(t); avisar(t); });
    await manda(escrituras, []);
    return n;
  }

  /* ── MATERIAL: sumar o restar envases ── */
  async function ajusta(id, delta, persona, motivo, origen, hechoPor, donde){
    const p = (memoria.producto || {})[id];
    if (!p) return null;
    const campo = donde === "cabina" ? "cabina" : "cantidad";
    const antes = Number(p[campo] || 0);
    const nuevo = Math.max(0, antes + delta);
    const real = nuevo - antes;
    p[campo] = nuevo; p.tocado = ahora(); p.por_quien = persona;
    guardarLocal("producto"); avisar("producto");
    const mov = { id: uuid(), producto_id:id, nombre:p.nombre, color:p.color || "",
      tipo: real > 0 ? "entrada" : "salida", delta: real, resultado: nuevo, donde: campo === "cabina" ? "cabina" : "almacén",
      persona, motivo: motivo || "", origen: origen || "", hecho_por: hechoPor || "", creado: ahora() };
    if (real === 0) return nuevo;
    if (modo === "nube" && db){
      const lote = db.batch();
      const cambio = { tocado: ahora(), por_quien: persona }; cambio[campo] = firebaseInc(real);
      lote.update(db.collection("producto").doc(id), cambio);
      lote.set(db.collection("movimiento").doc(mov.id), mov);
      enCamino(lote.commit());
    } else movLocal(mov);
    return nuevo;
  }

  /* ── Carga inicial: borra TODO el inventario de muebles y piezas y pone la lista.
     Va en lotes de 400 escrituras (tope de Firestore). Material no se toca. ── */
  async function manda(escrituras, movs){
    if (!(modo === "nube" && db)) return;
    const ops = [];
    escrituras.forEach(([t, id, doc]) => ops.push(b => doc === null ? b.delete(db.collection(t).doc(id)) : b.set(db.collection(t).doc(id), doc, {merge:true})));
    movs.forEach(m => ops.push(b => b.set(db.collection("movimiento").doc(m.id), m)));
    for (let i = 0; i < ops.length; i += 400){
      const b = db.batch(); ops.slice(i, i + 400).forEach(f => f(b));
      await enCamino(b.commit());
    }
  }
  /* Convierte el archivo de carga (nombres y juegos) a renglones con modelo_id y puertas.
     Devuelve también lo que NO se pudo resolver, para decirlo en vez de inventar. */
  function preparaCarga(carga){
    const porNombre = {};
    lista("modelo").concat(carga.modelos || []).forEach(m => { porNombre[m.nombre] = m; });
    const fuera = [], muebles = [], piezas = [];
    (carga.muebles || []).forEach(([nombre, etapa, cantidad, color, maquilo, armo]) => {
      const m = porNombre[nombre]; if (!m){ fuera.push(nombre + " (" + etapa + ")"); return; }
      muebles.push({ modelo_id: m.id, etapa, cantidad, color: color || "", maquilo: maquilo || "", armo: armo || "" });
    });
    (carga.juegos || []).forEach(([nombre, categoria, juegos, color]) => {
      const m = porNombre[nombre]; if (!m){ fuera.push(nombre + " (" + categoria + ")"); return; }
      const por = m.total_puertas;
      if (por == null || por === 0){ fuera.push(nombre + ": " + juegos + " juegos, pero la ficha no dice cuántas puertas lleva"); return; }
      piezas.push({ modelo_id: m.id, categoria, cantidad: juegos * por, color: color || "", juegos });
    });
    (carga.piezas || []).forEach(x => piezas.push(x));
    return { modelos: carga.modelos || [], muebles, piezas, fuera, id: carga.id, motivo: carga.motivo };
  }
  async function cargaInicial(cargaCruda, persona, origen){
    const carga = preparaCarga(cargaCruda);
    const t0 = ahora();
    const escrituras = [], movs = [];
    // 1) modelos nuevos (en amarillo: pendiente de revisar)
    memoria.modelo = memoria.modelo || {};
    (carga.modelos || []).forEach(m => {
      if (memoria.modelo[m.id]) return;
      const f = Object.assign({ activo: true, creado: t0, actualizado: t0, editado_por: "carga inicial", pendiente: true }, m);
      memoria.modelo[f.id] = f; escrituras.push(["modelo", f.id, f]);
    });
    // 2) borrar lotes y piezas
    Object.keys(memoria.lote || {}).forEach(id => escrituras.push(["lote", id, null]));
    Object.keys(memoria.pieza || {}).forEach(id => escrituras.push(["pieza", id, null]));
    memoria.lote = {}; memoria.pieza = {};
    // 3) muebles
    (carga.muebles || []).forEach(x => {
      const m = memoria.modelo[x.modelo_id]; if (!m) return;
      const l = { modelo_id: m.id, modelo: m.nombre, color: x.color || "", etapa: x.etapa, maquilo: x.maquilo || "", armo: x.armo || "", pinto: x.pinto || [] };
      l.id = claveLote(l);
      escrituras.push(["lote", l.id, incrementaLocal("lote", l, x.cantidad)]);
      movs.push({ id: uuid(), tipo: "alta", lote_id: l.id, modelo_id: m.id, nombre: m.nombre, color: l.color, etapa_a: l.etapa, delta: x.cantidad,
        resultado: memoria.lote[l.id].cantidad, persona, origen: origen || "", hecho_por: [l.maquilo, l.armo].filter(Boolean).filter((a, i, arr) => arr.indexOf(a) === i).join(" y "), motivo: carga.motivo || "carga inicial", creado: ahora() });
    });
    // 4) piezas
    (carga.piezas || []).forEach(x => {
      const m = memoria.modelo[x.modelo_id]; if (!m) return;
      const p = { modelo_id: m.id, modelo: m.nombre, color: x.color || "", categoria: x.categoria, minimo: 0 };
      p.id = clavePieza(p);
      escrituras.push(["pieza", p.id, incrementaLocal("pieza", p, x.cantidad)]);
      movs.push({ id: uuid(), tipo: "alta", pieza_id: p.id, modelo_id: m.id, nombre: m.nombre, color: p.color, categoria: p.categoria, delta: x.cantidad,
        resultado: memoria.pieza[p.id].cantidad, persona, origen: origen || "", hecho_por: "", motivo: carga.motivo || "carga inicial", creado: ahora() });
    });
    // 5) marca para no repetir
    const meta = { id: carga.id, hecho: t0, por: persona, renglones: movs.length };
    memoria.meta = memoria.meta || {}; memoria.meta[meta.id] = meta; escrituras.push(["meta", meta.id, meta]);
    ["modelo", "lote", "pieza", "meta"].forEach(t => { guardarLocal(t); avisar(t); });
    movs.forEach(movLocal);
    await manda(escrituras, movs);
    return { renglones: movs.length, fuera: carga.fuera };
  }
  const cargaHecha = id => !!(memoria.meta || {})[id];

  /* ── Tambos: del almacén a la cabina de pintura (un solo batch) ── */
  async function aCabina(id, n, persona, origen){
    const p = (memoria.producto || {})[id]; if (!p) throw new Error("Ese producto ya no está");
    n = Math.floor(Number(n || 0));
    if (n <= 0) throw new Error("Pon cuántos pasan");
    if (n > Number(p.cantidad || 0)) throw new Error("Solo hay " + Number(p.cantidad || 0) + " en el almacén");
    p.cantidad = Number(p.cantidad || 0) - n; p.cabina = Number(p.cabina || 0) + n; p.tocado = ahora(); p.por_quien = persona;
    guardarLocal("producto"); avisar("producto");
    const mov = { id: uuid(), tipo: "traslado", producto_id: id, nombre: p.nombre, color: "", etapa_de: "almacén", etapa_a: "cabina",
      delta: n, resultado: p.cabina, persona, origen: origen || "", motivo: "", creado: ahora() };
    movLocal(mov);
    if (modo === "nube" && db){
      const b = db.batch();
      b.update(db.collection("producto").doc(id), { cantidad: firebaseInc(-n), cabina: firebaseInc(n), tocado: ahora(), por_quien: persona });
      b.set(db.collection("movimiento").doc(mov.id), mov);
      enCamino(b.commit());
    }
    return mov;
  }

  /* ── Carga de pintura: suma a los que existen (por nombre) y crea los nuevos ── */
  async function cargaMaterial(carga, persona, origen){
    const t0 = ahora();
    const porNombre = {}; lista("producto").filter(p => p.tipo === "material" && p.activo !== false).forEach(p => { porNombre[p.nombre.trim().toUpperCase()] = p; });
    const escrituras = [], movs = [];
    memoria.producto = memoria.producto || {};
    (carga.material || []).forEach(x => {
      let p = porNombre[x.nombre.trim().toUpperCase()];
      const nuevo = !p;
      if (nuevo){
        p = { id: uuid(), tipo: "material", nombre: x.nombre, apodos: x.apodos || [], marca: x.marca || "", codigo: "", barras: "", presentacion: x.presentacion || "",
          categoria: x.presentacion === "Tambo" ? "Tambos" : "Cubetas", litros: x.litros == null ? null : x.litros, cantidad: 0, cabina: 0, minimo: 0, activo: true, creado: t0, tocado: t0, por_quien: persona, color: "" };
        memoria.producto[p.id] = p; porNombre[p.nombre.trim().toUpperCase()] = p;
      }
      const alm = Number(x.cantidad || 0), cab = Number(x.cabina || 0);
      p.cantidad = Number(p.cantidad || 0) + alm; p.cabina = Number(p.cabina || 0) + cab; p.tocado = t0;
      const doc = nuevo ? Object.assign({}, p) : { cantidad: firebaseInc(alm), cabina: firebaseInc(cab), tocado: t0, por_quien: persona };
      // La hoja dice en qué envase viene (tambo o cubeta); si el producto ya existía con otro, se corrige.
      if (!nuevo && x.presentacion && p.presentacion !== x.presentacion){ p.presentacion = x.presentacion; p.categoria = x.presentacion === "Tambo" ? "Tambos" : "Cubetas"; doc.presentacion = p.presentacion; doc.categoria = p.categoria; }
      escrituras.push(["producto", p.id, doc]);
      if (alm) movs.push({ id: uuid(), tipo: "entrada", producto_id: p.id, nombre: p.nombre, color: "", delta: alm, resultado: p.cantidad, donde: "almacén", persona, origen: origen || "", motivo: carga.motivo || "carga", creado: ahora() });
      if (cab) movs.push({ id: uuid(), tipo: "entrada", producto_id: p.id, nombre: p.nombre, color: "", delta: cab, resultado: p.cabina, donde: "cabina", persona, origen: origen || "", motivo: carga.motivo || "carga", creado: ahora() });
    });
    const meta = { id: carga.id, hecho: t0, por: persona, renglones: movs.length };
    memoria.meta = memoria.meta || {}; memoria.meta[meta.id] = meta; escrituras.push(["meta", meta.id, meta]);
    guardarLocal("producto"); avisar("producto"); guardarLocal("meta"); avisar("meta");
    movs.forEach(movLocal);
    await manda(escrituras, movs);
    return { renglones: movs.length };
  }

  /* ── Carga de pedidos de la libreta: se suman a los que haya (un solo batch) ── */
  async function cargaPedidos(carga, persona, origen){
    const t0 = ahora();
    const escrituras = [];
    memoria.pedido = memoria.pedido || {};
    (carga.pedidos || []).forEach(x => {
      const lineas = (x.lineas || []).map(([modelo, color, cantidad, entregado, extra]) => Object.assign({ modelo, color: color || "", cantidad: Number(cantidad || 0), entregado: Math.min(Number(cantidad || 0), Number(entregado || 0)) }, extra || {}));
      const completo = lineas.length && lineas.every(l => l.entregado >= l.cantidad);
      const p = { id: uuid(), cliente: x.cliente, fecha: x.fecha || null, lineas, notas: x.notas || "", estado: completo ? "entregado" : "pendiente", de: persona, origen: origen || "", creado: ahora() };
      memoria.pedido[p.id] = p; escrituras.push(["pedido", p.id, p]);
    });
    const meta = { id: carga.id, hecho: t0, por: persona, renglones: escrituras.length };
    memoria.meta = memoria.meta || {}; memoria.meta[meta.id] = meta; escrituras.push(["meta", meta.id, meta]);
    guardarLocal("pedido"); avisar("pedido"); guardarLocal("meta"); avisar("meta");
    await manda(escrituras, []);
    return { renglones: escrituras.length - 1 };
  }

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
    get sinPermiso(){ return Object.keys(sinPermiso); },
    arranca, necesitaEntrar, entra, sale, setPractica,
    mira(t, cb){ (oyentes[t] = oyentes[t] || []).push(cb); cb(lista(t)); },
    onEstado(cb){ estadoCb.push(cb); },
    lista, dame(t, id){ return (memoria[t] || {})[id] || null; },
    pon, parcha, borra, anota, ajusta,
    registra, traslada, ajustaLote, ajustaPieza, trasladaPieza, aCabina,
    cargaInicial, cargaMaterial, cargaPedidos, cargaHecha, preparaCarga, claveLote, clavePieza,
    prepara, revisaPreparar, deshaz, alPlan, planListo, planCambia, planQuita, fusionaModelo, arreglaPedidos, inicioSemana, limpiaSemana
  };
})();
