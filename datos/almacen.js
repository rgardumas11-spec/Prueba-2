/* ═══════════════════════════════════════════════════════════════════════════
   Almacén — la capa de datos. Una sola cara para la pantalla, dos respaldos:
     · NUBE  (Supabase): compartida entre todos, en vivo.
     · LOCAL (este aparato): cuando no hay llaves, no hay señal, o en
       modo práctica.
   La pantalla nunca sabe cuál está usando; solo pregunta `Almacen.modo`.
   ═══════════════════════════════════════════════════════════════════════════ */
window.Almacen = (() => {
  "use strict";
  const TABLAS = ["producto", "movimiento", "recado", "persona", "pedido"];
  const LIMITE = { movimiento: 400, recado: 200, pedido: 300 };
  let sb = null;                 // cliente Supabase
  let modo = "local";            // 'nube' | 'local'
  let practica = false;
  let sesion = null;
  const prefijo = "alm.";
  const memoria = {};            // tabla -> {id: fila}
  const oyentes = {};            // tabla -> [cb]
  const estadoCb = [];
  const canales = [];
  const refrescos = {};
  let cola = [];                 // ajustes hechos sin señal, por enviar

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

  function cargarTodoLocal(){ TABLAS.forEach(t => { memoria[t] = leerLocal(t); avisar(t); }); }

  /* ── NUBE: cargar y escuchar ── */
  async function cargarNube(t){
    if (!sb) return;
    let q = sb.from(t).select("*");
    if (t === "producto") q = q.eq("activo", true).limit(2000);
    if (t === "movimiento") q = q.order("creado", {ascending:false}).limit(LIMITE.movimiento);
    if (t === "recado") q = q.order("creado", {ascending:false}).limit(LIMITE.recado);
    if (t === "persona") q = q.limit(200);
    if (t === "pedido") q = q.order("creado", {ascending:false}).limit(LIMITE.pedido);
    const { data, error } = await q;
    if (error) { console.warn("nube", t, error.message); return; }
    const mapa = {};
    data.forEach(f => { mapa[f.id != null ? f.id : f.nombre] = f; });
    memoria[t] = mapa;
    guardarLocal(t);            // copia local: la próxima abierta pinta al instante
    avisar(t);
  }
  function refrescar(t){
    clearTimeout(refrescos[t]);
    refrescos[t] = setTimeout(() => cargarNube(t), 250);
  }
  function escucharNube(){
    canales.forEach(c => { try { sb.removeChannel(c); } catch(e){} });
    canales.length = 0;
    TABLAS.forEach(t => {
      const c = sb.channel("alm-" + t)
        .on("postgres_changes", {event:"*", schema:"public", table:t}, () => refrescar(t))
        .subscribe();
      canales.push(c);
    });
  }

  /* ── arranque ── */
  async function arranca(){
    practica = localStorage.getItem("alm.practica") === "1";
    try { cola = JSON.parse(localStorage.getItem("alm.cola") || "[]"); } catch(e){ cola = []; }
    const C = window.CONFIG || {};
    const hayLlaves = C.SUPABASE_URL && C.SUPABASE_LLAVE && window.supabase;
    if (hayLlaves){
      try {
        sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_LLAVE, {
          auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:false }
        });
        const { data } = await sb.auth.getSession();
        sesion = data && data.session ? data.session : null;
        sb.auth.onAuthStateChange((_ev, s) => {
          sesion = s;
          if (!practica){ modo = s ? "nube" : "local"; if (s) conectar(); }
          avisarEstado();
        });
        modo = (sesion && !practica) ? "nube" : "local";
      } catch(e){ console.warn("supabase", e); sb = null; modo = "local"; }
    } else {
      modo = "local";
    }
    cargarTodoLocal();
    if (practica && !lista("producto").length) sembrarPractica();   // práctica recién encendida o aparato nuevo
    if (modo === "nube") await conectar();
    window.addEventListener("online", () => { avisarEstado(); vaciarCola(); if (modo === "nube") TABLAS.forEach(cargarNube); });
    window.addEventListener("offline", avisarEstado);
    setInterval(vaciarCola, 30000);
    avisarEstado();
    return modo;
  }
  async function conectar(){
    if (!sb || !sesion) return;
    await Promise.all(TABLAS.map(cargarNube));
    escucharNube();
    vaciarCola();
  }

  /* ── sesión ── */
  const necesitaEntrar = () => !!sb && !sesion && !practica;
  async function entra(correo, clave){
    if (!sb) throw new Error("sin base");
    const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
    if (error) throw error;
    sesion = data.session; modo = "nube";
    await conectar();
    avisarEstado();
  }
  async function sale(){
    if (sb) await sb.auth.signOut();
    sesion = null; modo = "local"; avisarEstado();
  }

  /* ── modo práctica ── */
  async function setPractica(on){
    practica = !!on;
    localStorage.setItem("alm.practica", practica ? "1" : "0");
    if (practica){
      canales.forEach(c => { try { sb && sb.removeChannel(c); } catch(e){} });
      canales.length = 0;
      modo = "local";
      cargarTodoLocal();
      if (!lista("producto").length) sembrarPractica();
    } else {
      cargarTodoLocal();
      if (sb && sesion){ modo = "nube"; await conectar(); }
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
    if (t === "persona"){ f.creado = f.creado || ahora(); return f; }
    if (!f.id) f.id = uuid();
    f.creado = f.creado || ahora();
    if (t === "producto"){ f.tocado = ahora(); f.activo = f.activo !== false; f.apodos = (f.apodos || []).slice(0,3); }
    return f;
  }
  async function pon(t, fila){
    const f = normaliza(t, fila);
    const k = t === "persona" ? f.nombre : f.id;
    memoria[t] = memoria[t] || {};
    memoria[t][k] = f; guardarLocal(t); avisar(t);
    if (modo === "nube" && sb){
      const { error } = await sb.from(t).upsert(f);
      if (error) falla(error);
    }
    return f;
  }
  async function parcha(t, id, cambio){
    memoria[t] = memoria[t] || {};
    if (!memoria[t][id]) return;
    memoria[t][id] = Object.assign({}, memoria[t][id], cambio, t === "producto" ? {tocado: ahora()} : {});
    if (t === "producto" && cambio.apodos) memoria[t][id].apodos = cambio.apodos.slice(0,3);
    guardarLocal(t); avisar(t);
    if (modo === "nube" && sb){
      const { error } = await sb.from(t).update(memoria[t][id]).eq("id", id);
      if (error) falla(error);
    }
  }
  async function borra(t, id){
    if (memoria[t]) delete memoria[t][id];
    guardarLocal(t); avisar(t);
    if (modo === "nube" && sb){
      const { error } = await sb.from(t).delete().eq("id", id);
      if (error) falla(error);
    }
  }

  /* Anotar en la bitácora algo que no es suma/resta (alta, baja, conteo) */
  async function anota(mov){
    const f = Object.assign({ id: uuid(), creado: ahora(), delta:0, tipo:"ajuste" }, mov);
    memoria.movimiento = memoria.movimiento || {};
    memoria.movimiento[f.id] = f;
    const ids = Object.keys(memoria.movimiento);              // en local, no crecer sin fin
    if (ids.length > 1500) ids.sort((a,b) => (memoria.movimiento[a].creado < memoria.movimiento[b].creado ? -1 : 1))
      .slice(0, ids.length - 1200).forEach(i => delete memoria.movimiento[i]);
    guardarLocal("movimiento"); avisar("movimiento");
    if (modo === "nube" && sb){
      const sinId = Object.assign({}, f); delete sinId.id;    // la nube pone su propio id
      const { error } = await sb.from("movimiento").insert(sinId);
      if (error) falla(error);
    }
  }

  /* Sumar o restar. Local: al instante. Nube: un paso atómico en la base;
     sin señal, se guarda en cola y se manda al volver. */
  async function ajusta(id, delta, persona, motivo, origen, hechoPor){
    const p = (memoria.producto || {})[id];
    if (!p) return null;
    const antes = Number(p.cantidad || 0);
    const nuevo = Math.max(0, antes + delta);
    p.cantidad = nuevo; p.tocado = ahora(); p.por_quien = persona;
    guardarLocal("producto"); avisar("producto");

    if (modo === "nube" && sb){
      if (!enLinea()){ encolar({ id, delta, persona, motivo, origen, hechoPor, t: Date.now() }); return nuevo; }
      try {
        const { data, error } = await sb.rpc("ajustar_cantidad", { p_id:id, p_delta:delta, p_persona:persona, p_motivo:motivo||"", p_origen:origen||"", p_hecho_por:hechoPor||"" });
        if (error) throw error;
        p.cantidad = Number(data); guardarLocal("producto"); avisar("producto");
        return p.cantidad;
      } catch(e){
        encolar({ id, delta, persona, motivo, origen, hechoPor, t: Date.now() });
        return nuevo;
      }
    }
    if (nuevo !== antes) anota({ producto_id:id, nombre:p.nombre, color:p.color||"", tipo: delta>0?"entrada":"salida",
      delta: nuevo-antes, resultado:nuevo, persona, motivo:motivo||"", origen:origen||"", hecho_por:hechoPor||"" });
    return nuevo;
  }
  function encolar(x){ cola.push(x); localStorage.setItem("alm.cola", JSON.stringify(cola)); avisarEstado(); }
  async function vaciarCola(){
    if (!cola.length || !sb || !sesion || !enLinea() || practica) return;
    const pend = cola.slice(); cola = []; localStorage.setItem("alm.cola", "[]");
    for (const x of pend){
      try {
        const { error } = await sb.rpc("ajustar_cantidad", { p_id:x.id, p_delta:x.delta, p_persona:x.persona, p_motivo:x.motivo||"", p_origen:(x.origen||"")+" (sin señal)", p_hecho_por:x.hechoPor||"" });
        if (error) throw error;
      } catch(e){ cola.push(x); }
    }
    localStorage.setItem("alm.cola", JSON.stringify(cola));
    avisarEstado();
    cargarNube("producto"); cargarNube("movimiento");
  }

  function falla(e){
    console.warn("almacén:", e);
    const m = String(e && e.message || "");
    if (!window.grita) return;
    if (/JWT|auth|permission|policy/i.test(m)) grita("Se perdió la sesión. Vuelve a entrar.");
    else if (/network|fetch|Failed/i.test(m)) grita("Sin señal: se guardó aquí y se sube después.");
    else grita("No se pudo guardar en la nube.");
  }

  return {
    get modo(){ return modo; },
    get practica(){ return practica; },
    get sesion(){ return sesion; },
    get pendientes(){ return cola.length; },
    get enLinea(){ return enLinea(); },
    get hayNube(){ return !!sb; },
    arranca, necesitaEntrar, entra, sale, setPractica,
    mira(t, cb){ (oyentes[t] = oyentes[t] || []).push(cb); cb(lista(t)); },
    onEstado(cb){ estadoCb.push(cb); },
    lista, dame(t, id){ return (memoria[t] || {})[id] || null; },
    pon, parcha, borra, anota, ajusta, vaciarCola
  };
})();
