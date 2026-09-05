/* ═══════════════════════════════════════════════════════════════════════════
   Almacén — la capa de datos. Una sola cara para la pantalla, dos respaldos:
     · NUBE  (Firebase / Firestore): compartida entre todos, en vivo.
     · LOCAL (este aparato): cuando no hay llaves, no se ha entrado, o en
       modo práctica.
   La pantalla nunca sabe cuál está usando; solo pregunta `Almacen.modo`.

   Sin señal no hace falta cola propia: Firestore guarda lo que se hace y
   lo sube solo al volver. Las sumas y restas usan `increment`, que la
   base aplica de su lado, así que dos personas al mismo tiempo se suman
   en vez de pisarse.
   ═══════════════════════════════════════════════════════════════════════════ */
window.Almacen = (() => {
  "use strict";
  const TABLAS = ["producto", "movimiento", "recado", "persona", "pedido"];
  const LIMITE = { movimiento: 400, recado: 200, pedido: 300, persona: 200, producto: 2000 };
  let fb = null;                 // firebase.app
  let db = null, auth = null;    // firestore, auth
  let modo = "local";            // 'nube' | 'local'
  let practica = false;
  let sesion = null;
  const prefijo = "alm.";
  const memoria = {};            // tabla -> {id: fila}
  const oyentes = {};            // tabla -> [cb]
  const estadoCb = [];
  let sueltas = [];              // para dejar de escuchar al salir
  let pendientes = 0;            // escrituras que la nube todavía no confirma

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

  function cargarTodoLocal(){ TABLAS.forEach(t => { memoria[t] = leerLocal(t); avisar(t); }); }

  /* Cuenta las escrituras que siguen en camino, para poder decírselo a la
     persona ("subiendo 3 pendientes") en vez de dejarla a ciegas. */
  function enCamino(promesa){
    pendientes++; avisarEstado();
    return promesa.catch(falla).finally(() => { pendientes--; avisarEstado(); });
  }

  /* ── NUBE: escuchar. Firestore avisa solo de cada cambio, de cualquiera. ── */
  function consulta(t){
    let q = db.collection(t);
    if (t === "producto") return q.where("activo", "==", true).limit(LIMITE.producto);
    if (t === "persona")  return q.limit(LIMITE.persona);
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
          guardarLocal(t);        // copia local: la próxima abierta pinta al instante
          avisar(t);
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
        // Guarda una copia en el aparato: abre sin señal y sube al volver.
        try { await db.enablePersistence({ synchronizeTabs: true }); } catch(e){ /* otra pestaña ya la tiene, o el navegador no deja */ }
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
    if (practica && !lista("producto").length) sembrarPractica();   // práctica recién encendida o aparato nuevo
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
      if (!lista("producto").length) sembrarPractica();
    } else {
      cargarTodoLocal();
      if (db && sesion){ modo = "nube"; conectar(); }
    }
    avisarEstado();
  }
  function sembrarPractica(){
    const C = window.CATALOGO || {};
    const yo = "Práctica";
    const arts = [
      ["Monarca Midas","Negro completo","Stock de mueble",6,3],
      ["Monarca Midas","Negro completo","Puertas pintadas",23,10],
      ["Monarca Midas","Negro puertas cafés","Puertas pintadas",8,10],
      ["Ropero Deysi","Blanco completo","Mueble pintado",0,2],
      ["Cajonera Amanda 5 cajones","Nogal","Mueble armado",8,4],
      ["Cómoda Midas","Gris completo","Cajones pintados",12,6],
      ["Alacena Midas","Blanco completo","Mueble de MDF",3,2]
    ];
    arts.forEach(([nombre,color,cat,cant,min]) => pon("producto", {
      tipo:"mueble", nombre, color, categoria:cat, apodos:[], cantidad:cant, minimo:min, por_quien:yo }));
    const cants = [2,4,1,0,2,8];
    (C.arranqueMaterial || []).forEach((m,i) => pon("producto", Object.assign({
      tipo:"material", color:"", cantidad: cants[i] != null ? cants[i] : 3, minimo:2, por_quien:yo }, m)));
  }

  /* ── escritura ── */
  function normaliza(t, fila){
    const f = Object.assign({}, fila);
    if (t === "persona"){ f.nombre = String(f.nombre || "").trim(); f.creado = f.creado || ahora(); return f; }
    if (!f.id) f.id = uuid();
    f.creado = f.creado || ahora();
    if (t === "producto"){ f.tocado = ahora(); f.activo = f.activo !== false; f.apodos = (f.apodos || []).slice(0,3); }
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
    const c = Object.assign({}, cambio, t === "producto" ? {tocado: ahora()} : {});
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

  /* Anotar en la bitácora algo que no es suma/resta (alta, baja, conteo) */
  async function anota(mov){
    const f = Object.assign({ id: uuid(), creado: ahora(), delta:0, tipo:"ajuste" }, mov);
    memoria.movimiento = memoria.movimiento || {};
    memoria.movimiento[f.id] = f;
    podar();
    guardarLocal("movimiento"); avisar("movimiento");
    if (modo === "nube" && db) enCamino(db.collection("movimiento").doc(f.id).set(f));
  }
  function podar(){                                   // en local, no crecer sin fin
    const ids = Object.keys(memoria.movimiento || {});
    if (ids.length <= 1500) return;
    ids.sort((a,b) => memoria.movimiento[a].creado < memoria.movimiento[b].creado ? -1 : 1)
       .slice(0, ids.length - 1200).forEach(i => delete memoria.movimiento[i]);
  }

  /* Sumar o restar. La pantalla ya cambió; aquí se manda a la base con
     `increment`, que suma del lado del servidor: si dos personas le pican
     al mismo tiempo, se suman las dos en vez de perderse una. */
  async function ajusta(id, delta, persona, motivo, origen, hechoPor){
    const p = (memoria.producto || {})[id];
    if (!p) return null;
    const antes = Number(p.cantidad || 0);
    const nuevo = Math.max(0, antes + delta);
    const real = nuevo - antes;                       // lo que de verdad cambia (no baja de cero)
    p.cantidad = nuevo; p.tocado = ahora(); p.por_quien = persona;
    guardarLocal("producto"); avisar("producto");

    const mov = { id: uuid(), producto_id:id, nombre:p.nombre, color:p.color || "",
      tipo: real > 0 ? "entrada" : "salida", delta: real, resultado: nuevo,
      persona, motivo: motivo || "", origen: origen || "", hecho_por: hechoPor || "", creado: ahora() };

    if (real === 0) return nuevo;

    if (modo === "nube" && db){
      const lote = db.batch();
      lote.update(db.collection("producto").doc(id), {
        cantidad: firebase.firestore.FieldValue.increment(real),
        tocado: ahora(), por_quien: persona
      });
      lote.set(db.collection("movimiento").doc(mov.id), mov);
      enCamino(lote.commit());                        // sin señal, Firestore lo guarda y lo sube al volver
    } else {
      memoria.movimiento = memoria.movimiento || {};
      memoria.movimiento[mov.id] = mov; podar();
      guardarLocal("movimiento"); avisar("movimiento");
    }
    return nuevo;
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
    arranca, necesitaEntrar, entra, sale, setPractica,
    mira(t, cb){ (oyentes[t] = oyentes[t] || []).push(cb); cb(lista(t)); },
    onEstado(cb){ estadoCb.push(cb); },
    lista, dame(t, id){ return (memoria[t] || {})[id] || null; },
    pon, parcha, borra, anota, ajusta
  };
})();
