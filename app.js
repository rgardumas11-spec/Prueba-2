/* ═══════════════════════════════════════════════════════════════════════════
   Almacén San Bernardo — la pantalla.
   Muebles por etapa (maquilado → armado → pintado) con traslados que
   conservan quién hizo cada paso; piezas con equivalencia a muebles;
   listos para preparar; pedidos en ticket; catálogo editable; material.
   Celular y computadora con el mismo código. La lógica vive en
   datos/reglas.js; aquí solo se pregunta y se pinta.
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";

/* ── utilidades ── */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sinAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const iniciales = n => String(n || "?").trim().split(/\s+/).map(p => p[0]).join("").slice(0,2).toUpperCase();
const CAT = window.CATALOGO || {};
const R = window.Reglas;
const esEscritorio = () => matchMedia("(min-width:1024px)").matches;
const esApple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const plural = (n, uno, varios) => n + " " + (n === 1 ? uno : varios);

function reloj(iso){ return new Date(iso).toLocaleTimeString("es-MX", {hour:"2-digit", minute:"2-digit"}); }
function cuando(iso){
  const d = Math.floor((Date.now() - new Date(iso).getTime())/1000);
  if (d < 60) return "ahorita";
  if (d < 3600) return "hace " + Math.floor(d/60) + " min";
  if (d < 86400) return "hoy " + reloj(iso);
  if (d < 172800) return "ayer " + reloj(iso);
  return new Date(iso).toLocaleDateString("es-MX", {day:"numeric", month:"short"}) + " " + reloj(iso);
}
const hoyIso = () => new Date().toISOString().slice(0,10);
function isoADma(iso){ if (!iso) return ""; const [a,m,d] = String(iso).slice(0,10).split("-"); return d + "/" + m + "/" + a; }
function dmaAIso(s){ const m = String(s || "").trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/); if (!m) return ""; let [,d,mo,a] = m; if (a.length === 2) a = "20" + a; const dt = new Date(+a, +mo-1, +d); if (isNaN(dt) || dt.getDate() !== +d) return ""; return a + "-" + String(mo).padStart(2,"0") + "-" + String(d).padStart(2,"0"); }
function fechaLarga(iso){
  const hoy = new Date().toISOString().slice(0,10);
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  if (iso === hoy) return "Hoy"; if (iso === ayer) return "Ayer";
  const [a,m,d] = iso.split("-").map(Number);
  return new Date(a, m-1, d).toLocaleDateString("es-MX", {weekday:"long", day:"numeric", month:"long"});
}
let relojGrito;
window.grita = function(txt){
  const g = $("#grito"); g.textContent = txt; g.classList.add("on");
  clearTimeout(relojGrito); relojGrito = setTimeout(() => g.classList.remove("on"), 2800);
};
const TINTES = { negro:"#20232a", café:"#6B4A2F", cafe:"#6B4A2F", nogal:"#8A5A32", gris:"#8D9299", blanco:"#F3F3EF",
  rojo:"#A63122", rosa:"#D98BA5", azul:"#3C6FA8", amarillo:"#D9A521", crema:"#E4D6B4", naranja:"#E0742B", "iron-man":"#A63122" };
function tinte(c){ c = sinAcento(c); for (const k in TINTES) if (c.startsWith(sinAcento(k))) return TINTES[k]; return "#9AA095"; }
const chipColor = c => c ? '<span class="chip color"><span class="punto" style="background:' + tinte(c) + '"></span>' + esc(c) + '</span>' : '<span class="chip sin-color">sin color</span>';
const nombreColor = c => c || "sin color";
/* Chip de color + las partes que van de otro color (preparados): "Negro · puertas gris" */
const chipColores = l => chipColor(l.color) + (R.textoColores(l) ? ' <span class="chip partes">' + esc(R.textoColores(l)) + '</span>' : "");
const coloresLisos = () => (CAT.coloresLisos && CAT.coloresLisos.length ? CAT.coloresLisos : R.COLORES_LISOS);
/* ¿Al entrar a esta etapa/sección se pinta? Ahí se pide el color. */
const sePintaEn = destino => R.sePintaEn(destino);

/* ── estado de pantalla ── */
const E = {
  yo: localStorage.getItem("alm.yo") || "",
  vista: "plan",
  modelos: [], lotes: [], piezas: [], productos: [], movimientos: [], recados: [], personas: [], pedidos: [], plan: [],
  etapa: "maquilado", catPieza: "puertas_uriel", catMat: "",
  busca: {}, buscaAbierta: {},
  sel: null,                       // {tipo, ...llaves}
  pend: new Map(), relojes: new Map(),
  ordenPedidos: localStorage.getItem("alm.ordenPedidos") || "desc",
  porJuego: localStorage.getItem("alm.porJuego") === "1",
  ultimoQuien: {}
};
const origen = () => (esEscritorio() ? "computadora" : "celular");
const modeloDe = id => E.modelos.find(m => m.id === id) || null;
const modelosActivos = () => E.modelos.filter(m => m.activo !== false).sort((a,b) => sinAcento(a.nombre) < sinAcento(b.nombre) ? -1 : 1);

/* ═══════════════ persona ═══════════════ */
function pintaYo(){
  const ini = E.yo ? iniciales(E.yo) : "?";
  $("#yoIniLat").textContent = ini; $("#yoIniCel").textContent = ini;
  $("#yoNomLat").textContent = E.yo || "¿Quién eres?";
  $("#yoNomCel").textContent = E.yo || "¿Quién?";
}
function hojaQuienSoy(){
  const gente = Array.from(new Set(E.personas.map(p => p.nombre).concat(CAT.gente || [])));
  abreHoja('<h3>¿Quién eres?</h3><p class="guia">Tu nombre se queda en este aparato y firma todo lo que anotes.</p>' +
    '<label class="campo"><span>Tu nombre</span><input id="miNombre" list="dlGente" placeholder="Escribe tu nombre" value="' + esc(E.yo) + '" autocomplete="off"></label>' +
    '<datalist id="dlGente">' + gente.map(g => '<option value="' + esc(g) + '">').join("") + '</datalist>' +
    '<button class="btn vino grande" id="okNombre">Listo</button>',
    p => {
      const inp = p.querySelector("#miNombre"); inp.focus();
      const ok = async () => {
        const n = inp.value.trim(); if (!n) return;
        E.yo = n; localStorage.setItem("alm.yo", n); pintaYo();
        if (!E.personas.some(x => x.nombre === n)) Almacen.pon("persona", {nombre:n});
        cierraHoja(); pintaTodo();
      };
      p.querySelector("#okNombre").onclick = ok;
      inp.onkeydown = e => { if (e.key === "Enter") ok(); };
    });
}
const exigeYo = () => { if (E.yo) return true; hojaQuienSoy(); return false; };

/* ═══════════════ estado de conexión ═══════════════ */
function pintaPulso(){
  const p = $("#pulso"), t = $("#pulsoTxt");
  p.className = "pulso";
  if (Almacen.practica){ p.classList.add("local"); t.textContent = "Modo práctica: datos de juguete, solo en este aparato"; }
  else if (Almacen.modo === "nube" && Almacen.sinPermiso.length){ p.classList.add("local"); t.textContent = "Falta una regla en Firebase para: " + Almacen.sinPermiso.join(", ") + " (ve a Ajustes → Revisar este aparato)"; }
  else if (Almacen.modo === "nube" && Almacen.enLinea){ t.textContent = "Compartido en vivo con el taller" + (Almacen.pendientes ? " · subiendo " + Almacen.pendientes + " pendientes" : ""); }
  else if (Almacen.modo === "nube"){ p.classList.add("sin"); t.textContent = "Sin señal: lo que hagas se guarda aquí y se sube al volver"; }
  else if (Almacen.hayNube){ p.classList.add("local"); t.textContent = "Sin sesión: guardando solo en este aparato"; }
  else { p.classList.add("local"); t.textContent = "Guardando solo en este aparato"; }
  $("#practicaBanda").hidden = !Almacen.practica;
  $("#yoEstadoLat").textContent = Almacen.practica ? "PRÁCTICA" : (Almacen.modo === "nube" ? "EN LÍNEA" : "LOCAL");
  $("#entrada").hidden = !Almacen.necesitaEntrar();
}

/* ═══════════════ búsqueda: un icono, se despliega al tocarlo ═══════════════ */
const TEXTO_BUSCA = { plan:"Mueble o color…", muebles:"Mueble o color…", piezas:"Mueble o color…", listos:"Mueble o color…", pedidos:"Cliente o mueble…", material:"Nombre o apodo…", bitacora:"Mueble, persona…", catalogo:"Nombre del modelo…", apodos:"Nombre o apodo…" };
function pintaLupa(vista){
  const caja = $("#busca-" + vista); const btn = $('[data-lupa="' + vista + '"]'); if (!caja) return;
  const abierta = !!E.buscaAbierta[vista];
  caja.hidden = !abierta; if (btn) btn.classList.toggle("on", abierta);
  if (!abierta){ caja.innerHTML = ""; return; }
  if (!caja.querySelector("input")){
    caja.innerHTML = '<label class="campo-busca"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input placeholder="' + esc(TEXTO_BUSCA[vista] || "Buscar…") + '" value="' + esc(E.busca[vista] || "") + '" autocomplete="off"><button class="limpia" aria-label="Cerrar">×</button></label>';
    const inp = caja.querySelector("input");
    inp.oninput = () => { E.busca[vista] = inp.value; pintaVista(vista); };
    inp.onkeydown = e => { if (e.key === "Escape") cierraLupa(vista); };
    caja.querySelector(".limpia").onclick = () => cierraLupa(vista);
  }
}
function abreLupa(vista){ E.buscaAbierta[vista] = true; pintaLupa(vista); const i = $("#busca-" + vista + " input"); if (i){ i.focus(); } }
function cierraLupa(vista){ E.buscaAbierta[vista] = false; E.busca[vista] = ""; pintaLupa(vista); pintaVista(vista); }
$$("[data-lupa]").forEach(b => b.onclick = () => { const v = b.dataset.lupa; if (E.buscaAbierta[v]) cierraLupa(v); else abreLupa(v); });
const q = vista => (E.busca[vista] || "").trim();
const sinHallar = (vista, que) => '<div class="vacio"><b>No encontré ' + que + '</b><p>Nada se parece a «' + esc(q(vista)) + '». Revisa cómo se escribe o prueba con menos letras.</p></div>';

/* ═══════════════ agrupar lotes y piezas por mueble + color ═══════════════ */
const llaveMC = x => x.modelo_id + "|" + (x.color || "");
function gruposMueble(etapa){
  const g = {};
  const pk = l => etapa === "preparado" ? "|" + Object.keys(l.partes || {}).filter(x => l.partes[x]).sort().join("+") + "|" + Object.keys(l.colores || {}).filter(x => l.colores[x]).sort().map(x => x + "=" + sinAcento(l.colores[x])).join("+") : "";
  E.lotes.filter(l => l.etapa === etapa && Number(l.cantidad) > 0).forEach(l => {
    const k = llaveMC(l) + pk(l);
    (g[k] = g[k] || { k, modelo_id: l.modelo_id, modelo: l.modelo, color: l.color || "", etapa, total: 0, lotes: [], partes: l.partes || {}, colores: l.colores || {} });
    g[k].total += Number(l.cantidad); g[k].lotes.push(l);
  });
  return Object.values(g).map(x => { x.lotes.sort((a,b) => b.cantidad - a.cantidad); return x; })
    .sort((a,b) => sinAcento(a.modelo + a.color) < sinAcento(b.modelo + b.color) ? -1 : 1);
}
const totalEtapa = etapa => E.lotes.filter(l => l.etapa === etapa).reduce((s,l) => s + Number(l.cantidad || 0), 0);
const piezasDe = (modelo_id, color) => { const r = {}; E.piezas.filter(p => p.modelo_id === modelo_id).forEach(p => { r[p.categoria] = (r[p.categoria] || 0) + Number(p.cantidad || 0); }); return r; };
const vivoPieza = p => Math.max(0, Number(p.cantidad || 0) + (E.pend.get(p.id) || 0));

/* ═══════════════ MUEBLES ═══════════════ */
function pintaEtapasMueble(){
  const caja = $("#etapasMueble");
  const tabs = [];
  R.CADENA.madera.filter(e => e !== "preparado").forEach((e, i) => { if (i) tabs.push('<span class="flecha">→</span>'); tabs.push(pestana(e, R.ETAPAS[e].corto, totalEtapa(e), E.etapa === e)); });
  tabs.push('<span class="flecha" style="margin:0 6px">|</span>');
  R.CADENA.mdf.filter(e => e !== "preparado").forEach((e, i) => { if (i) tabs.push('<span class="flecha">→</span>'); tabs.push(pestana(e, R.ETAPAS[e].corto, totalEtapa(e), E.etapa === e)); });
  tabs.push('<span class="flecha" style="margin:0 6px">→</span>');
  tabs.push(pestana("preparado", R.ETAPAS.preparado.corto, totalEtapa("preparado"), E.etapa === "preparado"));
  caja.innerHTML = tabs.join("");
  caja.querySelectorAll("[data-etapa]").forEach(b => b.onclick = () => { E.etapa = b.dataset.etapa; E.sel = null; pintaMuebles(); if (esEscritorio()) pintaDetalle(); });
  const total = E.lotes.reduce((s,l) => s + Number(l.cantidad || 0), 0);
  $("#resumenMueble").textContent = total ? plural(total, "mueble en producción", "muebles en producción") : "";
}
const pestana = (id, txt, n, on) => '<button class="pestana' + (on ? " on" : "") + '" data-etapa="' + id + '"><b>' + n + '</b>' + esc(txt) + '</button>';
function pintaMuebles(){
  pintaEtapasMueble();
  const caja = $("#listaMueble");
  const et = R.ETAPAS[E.etapa];
  let l = gruposMueble(E.etapa);
  const total = l.reduce((s,g) => s + g.total, 0);
  if (q("muebles")) l = Busca.busca(q("muebles"), l, g => g.modelo + " " + g.color);
  if (!l.length){
    if (q("muebles")){ caja.innerHTML = sinHallar("muebles", "ese mueble en " + et.nombre.toLowerCase()); return; }
    const ant = etapaAnterior(E.etapa);
    caja.innerHTML = '<div class="vacio"><b>No hay muebles en «' + esc(et.nombre) + '»</b><p>' +
      (R.admiteAlta(E.etapa) ? "Aquí entran los muebles recién hechos. Regístralos con el botón de arriba." : E.etapa === "preparado" ? "Un mueble se prepara desde «Mueble pintado» o «MDF pintado» con el botón «Preparar»: se le descuentan sus puertas, cajones y parches pintados." : "Se registran aquí con el botón de arriba y el sistema los descuenta solo de «" + esc(R.ETAPAS[ant].nombre) + "».") + '</p>' +
      '<button class="btn vino" data-registrar="mueble">＋ Registrar</button></div>';
    const b = caja.querySelector("[data-registrar]"); if (b) b.onclick = registrarMueble;
    const v = caja.querySelector("[data-ir-etapa]"); if (v) v.onclick = () => { E.etapa = v.dataset.irEtapa; pintaMuebles(); };
    return;
  }
  caja.innerHTML = '<div class="encabezado-lista"><span>Mueble</span><span>Color</span><span class="d">Hay</span><span>Quién</span><span></span></div>' +
    l.map(g => {
      const sel = E.sel && E.sel.tipo === "mueble" && E.sel.k === g.k && E.sel.etapa === g.etapa;
      const porFirma = {}; g.lotes.forEach(x => { const f = R.firmaDe(x); porFirma[f] = (porFirma[f] || 0) + Number(x.cantidad); });
      let quien = Object.keys(porFirma).map(f => esc(f) + " " + porFirma[f]).join(" · ");
      let accion = R.siguienteEtapa(g.etapa) === "preparado" ? '<button class="btn suave" data-pasar="' + esc(g.k) + '">Preparar →</button>' : R.siguienteEtapa(g.etapa) ? '<button class="btn suave" data-pasar="' + esc(g.k) + '">Pasar a ' + esc(R.ETAPAS[R.siguienteEtapa(g.etapa)].corto.toLowerCase()) + ' →</button>' : '<span class="sello ver">final</span>';
      if (g.etapa === "preparado"){ const m = modeloDe(g.modelo_id); const fal = R.faltanPartes(m, g); const con = R.partesTexto(m, g);
        quien += (con ? ' <span class="sello ver">con ' + esc(con) + '</span>' : "") + (fal.length ? ' <span class="sello roj">faltan: ' + esc(fal.map(c => c.k).join(", ")) + '</span>' : (m ? ' <span class="sello ver">completo</span>' : ""));
        accion = fal.length ? '<button class="btn suave" data-pasar="' + esc(g.k) + '">Completar →</button>' : '<span class="sello ver">completo</span>'; }
      return '<div class="fila' + (sel ? " sel" : "") + '" data-abre="' + esc(g.k) + '">' +
        '<div class="nombre"><b>' + esc(g.modelo) + '</b></div>' +
        '<div class="sub">' + chipColores(g) + '</div>' +
        '<div class="apodos">' + chipColores(g) + '</div>' +
        '<div class="cifra"><b>' + g.total + '</b><small>' + (g.total === 1 ? "mueble" : "muebles") + '</small></div>' +
        '<div class="ultimo"><span>' + quien + '</span></div>' +
        '<div class="stepper">' + accion + '</div>' +
      '</div>';
    }).join("");
  caja.querySelectorAll("[data-abre]").forEach(f => f.onclick = e => { if (e.target.closest("[data-pasar]")) return; seleccionaMueble(f.dataset.abre, true); });
  caja.querySelectorAll("[data-pasar]").forEach(b => b.onclick = e => { e.stopPropagation(); const g = gruposMueble(E.etapa).find(x => x.k === b.dataset.pasar); if (g) (g.etapa === "preparado" ? hojaPreparar(g) : hojaPasar(g)); });
  if (!total && !q("muebles")) return;
}
function etapaAnterior(etapa){ return R.anteriorEtapa(etapa) || etapa; }
function seleccionaMueble(k, abrir){
  E.sel = { tipo: "mueble", k, etapa: E.etapa };
  pintaMuebles();
  if (esEscritorio()) pintaDetalle(); else if (abrir) abreHoja(htmlDetalleMueble(), montaDetalleMueble);
}
function grupoSel(){ return E.sel && E.sel.tipo === "mueble" ? gruposMueble(E.sel.etapa).find(g => g.k === E.sel.k) : null; }
function htmlDetalleMueble(){
  const g = grupoSel(); if (!g) return '<div class="detalle-vacio">Ese mueble ya no está en esta etapa</div>';
  const et = R.ETAPAS[g.etapa]; const sig = R.siguienteEtapa(g.etapa);
  const movs = E.movimientos.filter(m => m.modelo_id === g.modelo_id && (m.color || "") === g.color && !m.pieza_id).sort((a,b) => a.creado < b.creado ? 1 : -1).slice(0,10);
  return '<h2>' + esc(g.modelo) + '</h2><div class="sub">' + chipColores(g) + ' &nbsp;' + esc(et.nombre) + '</div>' +
    '<div class="grande-cant"><b>' + g.total + '</b><span>' + (g.total === 1 ? "mueble" : "muebles") + '<br>' + esc(et.nombre.toLowerCase().replace("mueble ", "")) + '</span></div>' +
    '<h3>De quién vienen</h3><div class="lotes">' + g.lotes.map(l => '<div class="lote"><div class="quien">' + esc(R.firmaDe(l)) + '<small>' + esc(R.origenDe(l)) + ' · desde ' + esc(cuando(l.creado)) + '</small></div><div class="disp"><b>' + l.cantidad + '</b></div></div>').join("") + '</div>' +
    (g.etapa === "preparado" ? '<div class="sub" style="margin:-6px 0 10px">' + (R.partesTexto(modeloDe(g.modelo_id), g) ? '<span class="sello ver">con ' + esc(R.partesTexto(modeloDe(g.modelo_id), g)) + '</span> ' : "") + (R.faltanPartes(modeloDe(g.modelo_id), g).length ? '<span class="sello roj">faltan: ' + esc(R.faltanPartes(modeloDe(g.modelo_id), g).map(c => c.k).join(", ")) + '</span>' : '<span class="sello ver">completo</span>') + '</div>' : "") +
    '<div class="acciones">' + (g.etapa === "preparado" && R.faltanPartes(modeloDe(g.modelo_id), g).length ? '<button class="btn vino" data-pasar>Completar →</button>' : sig === "preparado" ? '<button class="btn vino" data-pasar>Preparar →</button>' : sig ? '<button class="btn vino" data-pasar>Pasar a ' + esc(R.ETAPAS[sig].corto.toLowerCase()) + ' →</button>' : "") + '<button class="btn" data-corrige>Corregir cantidad</button></div>' +
    '<h3>Últimos movimientos</h3>' + (movs.length ? movs.map(lineaMov).join("") : '<div class="vacio" style="padding:14px"><p style="margin:0">Todavía nada.</p></div>');
}
function montaDetalleMueble(caja){
  const g = grupoSel(); if (!g) return;
  const p = caja.querySelector("[data-pasar]"); if (p) p.onclick = () => (g.etapa === "preparado" ? hojaPreparar(g) : hojaPasar(g));
  caja.querySelector("[data-corrige]").onclick = () => hojaCorregirLote(g);
  enlazaDeshacer(caja);
}

/* El botón Registrar de Muebles: alta en maquilado / MDF; en las demás etapas se
   registra desde el destino y el sistema descuenta de la etapa anterior. */
function registrarMueble(){ if (R.admiteAlta(E.etapa)) hojaRegistrarMueble(); else hojaRegistrarDesdeMueble(E.etapa); }
function hojaRegistrarDesdeMueble(etapa){
  if (!exigeYo()) return;
  if (etapa === "preparado") return hojaQuePreparar(null);
  const ant = R.anteriorEtapa(etapa); if (!ant) return;
  const disponibles = gruposMueble(ant);
  abreHoja('<h3>Registrar ' + esc(R.ETAPAS[etapa].nombre.toLowerCase()) + '</h3>' +
    '<div class="paso-a"><span class="de">' + esc(etapa === "preparado" ? "Mueble pintado / MDF pintado" : R.ETAPAS[ant].nombre) + '</span> → <span class="a">' + esc(R.ETAPAS[etapa].nombre) + '</span></div>' +
    '<p class="guia">' + (etapa === "preparado" ? "Escoge cuál se preparó: se le descuentan sus puertas, cajones y parches pintados." : "Escoge de cuáles: solo aparecen los que hay en «" + esc(R.ETAPAS[ant].nombre.toLowerCase()) + "». Lo que registres aquí se descuenta de ahí solo.") + '</p>' +
    campoBuscaLista("Mueble o color…") + '<div class="sugerencias" id="rLista"></div>',
    h => {
      const inp = h.querySelector("#rBusca"), lista = h.querySelector("#rLista");
      const pinta = () => {
        const l = inp.value.trim() ? Busca.busca(inp.value, disponibles, g => g.modelo + " " + g.color) : disponibles;
        lista.innerHTML = l.length ? l.map(g => '<button data-k="' + esc(g.k) + '">' + esc(g.modelo) + ' · ' + esc(nombreColor(g.color)) + '<small>' + g.total + ' disponibles · ' + esc(g.lotes.map(x => R.firmaDe(x) + " " + x.cantidad).join(" · ")) + '</small></button>').join("")
          : '<div class="sin-hallar">' + (disponibles.length ? "No encontré ese mueble ahí." : "No hay nada en «" + esc(R.ETAPAS[ant].nombre.toLowerCase()) + "» todavía.") + '</div>';
        lista.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { const g = disponibles.find(x => x.k === b.dataset.k); if (g) hojaPasar(g); });
      };
      inp.oninput = pinta; pinta(); inp.focus();
    });
}
/* Registrar muebles recién hechos (solo en la primera etapa) */
function hojaRegistrarMueble(){
  if (!exigeYo()) return;
  let modelo = null, color = "", quien = [];
  const pinta = () => {
    const tipo = R.tipoDe(modelo); const etapa = R.primeraEtapa(tipo); const regla = R.responsables(etapa);
    const h = $("#panel");
    h.querySelector("#rEtapa").innerHTML = modelo ? 'Entra a <span class="a">' + esc(R.ETAPAS[etapa].nombre) + '</span>' + (tipo === "mdf" ? ' <small style="color:var(--tinta3)">(es de MDF: Fernando lo maquila y arma)</small>' : "") : "";
    h.querySelector("#rQuien").innerHTML = modelo ? '<div class="grupo-h">' + esc(regla.pregunta) + '</div><div class="cats">' + regla.opciones.map(n => '<button class="cat' + (quien.includes(n) ? " on" : "") + '" data-n="' + esc(n) + '">' + esc(n) + '</button>').join("") + '</div>' : "";
    h.querySelectorAll("#rQuien [data-n]").forEach(b => b.onclick = () => { quien = quien.includes(b.dataset.n) ? [] : [b.dataset.n]; pinta(); });
    h.querySelector("#rOk").disabled = !(modelo && quien.length && Number(h.querySelector("#rCant").value) > 0);
  };
  abreHoja('<h3>Registrar muebles</h3><p class="guia">Muebles recién hechos. Los de las etapas siguientes no se registran aquí: se pasan desde la etapa anterior.</p>' +
    campoModelo() + campoColor() +
    '<label class="campo"><span>Cuántos</span><input id="rCant" type="number" inputmode="numeric" min="1" value="1"></label>' +
    '<div class="paso-a" id="rEtapa"></div><div id="rQuien"></div>' +
    '<button class="btn vino grande" id="rOk" disabled style="margin-top:14px">Registrar</button>',
    h => {
      montaCampoModelo(h, m => { modelo = m; if (m && m.tipo === "mdf") quien = ["Fernando"]; else quien = []; pinta(); });
      h.querySelector("#rColor").onchange = e => { color = e.target.value; pinta(); };
      h.querySelector("#rCant").oninput = pinta;
      h.querySelector("#rOk").onclick = async () => {
        const n = Math.floor(Number(h.querySelector("#rCant").value || 0)); if (!modelo || !quien.length || n <= 0) return;
        const tipo = R.tipoDe(modelo); const etapa = R.primeraEtapa(tipo);
        const d = { modelo_id: modelo.id, modelo: modelo.nombre, color, etapa, cantidad: n };
        if (tipo === "mdf"){ d.maquilo = quien[0]; d.armo = quien[0]; } else d.maquilo = quien[0];
        await Almacen.registra(d, E.yo, origen());
        anotaTrabajo("maquilado", quien[0], modelo, color, n);
        cierraHoja(); E.etapa = etapa; E.sel = { tipo:"mueble", k: modelo.id + "|" + color, etapa }; irA("muebles"); pintaTodo();
        grita("Listo: " + plural(n, "mueble", "muebles") + " en " + R.ETAPAS[etapa].nombre.toLowerCase());
      };
    });
}
/* Campo de modelo con búsqueda tolerante: se escribe y se escoge de la lista; nunca queda texto libre */
function campoModelo(){ return '<label class="campo"><span>Mueble</span><input id="rModelo" placeholder="Escribe el nombre, aunque sea aproximado…" autocomplete="off"></label><div class="sugerencias" id="rSug" hidden></div>'; }
/* Muebles y piezas solo llevan colores LISOS (las combinaciones "Negro puertas grises" son cosa del pedido). */
function campoColor(sel, obligatorio, id){
  const lisos = coloresLisos().slice(); if (sel && !lisos.some(c => R.mismoColor(c, sel))) lisos.push(sel);
  return '<label class="campo"><span>Color' + (obligatorio ? "" : " (si ya se sabe)") + '</span><select id="' + (id || "rColor") + '"><option value="">' + (obligatorio ? "— escoge el color —" : "— todavía sin color —") + '</option>' + lisos.map(c => '<option' + (sel && R.mismoColor(sel, c) ? " selected" : "") + '>' + esc(c) + '</option>').join("") + '</select></label>';
}
function montaCampoModelo(h, alEscoger, conExtras, filtro, guacalesArriba){
  const inp = h.querySelector("#rModelo"), sug = h.querySelector("#rSug");
  const primeroGuacales = l => { const g = typeof guacalesArriba === "function" ? guacalesArriba() : guacalesArriba; return g ? l.filter(m => R.esGuacal(m)).concat(l.filter(m => !R.esGuacal(m))) : l; };
  let escogido = null;
  const fuente = () => modelosActivos().filter(m => conExtras ? true : !R.esExtra(m)).filter(m => filtro ? filtro(m) : true);
  const pinta = () => {
    const t = inp.value.trim();
    if (escogido && escogido.nombre === t){ sug.hidden = true; return; }
    escogido = null; alEscoger(null);
    if (!t){ sug.hidden = true; return; }
    const l = primeroGuacales(Busca.busca(t, fuente(), m => m.nombre)).slice(0, 12);
    sug.hidden = false;
    sug.innerHTML = l.length ? l.map(m => '<button data-id="' + esc(m.id) + '">' + esc(m.nombre) + (R.esGuacal(m) ? ' <span class="chip">guacal</span>' : "") + (m.pendiente ? ' <span class="chip revisar">por revisar</span>' : "") + '<small>' + (R.esExtra(m) ? "pieza extra" : (m.tipo === "mdf" ? "MDF · " : "") + fichaCorta(m)) + '</small></button>').join("") : '<div class="sin-hallar">No encontré ese mueble. Revisa el nombre o agrégalo en Catálogo.</div>';
    sug.querySelectorAll("[data-id]").forEach(b => b.onclick = () => { escogido = modeloDe(b.dataset.id); inp.value = escogido.nombre; sug.hidden = true; alEscoger(escogido); });
  };
  inp.oninput = pinta;
  inp.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); const b = sug.querySelector("[data-id]"); if (b && !sug.hidden) b.click(); } };
  inp.focus();
}
/* El guacal (activo) sobre el que se arma un modelo, o null si tiene el suyo */
const guacalVivo = m => { if (!m) return null; const gu = R.guacalDe(m); const x = gu !== m.id ? modeloDe(gu) : null; return x && x.activo !== false ? x : null; };
function fichaCorta(m){
  const p = [];
  if (R.esGuacal(m)) p.push("guacal: sirve para " + plural(modelosActivos().filter(x => x.guacal === m.id).length, "modelo", "modelos"));
  else if (guacalVivo(m)) p.push("usa el guacal " + guacalVivo(m).nombre);
  p.push(m.cajones == null ? "cajones: falta dato" : plural(m.cajones, "cajón", "cajones"));
  p.push(m.total_puertas == null ? "puertas: falta dato" : plural(m.total_puertas, "puerta", "puertas"));
  const pa = R.parchesDe(m); if (pa > 0) p.push(plural(pa, "parche", "parches"));
  return p.join(" · ");
}

/* Pasar a la siguiente etapa: se escoge de qué lotes salen, con tope */
function hojaPasar(g){
  if (!exigeYo()) return;
  const sig = R.siguienteEtapa(g.etapa); if (!sig) return;
  if (sig === "preparado") return hojaQuePreparar(g);
  const regla = R.responsables(sig);
  let quien = [];
  const rec = E.ultimoQuien[sig]; if (rec && Date.now() - rec.t < 15*60*1000 && regla) quien = rec.nombres.filter(n => regla.opciones.includes(n));
  const tomas = {}; g.lotes.forEach(l => tomas[l.id] = 0);
  abreHoja('<h3>Pasar a ' + esc(R.ETAPAS[sig].corto.toLowerCase()) + '</h3>' +
    '<div class="paso-a"><span class="de">' + esc(R.ETAPAS[g.etapa].nombre) + '</span> → <span class="a">' + esc(R.ETAPAS[sig].nombre) + '</span></div>' +
    '<p class="guia"><b>' + esc(g.modelo) + '</b> · ' + esc(nombreColor(g.color)) + ' · hay <b>' + g.total + '</b>. Escribe cuántos salen de cada quien.</p>' +
    '<div class="lotes">' + g.lotes.map(l => '<div class="lote" data-lote="' + esc(l.id) + '"><div class="quien">' + esc(R.firmaDe(l)) + '<small>' + esc(R.origenDe(l)) + '</small><div class="disp">' + l.cantidad + ' disponibles</div></div>' +
      '<div class="toma"><button class="tecla" data-menos>−</button><input type="number" inputmode="numeric" min="0" max="' + l.cantidad + '" value="0"><button class="tecla" data-mas>＋</button></div></div>').join("") + '</div>' +
    '<div class="total-paso"><span>Pasan en total</span><b id="pTotal">0</b></div>' +
    (sePintaEn(sig) ? '<div class="grupo-h">De qué color se pintaron</div>' + campoColor(g.color, true, "pColor") : "") +
    (regla ? '<div class="grupo-h">' + esc(regla.pregunta) + (regla.max > 1 ? " · hasta " + regla.max : "") + '</div><div class="cats" id="pQuien">' + regla.opciones.map(n => '<button class="cat' + (quien.includes(n) ? " on" : "") + '" data-n="' + esc(n) + '">' + esc(n) + '</button>').join("") + '</div>'
           : '<p class="guia" style="margin-top:6px">Aquí no se pregunta quién: el lote sigue siendo de ' + esc(g.lotes.map(l => R.firmaDe(l)).filter((x,i,a) => a.indexOf(x) === i).join(" y ")) + '.</p>') +
    '<p class="sin-hallar" id="pError" hidden></p>' +
    '<button class="btn vino grande" id="pOk" disabled style="margin-top:12px">Confirmar</button>',
    h => {
      const filas = Array.from(h.querySelectorAll("[data-lote]"));
      const total = () => filas.reduce((s,f) => s + (Number(f.querySelector("input").value) || 0), 0);
      const revisa = () => {
        let mal = false;
        filas.forEach(f => { const l = g.lotes.find(x => x.id === f.dataset.lote); const inp = f.querySelector("input"); const v = Number(inp.value) || 0; const m = v < 0 || v > l.cantidad || !Number.isInteger(v); inp.classList.toggle("mal", m); if (m) mal = true; });
        const t = total(); h.querySelector("#pTotal").textContent = t;
        const err = h.querySelector("#pError");
        const excedido = filas.find(f => (Number(f.querySelector("input").value) || 0) > g.lotes.find(x => x.id === f.dataset.lote).cantidad);
        if (excedido){ const l = g.lotes.find(x => x.id === excedido.dataset.lote); err.hidden = false; err.textContent = R.firmaDe(l) + ": solo hay " + l.cantidad + " disponibles"; } else err.hidden = true;
        const colorOk = !sePintaEn(sig) || !!h.querySelector("#pColor").value;
        h.querySelector("#pOk").disabled = mal || t <= 0 || (regla && !quien.length) || !colorOk;
      };
      const pc = h.querySelector("#pColor"); if (pc) pc.onchange = revisa;
      filas.forEach(f => {
        const l = g.lotes.find(x => x.id === f.dataset.lote); const inp = f.querySelector("input");
        f.querySelector("[data-menos]").onclick = () => { inp.value = Math.max(0, (Number(inp.value) || 0) - 1); revisa(); };
        f.querySelector("[data-mas]").onclick = () => { inp.value = Math.min(l.cantidad, (Number(inp.value) || 0) + 1); revisa(); };
        inp.oninput = revisa; inp.onfocus = () => inp.select();
      });
      h.querySelectorAll("#pQuien [data-n]").forEach(b => b.onclick = () => {
        const n = b.dataset.n;
        if (quien.includes(n)) quien = quien.filter(x => x !== n);
        else if (regla.max === 1) quien = [n];
        else if (quien.length < regla.max) quien.push(n);
        else return grita("Máximo " + regla.max + " nombres");
        h.querySelectorAll("#pQuien [data-n]").forEach(x => x.classList.toggle("on", quien.includes(x.dataset.n)));
        revisa();
      });
      // Si solo hay un lote, se propone pasar todo
      if (filas.length === 1){ filas[0].querySelector("input").value = g.lotes[0].cantidad; }
      revisa();
      h.querySelector("#pOk").onclick = async () => {
        const d = { etapa_a: sig, tomas: filas.map(f => ({ lote_id: f.dataset.lote, cantidad: Number(f.querySelector("input").value) || 0 })) };
        if (sePintaEn(sig)) d.color_a = h.querySelector("#pColor").value;
        if (regla){ if (regla.campo === "armo") d.armo = quien[0]; if (regla.campo === "pinto") d.pinto = quien.slice(); E.ultimoQuien[sig] = { nombres: quien.slice(), t: Date.now() }; }
        try {
          const mov = await Almacen.traslada(d, E.yo, origen());
          if (sig === "armado" && d.armo) anotaTrabajo("armado", d.armo, modeloDe(g.modelo_id) || { nombre: g.modelo, familia: g.modelo.split(" ")[0] }, g.color, mov.delta);
          cierraHoja(); grita(plural(mov.delta, "mueble pasó", "muebles pasaron") + " a " + R.ETAPAS[sig].nombre.toLowerCase());
          E.etapa = sig; E.sel = { tipo:"mueble", k: g.modelo_id + "|" + (d.color_a != null ? d.color_a : g.color), etapa: sig }; irA("muebles"); pintaTodo();
        } catch(e){ const err = h.querySelector("#pError"); err.hidden = false; err.textContent = e.message; }
      };
    });
}
function hojaCorregirLote(g){
  if (!exigeYo()) return;
  abreHoja('<h3>Corregir cantidad</h3><p class="guia">' + esc(g.modelo) + ' · ' + esc(nombreColor(g.color)) + ' · ' + esc(R.ETAPAS[g.etapa].nombre) + '. Solo para arreglar un error o anotar una merma; los muebles que avanzan se pasan con «Pasar a…».</p>' +
    '<div class="lotes">' + g.lotes.map(l => '<div class="lote" data-lote="' + esc(l.id) + '"><div class="quien">' + esc(R.firmaDe(l)) + '<small>' + esc(R.origenDe(l)) + '</small><div class="disp">ahora ' + l.cantidad + '</div></div><div class="toma"><input type="number" inputmode="numeric" min="0" value="' + l.cantidad + '"></div></div>').join("") + '</div>' +
    '<label class="campo"><span>Motivo (obligatorio)</span><input id="cMot" placeholder="se contó mal, se rompió uno…"></label>' +
    '<button class="btn vino grande" id="cOk">Guardar</button>',
    h => {
      h.querySelector("#cOk").onclick = async () => {
        const mot = h.querySelector("#cMot").value.trim(); if (!mot) return grita("Escribe el motivo");
        let cambios = 0;
        for (const f of h.querySelectorAll("[data-lote]")){
          const l = g.lotes.find(x => x.id === f.dataset.lote); const nuevo = Math.max(0, Math.floor(Number(f.querySelector("input").value) || 0));
          if (nuevo !== l.cantidad){ await Almacen.ajustaLote(l.id, nuevo - l.cantidad, E.yo, mot, origen()); cambios++; }
        }
        cierraHoja(); grita(cambios ? "Corregido" : "Sin cambios"); pintaTodo();
      };
    });
}

/* ═══════════════ PIEZAS ═══════════════ */
function gruposPieza(cat){
  return E.piezas.filter(p => p.categoria === cat && vivoPieza(p) > 0).map(p => Object.assign({}, p, { k: llaveMC(p) }))
    .sort((a,b) => sinAcento(a.modelo + a.color) < sinAcento(b.modelo + b.color) ? -1 : 1);
}
const totalCat = cat => E.piezas.filter(p => p.categoria === cat).reduce((s,p) => s + vivoPieza(p), 0);
const totalPestana = pest => R.categoriasDePestana(pest).reduce((s,c) => s + totalCat(c), 0);
function pintaEtapasPieza(){
  const caja = $("#etapasPieza");
  const tabs = [];
  [R.CADENA_PUERTAS, R.CADENA_CAJONES, R.CADENA_PARCHES].forEach((cad, j) => {
    if (j) tabs.push('<span class="flecha" style="margin:0 6px">|</span>');
    cad.forEach((c, i) => { if (i) tabs.push('<span class="flecha">→</span>'); tabs.push(pestana(c, R.PIEZAS[c].nombre, totalPestana(c), E.catPieza === c)); });
  });
  caja.innerHTML = tabs.join("");
  caja.querySelectorAll("[data-etapa]").forEach(b => b.onclick = () => { E.catPieza = b.dataset.etapa; E.sel = null; pintaPiezas(); if (esEscritorio()) pintaDetalle(); });
}
function filaPiezaHtml(p){
  const m = modeloDe(p.modelo_id); const n = vivoPieza(p); const cat = p.categoria;
  const sig = R.siguientePiezaDe(cat, m); const emb = R.embisagra(cat);
  const txt = R.textoEquivalencia(n, cat, m);
  const e = R.equivalencia(n, R.piezasPorMueble(m, cat));
  const eq = R.esExtra(m) ? "pieza extra" : e.sinFicha ? "sin ficha, no se puede calcular" : e.noLleva ? "este modelo no lleva " + R.PIEZAS[cat].unidad
    : "=&nbsp;<b>" + plural(e.muebles, "juego", "juegos") + "</b>" + (e.sobran ? ' <span class="sello roj" title="Faltan ' + e.faltan + ' para otro juego">sobran ' + e.sobran + '</span>' : "");
  const sel = E.sel && E.sel.tipo === "pieza" && E.sel.id === p.id;
  const paso = pasoPieza(p, m);
  let botones = "";
  if (R.admiteAltaPieza(cat)) botones += '<button class="tecla" data-menos="' + esc(p.id) + '"' + (n < paso ? " disabled" : "") + '>−' + (paso > 1 ? paso : "") + '</button><span class="cant">' + n + '</span><button class="tecla" data-mas="' + esc(p.id) + '">＋' + (paso > 1 ? paso : "") + '</button>';
  if (emb) botones += '<button class="btn suave" data-emb="' + esc(p.id) + '">Embisagrar</button>';
  if (sig) botones += '<button class="btn suave" data-pasar="' + esc(p.id) + '"' + (emb || R.admiteAltaPieza(cat) ? ' style="margin-left:6px"' : "") + '>Pasar a ' + esc(R.PIEZAS[sig].corto.toLowerCase()) + ' →</button>';
  if (!sig && !emb && !R.admiteAltaPieza(cat)) botones += (["puertas_pintadas", "cajones_pintados", "parches_pintados"].includes(cat) && !R.esExtra(m) ? '<button class="btn suave" data-colgar="' + esc(p.id) + '">' + (cat === "puertas_pintadas" ? "Colgar" : "Poner") + ' en mueble →</button>' : '<span class="sello ver">final</span>');
  return '<div class="fila' + (sel ? " sel" : "") + (E.pend.get(p.id) ? " pend" : "") + '" data-abre="' + esc(p.id) + '">' +
    '<div class="nombre"><b>' + esc(p.modelo) + '</b>' + (R.esExtra(m) ? '<small>pieza extra</small>' : "") + '</div>' +
    '<div class="sub">' + chipColor(p.color) + '</div>' +
    '<div class="apodos">' + chipColor(p.color) + '</div>' +
    '<div class="cifra"><b>' + n + '</b><small>' + esc(txt.replace(/^\d+ /, "").split(/ [=·] /)[0]) + '</small></div>' +
    '<div class="ultimo"><span>' + eq + '</span></div>' +
    '<div class="stepper">' + botones + '</div></div>';
}
/* Cuánto mueve cada toque de − y ＋: 1 pieza, o un juego completo si está "Por juego" y el modelo tiene ficha */
function pasoPieza(p, m){
  if (!E.porJuego || p.categoria === "parches_pintados") return 1;
  const por = R.piezasPorMueble(m || modeloDe(p.modelo_id), p.categoria);
  return por && por > 0 ? por : 1;
}
function pintaModoJuego(){
  const b = $("#modoJuego"); if (!b) return;
  b.textContent = E.porJuego ? "Por juego" : "Por pieza"; b.classList.toggle("vino", E.porJuego);
}
$("#modoJuego").onclick = () => { E.porJuego = !E.porJuego; localStorage.setItem("alm.porJuego", E.porJuego ? "1" : "0"); pintaPiezas(); grita(E.porJuego ? "− y ＋ mueven un juego completo" : "− y ＋ mueven de una en una"); };
function pintaPiezas(){
  pintaEtapasPieza(); pintaModoJuego();
  const caja = $("#listaPieza"); const pest = E.catPieza; const P = R.PIEZAS[pest];
  const cats = R.categoriasDePestana(pest);
  const grupos = cats.map(c => ({ cat: c, filas: q("piezas") ? Busca.busca(q("piezas"), gruposPieza(c), p => p.modelo + " " + p.color) : gruposPieza(c) }));
  const total = grupos.reduce((s,g) => s + g.filas.length, 0);
  $("#resumenPieza").textContent = P.ayuda || "";
  if (!total){
    if (q("piezas")){ caja.innerHTML = sinHallar("piezas", "eso en " + P.nombre.toLowerCase()); return; }
    const ant = R.anteriorPieza(pest);
    caja.innerHTML = '<div class="vacio"><b>No hay ' + esc(P.nombre.toLowerCase()) + '</b><p>' + (R.admiteAltaPieza(pest) ? "Regístralas con el botón de arriba." : "Se registran aquí con el botón de arriba y el sistema las descuenta solo de «" + esc(R.PIEZAS[ant].nombre) + "».") + '</p></div>';
    return;
  }
  const enc = '<div class="encabezado-lista"><span>Mueble</span><span>Color</span><span class="d">Hay</span><span>Equivale a</span><span></span></div>';
  caja.innerHTML = enc + grupos.map(g => {
    const bloque = R.PIEZAS[g.cat].bloque;
    const cab = bloque ? '<div class="bloque-h' + (bloque === "Sin bisagras" ? " suave" : "") + '">' + esc(bloque) + '<span class="n">' + g.filas.reduce((s,p) => s + vivoPieza(p), 0) + '</span></div>' : "";
    return cab + (g.filas.length ? g.filas.map(filaPiezaHtml).join("") : (bloque ? '<div class="bloque-vacio">ninguna</div>' : ""));
  }).join("");
  caja.querySelectorAll("[data-abre]").forEach(f => f.onclick = e => { if (e.target.closest("button")) return; seleccionaPieza(f.dataset.abre, true); });
  caja.querySelectorAll("[data-mas]").forEach(b => b.onclick = e => { e.stopPropagation(); muevePieza(b.dataset.mas, +1); });
  caja.querySelectorAll("[data-menos]").forEach(b => b.onclick = e => { e.stopPropagation(); muevePieza(b.dataset.menos, -1); });
  caja.querySelectorAll("[data-pasar]").forEach(b => b.onclick = e => { e.stopPropagation(); const p = E.piezas.find(x => x.id === b.dataset.pasar); if (p) hojaPasarPieza(p, R.siguientePiezaDe(p.categoria, modeloDe(p.modelo_id))); });
  caja.querySelectorAll("[data-emb]").forEach(b => b.onclick = e => { e.stopPropagation(); const p = E.piezas.find(x => x.id === b.dataset.emb); if (p) hojaPasarPieza(p, R.embisagra(p.categoria)); });
  caja.querySelectorAll("[data-colgar]").forEach(b => b.onclick = e => { e.stopPropagation(); const p = E.piezas.find(x => x.id === b.dataset.colgar); if (p) hojaColgar(p); });
}
function seleccionaPieza(id, abrir){
  E.sel = { tipo:"pieza", id }; pintaPiezas();
  if (esEscritorio()) pintaDetalle(); else if (abrir) abreHoja(htmlDetallePieza(), montaDetallePieza);
}
function htmlDetallePieza(){
  const p = E.piezas.find(x => x.id === (E.sel || {}).id); if (!p) return '<div class="detalle-vacio">Esa pieza ya no está</div>';
  const m = modeloDe(p.modelo_id); const n = vivoPieza(p); const cat = p.categoria; const sig = R.siguientePiezaDe(cat, m); const emb = R.embisagra(cat);
  const movs = E.movimientos.filter(x => x.pieza_id === p.id || (x.modelo_id === p.modelo_id && (x.color || "") === (p.color || "") && x.categoria === cat)).sort((a,b) => a.creado < b.creado ? 1 : -1).slice(0,10);
  const e = R.equivalencia(n, R.piezasPorMueble(m, cat));
  return '<h2>' + esc(p.modelo) + '</h2><div class="sub">' + chipColor(p.color) + ' &nbsp;' + esc(R.PIEZAS[cat].nombre) + '</div>' +
    '<div class="grande-cant"><b>' + n + '</b><span>' + esc(R.PIEZAS[cat].unidad) + (cat !== "parches_pintados" && !R.esExtra(m) ? "<br>" + (e.sinFicha ? "sin ficha: no se puede calcular" : e.noLleva ? "este modelo no lleva " + R.PIEZAS[cat].unidad : "= <b style='font-size:13px;color:var(--tinta2)'>" + plural(e.muebles, "juego", "juegos") + "</b>" + (e.sobran ? "<br><span class='sello roj'>sobran " + e.sobran + " suelta" + (e.sobran === 1 ? "" : "s") + "</span><br>falta" + (e.faltan === 1 ? "" : "n") + " " + e.faltan + " para otro juego" : "")) : R.esExtra(m) ? "<br>pieza extra" : "") + '</span></div>' +
    '<dl class="ficha">' + (m ? (R.esExtra(m) ? '<dt>Qué es</dt><dd>pieza extra del catálogo (sin ficha de mueble)</dd>' : '<dt>Por mueble</dt><dd>' + esc(fichaCorta(m)) + '</dd>') : '<dt>Ficha</dt><dd style="color:var(--rojo)">este modelo no está en el catálogo</dd>') + '</dl>' +
    '<div class="acciones">' + (emb ? '<button class="btn vino" data-emb>Embisagrar</button>' : "") + (sig ? '<button class="btn' + (emb ? "" : " vino") + '" data-pasar>Pasar a ' + esc(R.PIEZAS[sig].corto.toLowerCase()) + ' →</button>' : "") + '<button class="btn" data-corrige>Corregir cantidad</button>' + (e.sinFicha && m && !R.esExtra(m) ? '<button class="btn" data-ficha>Completar ficha</button>' : "") + '</div>' +
    '<h3>Últimos movimientos</h3>' + (movs.length ? movs.map(lineaMov).join("") : '<div class="vacio" style="padding:14px"><p style="margin:0">Todavía nada.</p></div>');
}
function montaDetallePieza(caja){
  const p = E.piezas.find(x => x.id === (E.sel || {}).id); if (!p) return;
  const b = caja.querySelector("[data-pasar]"); if (b) b.onclick = () => hojaPasarPieza(p, R.siguientePiezaDe(p.categoria, modeloDe(p.modelo_id)));
  const eb = caja.querySelector("[data-emb]"); if (eb) eb.onclick = () => hojaPasarPieza(p, R.embisagra(p.categoria));
  caja.querySelector("[data-corrige]").onclick = () => hojaCorregirPieza(p);
  const f = caja.querySelector("[data-ficha]"); if (f) f.onclick = () => hojaModelo(modeloDe(p.modelo_id));
  enlazaDeshacer(caja);
}
/* − y + en piezas: los toques seguidos se juntan en un envío */
function muevePieza(id, d){
  if (!exigeYo()) return;
  const p = E.piezas.find(x => x.id === id); if (!p) return;
  const paso = pasoPieza(p); d = d * paso;
  if (d < 0 && vivoPieza(p) + d < 0){ if (paso > 1) grita("Solo hay " + vivoPieza(p) + ": no completa un juego de " + paso); return; }
  E.pend.set(id, (E.pend.get(id) || 0) + d);
  pintaPiezas(); if (E.sel && E.sel.id === id) pintaDetalle();
  clearTimeout(E.relojes.get(id));
  E.relojes.set(id, setTimeout(() => confirmaPieza(id), 650));
}
async function confirmaPieza(id){
  const d = E.pend.get(id); if (!d) return;
  E.pend.delete(id);
  const p = E.piezas.find(x => x.id === id); if (!p) return;
  const regla = d > 0 ? R.responsables(p.categoria) : null;
  let hechoPor = "";
  if (regla){
    const nombres = await pideQuien(regla, "+" + d + " · " + p.modelo + " · " + nombreColor(p.color) + " · " + R.PIEZAS[p.categoria].nombre, p.categoria);
    if (nombres === null){ pintaPiezas(); if (E.sel && E.sel.id === id) pintaDetalle(); return; }
    hechoPor = nombres.join(" y ");
  }
  await Almacen.ajustaPieza(p, d, E.yo, "", origen(), hechoPor);
}
/* El botón Registrar de Piezas: alta en Uriel / cajones / parches; en las demás
   secciones registra desde el destino y el sistema descuenta de la anterior. */
function registrarPieza(){ if (R.admiteAltaPieza(E.catPieza)) hojaRegistrarPieza(); else hojaRegistrarDesdePieza(E.catPieza); }
function hojaRegistrarPieza(){
  if (!exigeYo()) return;
  let modelo = null, color = "", quien = [], enJuegos = false;
  const cats = ["puertas_uriel", "cajones_armados", "parches_por_lijar"];
  const porDe = () => (cat === "parches_pintados" ? 0 : R.piezasPorMueble(modelo, cat)) || 0;
  const piezasDe = h => Math.floor(Number(h.querySelector("#rCant").value || 0)) * (enJuegos && porDe() > 1 ? porDe() : 1);
  let cat = cats.includes(E.catPieza) ? E.catPieza : "puertas_uriel";
  const pinta = () => {
    const h = $("#panel"); const regla = R.responsables(cat);
    if (R.esExtra(modelo)) cat = "puertas_uriel";
    h.querySelectorAll("[data-cat]").forEach(b => { b.classList.toggle("on", b.dataset.cat === cat); b.disabled = R.esExtra(modelo) && b.dataset.cat !== "puertas_uriel"; });
    h.querySelector("#rQuien").innerHTML = regla ? '<div class="grupo-h">' + esc(regla.pregunta) + '</div><div class="cats">' + regla.opciones.map(n => '<button class="cat' + (quien.includes(n) ? " on" : "") + '" data-n="' + esc(n) + '">' + esc(n) + '</button>').join("") + '</div>' : "";
    h.querySelectorAll("#rQuien [data-n]").forEach(b => b.onclick = () => { quien = quien.includes(b.dataset.n) ? [] : [b.dataset.n]; pinta(); });
    const por = porDe(); if (por <= 1) enJuegos = false;
    h.querySelector("#rUnidad").hidden = por <= 1;
    h.querySelectorAll("#rUnidad [data-u]").forEach(b => b.classList.toggle("on", (b.dataset.u === "juegos") === enJuegos));
    h.querySelector("#rUnidad [data-u=juegos]").textContent = "Por juego (" + por + ")";
    h.querySelector("#rCant").closest(".campo").querySelector("span").textContent = enJuegos ? "Cuántos juegos" : "Cuántas";
    h.querySelector("#rEq").textContent = modelo && piezasDe(h) > 0 ? R.textoEquivalencia(piezasDe(h), cat, modelo) : "";
    const hayG = modelosActivos().some(m => R.esGuacal(m)); const deGuacal = cat === "cajones_armados" || cat === "parches_por_lijar";
    h.querySelector("#rGuacales").hidden = !(hayG && deGuacal);
    h.querySelectorAll("#rGuacales [data-guacal]").forEach(b => b.classList.toggle("on", !!modelo && modelo.id === b.dataset.guacal));
    const sinParches = cat === "parches_por_lijar" && modelo && !(R.parchesDe(modelo) > 0);
    h.querySelector("#rAviso").hidden = !sinParches;
    if (sinParches) h.querySelector("#rAviso").textContent = R.parchesDe(modelo) === 0 ? "Este modelo no lleva parches según su ficha." : "La ficha de este modelo no dice cuántos parches lleva. Ponlo en Catálogo primero.";
    h.querySelector("#rOk").disabled = !(modelo && piezasDe(h) > 0 && (!regla || quien.length) && !sinParches);
  };
  abreHoja('<h3>Registrar piezas</h3><p class="guia">Las puertas entran a «Puertas Uriel» (por lijar → lijadas → con bisagras → pintadas). Los cajones entran armados y de ahí pasan a pintados. Los parches entran por lijar (lijados → pintados), solo para modelos cuya ficha dice cuántos llevan.</p>' +
    '<div class="grupo-h">Qué son</div><div class="cats" style="margin-bottom:12px">' + cats.map(c => '<button class="cat" data-cat="' + c + '">' + esc(R.PIEZAS[c].nombre) + '</button>').join("") + '</div>' +
    campoModelo() + '<div id="rGuacales" style="margin:-4px 0 10px" hidden><span class="guia" style="display:block;margin-bottom:4px">Guacales (sus cajones y parches sirven para todos sus modelos):</span><div class="cats">' + modelosActivos().filter(m => R.esGuacal(m)).map(m => '<button class="cat" data-guacal="' + esc(m.id) + '">' + esc(m.nombre) + '</button>').join("") + '</div></div>' +
    '<p class="sin-hallar" id="rAviso" hidden></p>' + campoColor() +
    '<div class="cats" id="rUnidad" style="margin-bottom:8px" hidden><button class="cat on" data-u="piezas">Por pieza</button><button class="cat" data-u="juegos">Por juego</button></div>' +
    '<label class="campo"><span>Cuántas</span><input id="rCant" type="number" inputmode="numeric" min="1" value="1"></label><p class="guia" id="rEq"></p>' +
    '<div id="rQuien"></div><button class="btn vino grande" id="rOk" disabled style="margin-top:14px">Registrar</button>',
    h => {
      h.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { cat = b.dataset.cat; quien = []; pinta(); });
      montaCampoModelo(h, m => { modelo = m; pinta(); }, true, null, () => cat === "cajones_armados" || cat === "parches_por_lijar");
      h.querySelectorAll("#rGuacales [data-guacal]").forEach(b => b.onclick = () => { modelo = modeloDe(b.dataset.guacal); h.querySelector("#rModelo").value = modelo ? modelo.nombre : ""; h.querySelector("#rSug").hidden = true; pinta(); });
      h.querySelector("#rColor").onchange = e => { color = e.target.value; pinta(); };
      h.querySelector("#rCant").oninput = pinta;
      h.querySelectorAll("#rUnidad [data-u]").forEach(b => b.onclick = () => { enJuegos = b.dataset.u === "juegos"; pinta(); });
      pinta();
      h.querySelector("#rOk").onclick = async () => {
        const n = piezasDe(h); if (!modelo || n <= 0) return;
        await Almacen.ajustaPieza({ modelo_id: modelo.id, modelo: modelo.nombre, color, categoria: cat }, n, E.yo, "", origen(), quien.join(" y "), "alta");
        cierraHoja(); E.catPieza = R.pestanaDe(cat); E.sel = { tipo:"pieza", id: Almacen.clavePieza({ modelo_id: modelo.id, color, categoria: cat }) }; irA("piezas"); pintaTodo();
        grita("Listo: " + n + " " + R.PIEZAS[cat].unidad);
      };
    });
}
/* Registrar desde la sección destino: se escoge entre lo que hay en la sección anterior
   y el sistema lo descuenta de ahí. Nada se puede "inventar" en una sección intermedia. */
function hojaRegistrarDesdePieza(pest){
  if (!exigeYo()) return;
  const destino = pest === "puertas_lijadas" ? "puertas_lijadas" : pest;
  const ant = R.anteriorPieza(destino); if (!ant) return;
  const disponibles = gruposPieza(ant);
  abreHoja('<h3>Registrar ' + esc(R.PIEZAS[destino].nombre.toLowerCase()) + '</h3>' +
    '<div class="paso-a"><span class="de">' + esc(R.PIEZAS[ant].nombre) + '</span> → <span class="a">' + esc(R.PIEZAS[destino].nombre) + '</span></div>' +
    '<p class="guia">Escoge de cuáles: solo aparecen las que hay en «' + esc(R.PIEZAS[ant].nombre.toLowerCase()) + '». Lo que registres aquí se descuenta de ahí solo.</p>' +
    campoBuscaLista("Mueble o color…") +
    '<div class="sugerencias" id="rLista"></div>',
    h => {
      const inp = h.querySelector("#rBusca"), lista = h.querySelector("#rLista");
      const pinta = () => {
        const l = inp.value.trim() ? Busca.busca(inp.value, disponibles, p => p.modelo + " " + p.color) : disponibles;
        lista.innerHTML = l.length ? l.map(p => '<button data-id="' + esc(p.id) + '">' + esc(p.modelo) + ' · ' + esc(nombreColor(p.color)) + '<small>' + p.cantidad + ' disponibles</small></button>').join("")
          : '<div class="sin-hallar">' + (disponibles.length ? "No encontré ese mueble ahí." : "No hay nada en «" + esc(R.PIEZAS[ant].nombre.toLowerCase()) + "» todavía.") + '</div>';
        lista.querySelectorAll("[data-id]").forEach(b => b.onclick = () => { const p = E.piezas.find(x => x.id === b.dataset.id); if (p) hojaPasarPieza(p, destino); });
      };
      inp.oninput = pinta; pinta(); inp.focus();
    });
}
const campoBuscaLista = ph => '<label class="campo-busca" style="margin-bottom:8px"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="rBusca" placeholder="' + esc(ph) + '" autocomplete="off"></label>';
/* Pasar piezas a otra sección (siguiente, o "con bisagras" al embisagrar) */
function hojaPasarPieza(p, destino){
  if (!exigeYo() || !destino) return;
  const regla = R.responsables(destino); let quien = [];
  const rec = E.ultimoQuien[destino]; if (rec && Date.now() - rec.t < 15*60*1000 && regla) quien = rec.nombres.filter(n => regla.opciones.includes(n));
  const n = vivoPieza(p);
  const esEmb = destino === "puertas_lijadas_bisagras";
  const por = R.piezasPorMueble(modeloDe(p.modelo_id), p.categoria) || 0; let enJuegos = E.porJuego && por > 1 && n >= por;
  const tope = () => enJuegos ? Math.floor(n / por) : n;
  abreHoja('<h3>' + (esEmb ? "Embisagrar" : "Pasar a " + esc(R.PIEZAS[destino].corto.toLowerCase())) + '</h3>' +
    '<div class="paso-a"><span class="de">' + esc(R.PIEZAS[p.categoria].nombre) + '</span> → <span class="a">' + esc(R.PIEZAS[destino].nombre) + '</span></div>' +
    '<p class="guia"><b>' + esc(p.modelo) + '</b> · ' + esc(nombreColor(p.color)) + ' · hay <b>' + n + '</b> disponibles.</p>' +
    (por > 1 ? '<div class="cats" id="pUnidad" style="margin-bottom:8px"><button class="cat' + (enJuegos ? "" : " on") + '" data-u="piezas">Por pieza</button><button class="cat' + (enJuegos ? " on" : "") + '" data-u="juegos"' + (n < por ? " disabled" : "") + '>Por juego (' + por + ')</button></div>' : "") +
    '<div class="lote"><div class="quien" id="pCuantas">Cuántas ' + (esEmb ? "se embisagraron" : "pasan") + '</div><div class="toma"><button class="tecla" data-menos>−</button><input id="pCant" type="number" inputmode="numeric" min="1" max="' + tope() + '" value="' + tope() + '"><button class="tecla" data-mas>＋</button></div></div><p class="guia" id="pEq"></p>' +
    (sePintaEn(destino) ? '<div class="grupo-h">De qué color se pintaron</div>' + campoColor(p.color, true, "pColor") : "") +
    (regla ? '<div class="grupo-h">' + esc(regla.pregunta) + '</div><div class="cats" id="pQuien">' + regla.opciones.map(x => '<button class="cat' + (quien.includes(x) ? " on" : "") + '" data-n="' + esc(x) + '">' + esc(x) + '</button>').join("") + '</div>' : "") +
    '<p class="sin-hallar" id="pError" hidden></p><button class="btn vino grande" id="pOk" style="margin-top:12px">Confirmar</button>',
    h => {
      const inp = h.querySelector("#pCant");
      const piezasDe = () => (Number(inp.value) || 0) * (enJuegos ? por : 1);
      const revisa = () => { const v = Number(inp.value) || 0, t = tope(); inp.classList.toggle("mal", v > t || v < 1); const err = h.querySelector("#pError"); err.hidden = v <= t; err.textContent = enJuegos ? "Solo hay " + n + " (" + t + " juegos completos)" : "Solo hay " + n + " disponibles"; h.querySelector("#pEq").textContent = enJuegos ? "= " + piezasDe() + " " + R.PIEZAS[p.categoria].unidad : (por > 1 && v > 0 ? R.textoEquivalencia(v, p.categoria, modeloDe(p.modelo_id)).replace(/^[^=·]*/, "") : ""); const colorOk = !sePintaEn(destino) || !!h.querySelector("#pColor").value; h.querySelector("#pOk").disabled = v > t || v < 1 || (regla && !quien.length) || !colorOk; };
      const pc = h.querySelector("#pColor"); if (pc) pc.onchange = revisa;
      h.querySelectorAll("#pUnidad [data-u]").forEach(b => b.onclick = () => { enJuegos = b.dataset.u === "juegos"; h.querySelectorAll("#pUnidad [data-u]").forEach(x => x.classList.toggle("on", x === b)); h.querySelector("#pCuantas").textContent = (enJuegos ? "Cuántos juegos " : "Cuántas ") + (esEmb ? "se embisagraron" : "pasan"); inp.max = tope(); inp.value = Math.min(Number(inp.value) || 1, tope()) || 1; revisa(); });
      h.querySelector("[data-menos]").onclick = () => { inp.value = Math.max(1, (Number(inp.value) || 0) - 1); revisa(); };
      h.querySelector("[data-mas]").onclick = () => { inp.value = Math.min(tope(), (Number(inp.value) || 0) + 1); revisa(); };
      inp.oninput = revisa; inp.onfocus = () => inp.select();
      h.querySelectorAll("#pQuien [data-n]").forEach(b => b.onclick = () => { quien = quien.includes(b.dataset.n) ? [] : [b.dataset.n]; h.querySelectorAll("#pQuien [data-n]").forEach(x => x.classList.toggle("on", quien.includes(x.dataset.n))); revisa(); });
      revisa();
      h.querySelector("#pOk").onclick = async () => {
        try {
          if (regla) E.ultimoQuien[destino] = { nombres: quien.slice(), t: Date.now() };
          const d = { pieza_id: p.id, cantidad: piezasDe(), categoria_a: destino, hecho_por: quien.join(" y ") };
          if (sePintaEn(destino)) d.color_a = h.querySelector("#pColor").value;
          const mov = await Almacen.trasladaPieza(d, E.yo, origen());
          cierraHoja(); grita(mov.delta + " " + R.PIEZAS[destino].unidad + " → " + R.PIEZAS[destino].nombre.toLowerCase());
          E.catPieza = R.pestanaDe(destino); E.sel = { tipo:"pieza", id: mov.pieza_id }; irA("piezas"); pintaTodo();
        } catch(e){ const err = h.querySelector("#pError"); err.hidden = false; err.textContent = e.message; }
      };
    });
}
function hojaCorregirPieza(p){
  if (!exigeYo()) return;
  const n = vivoPieza(p);
  abreHoja('<h3>Corregir cantidad</h3><p class="guia">' + esc(p.modelo) + ' · ' + esc(nombreColor(p.color)) + ' · ' + esc(R.PIEZAS[p.categoria].nombre) + ' · ahora hay <b>' + n + '</b>.</p>' +
    '<label class="campo"><span>Contado</span><input id="cCant" type="number" inputmode="numeric" min="0" value="' + n + '"></label>' +
    '<label class="campo"><span>Motivo (obligatorio)</span><input id="cMot" placeholder="conteo físico, se rompieron 2…"></label>' +
    '<button class="btn vino grande" id="cOk">Guardar</button>',
    h => {
      h.querySelector("#cCant").focus(); h.querySelector("#cCant").select();
      h.querySelector("#cOk").onclick = async () => {
        const mot = h.querySelector("#cMot").value.trim(); if (!mot) return grita("Escribe el motivo");
        const nuevo = Math.max(0, Math.floor(Number(h.querySelector("#cCant").value || 0)));
        cierraHoja();
        if (nuevo !== n){ E.pend.delete(p.id); await Almacen.ajustaPieza(p, nuevo - n, E.yo, mot, origen(), "", "ajuste"); }
        grita("Guardado"); pintaTodo();
      };
    });
}

/* "¿Quién?" para el + de cajones (y cualquier sección que lo pida) */
function pideQuien(regla, texto, llave){
  return new Promise(resolve => {
    const rec = E.ultimoQuien[llave];
    let marcados = (rec && Date.now() - rec.t < 15*60*1000) ? rec.nombres.filter(n => regla.opciones.includes(n)) : [];
    const max = regla.max || 1;
    abreHoja('<h3>' + esc(regla.pregunta) + '</h3><p class="guia">' + esc(texto) + (max > 1 ? " · hasta " + max : "") + '</p>' +
      '<div class="cats" id="quienCats" style="margin-bottom:16px">' + regla.opciones.map(n => '<button class="cat' + (marcados.includes(n) ? " on" : "") + '" data-n="' + esc(n) + '" style="font-size:15px;padding:10px 16px">' + esc(n) + '</button>').join("") + '</div>' +
      '<button class="btn vino grande" id="quienOk"' + (marcados.length ? "" : " disabled") + '>Listo</button>' +
      '<button class="btn fantasma grande" id="quienNo" style="margin-top:8px">Cancelar</button>',
      h => {
        const ok = h.querySelector("#quienOk");
        h.querySelectorAll("[data-n]").forEach(b => b.onclick = () => {
          const n = b.dataset.n;
          if (marcados.includes(n)) marcados = marcados.filter(x => x !== n);
          else { if (max === 1) marcados = [n]; else if (marcados.length < max) marcados.push(n); else return grita("Máximo " + max + " nombres"); }
          h.querySelectorAll("[data-n]").forEach(x => x.classList.toggle("on", marcados.includes(x.dataset.n)));
          ok.disabled = !marcados.length;
        });
        ok.onclick = () => { E.ultimoQuien[llave] = {nombres: marcados.slice(), t: Date.now()}; cierraHojaSin(); resolve(marcados); };
        h.querySelector("#quienNo").onclick = () => { cierraHojaSin(); resolve(null); };
      });
    E.resolverQuien = () => resolve(null);
  });
}
function cierraHojaSin(){ E.resolverQuien = null; cierraHoja(); }

/* ═══════════════ LISTOS PARA PREPARAR ═══════════════ */
/* Piezas que alcanzan para un modelo: las suyas, y cajones/parches también del guacal */
function piezasParaListos(m){
  const r = piezasDe(m.id); const gu = R.guacalDe(m);
  if (gu && gu !== m.id){ const pg = piezasDe(gu); ["cajones_pintados", "parches_pintados"].forEach(c => { if (pg[c]) r[c] = (r[c] || 0) + pg[c]; }); }
  return r;
}
function calculaListos(){
  const r = [];
  ["pintado", "mdf_pintado"].forEach(et => gruposMueble(et).forEach(g => {
    const m = modeloDe(g.modelo_id);
    if (R.esGuacal(m)){
      // Un guacal no se arma solo: se revisa por cada modelo que lo usa y tiene puertas pintadas
      const variantes = modelosActivos().filter(v => v.guacal === m.id && (piezasDe(v.id).puertas_pintadas || 0) > 0);
      if (!variantes.length){ r.push(Object.assign({ modelo: g.modelo, color: g.color, modelo_id: g.modelo_id, k: g.k, kl: g.k, etapa: et, m, guacal: true }, R.listos(null, g.total, {}), { detalle: [g.total + " pintados", "es un guacal: se arma con las puertas pintadas de alguno de sus modelos, y no hay de ninguno"] })); return; }
      variantes.forEach(v => { const res = R.listos(v, g.total, piezasParaListos(v)); r.push(Object.assign({ modelo: v.nombre, color: g.color, modelo_id: v.id, k: g.k, kl: g.k + "|" + v.id, etapa: et, m: v, sobre: g.modelo }, res)); });
      return;
    }
    const res = R.listos(m, g.total, piezasParaListos(m));
    r.push(Object.assign({ modelo: g.modelo, color: g.color, modelo_id: g.modelo_id, k: g.k, kl: g.k, etapa: et, m }, res));
  }));
  return r.sort((a,b) => b.listos - a.listos || (sinAcento(a.modelo + a.color) < sinAcento(b.modelo + b.color) ? -1 : 1));
}
function pintaListos(){
  const caja = $("#listaListos");
  let l = calculaListos();
  const total = l.reduce((s,x) => s + x.listos, 0);
  $("#resumenListos").textContent = l.length ? plural(total, "mueble listo", "muebles listos") : "";
  $("#nListos").hidden = !total; $("#nListos").textContent = total;
  if (q("listos")) l = Busca.busca(q("listos"), l, x => x.modelo + " " + x.color);
  let medias = gruposMueble("preparado").map(g => ({ g, m: modeloDe(g.modelo_id), faltan: R.faltanPartes(modeloDe(g.modelo_id), g) })).filter(x => x.faltan.length);
  if (q("listos")) medias = Busca.busca(q("listos"), medias, x => x.g.modelo + " " + x.g.color);
  const htmlMedias = medias.length ? '<div class="bloque-h">Preparados a medias<span class="n">' + medias.reduce((s,x) => s + x.g.total, 0) + '</span></div>' + medias.map(x => '<div class="fila" data-medio="' + esc(x.g.k) + '"><div class="nombre"><b>' + esc(x.g.modelo) + '</b><small>preparó ' + esc(x.g.lotes.map(l => R.firmaDe(l)).filter((v,i,a) => a.indexOf(v) === i).join(", ")) + '</small></div><div class="sub">' + chipColores(x.g) + '</div><div class="apodos">' + chipColores(x.g) + '</div>' +
      '<div class="cifra"><b>' + x.g.total + '</b><small>con ' + esc(R.partesTexto(x.m, x.g) || "nada") + '</small></div><div class="ultimo"><span class="sello roj">faltan: ' + esc(x.faltan.map(c => c.k).join(", ")) + '</span></div><div class="stepper"><button class="btn suave" data-completa="' + esc(x.g.k) + '">Completar →</button></div></div>').join("") + '<div class="bloque-h">Pintados: qué alcanza para preparar</div>' : "";
  if (!l.length && !medias.length){ caja.innerHTML = q("listos") ? sinHallar("listos", "ese mueble") : '<div class="vacio"><b>Todavía no hay muebles pintados</b><p>Cuando un mueble llegue a «Mueble pintado», aquí se revisa si ya tiene sus puertas, cajones y parches para prepararlo.</p></div>'; return; }
  caja.innerHTML = htmlMedias + '<div class="encabezado-lista"><span>Mueble</span><span>Color</span><span class="d">Listos</span><span>Por qué</span><span></span></div>' + l.map(x => {
    const sel = E.sel && E.sel.tipo === "listo" && E.sel.k === x.kl;
    const sellos = (x.faltanParches ? '<span class="sello amb">faltan parches</span>' : "") + (x.sinFicha ? '<span class="sello roj">sin ficha completa</span>' : "");
    const porque = x.sinFicha ? "no se puede calcular" : x.listos < x.pintados ? "faltan " + x.limitante : "completos";
    return '<div class="fila' + (sel ? " sel" : "") + (x.listos === 0 ? " suave" : "") + '" data-abre="' + esc(x.kl) + '" data-etapa="' + x.etapa + '">' +
      '<div class="nombre"><b>' + esc(x.modelo) + '</b>' + (x.sobre ? '<small>sobre guacal ' + esc(x.sobre) + '</small>' : "") + '</div><div class="sub">' + chipColor(x.color) + '</div><div class="apodos">' + chipColor(x.color) + '</div>' +
      '<div class="cifra"><b>' + x.listos + '</b><small>' + (x.listos === 1 ? "listo" : "listos") + ' de ' + x.pintados + '</small></div>' +
      '<div class="ultimo"><span>' + esc(porque) + '</span> ' + sellos + '</div><div class="stepper">' + (x.listos > 0 ? '<button class="btn suave" data-prep="' + esc(x.kl) + '">Preparar →</button>' : "") + '</div></div>';
  }).join("");
  caja.querySelectorAll("[data-abre]").forEach(f => f.onclick = e => { if (e.target.closest("[data-prep]")) return; E.sel = { tipo:"listo", k: f.dataset.abre, etapa: f.dataset.etapa }; pintaListos(); if (esEscritorio()) pintaDetalle(); else abreHoja(htmlDetalleListo(), montaDetalleListo); });
  caja.querySelectorAll("[data-prep]").forEach(b => b.onclick = e => { e.stopPropagation(); preparaDesdeListos(b.dataset.prep); });
  caja.querySelectorAll("[data-completa]").forEach(b => b.onclick = e => { e.stopPropagation(); const g = gruposMueble("preparado").find(x => x.k === b.dataset.completa); if (g) hojaPreparar(g); });
}
function preparaDesdeListos(kl){ const x = calculaListos().find(y => y.kl === kl); if (!x) return; const g = gruposMueble(x.etapa).find(y => y.k === x.k); if (g) hojaQuePreparar(g, { modelo: x.m }); }
function htmlDetalleListo(){
  const x = calculaListos().find(y => y.kl === (E.sel || {}).k); if (!x) return '<div class="detalle-vacio">Ya no está</div>';
  return '<h2>' + esc(x.modelo) + '</h2><div class="sub">' + chipColor(x.color) + (x.sobre ? ' &nbsp;sobre guacal ' + esc(x.sobre) : "") + '</div>' +
    '<div class="grande-cant"><b>' + x.listos + '</b><span>' + (x.listos === 1 ? "listo" : "listos") + ' para preparar<br>de ' + x.pintados + ' pintados</span></div>' +
    (x.faltanParches ? '<div class="candado" style="margin-bottom:10px"><span>Faltan parches</span></div>' : "") +
    '<h3>Cómo se calculó</h3>' + x.detalle.map(d => '<div class="linea"><span class="det">' + esc(d) + '</span></div>').join("") +
    '<div class="acciones" style="margin-top:12px">' + (x.listos > 0 ? '<button class="btn vino" data-prep>Preparar →</button>' : "") + (x.m ? '<button class="btn" data-ficha>Ver ficha en Catálogo</button>' : "") + '</div>';
}
function montaDetalleListo(caja){ const x = calculaListos().find(y => y.kl === (E.sel || {}).k); const b = caja.querySelector("[data-ficha]"); if (b && x) b.onclick = () => hojaModelo(x.m); const pb = caja.querySelector("[data-prep]"); if (pb && x) pb.onclick = () => preparaDesdeListos(x.kl); }

/* ═══════════════ MATERIAL ═══════════════ */
const vivo = p => Math.max(0, Number(p.cantidad || 0) + (E.pend.get(p.id) || 0));
const titulo = p => (p.apodos && p.apodos[0]) ? p.apodos[0] : p.nombre;
const estado = p => { const n = vivo(p), m = Number(p.minimo || 0); return n === 0 ? "cero" : (m > 0 && n <= m ? "bajo" : ""); };
const catDe = p => p.presentacion === "Tambo" ? "Tambos" : p.presentacion === "Cubeta" ? "Cubetas" : (p.categoria || "");
const materiales = () => E.productos.filter(p => p.tipo === "material" && p.activo !== false);
const enCabina = p => Math.max(0, Number(p.cabina || 0) + (E.pend.get("cab:" + p.id) || 0));
function pintaMaterial(){
  const caja = $("#listaMaterial"); const tabs = $("#catsMaterial");
  const todos = materiales();
  if (!E.catMat) E.catMat = "Cubetas";
  const esCab = E.catMat === "Tambos en cabina";
  const cuenta = c => c === "Tambos en cabina" ? todos.filter(p => catDe(p) === "Tambos").reduce((s,p) => s + enCabina(p), 0) : todos.filter(p => catDe(p) === c).reduce((s,p) => s + vivo(p), 0);
  tabs.innerHTML = ["Cubetas", "Tambos", "Tambos en cabina"].map(c => '<button class="pestana' + (E.catMat === c ? " on" : "") + '" data-cat="' + esc(c) + '"><b>' + cuenta(c) + '</b>' + esc(c) + '</button>').join("");
  tabs.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { E.catMat = b.dataset.cat; pintaMaterial(); });
  let l = todos.filter(p => catDe(p) === (esCab ? "Tambos" : E.catMat));
  if (esCab) l = l.filter(p => enCabina(p) > 0);
  if (q("material")) l = Busca.busca(q("material"), l, p => [p.nombre, ...(p.apodos || []), p.marca, p.codigo, p.barras].filter(Boolean).join(" "));
  l.sort((a,b) => sinAcento(titulo(a)) < sinAcento(titulo(b)) ? -1 : 1);
  $("#resumenMaterial").textContent = esCab ? "tambos abiertos en la cabina de pintura" : (E.catMat === "Tambos" ? "sellados en el almacén" : "");
  const bajos = todos.filter(p => estado(p)).length; $("#nMat").hidden = !bajos; $("#nMat").textContent = bajos;
  if (!todos.length){
    caja.innerHTML = '<div class="vacio"><b>Todavía no hay material</b><p>Agrégalo con el botón de arriba.</p></div>';
    return;
  }
  if (!l.length){ caja.innerHTML = q("material") ? sinHallar("material", "ese producto") : '<div class="vacio"><b>' + (esCab ? "No hay tambos abiertos en cabina" : "Nada en " + esc(E.catMat.toLowerCase())) + '</b><p>' + (esCab ? "Desde la pestaña Tambos, toca «Pasar a cabina»." : "") + '</p></div>'; return; }
  caja.innerHTML = '<div class="encabezado-lista"><span>Producto</span><span>Otros apodos</span><span class="d">Hay</span><span>Último movimiento</span><span></span></div>' + l.map(p => {
    const n = esCab ? enCabina(p) : vivo(p), est = esCab ? (n === 0 ? "cero" : "") : estado(p);
    const u = E.movimientos.filter(m => m.producto_id === p.id && (esCab ? m.donde === "cabina" || m.etapa_a === "cabina" : m.donde !== "cabina")).sort((a,b) => a.creado < b.creado ? 1 : -1)[0];
    const sello = est === "cero" ? '<span class="sello roj">se acabó</span>' : est === "bajo" ? '<span class="sello amb">pocos</span>' : "";
    const otros = (p.apodos || []).slice(1);
    const sel = E.sel && E.sel.tipo === "material" && E.sel.id === p.id;
    const kp = (esCab ? "cab:" : "") + p.id;
    const stepper = esCab
      ? '<button class="tecla" data-menos="' + p.id + '" data-donde="cabina"' + (n === 0 ? " disabled" : "") + '>−</button><span class="cant' + (E.pend.get(kp) ? " pend" : "") + '">' + n + '</span><span style="width:34px"></span>'
      : '<button class="tecla" data-menos="' + p.id + '"' + (n === 0 ? " disabled" : "") + '>−</button><span class="cant' + (E.pend.get(kp) ? " pend" : "") + '">' + n + '</span><button class="tecla" data-mas="' + p.id + '">＋</button>' +
        (E.catMat === "Tambos" ? '<button class="btn suave" data-cabina="' + p.id + '" style="margin-left:6px"' + (n === 0 ? " disabled" : "") + '>Pasar a cabina →</button>' : "");
    return '<div class="fila ' + est + (sel ? " sel" : "") + '" data-id="' + p.id + '">' +
      '<div class="nombre" data-abre="' + p.id + '"><b>' + esc(titulo(p)) + '</b>' + (p.nombre !== titulo(p) ? '<small>' + esc(p.nombre) + '</small>' : "") + '</div>' +
      '<div class="sub"><span>' + esc(esCab ? "en cabina" : catDe(p)) + (p.litros ? " · " + p.litros + " L" : "") + (esCab ? " · " + vivo(p) + " en almacén" : "") + '</span>' + sello + '</div>' +
      '<div class="apodos">' + otros.map(a => '<span class="chip">' + esc(a) + '</span>').join("") + '</div>' +
      '<div class="cant' + (E.pend.get(kp) ? " pend" : "") + '" data-abre="' + p.id + '">' + n + (esEscritorio() ? sello : "") + '</div>' +
      '<div class="ultimo">' + (u ? '<b>' + esc(u.persona || "?") + ' · ' + esc(cuando(u.creado)) + '</b><span>' + (u.tipo === "traslado" ? "→ cabina " : (u.delta > 0 ? "+" : "")) + (u.tipo === "traslado" ? u.delta : (u.delta || "")) + (u.motivo ? " · " + esc(u.motivo) : "") + '</span>' : '<span>sin movimientos</span>') + '</div>' +
      '<div class="stepper">' + stepper + '</div></div>';
  }).join("");
  caja.querySelectorAll("[data-mas]").forEach(x => x.onclick = e => { e.stopPropagation(); mueve(x.dataset.mas, +1); });
  caja.querySelectorAll("[data-menos]").forEach(x => x.onclick = e => { e.stopPropagation(); mueve(x.dataset.menos, -1, x.dataset.donde); });
  caja.querySelectorAll("[data-cabina]").forEach(x => x.onclick = e => { e.stopPropagation(); hojaACabina(x.dataset.cabina); });
  caja.querySelectorAll("[data-abre]").forEach(x => x.onclick = () => seleccionaMaterial(x.dataset.abre, true));
}
function hojaACabina(id){
  if (!exigeYo()) return;
  const p = E.productos.find(x => x.id === id); if (!p) return;
  const n = vivo(p);
  abreHoja('<h3>Pasar a cabina</h3><div class="paso-a"><span class="de">Almacén</span> → <span class="a">Cabina de pintura</span></div>' +
    '<p class="guia"><b>' + esc(titulo(p)) + '</b> · hay <b>' + n + '</b> en el almacén y <b>' + enCabina(p) + '</b> en cabina.</p>' +
    '<div class="lote"><div class="quien">Cuántos pasan</div><div class="toma"><button class="tecla" data-menos>−</button><input id="pCant" type="number" inputmode="numeric" min="1" max="' + n + '" value="1"><button class="tecla" data-mas>＋</button></div></div>' +
    '<p class="sin-hallar" id="pError" hidden></p><button class="btn vino grande" id="pOk" style="margin-top:12px">Confirmar</button>',
    h => {
      const inp = h.querySelector("#pCant");
      const revisa = () => { const v = Number(inp.value) || 0; inp.classList.toggle("mal", v > n || v < 1); h.querySelector("#pOk").disabled = v > n || v < 1; };
      h.querySelector("[data-menos]").onclick = () => { inp.value = Math.max(1, (Number(inp.value) || 0) - 1); revisa(); };
      h.querySelector("[data-mas]").onclick = () => { inp.value = Math.min(n, (Number(inp.value) || 0) + 1); revisa(); };
      inp.oninput = revisa; revisa();
      h.querySelector("#pOk").onclick = async () => {
        try { const mov = await Almacen.aCabina(p.id, Number(inp.value), E.yo, origen()); cierraHoja(); grita(plural(mov.delta, "tambo pasó", "tambos pasaron") + " a cabina"); E.catMat = "Tambos en cabina"; pintaTodo(); }
        catch(e){ const err = h.querySelector("#pError"); err.hidden = false; err.textContent = e.message; }
      };
    });
}
function mueve(id, d, donde){
  if (!exigeYo()) return;
  const p = E.productos.find(x => x.id === id); if (!p) return;
  const k = (donde === "cabina" ? "cab:" : "") + id;
  if (d < 0 && (donde === "cabina" ? enCabina(p) : vivo(p)) === 0) return;
  E.pend.set(k, (E.pend.get(k) || 0) + d);
  pintaMaterial(); if (E.sel && E.sel.id === id) pintaDetalle();
  clearTimeout(E.relojes.get(k));
  E.relojes.set(k, setTimeout(() => confirma(id, "", donde), 650));
}
async function confirma(id, motivo, donde){
  const k = (donde === "cabina" ? "cab:" : "") + id;
  const d = E.pend.get(k); if (!d) return;
  E.pend.delete(k);
  await Almacen.ajusta(id, d, E.yo, motivo || "", origen(), "", donde);
}
function seleccionaMaterial(id, abrir){
  E.sel = { tipo:"material", id }; pintaMaterial();
  if (esEscritorio()) pintaDetalle(); else if (abrir) abreHoja(htmlDetalleMaterial(), montaDetalleMaterial);
}
function htmlDetalleMaterial(){
  const p = E.productos.find(x => x.id === (E.sel || {}).id); if (!p) return '<div class="detalle-vacio">Ya no está</div>';
  const n = vivo(p);
  const movs = E.movimientos.filter(m => m.producto_id === p.id).sort((a,b) => a.creado < b.creado ? 1 : -1).slice(0,12);
  const unidad = p.presentacion ? p.presentacion.toLowerCase() + (n === 1 ? "" : "s") : "envases";
  return '<h2>' + esc(titulo(p)) + '</h2><div class="sub">' + esc([p.nombre !== titulo(p) ? p.nombre : "", p.marca, catDe(p)].filter(Boolean).join(" · ")) + '</div>' +
    '<div class="grande-cant"><b>' + n + '</b><span>' + esc(unidad) + (p.litros ? "<br>de " + p.litros + " L<br><b style='font-size:13px;color:var(--tinta2)'>" + Math.round(n * p.litros) + " L</b>" : "") + '</span>' +
      '<div class="stepper"><button class="tecla" data-menos="' + p.id + '"' + (n === 0 ? " disabled" : "") + '>−</button><button class="tecla on" data-mas="' + p.id + '">＋</button></div></div>' +
    '<dl class="ficha">' +
      ((p.apodos || []).length ? '<dt>Apodos</dt><dd><div class="apodos">' + p.apodos.map(a => '<span class="chip">' + esc(a) + '</span>').join("") + '</div></dd>' : "") +
      (p.codigo ? '<dt>Código</dt><dd style="font-family:var(--mono);font-size:13px">' + esc(p.codigo) + '</dd>' : "") +
      (p.barras ? '<dt>Barras</dt><dd style="font-family:var(--mono);font-size:13px">' + esc(p.barras) + '</dd>' : "") +
      (catDe(p) === "Tambos" ? '<dt>En cabina</dt><dd>' + enCabina(p) + (enCabina(p) === 1 ? " tambo abierto" : " tambos abiertos") + '</dd>' : "") +
      '<dt>Mínimo</dt><dd>' + (p.minimo ? p.minimo + " · avisa al llegar" : "sin mínimo") + '</dd>' +
      (p.por_quien ? '<dt>Último</dt><dd>' + esc(p.por_quien) + (p.tocado ? " · " + esc(cuando(p.tocado)) : "") + '</dd>' : "") +
    '</dl>' +
    '<div class="acciones">' + (catDe(p) === "Tambos" && n > 0 ? '<button class="btn vino" data-cabina="' + p.id + '">Pasar a cabina →</button>' : "") + '<button class="btn" data-conteo="' + p.id + '">Poner cantidad exacta</button><button class="btn" data-editar="' + p.id + '">Editar</button><button class="btn fantasma" data-quitar="' + p.id + '">Quitar</button></div>' +
    '<h3>Últimos movimientos</h3>' + (movs.length ? movs.map(lineaMov).join("") : '<div class="vacio" style="padding:14px"><p style="margin:0">Todavía nadie lo ha movido.</p></div>');
}
function montaDetalleMaterial(caja){
  caja.querySelectorAll("[data-cabina]").forEach(x => x.onclick = () => hojaACabina(x.dataset.cabina));
  caja.querySelectorAll("[data-mas]").forEach(x => x.onclick = () => mueve(x.dataset.mas, +1));
  caja.querySelectorAll("[data-menos]").forEach(x => x.onclick = () => mueve(x.dataset.menos, -1));
  caja.querySelectorAll("[data-conteo]").forEach(x => x.onclick = () => hojaConteo(x.dataset.conteo));
  caja.querySelectorAll("[data-editar]").forEach(x => x.onclick = () => hojaProducto(E.productos.find(y => y.id === x.dataset.editar)));
  caja.querySelectorAll("[data-quitar]").forEach(x => x.onclick = async () => {
    const p = E.productos.find(y => y.id === x.dataset.quitar);
    if (!confirm("¿Quitar «" + titulo(p) + "» del inventario?")) return;
    await Almacen.parcha("producto", p.id, {activo:false});
    await Almacen.anota({producto_id:p.id, nombre:p.nombre, tipo:"baja", persona:E.yo, motivo:"quitado del inventario", origen:origen()});
    E.sel = null; cierraHoja(); pintaTodo(); grita("Quitado");
  });
}
function hojaProducto(p){
  p = p || {}; const nuevo = !p.id; const pres = CAT.presentaciones || []; const ap = p.apodos || [];
  abreHoja('<h3>' + (nuevo ? "Material nuevo" : "Ficha del material") + '</h3><p class="guia">Litros por envase, nombre de la etiqueta y el apodo con el que se le dice en el taller (así se ve en Material).</p>' +
    '<div class="dupla"><label class="campo"><span>Litros por envase</span><input id="fLitros" type="number" inputmode="decimal" min="0" step="0.5" value="' + (p.litros != null ? p.litros : "") + '" placeholder="19"></label>' +
    '<label class="campo"><span>Presentación</span><select id="fPres">' + pres.map(x => '<option value="' + esc(x.n) + '|' + x.l + '"' + (p.presentacion === x.n && Number(p.litros) === x.l ? " selected" : "") + '>' + esc(x.n) + ' ' + x.l + ' L</option>').join("") + '<option value="|"' + (!p.presentacion ? " selected" : "") + '>Otra / no sé</option></select></label></div>' +
    '<label class="campo"><span>Nombre de la etiqueta</span><input id="fNombre" value="' + esc(p.nombre || "") + '" placeholder="LACA INDUSTRIAL NITRO…"></label>' +
    '<label class="campo"><span>Apodo (cómo le dicen)</span><input id="fApodo" value="' + esc(ap[0] || "") + '" placeholder="laca amarilla"></label>' +
    '<div class="dupla"><label class="campo"><span>Otro apodo</span><input id="fApodo2" value="' + esc(ap[1] || "") + '"></label><label class="campo"><span>Otro apodo</span><input id="fApodo3" value="' + esc(ap[2] || "") + '"></label></div>' +
    '<label class="campo"><span>Marca</span><input id="fMarca" value="' + esc(p.marca || "") + '" placeholder="HiCoat"></label>' +
    '<div class="dupla"><label class="campo"><span>Código del fabricante</span><input id="fCodigo" value="' + esc(p.codigo || "") + '" placeholder="13261"></label>' +
    '<label class="campo"><span>Código de barras</span><input id="fBarras" inputmode="numeric" value="' + esc(p.barras || "") + '" placeholder="7506180720880"></label></div>' +
    '<div class="dupla"><label class="campo"><span>Envases que hay</span><input id="fCant" type="number" inputmode="numeric" min="0" value="' + (nuevo ? 0 : vivo(p)) + '"' + (nuevo ? "" : " disabled") + '></label>' +
    '<label class="campo"><span>Avisar cuando baje a</span><input id="fMin" type="number" inputmode="numeric" min="0" value="' + Number(p.minimo || 0) + '"></label></div>' +
    '<button class="btn vino grande" id="fOk">' + (nuevo ? "Agregar" : "Guardar cambios") + '</button>' + (nuevo ? "" : '<button class="btn fantasma grande" id="fQuita" style="margin-top:8px">Quitar del catálogo</button>'),
    h => {
      const g = id => h.querySelector(id);
      g("#fPres").onchange = () => { const [,l] = g("#fPres").value.split("|"); if (l) g("#fLitros").value = l; };
      g(nuevo ? "#fLitros" : "#fNombre").focus();
      g("#fOk").onclick = async () => {
        if (!exigeYo()) return;
        const nombre = g("#fNombre").value.trim(); if (!nombre) return grita("Falta el nombre");
        const apodos = ["#fApodo", "#fApodo2", "#fApodo3"].map(id => g(id).value.trim()).filter(Boolean).filter((a, i, arr) => arr.indexOf(a) === i).slice(0, 3);
        const datos = { tipo:"material", nombre, minimo: Math.max(0, Number(g("#fMin").value || 0)), por_quien: E.yo, color:"", apodos,
          marca: g("#fMarca").value.trim(), codigo: g("#fCodigo").value.trim(), barras: g("#fBarras").value.trim().replace(/\s+/g, ""),
          presentacion: g("#fPres").value.split("|")[0] || (p.presentacion || ""), litros: g("#fLitros").value === "" ? null : Number(g("#fLitros").value) };
        datos.categoria = datos.presentacion === "Tambo" ? "Tambos" : datos.presentacion === "Cubeta" ? "Cubetas" : "";
        if (nuevo){
          datos.cantidad = Math.max(0, Number(g("#fCant").value || 0));
          const f = await Almacen.pon("producto", datos);
          await Almacen.anota({producto_id:f.id, nombre:f.nombre, tipo:"alta", delta:f.cantidad, resultado:f.cantidad, persona:E.yo, motivo:"material nuevo", origen:origen()});
          E.sel = { tipo:"material", id: f.id }; grita("Agregado");
        } else { await Almacen.parcha("producto", p.id, datos); grita("Guardado"); }
        cierraHoja(); pintaTodo();
      };
      const qb = g("#fQuita"); if (qb) qb.onclick = async () => {
        if (!confirm("¿Quitar «" + titulo(p) + "» del catálogo de material?")) return;
        await Almacen.parcha("producto", p.id, {activo:false});
        await Almacen.anota({producto_id:p.id, nombre:p.nombre, tipo:"baja", persona:E.yo, motivo:"quitado del catálogo de material", origen:origen()});
        E.sel = null; cierraHoja(); pintaTodo(); grita("Quitado");
      };
    });
}
function hojaConteo(id){
  const p = E.productos.find(x => x.id === id); if (!p) return;
  abreHoja('<h3>Cantidad exacta</h3><p class="guia">' + esc(titulo(p)) + ' · ahora hay <b>' + vivo(p) + '</b>. Escribe lo que contaste y el sistema anota la diferencia.</p>' +
    '<label class="campo"><span>Contado</span><input id="cCant" type="number" inputmode="numeric" min="0" value="' + vivo(p) + '"></label>' +
    '<label class="campo"><span>Motivo (opcional)</span><input id="cMot" placeholder="conteo físico, se rompieron 2…"></label>' +
    '<button class="btn vino grande" id="cOk">Guardar</button>',
    h => {
      h.querySelector("#cCant").focus(); h.querySelector("#cCant").select();
      h.querySelector("#cOk").onclick = async () => {
        if (!exigeYo()) return;
        const nuevo = Math.max(0, Number(h.querySelector("#cCant").value || 0)); const d = nuevo - vivo(p);
        cierraHoja();
        if (d !== 0){ E.pend.delete(id); await Almacen.ajusta(id, d, E.yo, h.querySelector("#cMot").value.trim() || "conteo exacto", origen()); }
        grita("Guardado"); pintaTodo();
      };
    });
}
async function sembrarMaterial(){
  if (!exigeYo()) return;
  for (const m of (CAT.arranqueMaterial || [])){
    const f = await Almacen.pon("producto", Object.assign({tipo:"material", color:"", cantidad:0, minimo:2, por_quien:E.yo}, m));
    await Almacen.anota({producto_id:f.id, nombre:f.nombre, tipo:"alta", persona:E.yo, motivo:"alta desde el catálogo", origen:origen()});
  }
  grita("Listo: pon cuántos hay de cada uno");
}

/* ═══════════════ código de barras (material) ═══════════════ */
let lector = null;
function hojaBarras(){
  abreHoja('<h3>Código de barras</h3><p class="guia">Apunta la cámara al código, o escríbelo abajo si no lo lee.</p>' +
    '<div id="camBarras"><video id="vidBarras" muted playsinline hidden></video><button class="btn grande" id="btnCam">Abrir cámara</button></div>' +
    '<label class="campo" style="margin-top:12px"><span>O escribe el código</span><input id="codBarras" inputmode="numeric" placeholder="7506180720880" autocomplete="off"></label>' +
    '<button class="btn vino grande" id="okBarras">Buscar</button><div class="resultado-barras" id="resBarras" style="margin-top:10px"></div>',
    h => {
      const inp = h.querySelector("#codBarras");
      const resolver = cod => {
        cod = String(cod || "").replace(/\s+/g, "").trim(); if (!cod) return;
        const p = materiales().find(x => x.barras && x.barras === cod);
        if (p){ paraLector(); cierraHoja(); irA("material"); seleccionaMaterial(p.id, true); grita("Encontrado: " + titulo(p)); return; }
        h.querySelector("#resBarras").innerHTML = '<div class="aviso"><b>Código ' + esc(cod) + ' no está registrado</b><p>Escoge a qué producto pertenece y lo dejo guardado para la próxima.</p></div>' +
          materiales().sort((a,b) => sinAcento(titulo(a)) > sinAcento(titulo(b)) ? 1 : -1).slice(0,40).map(x => '<button class="btn" style="justify-content:flex-start" data-liga="' + x.id + '">' + esc(titulo(x)) + '</button>').join("");
        h.querySelectorAll("[data-liga]").forEach(b => b.onclick = async () => { await Almacen.parcha("producto", b.dataset.liga, {barras:cod}); paraLector(); cierraHoja(); seleccionaMaterial(b.dataset.liga, true); grita("Código guardado"); });
      };
      h.querySelector("#okBarras").onclick = () => resolver(inp.value);
      inp.onkeydown = e => { if (e.key === "Enter") resolver(inp.value); };
      h.querySelector("#btnCam").onclick = () => abreCamara(h, resolver);
    });
}
async function abreCamara(h, resolver){
  const video = h.querySelector("#vidBarras"), btn = h.querySelector("#btnCam");
  btn.disabled = true; btn.textContent = "Abriendo…";
  try {
    if (!window.ZXing) await cargaScript("https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js");
    video.hidden = false;
    lector = new ZXing.BrowserMultiFormatReader();
    await lector.decodeFromVideoDevice(undefined, video, (res) => { if (res){ if (navigator.vibrate) navigator.vibrate(60); resolver(res.getText()); } });
    btn.textContent = "Leyendo… apunta al código";
  } catch(e){
    video.hidden = true; btn.disabled = false; btn.textContent = "Abrir cámara";
    grita(e && e.name === "NotAllowedError" ? "No diste permiso a la cámara. Escribe el código." : "No se pudo abrir la cámara. Escribe el código.");
  }
}
function paraLector(){ try { lector && lector.reset(); } catch(e){} lector = null; }
function cargaScript(src){ return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("no cargó")); document.head.appendChild(s); }); }

/* ═══════════════ PEDIDOS (tickets) ═══════════════ */
const lineasDe = p => (Array.isArray(p.lineas) ? p.lineas : []).map(x => Object.assign({ entregado: 0 }, x));
const FAMILIAS_SURTIDO = ["Mariana", "Monarca", "Petaquero", "Ropero", "Cómoda", "Vitrina", "Cajonera", "Librero", "Tocador", "Alacena"];
const modeloExacto = n => E.modelos.find(m => m.activo !== false && sinAcento(m.nombre) === sinAcento(n)) || null;
const enCatalogo = x => !!(x.surtido || modeloExacto(x.modelo));
const avance = p => { const ls = lineasDe(p); const t = ls.reduce((s,x) => s + Number(x.cantidad || 0), 0); const e = ls.reduce((s,x) => s + Math.min(Number(x.cantidad || 0), Number(x.entregado || 0)), 0); return { t, e, pct: t ? Math.round(e * 100 / t) : 0 }; };
function pintaPedidos(){
  const caja = $("#listaPedidos");
  $("#ordenPedidos").textContent = E.ordenPedidos === "desc" ? "Más nuevos primero" : "Más viejos primero";
  let l = E.pedidos.slice().sort((a,b) => { const ka = (a.fecha || "") + a.creado, kb = (b.fecha || "") + b.creado; return E.ordenPedidos === "desc" ? (ka < kb ? 1 : -1) : (ka < kb ? -1 : 1); });
  const pend = l.filter(p => p.estado !== "entregado").length;
  $("#resumenPedidos").textContent = l.length ? plural(pend, "pedido por entregar", "pedidos por entregar") : "";
  $("#nPed").hidden = !pend; $("#nPed").textContent = pend;
  if (q("pedidos")) l = Busca.busca(q("pedidos"), l, p => [p.cliente, ...lineasDe(p).map(x => x.modelo + " " + (x.color || ""))].join(" "));
  if (!l.length){ caja.innerHTML = q("pedidos") ? sinHallar("pedidos", "ese pedido") : '<div class="vacio"><b>Sin pedidos</b><p>Agrega el primero con el botón. Cada pedido queda como un ticket con el cliente, la fecha y lo que pidió.</p></div>'; return; }
  caja.innerHTML = '<div class="tickets">' + l.map(p => {
    const ls = lineasDe(p); const av = avance(p);
    return '<article class="ticket' + (p.estado === "entregado" ? " entregado" : "") + '" data-id="' + p.id + '">' +
      '<div class="t-cab"><span class="t-caja">MUEBLES</span><span class="t-script">San Bernardo</span></div><div class="t-linea"></div>' +
      '<div class="t-fila"><span>CLIENTE</span><b>' + esc(p.cliente) + '</b></div>' +
      '<div class="t-fila"><span>FECHA</span><b>' + esc(isoADma(p.fecha) || "—") + '</b></div>' +
      '<div class="t-fila"><span>CAPTURÓ</span><b>' + esc(p.de || "?") + '</b></div><div class="t-linea"></div>' +
      (ls.length ? ls.map((x, i) => { const ent = Math.min(x.cantidad, x.entregado || 0); return '<div class="t-item' + (ent >= x.cantidad ? " hecho" : "") + '"><span class="t-n">' + Number(x.cantidad || 0) + '</span><span class="t-desc">' + esc(x.modelo) + (x.surtido ? ' <span class="sello amb">surtido</span>' : enCatalogo(x) ? "" : ' <span class="sello roj">no está en catálogo</span>') + (x.color ? '<small>' + esc(x.color) + '</small>' : "") + (x.surtido && (x.entregas || []).length ? '<small>se dieron: ' + esc(x.entregas.map(e => e.cantidad + " " + e.modelo + (e.color ? " " + e.color : "")).join(", ")) + '</small>' : "") + '</span>' +
        '<span class="t-ent"><button class="tecla" data-ent="' + p.id + '|' + i + '|-1"' + (ent <= 0 ? " disabled" : "") + '>−</button><small>' + ent + ' de ' + x.cantidad + '</small><button class="tecla" data-ent="' + p.id + '|' + i + '|1"' + (ent >= x.cantidad ? " disabled" : "") + '>＋</button>' + (ent >= x.cantidad ? '<span class="sello ver">listo</span>' : '<button class="btn suave chico" data-listo="' + p.id + '|' + i + '">Listo</button>') + '</span></div>'; }).join("")
               : '<div class="t-item"><span class="t-desc" style="color:var(--tinta3)">sin renglones</span></div>') +
      '<div class="t-linea"></div>' +
      '<div class="t-faltan' + (av.t - av.e === 0 ? " ok" : "") + '"><b>' + (av.t - av.e === 0 ? "✓" : av.t - av.e) + '</b><span>' + (av.t - av.e === 0 ? "todo entregado" : (av.t - av.e === 1 ? "mueble falta" : "muebles faltan") + "<br>de " + av.t) + '</span><em>' + av.pct + ' %</em></div>' +
      '<div class="progreso"><i style="width:' + av.pct + '%"></i></div><div class="progreso-txt"><span>' + av.e + ' de ' + av.t + ' entregados</span></div>' +
      (p.notas ? '<div class="t-notas">' + esc(p.notas) + '</div>' : "") +
      '<div class="t-estado">' + (p.estado === "entregado" ? "✓ ENTREGADO" : av.e ? "EN ENTREGA" : "PENDIENTE") + '</div>' +
      '<div class="t-acciones">' + (p.estado === "entregado" ? '<button class="btn fantasma" data-reabre="' + p.id + '">Reabrir</button>' : '<button class="btn" data-todo="' + p.id + '">✓ Todo entregado</button>') + '<button class="btn fantasma" data-edita="' + p.id + '">Editar</button><button class="btn fantasma" data-borra="' + p.id + '">Borrar</button></div>' +
    '</article>';
  }).join("") + '</div>';
  caja.querySelectorAll("[data-ent]").forEach(b => b.onclick = () => { const [id, i, d] = b.dataset.ent.split("|"); entrega(id, Number(i), Number(d)); });
  caja.querySelectorAll("[data-listo]").forEach(b => b.onclick = () => { const [id, i] = b.dataset.listo.split("|"); entrega(id, Number(i), 99999); });
  caja.querySelectorAll("[data-todo]").forEach(b => b.onclick = () => { if (!exigeYo()) return; const p = E.pedidos.find(x => x.id === b.dataset.todo); const ls = lineasDe(p);
    if (ls.some(x => x.surtido && Number(x.entregado || 0) < Number(x.cantidad || 0))) return grita("Hay renglones surtidos: márcalos uno por uno y di qué muebles se dieron");
    Almacen.parcha("pedido", p.id, { lineas: ls.map(x => Object.assign({}, x, { entregado: x.cantidad })), estado: "entregado" }); });
  caja.querySelectorAll("[data-reabre]").forEach(b => b.onclick = () => Almacen.parcha("pedido", b.dataset.reabre, {estado:"pendiente"}));
  caja.querySelectorAll("[data-edita]").forEach(b => b.onclick = () => hojaPedido(E.pedidos.find(x => x.id === b.dataset.edita)));
  caja.querySelectorAll("[data-borra]").forEach(b => b.onclick = () => { if (confirm("¿Borrar este pedido?")) Almacen.borra("pedido", b.dataset.borra); });
}
function entrega(id, i, d){
  if (!exigeYo()) return;
  const p = E.pedidos.find(x => x.id === id); if (!p) return;
  const ls = lineasDe(p); const x = ls[i]; if (!x) return;
  if (x.surtido && d > 0) return hojaEntregaSurtido(p, i, Math.min(Number(x.cantidad || 0), Number(x.entregado || 0) + d));
  if (x.surtido && d < 0){ const es = (x.entregas || []).slice(); let quitar = -d; while (quitar > 0 && es.length){ const u = es[es.length - 1]; const t = Math.min(quitar, u.cantidad); u.cantidad -= t; quitar -= t; if (!u.cantidad) es.pop(); } x.entregas = es; }
  x.entregado = Math.max(0, Math.min(Number(x.cantidad || 0), Number(x.entregado || 0) + d));
  const completo = ls.every(y => Number(y.entregado || 0) >= Number(y.cantidad || 0));
  Almacen.parcha("pedido", id, { lineas: ls, estado: completo ? "entregado" : "pendiente" });
}
$("#ordenPedidos").onclick = () => { E.ordenPedidos = E.ordenPedidos === "desc" ? "asc" : "desc"; localStorage.setItem("alm.ordenPedidos", E.ordenPedidos); pintaPedidos(); };
function hojaPedido(p){
  p = p || {}; const nuevo = !p.id;
  let lineas = lineasDe(p); if (!lineas.length) lineas = [{modelo:"", color:"", cantidad:1, entregado:0}];
  const grupos = CAT.gruposColor || [];
  const opcionesColor = sel => '<option value="">— color —</option>' + grupos.map(g => '<optgroup label="' + esc(g.grupo) + '">' + g.colores.map(c => '<option' + (sel === c ? " selected" : "") + '>' + esc(c) + '</option>').join("") + '</optgroup>').join("");
  const opcionesFam = sel => FAMILIAS_SURTIDO.map(f => '<option' + (sel === f ? " selected" : "") + '>' + f + '</option>').join("");
  const filaHtml_ = (x, i) => '<div class="p-linea' + (x.surtido ? " surtido" : "") + '" data-i="' + i + '" data-ent="' + (x.entregado || 0) + '" data-entregas="' + esc(JSON.stringify(x.entregas || [])) + '"><input class="p-cant" type="number" inputmode="numeric" min="1" value="' + (x.cantidad || 1) + '" aria-label="Cantidad">' +
    '<input class="p-modelo" list="dlModelosP" placeholder="Mueble" value="' + esc(x.surtido ? "" : (x.modelo || "")) + '" autocomplete="off"><select class="p-fam" aria-label="Familia surtida">' + opcionesFam(x.familia) + '</select>' +
    '<select class="p-color">' + opcionesColor(x.color) + '</select><button class="btn fantasma p-surt" title="El cliente deja escoger los modelos de una familia">Surtido</button><button class="btn fantasma p-quita" aria-label="Quitar renglón">×</button></div>';
  abreHoja('<h3>' + (nuevo ? "Nuevo pedido" : "Editar pedido") + '</h3>' +
    '<label class="campo"><span>Cliente</span><input id="pCliente" list="dlClientes" value="' + esc(p.cliente || "") + '" placeholder="Sr. Pedro Orozco" autocomplete="off"></label>' +
    '<datalist id="dlClientes">' + (CAT.clientes || []).map(c => '<option value="' + esc(c) + '">').join("") + '</datalist>' +
    '<datalist id="dlModelosP">' + modelosActivos().map(m => '<option value="' + esc(m.nombre) + '">').join("") + '</datalist>' +
    '<label class="campo"><span>Fecha (día/mes/año)</span><input id="pFecha" inputmode="numeric" placeholder="dd/mm/aaaa" value="' + esc(isoADma(p.fecha) || isoADma(hoyIso())) + '"></label>' +
    '<div class="grupo-h">Lo que pidió</div><div id="pLineas">' + lineas.map(filaHtml_).join("") + '</div>' +
    '<button class="btn" id="pMas" style="margin:6px 0 14px">＋ Otro renglón</button>' +
    '<label class="campo"><span>Notas</span><textarea id="pNotas" placeholder="urgente, con lámpara, entregar en…">' + esc(p.notas || "") + '</textarea></label>' +
    '<button class="btn vino grande" id="pOk">' + (nuevo ? "Guardar pedido" : "Guardar cambios") + '</button>',
    h => {
      const cont = h.querySelector("#pLineas");
      const leer = () => Array.from(cont.querySelectorAll(".p-linea")).map(f => { const surtido = f.classList.contains("surtido"); const fam = f.querySelector(".p-fam").value; let entregas = []; try { entregas = JSON.parse(f.dataset.entregas || "[]"); } catch(e){}
        return Object.assign({ cantidad: Math.max(0, Number(f.querySelector(".p-cant").value || 0)), modelo: surtido ? fam + " surtido" : f.querySelector(".p-modelo").value.trim(), color: f.querySelector(".p-color").value, entregado: Number(f.dataset.ent || 0) }, surtido ? { surtido: true, familia: fam, entregas } : {}); });
      const enlaza = () => { cont.querySelectorAll(".p-quita").forEach(b => b.onclick = () => { if (cont.children.length > 1) b.closest(".p-linea").remove(); });
        cont.querySelectorAll(".p-surt").forEach(b => b.onclick = () => { const f = b.closest(".p-linea"); f.classList.toggle("surtido"); b.classList.toggle("on", f.classList.contains("surtido")); }); cont.querySelectorAll(".p-linea.surtido .p-surt").forEach(b => b.classList.add("on")); };
      enlaza();
      h.querySelector("#pMas").onclick = () => { cont.insertAdjacentHTML("beforeend", filaHtml_({cantidad:1}, cont.children.length)); enlaza(); cont.lastElementChild.querySelector(".p-modelo").focus(); };
      const f = h.querySelector("#pFecha");
      f.oninput = () => { let v = f.value.replace(/[^\d]/g, "").slice(0,8); if (v.length > 4) v = v.slice(0,2) + "/" + v.slice(2,4) + "/" + v.slice(4); else if (v.length > 2) v = v.slice(0,2) + "/" + v.slice(2); f.value = v; };
      h.querySelector("#pCliente").focus();
      h.querySelector("#pOk").onclick = async () => {
        if (!exigeYo()) return;
        const cliente = h.querySelector("#pCliente").value.trim(); if (!cliente) return grita("Falta el cliente");
        const iso = dmaAIso(f.value); if (f.value && !iso) return grita("La fecha va día/mes/año, por ejemplo 04/09/2026");
        const ls = leer().filter(x => (x.modelo || x.surtido) && x.cantidad > 0).map(x => Object.assign(x, { entregado: Math.min(x.entregado, x.cantidad) }));
        const completo = ls.length && ls.every(x => x.entregado >= x.cantidad);
        const datos = { cliente, fecha: iso || null, lineas: ls, notas: h.querySelector("#pNotas").value.trim(), estado: completo ? "entregado" : "pendiente", de: p.de || E.yo };
        if (nuevo) await Almacen.pon("pedido", datos); else await Almacen.parcha("pedido", p.id, datos);
        cierraHoja(); grita(nuevo ? "Pedido guardado" : "Guardado"); pintaPedidos();
      };
    });
}

/* Renglón surtido: al entregar hay que decir qué muebles se dieron (modelos de esa familia). */
function hojaEntregaSurtido(p, i, nuevoTotal){
  const x = lineasDe(p)[i]; const fam = x.familia || (x.modelo || "").split(" ")[0];
  const previas = (x.entregas || []).slice(); const ya = previas.reduce((s, e) => s + Number(e.cantidad || 0), 0);
  const faltanDecir = nuevoTotal - ya; if (faltanDecir <= 0){ const ls = lineasDe(p); ls[i].entregado = nuevoTotal; Almacen.parcha("pedido", p.id, { lineas: ls, estado: ls.every(y => y.entregado >= y.cantidad) ? "entregado" : "pendiente" }); return; }
  const modelos = modelosActivos().filter(m => !R.esExtra(m) && sinAcento(m.familia || m.nombre.split(" ")[0]) === sinAcento(fam));
  let filas = [{ modelo: "", color: x.color || "", cantidad: faltanDecir }];
  const opcionesColor = sel => '<option value="">— color —</option>' + (CAT.gruposColor || []).map(g => '<optgroup label="' + esc(g.grupo) + '">' + g.colores.map(c => '<option' + (sel === c ? " selected" : "") + '>' + esc(c) + '</option>').join("") + '</optgroup>').join("");
  const filaHtml = (f, j) => '<div class="p-linea" data-j="' + j + '"><input class="p-cant" type="number" inputmode="numeric" min="1" value="' + f.cantidad + '"><select class="p-modelo-s"><option value="">— modelo —</option>' + modelos.map(m => '<option' + (f.modelo === m.nombre ? " selected" : "") + '>' + esc(m.nombre) + '</option>').join("") + '</select><select class="p-color">' + opcionesColor(f.color) + '</select><button class="btn fantasma p-quita">×</button></div>';
  abreHoja('<h3>¿Qué muebles se dieron?</h3><p class="guia"><b>' + esc(p.cliente) + '</b> pidió <b>' + x.cantidad + ' ' + esc(fam) + ' surtidos</b>' + (ya ? " · ya se habían anotado " + ya : "") + '. Di cuáles son los <b>' + faltanDecir + '</b> que se entregan ahora.</p>' +
    '<div id="sLineas">' + filas.map(filaHtml).join("") + '</div><button class="btn" id="sMas" style="margin:6px 0 10px">＋ Otro modelo</button>' +
    '<div class="total-paso"><span>Suman</span><b id="sTotal">0</b> <span>de ' + faltanDecir + '</span></div><p class="sin-hallar" id="sError" hidden></p>' +
    '<button class="btn vino grande" id="sOk" disabled>Guardar entrega</button>',
    h => {
      const cont = h.querySelector("#sLineas");
      const leer = () => Array.from(cont.querySelectorAll(".p-linea")).map(f => ({ cantidad: Math.max(0, Number(f.querySelector(".p-cant").value || 0)), modelo: f.querySelector(".p-modelo-s").value, color: f.querySelector(".p-color").value }));
      const revisa = () => { const ls = leer(); const t = ls.reduce((s, f) => s + f.cantidad, 0); h.querySelector("#sTotal").textContent = t; const ok = t === faltanDecir && ls.every(f => f.modelo && f.cantidad > 0); h.querySelector("#sOk").disabled = !ok; const err = h.querySelector("#sError"); err.hidden = t <= faltanDecir; err.textContent = "Son más de " + faltanDecir; };
      const enlaza = () => { cont.querySelectorAll("input,select").forEach(e => { e.oninput = revisa; e.onchange = revisa; }); cont.querySelectorAll(".p-quita").forEach(b => b.onclick = () => { if (cont.children.length > 1){ b.closest(".p-linea").remove(); revisa(); } }); };
      enlaza(); revisa();
      h.querySelector("#sMas").onclick = () => { cont.insertAdjacentHTML("beforeend", filaHtml({ modelo: "", color: x.color || "", cantidad: 1 }, cont.children.length)); enlaza(); revisa(); };
      h.querySelector("#sOk").onclick = async () => {
        const ls = lineasDe(p); ls[i].entregas = previas.concat(leer()); ls[i].entregado = nuevoTotal;
        const completo = ls.every(y => Number(y.entregado || 0) >= Number(y.cantidad || 0));
        await Almacen.parcha("pedido", p.id, { lineas: ls, estado: completo ? "entregado" : "pendiente" });
        cierraHoja(); grita("Entrega anotada"); pintaPedidos();
      };
    });
}

/* ═══════════════ CATÁLOGO (editable) ═══════════════ */
const FAMILIAS = ["Mariana", "Monarca", "Petaquero", "Ropero", "Cómoda", "Vitrina", "Cajonera"];
function pintaCatalogo(){
  const caja = $("#listaCatalogo");
  let l = modelosActivos();
  const modelos = l.filter(m => !R.esExtra(m));
  $("#resumenCatalogo").textContent = modelos.length ? plural(modelos.length, "modelo", "modelos") + " · " + modelos.filter(m => !R.ficha(m).completa).length + " con datos faltantes" : "";
  if (q("catalogo")) l = Busca.busca(q("catalogo"), l, m => m.nombre + " " + (m.familia || ""));
  if (!l.length){ caja.innerHTML = q("catalogo") ? sinHallar("catalogo", "ese modelo") + '<div style="text-align:center;margin-top:-10px"><button class="btn vino" id="agregaDesde">Agregarlo al catálogo</button></div>' : '<div class="vacio"><b>El catálogo está vacío</b></div>'; const b = caja.querySelector("#agregaDesde"); if (b) b.onclick = () => hojaModelo(null, q("catalogo")); return; }
  // Grupos: familias de madera en el orden del catálogo, luego MDF, hasta abajo las piezas extras
  const grupos = [];
  const madera = l.filter(m => m.tipo !== "mdf" && !R.esExtra(m));
  const fams = FAMILIAS.slice(); madera.forEach(m => { if (!fams.includes(m.familia || "Otros")) fams.push(m.familia || "Otros"); });
  fams.forEach(f => { const ms = madera.filter(m => (m.familia || "Otros") === f); if (ms.length) grupos.push({ titulo: f, ms }); });
  const mdf = l.filter(m => m.tipo === "mdf"); if (mdf.length) grupos.push({ titulo: "MDF", ms: mdf });
  const extras = l.filter(R.esExtra); if (extras.length || !q("catalogo")) grupos.push({ titulo: "Piezas extras", ms: extras, extra: true });
  caja.innerHTML = grupos.map(g => '<div class="bloque-h' + (g.extra ? "" : "") + '">' + esc(g.titulo) + (g.extra ? '<button class="btn" id="nuevaExtra">＋ Pieza extra</button>' : '<span class="n">' + g.ms.length + '</span>') + '</div>' +
    (g.ms.length ? g.ms.map(m => g.extra ? filaExtraHtml(m) : filaModeloHtml(m)).join("") : '<div class="bloque-vacio">Aquí van piezas que no son de un modelo (se registran por nombre y entran a «Puertas Uriel»).</div>')).join("");
  caja.querySelectorAll("[data-id]").forEach(f => f.onclick = () => { const m = modeloDe(f.dataset.id); if (R.esExtra(m)) hojaExtra(m); else hojaModelo(m); });
  const ne = caja.querySelector("#nuevaExtra"); if (ne) ne.onclick = e => { e.stopPropagation(); hojaExtra(null); };
}
function filaModeloHtml(m){
  const chips = [(m.pendiente ? '<span class="chip revisar">por revisar</span>' : ""), (m.tipo === "mdf" ? '<span class="chip mdf">MDF</span>' : ""),
    m.cajones == null ? '<span class="chip falta">cajones: falta dato</span>' : '<span class="chip">' + plural(m.cajones, "cajón", "cajones") + '</span>',
    m.total_puertas == null ? '<span class="chip falta">puertas: falta dato</span>' : '<span class="chip">' + plural(m.total_puertas, "puerta", "puertas") + '</span>',
    R.parchesDe(m) == null ? '<span class="chip falta">parches: falta dato</span>' : R.parchesDe(m) > 0 ? '<span class="chip">' + plural(R.parchesDe(m), "parche", "parches") + '</span>' : "",
    m.lleva_respaldo === true ? '<span class="chip">lleva respaldo</span>' : ""].filter(Boolean).join("");
  return '<div class="fila' + (m.pendiente ? " revisar" : "") + '" data-id="' + esc(m.id) + '"><div class="nombre"><b>' + esc(m.nombre) + '</b>' + (m.nota ? '<small>' + esc(m.nota) + '</small>' : "") + '</div><div class="sub ficha-chips">' + chips + '</div><div class="apodos ficha-chips">' + chips + '</div><div class="cifra"></div><div class="ultimo"><span>' + (m.editado_por ? esc(m.editado_por) + " · " + esc(cuando(m.actualizado || m.creado)) : "") + '</span></div><div class="stepper"><button class="btn" data-edita="' + esc(m.id) + '">Editar</button></div></div>';
}
function filaExtraHtml(m){
  return '<div class="fila" data-id="' + esc(m.id) + '"><div class="nombre"><b>' + esc(m.nombre) + '</b><small>pieza extra</small></div><div class="sub"><span class="chip">entra a Puertas Uriel · llega hasta lijadas</span></div><div class="apodos"><span class="chip">Puertas Uriel → lijadas</span></div><div class="cifra"></div><div class="ultimo"><span>' + (m.editado_por ? esc(m.editado_por) + " · " + esc(cuando(m.actualizado || m.creado)) : "") + '</span></div><div class="stepper"><button class="btn">Editar</button></div></div>';
}
/* Pieza extra: solo el nombre. Entra a Puertas Uriel y llega hasta lijadas. */
function hojaExtra(m){
  if (!exigeYo()) return;
  const nuevo = !m; m = m || { nombre: "" };
  abreHoja('<h3>' + (nuevo ? "Pieza extra nueva" : "Pieza extra") + '</h3><p class="guia">Solo el nombre. Se registra en «Puertas Uriel» con su color, se pasa a por lijar y a lijadas (con o sin bisagras). No se pinta ni cuenta para muebles listos.</p>' +
    '<label class="campo"><span>Nombre</span><input id="xNombre" value="' + esc(m.nombre) + '" placeholder="Copete, tapa, cajón suelto…"></label>' +
    '<button class="btn vino grande" id="xOk">' + (nuevo ? "Agregar" : "Guardar") + '</button>' + (nuevo ? "" : '<button class="btn fantasma grande" id="xQuita" style="margin-top:8px">Quitar del catálogo</button>'),
    h => {
      const inp = h.querySelector("#xNombre"); inp.focus();
      const ok = async () => {
        const nombre = inp.value.trim(); if (!nombre) return grita("Falta el nombre");
        if (E.modelos.find(x => x.id !== m.id && x.activo !== false && sinAcento(x.nombre) === sinAcento(nombre))) return grita("Ya existe algo con ese nombre");
        let id = m.id;
        if (nuevo){ const f = await Almacen.pon("modelo", { id: "X" + Date.now().toString(36), nombre, familia: "Piezas extras", tipo: "extra", activo: true, editado_por: E.yo }); id = f.id; }
        else { await Almacen.parcha("modelo", id, { nombre, editado_por: E.yo }); if (nombre !== m.nombre) renombraEnTodo(id, nombre); }
        await Almacen.anota({ tipo: "catalogo", modelo_id: id, nombre, persona: E.yo, motivo: nuevo ? "pieza extra nueva" : "pieza extra: " + m.nombre + " → " + nombre, origen: origen() });
        cierraHoja(); grita(nuevo ? "Pieza extra agregada" : "Guardado"); pintaTodo();
      };
      h.querySelector("#xOk").onclick = ok; inp.onkeydown = e => { if (e.key === "Enter") ok(); };
      const qb = h.querySelector("#xQuita"); if (qb) qb.onclick = async () => {
        if (!confirm("¿Quitar «" + m.nombre + "» del catálogo? Las existencias que ya tenga se conservan.")) return;
        await Almacen.parcha("modelo", m.id, { activo:false, editado_por: E.yo });
        await Almacen.anota({ tipo:"catalogo", modelo_id: m.id, nombre: m.nombre, persona: E.yo, motivo: "pieza extra quitada", origen: origen() });
        cierraHoja(); pintaTodo();
      };
    });
}
function hojaModelo(m, nombreSugerido){
  if (!exigeYo()) return;
  const nuevo = !m; m = m || { nombre: nombreSugerido || "", familia: "", tipo: "madera", cajones: null, puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, total_puertas: null, parches: null, lleva_parches: null, lleva_respaldo: null, guacal: null, es_guacal: false };
  // Modelos que se arman con este guacal (se escogen aquí, en la ficha del guacal)
  const candidatos = () => modelosActivos().filter(x => !R.esExtra(x) && !R.esGuacal(x) && x.id !== m.id);
  let compat = m.id ? candidatos().filter(x => x.guacal === m.id).map(x => x.id) : [];
  const num = (id, txt, v) => '<label class="campo"><span>' + txt + '</span><input id="' + id + '" type="number" inputmode="numeric" min="0" value="' + (v == null ? "" : v) + '" placeholder="falta dato"></label>';
  const siNo = (id, txt, v) => '<div class="campo"><span>' + txt + '</span><div class="opcion-si-no" id="' + id + '"><button class="cat' + (v === true ? " on" : "") + '" data-v="1">Sí</button><button class="cat' + (v === false ? " on" : "") + '" data-v="0">No</button><button class="cat' + (v == null ? " on" : "") + '" data-v="">No sé</button></div></div>';
  abreHoja('<h3>' + (nuevo ? "Modelo nuevo" : "Ficha del modelo") + '</h3>' + (m.pendiente ? '<div class="candado" style="margin-bottom:10px"><span><b>Por revisar.</b> ' + esc(m.nota || "Entró con la carga del 2 de octubre; confirma el nombre y la ficha.") + ' Al guardar se quita la marca.</span></div>' : "") + '<p class="guia">Con esta ficha el sistema traduce puertas y cajones a muebles. Si no sabes un dato, déjalo vacío: el sistema dirá «falta dato» en vez de inventar.</p>' +
    '<label class="campo"><span>Nombre</span><input id="mNombre" value="' + esc(m.nombre) + '" placeholder="Monarca Midas"></label>' +
    '<div class="dupla"><label class="campo"><span>Familia</span><input id="mFamilia" value="' + esc(m.familia || "") + '" placeholder="Monarca"></label>' +
    '<div class="campo"><span>Material</span><div class="opcion-si-no" id="mTipo"><button class="cat' + (m.tipo !== "mdf" ? " on" : "") + '" data-v="madera">Madera</button><button class="cat' + (m.tipo === "mdf" ? " on" : "") + '" data-v="mdf">MDF</button></div></div></div>' +
    '<label class="interruptor" style="margin:0 0 10px"><input type="checkbox" id="mEsGuacal"' + (m.es_guacal ? " checked" : "") + '> <span>Este modelo es un guacal: sirve para varios modelos (las puertas hacen el modelo)</span></label>' +
    '<div id="mCompat"' + (m.es_guacal ? "" : " hidden") + ' style="margin:0 0 12px"><div class="grupo-h">Modelos que se arman con este guacal</div><p class="guia">Marca del catálogo los modelos a los que se les cuelgan sus puertas sobre este guacal. Puedes agregar o quitar cuando quieras.</p>' +
      campoBuscaLista("Buscar modelo…") + '<div class="cats" id="mCompatSel"></div><div class="sugerencias" id="mCompatLista"></div></div>' +
    (guacalVivo(m) ? '<p class="guia" style="margin:-4px 0 10px">Este modelo se arma sobre el guacal <b>' + esc(guacalVivo(m).nombre) + '</b>. Eso se cambia desde la ficha de ese guacal.</p>' : "") +
    num("mCajones", "Cajones", m.cajones) +
    '<div class="grupo-h">Puertas</div><div class="dupla">' + num("mPG", "Grandes", m.puertas_grandes) + num("mPGL", "Grandes con luna", m.puertas_grandes_luna) + '</div>' +
    '<div class="dupla">' + num("mPC", "Chicas", m.puertas_chicas) + num("mPCL", "Chicas con luna", m.puertas_chicas_luna) + '</div>' +
    num("mTotal", "Total de puertas (lo que cuenta para las equivalencias)", m.total_puertas) +
    '<div class="dupla">' + num("mParches", "Parches por mueble (0 si no lleva)", R.parchesDe(m)) + siNo("mRespaldo", "¿Lleva respaldo?", m.lleva_respaldo) + '</div>' +
    '<button class="btn vino grande" id="mOk" style="margin-top:8px">' + (nuevo ? "Agregar al catálogo" : "Guardar cambios") + '</button>' +
    (nuevo ? "" : '<button class="btn fantasma grande" id="mQuita" style="margin-top:8px">Quitar del catálogo</button>'),
    h => {
      const g = id => h.querySelector(id);
      let tipo = m.tipo === "mdf" ? "mdf" : "madera", respaldo = m.lleva_respaldo;
      const marca = (cont, v) => cont.querySelectorAll("[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === (v == null ? "" : String(v === true ? 1 : v === false ? 0 : v))));
      g("#mTipo").querySelectorAll("[data-v]").forEach(b => b.onclick = () => { tipo = b.dataset.v; marca(g("#mTipo"), tipo); });
      g("#mRespaldo").querySelectorAll("[data-v]").forEach(b => b.onclick = () => { respaldo = b.dataset.v === "" ? null : b.dataset.v === "1"; marca(g("#mRespaldo"), respaldo); });
      const pintaCompat = () => {
        const q = g("#rBusca").value.trim(); const todos = candidatos();
        g("#mCompatSel").innerHTML = compat.map(id => modeloDe(id)).filter(Boolean).map(x => '<button class="cat on" data-c="' + esc(x.id) + '">' + esc(x.nombre) + ' ✕</button>').join("") || '<span class="guia">Todavía ninguno.</span>';
        const l = (q ? Busca.busca(q, todos, x => x.nombre) : todos.filter(x => x.familia === (g("#mFamilia").value.trim() || m.familia))).filter(x => !compat.includes(x.id)).slice(0, 12);
        g("#mCompatLista").innerHTML = l.map(x => '<button data-c="' + esc(x.id) + '">' + esc(x.nombre) + '<small>' + esc(fichaCorta(x)) + (guacalVivo(x) && x.guacal !== m.id ? ' · ya usa el guacal ' + esc(guacalVivo(x).nombre) + ' (se cambia)' : "") + '</small></button>').join("") || (q ? '<div class="sin-hallar">No encontré ese modelo.</div>' : '<div class="sin-hallar">Escribe arriba para buscar en todo el catálogo.</div>');
        h.querySelectorAll("#mCompat [data-c]").forEach(b => b.onclick = () => { const id = b.dataset.c; compat = compat.includes(id) ? compat.filter(x => x !== id) : compat.concat(id); pintaCompat(); });
      };
      g("#rBusca").oninput = pintaCompat; pintaCompat();
      g("#mEsGuacal").onchange = e => { g("#mCompat").hidden = !e.target.checked; };
      const suma = () => { const vs = ["#mPG", "#mPGL", "#mPC", "#mPCL"].map(id => g(id).value); if (vs.every(v => v !== "")) g("#mTotal").value = vs.reduce((s,v) => s + Number(v), 0); };
      ["#mPG", "#mPGL", "#mPC", "#mPCL"].forEach(id => g(id).oninput = suma);
      const leeNum = id => g(id).value === "" ? null : Math.max(0, Math.floor(Number(g(id).value)));
      g("#mOk").onclick = async () => {
        const nombre = g("#mNombre").value.trim(); if (!nombre) return grita("Falta el nombre");
        const repetido = E.modelos.find(x => x.id !== m.id && x.activo !== false && sinAcento(x.nombre) === sinAcento(nombre)); if (repetido) return grita("Ya existe un modelo con ese nombre");
        const esG = g("#mEsGuacal").checked;
        if (!esG && m.es_guacal && compat.length && !confirm("Al dejar de ser guacal, " + plural(compat.length, "modelo", "modelos") + " se desligan. ¿Seguro?")) return;
        const datos = { nombre, familia: g("#mFamilia").value.trim() || nombre.split(" ")[0], tipo, pendiente: false, nota: "", guacal: esG ? null : (m.guacal || null), es_guacal: esG, cajones: leeNum("#mCajones"), puertas_grandes: leeNum("#mPG"), puertas_grandes_luna: leeNum("#mPGL"), puertas_chicas: leeNum("#mPC"), puertas_chicas_luna: leeNum("#mPCL"), total_puertas: leeNum("#mTotal"), parches: leeNum("#mParches"), lleva_parches: leeNum("#mParches") == null ? null : leeNum("#mParches") > 0, lleva_respaldo: respaldo, editado_por: E.yo };
        const vale = k => k === "es_guacal" ? !!m[k] : (m[k] == null ? null : m[k]);
        const cambios = nuevo ? "modelo nuevo" : Object.keys(datos).filter(k => !["editado_por", "pendiente", "nota"].includes(k) && JSON.stringify(datos[k]) !== JSON.stringify(vale(k))).map(k => k.replace(/_/g, " ") + ": " + (vale(k) == null ? "vacío" : vale(k)) + " → " + (datos[k] == null ? "vacío" : datos[k])).join(" · ");
        const ligaCambia = E.modelos.some(x => x.id !== m.id && ((esG && compat.includes(x.id)) !== (x.guacal === m.id)));
        if (!nuevo && !cambios && !m.pendiente && !ligaCambia){ cierraHoja(); return; }
        let id = m.id;
        if (nuevo){ const f = await Almacen.pon("modelo", Object.assign({ id: "N" + Date.now().toString(36), activo: true }, datos)); id = f.id; }
        else { await Almacen.parcha("modelo", id, datos); if (datos.nombre !== m.nombre) renombraEnTodo(id, datos.nombre); }
        // liga guacal → modelos: lo marcado queda con guacal = este; lo desmarcado se desliga
        const quiere = esG ? compat : []; const mas = [], menos = [];
        E.modelos.filter(x => x.id !== id).forEach(x => {
          if (quiere.includes(x.id) && x.guacal !== id){ Almacen.parcha("modelo", x.id, { guacal: id }); mas.push(x.nombre); }
          else if (!quiere.includes(x.id) && x.guacal === id){ Almacen.parcha("modelo", x.id, { guacal: null }); menos.push(x.nombre); }
        });
        const motivo = [cambios, mas.length ? "se arman con este guacal: +" + mas.join(", +") : "", menos.length ? "ya no: −" + menos.join(", −") : ""].filter(Boolean).join(" · ");
        if (motivo) await Almacen.anota({ tipo:"catalogo", modelo_id: id, nombre, persona: E.yo, motivo, origen: origen() });
        cierraHoja(); grita(nuevo ? "Modelo agregado" : "Ficha guardada"); pintaTodo();
      };
      const qb = g("#mQuita"); if (qb) qb.onclick = async () => {
        const ligados = E.modelos.filter(x => x.guacal === m.id);
        if (!confirm("¿Quitar «" + m.nombre + "» del catálogo? Las existencias que ya tenga se conservan." + (ligados.length ? " Los " + ligados.length + " modelos que se arman sobre este guacal quedan sin guacal." : ""))) return;
        await Almacen.parcha("modelo", m.id, { activo:false, editado_por: E.yo });
        ligados.forEach(x => Almacen.parcha("modelo", x.id, { guacal: null }));
        await Almacen.anota({ tipo:"catalogo", modelo_id: m.id, nombre: m.nombre, persona: E.yo, motivo: "quitado del catálogo" + (ligados.length ? " · se desligaron: " + ligados.map(x => x.nombre).join(", ") : ""), origen: origen() });
        cierraHoja(); pintaTodo();
      };
      g("#mNombre").focus();
    });
}
/* Si se renombra un modelo, los lotes y piezas que ya existen cambian de nombre también */
function renombraEnTodo(id, nombre){
  E.lotes.filter(l => l.modelo_id === id).forEach(l => Almacen.parcha("lote", l.id, { modelo: nombre }));
  E.piezas.filter(p => p.modelo_id === id).forEach(p => Almacen.parcha("pieza", p.id, { modelo: nombre }));
}
$("#nuevoModelo").onclick = () => hojaModelo(null);


/* ═══════════════ recados ═══════════════ */
/* Recado automático de trabajo: UN ticket por persona, tipo y semana; se le suman renglones. */
function anotaTrabajo(tipo, persona, modelo, color, n){
  if (!persona || !n) return;
  const semana = Almacen.inicioSemana().toISOString();
  const linea = { modelo: modelo.nombre, familia: modelo.familia || modelo.nombre.split(" ")[0], color: color || "", cantidad: n };
  const ex = E.recados.find(r => r.tipo === tipo && r.persona === persona && r.semana === semana && Array.isArray(r.lineas));
  const verbo = tipo === "armado" ? "armó" : (modelo.tipo === "mdf" ? "hizo" : "maquiló");
  if (ex){
    const ls = ex.lineas.slice(); const i = ls.findIndex(l => l.modelo === linea.modelo && (l.color || "") === linea.color);
    if (i >= 0) ls[i] = Object.assign({}, ls[i], { cantidad: Number(ls[i].cantidad || 0) + n }); else ls.push(linea);
    const total = ls.reduce((s,l) => s + Number(l.cantidad || 0), 0);
    Almacen.parcha("recado", ex.id, { lineas: ls, texto: persona + " " + verbo + " esta semana " + plural(total, "mueble", "muebles"), hecho: false, hecho_en: null, actualizado: new Date().toISOString() });
  } else {
    Almacen.pon("recado", { texto: persona + " " + verbo + " esta semana " + plural(n, "mueble", "muebles"), de: E.yo, para: "", hecho: false, urgente: false, tipo, persona, semana, lineas: [linea], vistos: {} });
  }
}
function ticketRecado(r){
  const fams = FAMILIAS.slice(); const orden = f => { const i = fams.indexOf(f); return i >= 0 ? i : 99; };
  const ls = (r.lineas || []).slice().sort((a,b) => orden(a.familia) - orden(b.familia) || (sinAcento(a.familia) < sinAcento(b.familia) ? -1 : sinAcento(a.familia) > sinAcento(b.familia) ? 1 : 0) || (sinAcento(a.modelo) < sinAcento(b.modelo) ? -1 : 1));
  let fam = ""; let html = '<div class="ticket-rec">';
  ls.forEach(l => { if (l.familia !== fam){ fam = l.familia; html += '<div class="fam-h">' + esc(fam) + '</div>'; } html += '<div class="rl"><b>' + Number(l.cantidad || 0) + '</b><span>' + esc(l.modelo) + (l.color ? ' <small>' + esc(l.color) + '</small>' : "") + '</span></div>'; });
  return html + '</div>';
}
function textoSemana(sab){
  const vie = new Date(sab); vie.setDate(vie.getDate() + 6);
  const f = d => d.toLocaleDateString("es-MX", { day: "numeric", month: "long" });
  const hoySab = Almacen.inicioSemana().getTime() === sab.getTime();
  return "Semana del sábado " + f(sab) + " al viernes " + f(vie) + (hoySab ? " · esta semana" : "");
}
function pintaRecados(){
  const caja = $("#listaRecados");
  const l = E.recados.slice().sort((a,b) => a.creado < b.creado ? 1 : -1);
  const pend = l.filter(r => !r.hecho).length;
  $("#resumenRecados").textContent = l.length ? (pend ? pend + " sin atender" : "todo atendido") : "";
  const nuevos = l.filter(r => !r.hecho && !(r.vistos || {})[E.yo]).length;
  $("#globoRec").hidden = !nuevos; $("#globoRec").textContent = nuevos;
  $("#nRec").hidden = !pend; $("#nRec").textContent = pend;
  if (!l.length){ caja.innerHTML = '<div class="vacio"><b>No hay recados</b><p>Escribe uno arriba y todos lo ven. Lo que ya quedó hecho se borra solo el domingo a las 12 de la noche.</p></div>'; return; }
  const semanas = {};
  l.forEach(r => { const sab = Almacen.inicioSemana(r.creado); const k = sab.toISOString(); (semanas[k] = semanas[k] || { sab, rs: [] }).rs.push(r); });
  caja.innerHTML = Object.keys(semanas).sort().reverse().map(k => '<div class="dia semana">' + esc(textoSemana(semanas[k].sab)) + '</div>' + semanas[k].rs.map(r => {
    const vistos = Object.keys(r.vistos || {}).filter(v => v !== r.de);
    const auto = r.tipo === "maquilado" || r.tipo === "armado";
    return '<article class="tarjeta' + (r.hecho ? " lista" : r.urgente ? " urge" : "") + '"><div class="enc"><span class="av">' + esc(iniciales(auto && r.persona ? r.persona : r.de)) + '</span><b>' + esc(auto && r.persona ? r.persona : (r.de || "Alguien")) + '</b>' + (auto ? '<span class="sello amb">' + r.tipo + '</span>' : "") + '<span class="hora">' + esc(cuando(r.actualizado || r.creado)) + '</span></div>' +
      '<div class="cuerpo">' + esc(r.texto) + '</div>' + (Array.isArray(r.lineas) ? ticketRecado(r) : "") + '<div class="pie"><span class="visto">' + (r.hecho ? "Hecho " + esc(cuando(r.hecho_en || r.creado)) + " · se borra el domingo en la noche" : vistos.length ? "Visto: " + esc(vistos.join(", ")) : "Nadie lo ha visto") + '</span>' +
      (r.hecho ? '<button class="btn fantasma" data-reabre="' + r.id + '">Reabrir</button>' : '<button class="btn" data-hecho="' + r.id + '">✓ Ya quedó</button>') +
      '<button class="btn fantasma" data-borra="' + r.id + '">Borrar</button></div></article>';
  }).join("")).join("");
  caja.querySelectorAll("[data-hecho]").forEach(b => b.onclick = () => { if (exigeYo()) Almacen.parcha("recado", b.dataset.hecho, {hecho:true, hecho_en: new Date().toISOString(), hecho_por: E.yo}); });
  caja.querySelectorAll("[data-reabre]").forEach(b => b.onclick = () => Almacen.parcha("recado", b.dataset.reabre, {hecho:false, hecho_en: null}));
  caja.querySelectorAll("[data-borra]").forEach(b => b.onclick = () => { if (confirm("¿Borrar este recado para todos?")) Almacen.borra("recado", b.dataset.borra); });
  marcaVistos();
}
const yaMarcados = new Set(); let relojVistos;
function marcaVistos(){
  if (!E.yo || E.vista !== "recados") return;
  clearTimeout(relojVistos);
  relojVistos = setTimeout(() => {
    E.recados.filter(r => !r.hecho && !(r.vistos || {})[E.yo] && !yaMarcados.has(r.id)).slice(0,20).forEach(r => {
      yaMarcados.add(r.id);
      Almacen.parcha("recado", r.id, {vistos: Object.assign({}, r.vistos || {}, {[E.yo]: new Date().toISOString()})});
    });
  }, 900);
}
async function ponRecado(texto){
  texto = (texto || "").trim(); if (!texto || !exigeYo()) return;
  await Almacen.pon("recado", {texto, de:E.yo, para:"", hecho:false, urgente:/urgente|urge|hoy mismo/i.test(texto), vistos:{}});
  grita("Recado puesto");
}

/* ═══════════════ bitácora ═══════════════ */
function descMov(m){
  const et = k => (R.ETAPAS[k] || R.PIEZAS[k] || {}).nombre || k;
  let titulo_ = esc(m.nombre || m.tipo) + (m.color ? " · " + esc(m.color) : "");
  let sub = "";
  if (m.tipo === "deshecho") sub = esc(m.motivo || "se deshizo un movimiento");
  else if (m.tipo === "preparado") sub = "se preparó · salió de " + esc(et(m.etapa_de)) + (m.hecho_por ? " · preparó " + esc(m.hecho_por) : "") + (m.desglose && m.desglose.length ? " · descontó: " + m.desglose.map(d => d.cantidad + " " + esc(d.de)).join(", ") : "") + (m.motivo ? " · " + esc(m.motivo) : "");
  else if (m.tipo === "plan") sub = esc(et(m.etapa_de)) + " → plan del día (" + esc(et(m.etapa_a)) + ")" + (m.motivo ? " · " + esc(m.motivo) : "");
  else if (m.tipo === "traslado") sub = esc(et(m.etapa_de)) + " → " + esc(et(m.etapa_a)) + (m.hecho_por ? " · " + esc(m.etapa_a === "puertas_lijadas_bisagras" ? "bisagras: " : m.etapa_a === "armado" ? "armó " : "pintó ") + esc(m.hecho_por) : "") + (m.desglose && m.desglose.length ? " · de: " + m.desglose.map(d => esc(d.de) + " " + d.cantidad).join(", ") : "");
  else if (m.tipo === "alta" && m.etapa_a) sub = "entró a " + esc(et(m.etapa_a)) + (m.hecho_por ? " · " + esc(m.etapa_a === "mdf" ? "hizo " : "maquiló ") + esc(m.hecho_por) : "") + (m.motivo ? " · " + esc(m.motivo) : "");
  else if (m.tipo === "alta" && m.categoria) sub = "entró a " + esc(et(m.categoria)) + (m.hecho_por ? " · pintó " + esc(m.hecho_por) : "") + (m.motivo ? " · " + esc(m.motivo) : "");
  else if (m.tipo === "ajuste" && (m.etapa_a || m.categoria)) sub = "corrección en " + esc(et(m.etapa_a || m.categoria)) + (m.motivo ? " · " + esc(m.motivo) : "");
  else if (m.categoria) sub = esc(et(m.categoria)) + (m.hecho_por ? " · pintó " + esc(m.hecho_por) : "") + (m.motivo ? " · " + esc(m.motivo) : "");
  else if (m.tipo === "catalogo") sub = "catálogo · " + esc(m.motivo || "");
  else if (m.producto_id && m.tipo === "traslado") sub = "almacén → cabina de pintura";
  else if (m.producto_id && m.donde === "cabina") sub = "en cabina" + (m.motivo ? " · " + esc(m.motivo) : "");
  else sub = esc(m.motivo || m.tipo || "");
  if (m.resultado != null && m.tipo !== "catalogo") sub += " · quedan " + m.resultado;
  return { titulo: titulo_, sub };
}
const puedeDeshacer = m => !m.deshecho && !m.producto_id && ["ajuste", "alta", "entrada", "salida", "traslado", "preparado"].includes(m.tipo) && (m.pieza_id || m.lote_id || m.desglose);
const botonDeshacer = m => puedeDeshacer(m) ? '<button class="btn fantasma chico" data-deshaz="' + esc(m.id) + '" title="Dejar las cosas como estaban antes de este movimiento">Deshacer</button>' : (m.deshecho ? '<span class="sello amb">deshecho' + (m.deshecho_por ? " por " + esc(m.deshecho_por) : "") + '</span>' : "");
function lineaMov(m){
  const d = descMov(m);
  return '<div class="linea' + (m.deshecho ? " deshecha" : "") + '"><span class="reloj">' + esc(cuando(m.creado)) + '</span><span class="delta ' + (m.delta > 0 ? "mas" : m.delta < 0 ? "menos" : "") + '">' + (m.tipo === "traslado" ? "→" + m.delta : m.delta > 0 ? "+" + m.delta : (m.delta || "·")) + '</span><span class="det"><b>' + d.titulo + '</b><small>' + d.sub + ' · ' + esc(m.persona || "?") + '</small></span>' + botonDeshacer(m) + '</div>';
}
function enlazaDeshacer(caja){
  caja.querySelectorAll("[data-deshaz]").forEach(b => b.onclick = async e => {
    e.stopPropagation(); if (!exigeYo()) return;
    const m = E.movimientos.find(x => x.id === b.dataset.deshaz); if (!m) return;
    const d = descMov(m); const txt = d.titulo.replace(/<[^>]+>/g, "") + " · " + d.sub.replace(/<[^>]+>/g, "");
    if (!confirm("¿Deshacer este movimiento y dejar todo como estaba antes?\n\n" + txt)) return;
    try { await Almacen.deshaz(m.id, E.yo, origen()); grita("Deshecho: todo quedó como estaba"); pintaTodo(); } catch(err){ grita(err.message); }
  });
}
function pintaBitacora(){
  const caja = $("#listaBitacora");
  let ms = E.movimientos.slice();
  if (q("bitacora")) ms = Busca.busca(q("bitacora"), ms, m => [m.nombre, m.color, m.persona, m.hecho_por, m.motivo, (R.ETAPAS[m.etapa_a] || R.PIEZAS[m.etapa_a || m.categoria] || {}).nombre].filter(Boolean).join(" "));
  const dias = {};
  ms.forEach(m => { const d = (m.creado || "").slice(0,10); (dias[d] = dias[d] || []).push(m); });
  const ord = Object.keys(dias).sort().reverse().slice(0,30);
  if (!ord.length){ caja.innerHTML = q("bitacora") ? sinHallar("bitacora", "eso en la bitácora") : '<div class="vacio"><b>Todavía no hay movimientos</b><p>Cada registro, paso de etapa o corrección queda aquí con fecha, hora, quién lo capturó y quién hizo el trabajo.</p></div>'; return; }
  caja.innerHTML = ord.map(d => '<div class="dia">' + esc(fechaLarga(d)) + '</div>' + dias[d].sort((a,b) => a.creado < b.creado ? 1 : -1).map(m => {
    const x = descMov(m);
    return '<div class="linea' + (m.deshecho ? " deshecha" : "") + '"><span class="reloj">' + esc(reloj(m.creado)) + '</span><span class="delta ' + (m.delta > 0 ? "mas" : m.delta < 0 ? "menos" : "") + '">' + (m.tipo === "traslado" ? "→" + m.delta : m.delta > 0 ? "+" + m.delta : (m.delta || "·")) + '</span><span class="det"><b>' + x.titulo + '</b><small>' + x.sub + ' · capturó ' + esc(m.persona || "?") + (m.origen ? " · " + esc(m.origen) : "") + '</small></span>' + botonDeshacer(m) + '</div>';
  }).join("")).join("");
  enlazaDeshacer(caja);
}

/* ═══════════════ catálogo de material: litros · nombre · apodo ═══════════════ */
function pintaCatMaterial(){
  const caja = $("#listaApodos");
  let l = materiales();
  $("#resumenApodos").textContent = l.length ? plural(l.length, "producto", "productos") : "";
  if (q("apodos")) l = Busca.busca(q("apodos"), l, p => [p.nombre, ...(p.apodos || []), p.marca].filter(Boolean).join(" "));
  l.sort((a,b) => sinAcento(titulo(a)) > sinAcento(titulo(b)) ? 1 : -1);
  if (!l.length){ caja.innerHTML = q("apodos") ? sinHallar("apodos", "ese producto") : '<div class="vacio"><b>Todavía no hay material</b><p>Agrega el primero con el botón de arriba.</p></div>'; return; }
  caja.innerHTML = '<div class="bloque-h suave">Litros · nombre · apodo<span class="n">toca uno para editarlo</span></div>' + l.map(p => {
    const ap = p.apodos || [];
    return '<div class="fila-mat" data-id="' + p.id + '">' +
      '<div class="litros' + (p.litros == null ? " falta" : "") + '">' + (p.litros != null ? p.litros : "?") + '<small>' + (p.litros != null ? "L" : "litros") + '</small></div>' +
      '<div class="nombre">' + esc(p.nombre) + '<small>' + esc([p.presentacion, p.marca, p.codigo].filter(Boolean).join(" · ") || "sin presentación") + '</small></div>' +
      '<div class="apodo">' + (ap.length ? ap.map((a, i) => '<span class="chip' + (i === 0 ? " principal" : "") + '">' + esc(a) + '</span>').join("") : '<span class="chip falta" style="background:var(--rojo-t);border-color:var(--rojo);color:var(--rojo)">sin apodo</span>') + '</div></div>';
  }).join("");
  caja.querySelectorAll(".fila-mat").forEach(f => f.onclick = () => hojaProducto(E.productos.find(x => x.id === f.dataset.id)));
}

/* ═══════════════ ajustes ═══════════════ */
function pintaAjustes(){
  const C = window.CONFIG || {};
  $("#ajustes").innerHTML =
    tarjetaGuacales() + tarjetaColores() + tarjetaArregloPuertas() + tarjetaRevisarNombres() + tarjetaArreglo() + tarjetaPedidosLibreta() + tarjetaCarga() + tarjetaPintura() +
    '<div class="ajuste"><h4>Quién soy</h4><p>' + (E.yo ? "Estás como <b>" + esc(E.yo) + "</b>." : "Todavía no has dicho quién eres.") + '</p><div class="acciones"><button class="btn" id="ajYo">Cambiar de persona</button>' + (Almacen.sesion ? '<button class="btn fantasma" id="ajSalir">Cerrar sesión</button>' : "") + '</div></div>' +
    '<div class="ajuste"><h4>Modo práctica</h4><p>Para jugar sin miedo: datos de juguete, solo en este aparato. El inventario real ni se entera.</p><label class="interruptor"><input type="checkbox" id="ajPractica"' + (Almacen.practica ? " checked" : "") + '> <span>' + (Almacen.practica ? "Practicando" : "Apagado") + '</span></label></div>' +
    '<div class="ajuste"><h4>Hoja de conteo para imprimir</h4><p>Para caminar el almacén con papel y comparar contra el sistema.</p><div class="acciones"><button class="btn" data-imprime="mueble">Muebles</button><button class="btn" data-imprime="pieza">Piezas</button><button class="btn" data-imprime="material">Material</button></div></div>' +
    '<div class="ajuste"><h4>Revisar este aparato</h4><p>Prueba una por una las cosas que la app necesita y te dice cómo arreglar lo que falle.</p><div class="acciones"><button class="btn" id="ajDiag">Revisar ahora</button></div><div class="diag" id="diag" style="margin-top:10px"></div></div>' +
    '<div class="ajuste"><h4>Instalar en el celular</h4><p>' + (esApple ? "En iPhone: botón <b>Compartir</b> (el cuadrito con la flecha) → <b>Agregar a pantalla de inicio</b>." : "En Android: menú <b>⋮</b> → <b>Agregar a pantalla principal</b> o <b>Instalar app</b>.") + ' Queda con su icono y abre en un segundo.</p></div>' +
    '<div class="ajuste"><h4>Versión</h4><p><b>' + esc(C.VERSION || "?") + '</b> · ' + (Almacen.hayNube ? "base compartida conectada" : "sin base compartida") + '</p><div class="acciones"><button class="btn" id="ajActualiza">Buscar actualización</button><button class="btn fantasma" id="ajTema">Claro / oscuro</button></div></div>';
  const cg = $("#ajCarga"); if (cg) cg.onclick = hojaCarga;
  const cp = $("#ajPintura"); if (cp) cp.onclick = cargaPintura;
  const cpl = $("#ajPedidos"); if (cpl) cpl.onclick = cargaPedidosLibreta;
  const rn = $("#ajNombres"); if (rn) rn.onclick = hojaRevisarNombres;
  const ar = $("#ajArreglo"); if (ar) ar.onclick = aplicaArreglo;
  const ap = $("#ajPuertas"); if (ap) ap.onclick = hojaArregloPuertas;
  const gq = $("#ajGuacales"); if (gq) gq.onclick = hojaGuacales;
  const cl = $("#ajColores"); if (cl) cl.onclick = hojaColores;
  $("#ajYo").onclick = hojaQuienSoy;
  const s = $("#ajSalir"); if (s) s.onclick = async () => { await Almacen.sale(); pintaPulso(); pintaTodo(); };
  $("#ajPractica").onchange = async e => { await Almacen.setPractica(e.target.checked); pintaPulso(); pintaTodo(); grita(e.target.checked ? "Modo práctica encendido" : "De vuelta a lo real"); };
  $("#ajDiag").onclick = diagnostico;
  $("#ajActualiza").onclick = buscaActualizacion;
  $("#ajTema").onclick = () => { const osc = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.dataset.theme = osc ? "light" : "dark"; localStorage.setItem("alm.tema", document.documentElement.dataset.theme); };
  $("#ajustes").querySelectorAll("[data-imprime]").forEach(b => b.onclick = () => imprime(b.dataset.imprime));
}
/* Carga del stock de la libreta (datos/carga-inicial.js). Borra muebles y piezas y pone la lista. */
function tarjetaCarga(){
  const C = window.CARGA_INICIAL; if (!C) return "";
  const hecha = Almacen.cargaHecha(C.id);
  const puede = Almacen.practica || (Almacen.modo === "nube" && Almacen.sesion);
  return '<div class="' + (hecha ? "ajuste" : "aviso") + '"><' + (hecha ? "h4" : "b") + '>' + esc(C.titulo) + (hecha ? " · ya se cargó" : "") + '</' + (hecha ? "h4" : "b") + '><p>' +
    (hecha ? "Entró " + esc(cuando(Almacen.dame("meta", C.id).hecho)) + " por " + esc(Almacen.dame("meta", C.id).por || "?") + ". Los modelos nuevos quedaron en amarillo en Catálogo para que los revises. Si se movió algo por error, con el botón se <b>borra</b> lo que hay en Muebles y Piezas y vuelve a quedar la lista de ese día."
           : "La lista de las dos hojas (" + (C.muebles || []).length + " renglones de muebles y " + (C.juegos || []).length + " de puertas). <b>Borra todo lo que haya en Muebles y Piezas</b> y pone esto en su lugar. El material no se toca.") + '</p>' +
    '<div class="pie"><button class="btn ' + (hecha ? "fantasma" : "vino") + '" id="ajCarga"' + (puede ? "" : " disabled") + '>' + (hecha ? "Volver a dejarlo como el 2 de octubre" : "Cargar ahora") + '</button>' + (puede ? "" : '<span class="guia" style="margin:0">Entra con tu cuenta primero.</span>') + '</div></div>';
}
function hojaCarga(){
  if (!exigeYo()) return;
  const C = window.CARGA_INICIAL; if (!C) return;
  const otraVez = Almacen.cargaHecha(C.id);
  const prev = Almacen.preparaCarga(C);
  const lotesHoy = E.lotes.filter(l => Number(l.cantidad) > 0).length, piezasHoy = E.piezas.filter(p => Number(p.cantidad) > 0).length;
  const porCat = {}; prev.piezas.forEach(p => { porCat[p.categoria] = (porCat[p.categoria] || 0) + p.cantidad; });
  const porEt = {}; prev.muebles.forEach(m => { porEt[m.etapa] = (porEt[m.etapa] || 0) + m.cantidad; });
  abreHoja('<h3>' + esc(C.titulo) + '</h3>' +
    '<div class="candado" style="margin-bottom:10px"><span>Se van a <b>borrar</b> ' + lotesHoy + ' renglones de muebles y ' + piezasHoy + ' de piezas que hay ahora, y entra lo de la libreta.</span></div>' +
    '<h3 class="mini">Lo que entra</h3>' +
    '<div class="lotes">' + Object.keys(porEt).map(e => '<div class="lote"><div class="quien">' + esc(R.ETAPAS[e].nombre) + '</div><div class="disp"><b>' + porEt[e] + '</b> muebles</div></div>').join("") +
      Object.keys(porCat).map(c => '<div class="lote"><div class="quien">' + esc(R.PIEZAS[c].nombre) + '</div><div class="disp"><b>' + porCat[c] + '</b> puertas</div></div>').join("") + '</div>' +
    '<p class="guia">' + prev.modelos.length + ' modelos nuevos se agregan al catálogo <b>en amarillo (por revisar)</b>.' + (prev.fuera.length ? ' <b style="color:var(--rojo)">No se pudieron cargar:</b> ' + esc(prev.fuera.join("; ")) : "") + '</p>' +
    '<button class="btn vino grande" id="cgOk">' + (otraVez ? "Sí, borrar lo que hay y dejarlo como el 2 de octubre" : "Sí, borrar lo que hay y cargar") + '</button><button class="btn fantasma grande" id="cgNo" style="margin-top:8px">Cancelar</button>',
    h => {
      h.querySelector("#cgNo").onclick = cierraHoja;
      h.querySelector("#cgOk").onclick = async () => {
        if (!confirm("Última confirmación: ¿borrar el inventario actual de muebles y piezas y cargar la libreta?")) return;
        h.querySelector("#cgOk").disabled = true; h.querySelector("#cgOk").textContent = "Cargando…";
        const r = await Almacen.cargaInicial(otraVez ? Object.assign({}, C, { motivo: "se volvió a dejar el stock del 2 de octubre" }) : C, E.yo, origen());
        cierraHoja(); pintaTodo(); grita("Listo: " + plural(r.renglones, "renglón cargado", "renglones cargados"));
      };
    });
}
function tarjetaPintura(){
  const C = window.CARGA_PINTURA; if (!C) return "";
  const hecha = Almacen.cargaHecha(C.id);
  const puede = Almacen.practica || (Almacen.modo === "nube" && Almacen.sesion);
  return '<div class="' + (hecha ? "ajuste" : "aviso") + '"><' + (hecha ? "h4" : "b") + '>' + esc(C.titulo) + (hecha ? " · ya se cargó" : "") + '</' + (hecha ? "h4" : "b") + '><p>' +
    (hecha ? "Entró " + esc(cuando(Almacen.dame("meta", C.id).hecho)) + " por " + esc(Almacen.dame("meta", C.id).por || "?") + "."
           : "La hoja de tambos y cubetas (" + (C.material || []).length + " productos). <b>Se suma</b> a lo que ya hay en Material; no borra nada.") + '</p>' +
    (hecha ? "" : '<div class="pie"><button class="btn vino" id="ajPintura"' + (puede ? "" : " disabled") + '>Cargar ahora</button></div>') + '</div>';
}
async function cargaPintura(){
  if (!exigeYo()) return;
  const C = window.CARGA_PINTURA; if (!C || Almacen.cargaHecha(C.id)) return;
  if (!confirm("¿Cargar la hoja de pintura? Se suma a lo que ya hay en Material.")) return;
  const r = await Almacen.cargaMaterial(C, E.yo, origen());
  pintaTodo(); grita("Listo: " + plural(r.renglones, "renglón cargado", "renglones cargados"));
}
function tarjetaPedidosLibreta(){
  const C = window.CARGA_PEDIDOS; if (!C) return "";
  const hecha = Almacen.cargaHecha(C.id);
  const puede = Almacen.practica || (Almacen.modo === "nube" && Almacen.sesion);
  const n = (C.pedidos || []).length, r = (C.pedidos || []).reduce((a, p) => a + (p.lineas || []).length, 0);
  return '<div class="' + (hecha ? "ajuste" : "aviso") + '"><' + (hecha ? "h4" : "b") + '>' + esc(C.titulo) + (hecha ? " · ya se cargó" : "") + '</' + (hecha ? "h4" : "b") + '><p>' +
    (hecha ? "Entró " + esc(cuando(Almacen.dame("meta", C.id).hecho)) + " por " + esc(Almacen.dame("meta", C.id).por || "?") + ". Los renglones con (?) son nombres que no se entendieron de la libreta: corrígelos con Editar."
           : plural(n, "pedido", "pedidos") + " con " + plural(r, "renglón", "renglones") + " de las fotos de la libreta, con su fecha y lo que ya se entregó. <b>Se suman</b> a los pedidos que haya; no borra nada.") + '</p>' +
    (hecha ? "" : '<div class="pie"><button class="btn vino" id="ajPedidos"' + (puede ? "" : " disabled") + '>Cargar ahora</button></div>') + '</div>';
}
async function cargaPedidosLibreta(){
  if (!exigeYo()) return;
  const C = window.CARGA_PEDIDOS; if (!C || Almacen.cargaHecha(C.id)) return;
  if (!confirm("¿Cargar los pedidos de la libreta? Se suman a los que ya hay.")) return;
  const r = await Almacen.cargaPedidos(C, E.yo, origen());
  pintaTodo(); grita("Listo: " + plural(r.renglones, "pedido cargado", "pedidos cargados"));
}
async function diagnostico(){
  const caja = $("#diag"); const filas = [];
  const fila = (ok, t, arreglo) => filas.push('<div class="r"><span class="' + (ok === true ? "ok" : ok === false ? "no" : "duda") + '">' + (ok === true ? "✓" : ok === false ? "✗" : "?") + '</span><span>' + t + (arreglo ? '<small>' + arreglo + '</small>' : "") + '</span></div>');
  const pinta = () => { caja.innerHTML = filas.join(""); };
  fila(navigator.onLine !== false, "Conexión a internet", navigator.onLine === false ? "Sin señal ahora. Lo que hagas se guarda y se sube después." : "");
  if (Almacen.sinPermiso.length) fila(false, "Reglas de Firebase incompletas: " + Almacen.sinPermiso.join(", "), "En console.firebase.google.com → Firestore → Rules, agrega esta línea junto a las demás y publica: " + Almacen.sinPermiso.map(c => "match /" + c + "/{id} { allow read, write: if delTaller(); }").join("  "));
  fila(Almacen.hayNube ? (Almacen.modo === "nube") : null, "Base compartida", !Almacen.hayNube ? "Faltan las llaves en config.js" : Almacen.modo !== "nube" ? "No has iniciado sesión" : "");
  const instalada = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  fila(instalada, "Instalada como app", instalada ? "" : (esApple ? "Compartir → Agregar a pantalla de inicio" : "Menú ⋮ → Instalar app"));
  try { localStorage.setItem("alm.prueba", "1"); localStorage.removeItem("alm.prueba"); fila(true, "Guardado en este aparato"); } catch(e){ fila(false, "Guardado en este aparato", "El navegador está bloqueando el almacenamiento. Sal del modo privado."); }
  fila("serviceWorker" in navigator, "Abre sin señal", "serviceWorker" in navigator ? "" : "Este navegador no lo permite; la app sigue sirviendo con señal.");
  pinta();
  const md = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  if (!md){ fila(false, "Cámara", "Este navegador no da acceso a la cámara. Escribe los códigos a mano."); pinta(); }
  else {
    try { const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}); s.getTracks().forEach(t => t.stop()); fila(true, "Cámara (para el código de barras)"); }
    catch(e){ fila(false, "Cámara", e.name === "NotAllowedError" ? (esApple ? "iPhone: Ajustes → Safari → Cámara → Permitir" : "Android: toca el candado en la barra de dirección → Permisos → Cámara") : "No se encontró cámara."); }
    pinta();
  }
  fila(true, "Versión instalada: " + esc((window.CONFIG || {}).VERSION || "?"));
  pinta();
}
function imprime(tipo){
  let filas, cab;
  if (tipo === "material"){ cab = ["Producto", "Presentación"]; filas = materiales().sort((a,b) => sinAcento(titulo(a)) > sinAcento(titulo(b)) ? 1 : -1).map(p => [esc(titulo(p)) + (p.nombre !== titulo(p) ? '<br><small>' + esc(p.nombre) + '</small>' : ""), esc((p.presentacion || "") + (p.litros ? " " + p.litros + " L" : "")), vivo(p)]); }
  else if (tipo === "pieza"){ cab = ["Mueble · color", "Sección"]; filas = []; Object.keys(R.PIEZAS).forEach(c => gruposPieza(c).forEach(p => filas.push([esc(p.modelo) + " · " + esc(nombreColor(p.color)), esc(R.PIEZAS[c].nombre), vivoPieza(p)]))); }
  else { cab = ["Mueble · color", "Etapa · de quién"]; filas = []; Object.keys(R.ETAPAS).forEach(e => gruposMueble(e).forEach(g => g.lotes.forEach(l => filas.push([esc(g.modelo) + " · " + esc(nombreColor(g.color)), esc(R.ETAPAS[e].nombre) + " · " + esc(R.origenDe(l)), l.cantidad])))); }
  $("#impresion").innerHTML = '<h1>Hoja de conteo · ' + (tipo === "material" ? "Material" : tipo === "pieza" ? "Piezas" : "Muebles") + '</h1><p>' + esc((window.CONFIG || {}).TALLER || "") + ' · ' + new Date().toLocaleDateString("es-MX", {weekday:"long", day:"numeric", month:"long", year:"numeric"}) + ' · contó: ______________</p>' +
    '<table><thead><tr><th>' + cab[0] + '</th><th>' + cab[1] + '</th><th>Sistema</th><th>Contado</th><th>Notas</th></tr></thead><tbody>' + filas.map(r => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td class="n">' + r[2] + '</td><td class="blanco"></td><td></td></tr>').join("") + '</tbody></table>';
  $("#impresion").hidden = false; window.print(); setTimeout(() => { $("#impresion").hidden = true; }, 500);
}

/* ═══════════════ REPORTES ═══════════════
   Cada reporte es una tabla {titulo, columnas, filas[], grupos?}. Se ve en pantalla,
   se imprime en computadora y se baja como PDF en el celular. */
const fechaHoy = () => new Date().toLocaleDateString("es-MX", {weekday:"long", day:"numeric", month:"long", year:"numeric"});
const SECCIONES_REP = () => [
  ...["maquilado", "armado", "pintado", "mdf", "mdf_pintado", "preparado"].map(k => ({ k, zona: "Zona de muebles", nombre: R.ETAPAS[k].nombre })),
  ...[["puertas_uriel"], ["puertas_por_lijar"], ["puertas_lijadas", "Puertas lijadas · sin bisagras"], ["puertas_lijadas_bisagras", "Puertas lijadas · con bisagras"], ["puertas_pintadas"], ["cajones_armados"], ["cajones_pintados"], ["parches_por_lijar"], ["parches_lijados"], ["parches_pintados"]]
    .map(([k, n]) => ({ k, zona: "Zona de piezas", nombre: n || R.PIEZAS[k].nombre }))
];
/* A dónde va cada cosa cuando se descuenta desde el reporte al Plan del día (null = no se puede) */
function destinoPlan(tipo, x){
  if (tipo === "lote"){ const sig = R.siguienteEtapa(x.etapa); return sig && sig !== "preparado" ? sig : null; }
  if (x.categoria === "puertas_lijadas") return "puertas_pintadas";       // sin bisagras: pide autorización
  if (R.esExtra(modeloDe(x.modelo_id))) return R.siguientePiezaDe(x.categoria, modeloDe(x.modelo_id));
  return R.siguientePieza(x.categoria);
}
const NOMBRE_PLAN = { puertas_por_lijar: "Puertas a pre lijar (Uriel)", puertas_lijadas: "Puertas a lijar", puertas_pintadas: "Puertas a pintar", armado: "Muebles a armar", pintado: "Muebles a pintar", mdf_pintado: "MDF a pintar", cajones_pintados: "Cajones a pintar", parches_lijados: "Parches a lijar", parches_pintados: "Parches a pintar" };
function reporteMuebles(seccion){
  const orden = (a, b) => sinAcento(a.modelo + a.color) < sinAcento(b.modelo + b.color) ? -1 : 1;
  const grupos = SECCIONES_REP().filter(s => !seccion || s.k === seccion).map(s => {
    let filas, total = 0;
    let refs;
    if (s.zona === "Zona de muebles"){
      const ls = E.lotes.filter(l => l.etapa === s.k && Number(l.cantidad) > 0).sort(orden);
      filas = ls.map(l => { total += Number(l.cantidad); const q = R.firmaDe(l); let quien = /sin nombre|sin responsable/.test(q || "") ? "" : (q || "");
        if (s.k === "preparado"){ const m = modeloDe(l.modelo_id); const con = R.partesTexto(m, l), fal = R.faltanPartes(m, l); quien = [quien, con ? "con " + con : "", fal.length ? "faltan " + fal.map(c => c.k).join(", ") : "completo"].filter(Boolean).join(" · "); }
        return [l.modelo, nombreColor(l.color) + (R.textoColores(l) ? " · " + R.textoColores(l) : ""), Number(l.cantidad), quien]; });
      refs = ls.map(l => ({ tipo: "lote", id: l.id, a: destinoPlan("lote", l) }));
    } else {
      const ps = E.piezas.filter(p => p.categoria === s.k && vivoPieza(p) > 0).sort(orden);
      filas = ps.map(p => { const n = vivoPieza(p); total += n; return [p.modelo, nombreColor(p.color), n, R.textoEquivalencia(n, s.k, modeloDe(p.modelo_id)).replace(/^\d+ \S+ ?/, "").replace(/^· /, "")]; });
      refs = ps.map(p => ({ tipo: "pieza", id: p.id, a: destinoPlan("pieza", p) }));
    }
    return { zona: s.zona, titulo: s.nombre, total, filas, refs };
  }).filter(g => seccion || g.filas.length);
  const sec = seccion && SECCIONES_REP().find(s => s.k === seccion);
  return { titulo: sec ? (sec.zona === "Zona de muebles" ? "Muebles · " : "Piezas · ") + sec.nombre : "Muebles y piezas", columnas: ["Mueble", "Color", "Hay", sec && sec.zona === "Zona de muebles" ? "Quién" : sec ? "Equivale a" : "Quién / equivale a"], numericas: 1, grupos, conZonas: !seccion };
}
function reportePintura(){
  const grupos = [];
  const mk = (t, l, cab) => grupos.push({ titulo: t, filas: l.filter(p => (cab ? enCabina(p) : vivo(p)) > 0).sort((a,b) => sinAcento(titulo(a)) < sinAcento(titulo(b)) ? -1 : 1).map(p => [titulo(p) + (p.nombre !== titulo(p) ? " (" + p.nombre + ")" : ""), p.litros ? p.litros + " L" : "", cab ? enCabina(p) : vivo(p)]) });
  mk("Cubetas", materiales().filter(p => catDe(p) === "Cubetas"));
  mk("Tambos en el almacén", materiales().filter(p => catDe(p) === "Tambos"));
  mk("Tambos en cabina", materiales().filter(p => catDe(p) === "Tambos" && enCabina(p) > 0), true);
  return { titulo: "Pintura y material", columnas: ["Producto", "Litros", "Hay"], grupos, numericas: 1 };
}
/* Lo que falta por cliente y qué hay en el taller para cubrirlo */
function reportePedidos(){
  const grupos = [];
  const porModelo = n => E.modelos.find(m => sinAcento(m.nombre) === sinAcento(n)) || null;
  E.pedidos.filter(p => p.estado !== "entregado").sort((a,b) => (a.cliente || "") < (b.cliente || "") ? -1 : 1).forEach(p => {
    const filas = [];
    lineasDe(p).forEach(x => {
      const faltan = Number(x.cantidad || 0) - Math.min(Number(x.cantidad || 0), Number(x.entregado || 0)); if (faltan <= 0) return;
      const m = x.surtido ? null : porModelo(x.modelo);
      let hay = "no está en el catálogo";
      if (x.surtido){
        const fam = x.familia || (x.modelo || "").split(" ")[0];
        const ms = E.modelos.filter(mm => mm.activo !== false && sinAcento(mm.familia || "") === sinAcento(fam)).map(mm => mm.id);
        const cnt = k => E.lotes.filter(l => l.etapa === k && ms.includes(l.modelo_id)).reduce((s,l) => s + Number(l.cantidad), 0);
        hay = "surtido: el cliente deja escoger · de " + fam + " hay " + cnt("pintado") + " pintados y " + cnt("preparado") + " preparados";
      } else if (m){
        // Como lego: el mueble y las puertas se pintan por separado. Se dice TODO lo que hay
        // del modelo (y del guacal que usa), de cualquier color, y se marca con ✓ lo que
        // coincide con lo que pide la combinación del pedido para ESA parte.
        const d = R.desarmaColor(x.color); const gu = R.guacalDe(m); const guacal = gu !== m.id ? modeloDe(gu) : null;
        const porColor = (lista, cant, etiqueta, ok) => { const g = {}; lista.forEach(l => { const c = etiqueta(l) || "sin color"; (g[c] = g[c] || { c, n: 0, ok: ok(l) }).n += cant(l); }); return Object.values(g).filter(e => e.n > 0).sort((a,b) => (b.ok - a.ok) || b.n - a.n); };
        const marca = e => (x.color && e.ok ? "✓ " : "");
        const deModelo = l => l.modelo_id === m.id || (guacal && l.modelo_id === guacal.id);
        const et = (k, nombre) => { const cs = porColor(E.lotes.filter(l => l.etapa === k && (k === "preparado" ? l.modelo_id === m.id : deModelo(l))), l => Number(l.cantidad),
            l => (l.color || "sin color") + (k === "preparado" && R.textoColores(l) ? " · " + R.textoColores(l) : "") + (guacal && l.modelo_id === guacal.id ? " (guacal)" : ""),
            l => k === "preparado" ? R.coincideCombo(x.color, l) : R.mismoColor(l.color, d.mueble));
          const t = cs.reduce((s,c) => s + c.n, 0); return t + " " + nombre + (t ? " (" + cs.map(c => marca(c) + c.n + " " + c.c).join(", ") + ")" : ""); };
        const pz = (ks, nombre, por, parte) => { const cs = porColor(E.piezas.filter(q => ks.includes(q.categoria) && (parte === "puertas" ? q.modelo_id === m.id : deModelo(q))), vivoPieza, q => (q.color || "sin color") + (guacal && q.modelo_id === guacal.id ? " (guacal)" : ""), q => R.mismoColor(q.color, d[parte])); const t = cs.reduce((s,c) => s + c.n, 0);
          const eq = n => por == null ? "" : por === 0 ? "" : " para " + Math.floor(n / por);
          if (por === 0) return nombre + ": no lleva"; if (!t) return nombre + " para 0";
          return nombre + " para " + (por ? Math.floor(t / por) : "?") + " (" + cs.map(c => marca(c) + c.n + " " + c.c + eq(c.n)).join(", ") + ")" + (por == null ? " · sin ficha" : ""); };
        const partes = [];
        if (m.tipo === "mdf") partes.push(et("mdf", "MDF"), et("mdf_pintado", "MDF pintados"));
        else partes.push(et("maquilado", "maquilados"), et("armado", "armados"), et("pintado", "pintados"));
        partes.push(et("preparado", "preparados"));
        partes.push(pz(["puertas_pintadas"], "puertas pintadas", m.total_puertas, "puertas"), pz(["puertas_lijadas", "puertas_lijadas_bisagras"], "puertas lijadas", m.total_puertas, "puertas"), pz(["cajones_pintados"], "cajones pintados", m.cajones, "cajones"));
        hay = partes.join(" · ");
      }
      filas.push(["Faltan " + faltan + " " + x.modelo + (x.color ? " · " + x.color : ""), hay]);
    });
    if (filas.length) grupos.push({ titulo: p.cliente + (p.fecha ? " · " + isoADma(p.fecha) : ""), filas });
  });
  return { titulo: "Pedidos: qué falta y qué hay", columnas: ["Falta", "Hay en el taller"], grupos, numericas: 0 };
}
function reporteMovimientos(){
  const sab = Almacen.inicioSemana(); const lun = new Date(sab); lun.setDate(lun.getDate() + 2);
  const semanas = [{ sab, titulo: "Esta semana" }];
  if (Date.now() < lun.getTime()){ const ant = new Date(sab); ant.setDate(ant.getDate() - 7); semanas.push({ sab: ant, titulo: "Semana pasada (se borra el domingo en la noche)" }); }
  const grupos = [];
  semanas.forEach(w => {
    const ini = w.sab.toISOString(); const fin = new Date(w.sab); fin.setDate(fin.getDate() + 7); const finIso = fin.toISOString();
    const ms = E.movimientos.filter(m => m.creado >= ini && m.creado < finIso && m.tipo !== "catalogo");
    const dias = {}; ms.forEach(m => { const d = m.creado.slice(0, 10); (dias[d] = dias[d] || []).push(m); });
    Object.keys(dias).sort().forEach(d => {
      const filas = dias[d].sort((a, b) => a.creado < b.creado ? -1 : 1).map(m => { const x = descMov(m); return [reloj(m.creado), (m.tipo === "traslado" ? "→" : m.delta > 0 ? "+" : "") + (m.delta || "·"), x.titulo.replace(/<[^>]+>/g, ""), x.sub.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " "), (m.persona || "?") + (m.origen ? " · " + m.origen : "")]; });
      grupos.push({ zona: textoSemana(w.sab), titulo: fechaLarga(d), total: filas.length, filas });
    });
  });
  return { titulo: "Movimientos de la semana", columnas: ["Hora", "Cant.", "Qué", "Detalle", "Capturó"], grupos, numericas: 0, conZonas: true, archivo: "movimientos-semana-" + sab.toISOString().slice(0, 10) };
}
function pintaReportes(){
  $("#listaReportes").innerHTML =
    '<div class="ajuste"><h4>Muebles y piezas</h4><p>Seccionado igual que la app: Zona de muebles (una tabla por etapa) y Zona de piezas (una tabla por sección). Cada renglón trae el botón <b>Descontar</b>: baja del inventario ahora y queda pendiente en el Plan del día hasta que se marque listo.</p><div class="acciones"><button class="btn vino" data-rep="muebles">Todo</button><select id="repSeccion" class="btn"><option value="">Solo una sección…</option>' +
      ["Zona de muebles", "Zona de piezas"].map(z => '<optgroup label="' + z + '">' + SECCIONES_REP().filter(s => s.zona === z).map(s => '<option value="' + s.k + '">' + esc(s.nombre) + '</option>').join("") + '</optgroup>').join("") + '</select></div></div>' +
    '<div class="ajuste"><h4>Pintura y material</h4><p>Cubetas, tambos en el almacén y tambos abiertos en cabina.</p><div class="acciones"><button class="btn vino" data-rep="pintura">Ver</button></div></div>' +
    '<div class="ajuste"><h4>Pedidos</h4><p>Por cliente: lo que falta por entregar y qué hay en el taller para cubrirlo.</p><div class="acciones"><button class="btn vino" data-rep="pedidos">Ver</button></div></div>' +
    '<div class="ajuste"><h4>Movimientos de la semana</h4><p>Todo lo que se hizo de sábado a viernes, día por día. Bájalo en PDF antes del domingo en la noche: ese día se borra de la nube para no ocupar espacio.</p><div class="acciones"><button class="btn vino" data-rep="semana">Ver</button></div></div>';
  $("#listaReportes").querySelectorAll("[data-rep]").forEach(b => b.onclick = () => abreReporte(b.dataset.rep));
  $("#repSeccion").onchange = e => { if (e.target.value) abreReporte("muebles", e.target.value); };
}
const esNum = (r, i) => r.numCols ? r.numCols.includes(i) : i >= r.columnas.length - r.numericas;
function abreReporte(cual, seccion){
  E.reporteAbierto = { cual, seccion };
  const r = cual === "muebles" ? reporteMuebles(seccion) : cual === "pintura" ? reportePintura() : cual === "semana" ? reporteMovimientos() : reportePedidos();
  if (cual === "muebles") r.numCols = [2];
  if (cual === "semana") r.numCols = [];
  const conAccion = cual === "muebles";
  const tabla = (filas, refs) => filas.length ? '<table class="rep"><thead><tr>' + r.columnas.map((c, i) => '<th' + (esNum(r, i) ? ' class="n"' : "") + '>' + esc(c) + '</th>').join("") + (conAccion ? '<th class="acc"></th>' : "") + '</tr></thead><tbody>' +
    filas.map((f, j) => '<tr>' + f.map((v, i) => '<td' + (esNum(r, i) ? ' class="n"' : "") + '>' + esc(v) + '</td>').join("") + (conAccion ? '<td class="acc">' + (refs && refs[j] && refs[j].a ? '<button class="btn chico" data-desc="' + esc(refs[j].tipo + "|" + refs[j].id) + '">Descontar</button>' : "") + '</td>' : "") + '</tr>').join("") + '</tbody></table>' : '<p class="rep-nada">Nada en esta sección.</p>';
  let zona = "";
  const cuerpo = r.grupos ? (r.grupos.length ? r.grupos.map(g => { const z = r.conZonas && g.zona && g.zona !== zona ? '<h3 class="rep-zona">' + esc(zona = g.zona) + '</h3>' : ""; return z + '<h4 class="rep-g">' + esc(g.titulo) + (g.total != null ? ' <span>· ' + g.total + '</span>' : "") + '</h4>' + tabla(g.filas, g.refs); }).join("") : '<div class="vacio"><b>Nada que reportar</b></div>') : (r.filas.length ? tabla(r.filas) : '<div class="vacio"><b>Nada que reportar</b></div>');
  $("#listaReportes").innerHTML = '<div class="rep-cab"><button class="btn" id="repVolver">← Reportes</button><div class="der">' + (esEscritorio() ? '<button class="btn vino" id="repImprimir">Imprimir</button>' : '<button class="btn vino" id="repPdf">Descargar PDF</button>') + '</div></div>' +
    '<div class="rep-hoja" id="repHoja"><h1>' + esc(r.titulo) + '</h1><p class="rep-fecha">' + esc((window.CONFIG || {}).TALLER || "") + ' · ' + esc(fechaHoy()) + '</p>' + cuerpo + '</div>';
  $("#repVolver").onclick = () => { E.reporteAbierto = null; pintaReportes(); };
  $("#listaReportes").querySelectorAll("[data-desc]").forEach(b => b.onclick = () => { const [tipo, id] = b.dataset.desc.split("|"); hojaDescontar(tipo, id, () => abreReporte(cual, seccion)); });
  const bi = $("#repImprimir"); if (bi) bi.onclick = () => { $("#impresion").innerHTML = $("#repHoja").innerHTML; $("#impresion").hidden = false; window.print(); setTimeout(() => { $("#impresion").hidden = true; }, 500); };
  const bp = $("#repPdf"); if (bp) bp.onclick = () => descargaPdf(r);
}
async function descargaPdf(r){
  grita("Armando el PDF…");
  try {
    if (!window.jspdf) await cargaScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const { jsPDF } = window.jspdf;
    const apaisado = r.columnas.length > 6;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: apaisado ? "landscape" : "portrait" });
    const W = apaisado ? 297 : 210, H = apaisado ? 210 : 297, M = 12; let y = M;
    const txt = (t, size, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); };
    const linea = (celdas, anchos, bold, fondo) => {
      txt("", bold ? 7.5 : 8.5, bold);
      const partes = celdas.map((c, i) => doc.splitTextToSize(String(c == null ? "" : c), anchos[i] - 2).slice(0, bold ? 2 : 1));
      const renglones = Math.max(1, ...partes.map(x => x.length));
      const alto = 4 + 3.6 * renglones; if (y + alto > H - M){ doc.addPage(); y = M; }
      if (fondo){ doc.setFillColor(240, 232, 228); doc.rect(M, y - 4.2, W - 2*M, alto, "F"); }
      let x = M + 1;
      partes.forEach((ls, i) => { const num = esNum(r, i); ls.forEach((t, j) => doc.text(t, num ? x + anchos[i] - 2 : x, y + j * 3.6, num ? { align: "right" } : undefined)); x += anchos[i]; });
      y += alto;
    };
    txt("", 15, true); doc.text(r.titulo, M, y); y += 6;
    txt("", 9, false); doc.setTextColor(110); doc.text(((window.CONFIG || {}).TALLER || "") + " · " + fechaHoy(), M, y); doc.setTextColor(0); y += 8;
    const nCols = r.columnas.length; const nNum = r.columnas.filter((c, i) => esNum(r, i)).length; const numW = nNum ? Math.min(24, (W - 2*M) * 0.68 / nNum) : 0;
    const anchos = r.columnas.map((c, i) => esNum(r, i) ? numW : (W - 2*M - numW * nNum) / Math.max(1, nCols - nNum));
    const grupos = r.grupos || [{ titulo: "", filas: r.filas }];
    let zona = "";
    grupos.forEach(g => {
      if (r.conZonas && g.zona && g.zona !== zona){ zona = g.zona; if (y + 16 > H - M){ doc.addPage(); y = M; } y += 5; txt("", 13, true); doc.setTextColor(120, 30, 30); doc.text(zona.toUpperCase(), M, y); doc.setTextColor(0); y += 7; }
      if (g.titulo){ if (y + 10 > H - M){ doc.addPage(); y = M; } y += 3; txt("", 11, true); doc.text(g.titulo + (g.total != null ? "  ·  " + g.total : ""), M, y); y += 6; }
      if (!g.filas.length){ txt("", 9, false); doc.setTextColor(110); doc.text("Nada en esta sección.", M, y); doc.setTextColor(0); y += 6; return; }
      linea(r.columnas, anchos, true, true);
      g.filas.forEach(f => linea(f, anchos, false, false));
    });
    const nombre = (r.archivo || r.titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + new Date().toISOString().slice(0, 10)) + ".pdf";
    doc.save(nombre);
  } catch(e){ console.warn(e); grita("No se pudo armar el PDF. Revisa la señal e intenta de nuevo."); }
}

/* ═══════════════ PREPARAR: mueble pintado + puertas, cajones y parches pintados ═══════════════ */
/* Desde Piezas: "Colgar en mueble" → escoger a qué muebles (pintados del modelo O de su guacal, o
   preparados a medias del modelo) se les ponen, de cualquier color, y abrir Preparar con esa parte marcada. */
function hojaColgar(p){
  if (!exigeYo()) return;
  const m = modeloDe(p.modelo_id); if (!m) return grita("Este modelo no está en el catálogo");
  const k = p.categoria === "puertas_pintadas" ? "puertas" : p.categoria === "cajones_pintados" ? "cajones" : "parches";
  const comp = R.componentes(m).find(c => c.k === k);
  if (!comp) return grita("Según la ficha, " + m.nombre + " no lleva " + k);
  const gu = R.guacalDe(m); const guacal = gu !== m.id ? modeloDe(gu) : null;
  const grupos = gruposMueble("pintado").concat(gruposMueble("mdf_pintado")).filter(g => g.modelo_id === m.id || (guacal && g.modelo_id === guacal.id))
    .concat(gruposMueble("preparado").filter(g => g.modelo_id === m.id && !(g.partes || {})[k]));
  if (!grupos.length) return grita("No hay muebles pintados de " + m.nombre + (guacal ? " ni de su guacal (" + guacal.nombre + ")" : "") + " para ponerles " + k + ". Primero pasa el mueble a pintado." + (!guacal && R.esGuacal(m) === false ? " Si este modelo se arma sobre un guacal compartido, ponlo en su ficha." : ""));
  abreHoja('<h3>' + (k === "puertas" ? "Colgar puertas" : "Poner " + k) + '</h3><p class="guia"><b>' + esc(p.modelo) + '</b> · ' + esc(nombreColor(p.color)) + ' · hay <b>' + vivoPieza(p) + '</b> ' + esc(R.PIEZAS[p.categoria].unidad) + ' (' + esc(R.textoEquivalencia(vivoPieza(p), p.categoria, m).replace(/^[^=]*= /, "")) + '). ¿A qué muebles se les ponen? No importa el color del mueble.</p>' +
    '<div class="sugerencias">' + grupos.map((g, i) => '<button data-g="' + i + '">' + esc(g.modelo) + (guacal && g.modelo_id === guacal.id ? ' <span class="chip">guacal</span>' : "") + ' · ' + esc(nombreColor(g.color)) + ' · ' + esc(R.ETAPAS[g.etapa].nombre) + (g.etapa === "preparado" ? " (con " + esc(R.partesTexto(m, g) || "nada") + ")" : "") + '<small>' + g.total + ' disponibles · ' + esc(g.lotes.map(l => R.firmaDe(l) + " " + l.cantidad).join(" · ")) + '</small></button>').join("") + '</div>',
    h => h.querySelectorAll("[data-g]").forEach(b => b.onclick = () => hojaPreparar(grupos[Number(b.dataset.g)], { modelo: m, pref: k })));
}
/* Renglones de pedidos que todavía faltan (no surtidos), con su modelo del catálogo */
function pendientesPedido(filtro){
  const r = [];
  E.pedidos.filter(p => p.estado !== "entregado").forEach(p => lineasDe(p).forEach((x, i) => {
    if (x.surtido || !x.modelo) return;
    const faltan = Number(x.cantidad || 0) - Math.min(Number(x.cantidad || 0), Number(x.entregado || 0)); if (faltan <= 0) return;
    const m = modelosActivos().find(mm => sinAcento(mm.nombre) === sinAcento(x.modelo)); if (!m || R.esExtra(m)) return;
    if (filtro && !filtro(m)) return;
    r.push({ p, i, x, m, faltan });
  }));
  return r.sort((a,b) => (a.p.fecha || "") < (b.p.fecha || "") ? -1 : (a.p.fecha || "") > (b.p.fecha || "") ? 1 : (a.p.cliente < b.p.cliente ? -1 : 1));
}
/* ¿Qué se prepara? Primero los muebles pendientes de pedidos (del modelo o de los que usan el
   mismo guacal); abajo, armar uno que no es de pedido. g = grupo de muebles pintados (puede faltar). */
function hojaQuePreparar(g, opc){
  if (!exigeYo()) return;
  opc = opc || {};
  const gm = g ? modeloDe(g.modelo_id) : null;
  const pend = pendientesPedido(m => opc.modelo ? m.id === opc.modelo.id : (gm ? R.mismoGuacal(m, gm) : true));
  const libre = () => g ? hojaPreparar(g, { pref: opc.pref, modelo: opc.modelo }) : hojaEscogerPintado(null, null);
  if (!pend.length) return libre();
  abreHoja('<h3>¿Qué se prepara?</h3>' + (g ? '<p class="guia"><b>' + esc(g.modelo) + '</b> · ' + esc(nombreColor(g.color)) + ' · hay <b>' + g.total + '</b> ' + esc(R.ETAPAS[g.etapa].nombre.toLowerCase()) + '.</p>' : '<p class="guia">Escoge un mueble pendiente de pedido, o arma uno que no es de pedido.</p>') +
    '<div class="grupo-h">Muebles pendientes de pedidos</div><div class="sugerencias">' + pend.map((q, i) => '<button data-q="' + i + '">' + esc(q.p.cliente) + ' · <b>' + esc(q.m.nombre) + '</b>' + (q.x.color ? ' · ' + esc(q.x.color) : "") + '<small>faltan ' + q.faltan + (q.p.fecha ? " · pedido del " + esc(isoADma(q.p.fecha)) : "") + (g && q.m.id !== g.modelo_id ? " · se arma sobre " + esc(g.modelo) : "") + '</small></button>').join("") + '</div>' +
    '<div class="grupo-h">O sin pedido</div><button class="btn grande" id="qLibre">Armar mueble que no es pedido</button>',
    h => {
      h.querySelector("#qLibre").onclick = libre;
      h.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { const q = pend[Number(b.dataset.q)]; const ped = { id: q.p.id, cliente: q.p.cliente, i: q.i, color: q.x.color || "", faltan: q.faltan }; if (g) hojaPreparar(g, { modelo: q.m, pedido: ped, pref: opc.pref }); else hojaEscogerPintado(q.m, ped); });
    });
}
/* Escoger de qué muebles pintados sale: del modelo o de su guacal (m puede faltar: cualquiera) */
function hojaEscogerPintado(m, pedido){
  const gu = m ? R.guacalDe(m) : null;
  const disponibles = gruposMueble("pintado").concat(gruposMueble("mdf_pintado")).filter(g => !m || g.modelo_id === m.id || g.modelo_id === gu);
  abreHoja('<h3>' + (m ? "Preparar " + esc(m.nombre) : "Armar mueble que no es pedido") + '</h3>' +
    (pedido ? '<p class="guia">Para <b>' + esc(pedido.cliente) + '</b>' + (pedido.color ? " · " + esc(pedido.color) : "") + ' · faltan <b>' + pedido.faltan + '</b>.</p>' : "") +
    '<div class="paso-a"><span class="de">Mueble pintado / MDF pintado</span> → <span class="a">Mueble preparado</span></div>' +
    '<p class="guia">' + (m ? "Escoge de qué muebles pintados sale: del mismo modelo o de su guacal." : "Escoge cuál se preparó: se le descuentan sus puertas, cajones y parches pintados.") + '</p>' +
    campoBuscaLista("Mueble o color…") + '<div class="sugerencias" id="rLista"></div>',
    h => {
      const inp = h.querySelector("#rBusca"), lista = h.querySelector("#rLista");
      const pinta = () => {
        const l = inp.value.trim() ? Busca.busca(inp.value, disponibles, g => g.modelo + " " + g.color) : disponibles;
        lista.innerHTML = l.length ? l.map(g => '<button data-k="' + esc(g.k) + '">' + esc(g.modelo) + (m && g.modelo_id !== m.id ? ' <span class="chip">guacal</span>' : "") + ' · ' + esc(nombreColor(g.color)) + '<small>' + g.total + ' disponibles · ' + esc(g.lotes.map(x => R.firmaDe(x) + " " + x.cantidad).join(" · ")) + '</small></button>').join("")
          : '<div class="sin-hallar">' + (disponibles.length ? "No encontré ese mueble ahí." : m ? "No hay muebles pintados de " + esc(m.nombre) + (gu !== m.id && modeloDe(gu) ? " ni de su guacal (" + esc(modeloDe(gu).nombre) + ")" : "") + "." : "No hay nada en «mueble pintado» todavía.") + '</div>';
        lista.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { const g = disponibles.find(x => x.k === b.dataset.k); if (g) hojaPreparar(g, { modelo: m || modeloDe(g.modelo_id), pedido }); });
      };
      inp.oninput = pinta; pinta(); inp.focus();
    });
}
/* opc: { modelo: la variante que se arma (si el grupo es un guacal), pedido: {id, cliente, i, color, faltan}, pref: parte que viene marcada } */
function hojaPreparar(g, opc){
  if (!exigeYo()) return;
  opc = opc || {}; const pedido = opc.pedido || null; const pref = opc.pref;
  const regla = R.responsables("preparado"); let quien = [];
  const rec = E.ultimoQuien.preparado; if (rec && Date.now() - rec.t < 15*60*1000) quien = rec.nombres.filter(n => regla.opciones.includes(n));
  const gm = modeloDe(g.modelo_id);
  const completar = g.etapa === "preparado";
  const m = completar ? gm : (opc.modelo || gm);
  if (!m) return grita("Este modelo no está en el catálogo");
  if (R.esGuacal(m) && !completar){
    const variantes = modelosActivos().filter(x => x.guacal === m.id);
    abreHoja('<h3>Preparar</h3><p class="guia"><b>' + esc(g.modelo) + '</b> es un guacal: sirve para varios modelos. ¿Cuál se arma?</p>' + campoModelo() +
      (variantes.length ? '<div class="grupo-h">Modelos de este guacal</div><div class="sugerencias">' + variantes.map(v => '<button data-id="' + esc(v.id) + '">' + esc(v.nombre) + '<small>' + esc(fichaCorta(v)) + '</small></button>').join("") + '</div>' : '<p class="sin-hallar">Ningún modelo del catálogo usa este guacal todavía. Márcalos en la ficha de este guacal (Catálogo).</p>'),
      h => { montaCampoModelo(h, x => { if (x) hojaPreparar(g, Object.assign({}, opc, { modelo: x })); }, false, x => x.guacal === m.id); h.querySelectorAll(".sugerencias [data-id]").forEach(b => b.onclick = () => hojaPreparar(g, Object.assign({}, opc, { modelo: modeloDe(b.dataset.id) }))); });
    return;
  }
  if (m.id !== g.modelo_id && R.guacalDe(m) !== g.modelo_id && !R.mismoGuacal(m, gm)) return grita(m.nombre + " no se arma sobre " + g.modelo);
  const ya = completar ? (g.partes || {}) : {};
  const comps = R.componentes(m).filter(c => !ya[c.k]);
  if (!comps.length) return grita("Este mueble ya tiene todo lo de su ficha");
  const quiere = pedido && pedido.color ? R.desarmaColor(pedido.color) : null;
  const gu = R.guacalDe(m);
  const marcadas = {}, tocadas = {}, colores = {};   // colores[k]: "" = cualquier color (primero el del mueble); si no, color fijo
  if (pref) comps.forEach(c => { if (c.k !== pref){ tocadas[c.k] = true; marcadas[c.k] = false; } });
  const hayDe = (c, col) => Almacen.piezasPara(m.id, g.color, c.cat, { guacal: gu, color: col }).length > 0;
  comps.forEach(c => { if (!c.cat) return; if (quiere && quiere[c.k]) colores[c.k] = quiere[c.k]; else colores[c.k] = g.color && hayDe(c, g.color) ? g.color : ""; });
  const tope = pedido ? Math.max(1, Math.min(pedido.faltan, g.total)) : g.total;
  const ini = g.lotes.length === 1 ? Math.min(g.lotes[0].cantidad, tope) : 0;
  const sobreGuacal = m.id !== g.modelo_id;
  abreHoja('<h3>' + (completar ? "Completar" : "Preparar") + (pedido ? " para " + esc(pedido.cliente) : "") + '</h3>' +
    '<div class="paso-a"><span class="de">' + esc(R.ETAPAS[g.etapa].nombre) + (completar ? " · con " + esc(Object.keys(ya).filter(k => ya[k]).join(", ")) : "") + '</span> → <span class="a">Mueble preparado</span></div>' +
    '<p class="guia"><b>' + esc(m.nombre) + '</b>' + (sobreGuacal ? ' sobre el guacal <b>' + esc(g.modelo) + '</b>' : "") + ' · mueble ' + esc(nombreColor(g.color)) + ' · hay <b>' + g.total + '</b>.' +
      (pedido ? ' Pedido de <b>' + esc(pedido.cliente) + '</b>' + (pedido.color ? ': <b>' + esc(pedido.color) + '</b>' : "") + ' · faltan ' + pedido.faltan + '.' : "") +
      ' Como lego: marca lo que se le puso ahora y de qué color; lo demás queda pendiente y se puede completar después.</p>' +
    '<div class="lotes">' + g.lotes.map(l => '<div class="lote" data-lote="' + esc(l.id) + '"><div class="quien">' + esc(R.firmaDe(l)) + '<small>' + esc(R.origenDe(l)) + '</small><div class="disp">' + l.cantidad + ' disponibles</div></div>' +
      '<div class="toma"><button class="tecla" data-menos>−</button><input type="number" inputmode="numeric" min="0" max="' + l.cantidad + '" value="' + (g.lotes.length === 1 ? ini : 0) + '"><button class="tecla" data-mas>＋</button></div></div>').join("") + '</div>' +
    '<div class="total-paso"><span>Muebles</span><b id="pTotal">' + ini + '</b></div>' +
    '<h3 class="mini">Qué se le puso y de qué color</h3><div class="lotes" id="pDesc"></div>' +
    '<div class="grupo-h">' + esc(regla.pregunta) + '</div><div class="cats" id="pQuien">' + regla.opciones.map(n => '<button class="cat' + (quien.includes(n) ? " on" : "") + '" data-n="' + esc(n) + '">' + esc(n) + '</button>').join("") + '</div>' +
    '<p class="sin-hallar" id="pError" hidden></p><button class="btn vino grande" id="pOk" disabled style="margin-top:12px">Confirmar</button>',
    h => {
      const filas = Array.from(h.querySelectorAll("[data-lote]"));
      const total = () => filas.reduce((s,f) => s + (Number(f.querySelector("input").value) || 0), 0);
      const selectColor = c => {
        const fuentes = Almacen.piezasPara(m.id, g.color, c.cat, { guacal: gu }); const porColor = {};
        fuentes.forEach(p => { if (!p.color) return; const kc = Object.keys(porColor).find(x => R.mismoColor(x, p.color)) || p.color; porColor[kc] = (porColor[kc] || 0) + Number(p.cantidad || 0); });
        const cols = Object.keys(porColor); const fijo = colores[c.k] || "";
        if (fijo && !cols.some(x => R.mismoColor(x, fijo))) cols.push(fijo);
        return '<select class="sel-color" data-k="' + c.k + '"><option value=""' + (!fijo ? " selected" : "") + '>Cualquier color' + (g.color ? " (primero " + esc(g.color) + ")" : "") + '</option>' +
          cols.map(x => '<option value="' + esc(x) + '"' + (fijo && R.mismoColor(x, fijo) ? " selected" : "") + '>' + esc(x) + ' · ' + (porColor[x] ? "hay " + porColor[x] : "no hay") + (quiere && quiere[c.k] && R.mismoColor(x, quiere[c.k]) ? " · lo pide el pedido" : "") + '</option>').join("") + '</select>';
      };
      const revisa = () => {
        let mal = false;
        filas.forEach(f => { const l = g.lotes.find(x => x.id === f.dataset.lote); const inp = f.querySelector("input"); const v = Number(inp.value) || 0; const m2 = v < 0 || v > l.cantidad || !Number.isInteger(v); inp.classList.toggle("mal", m2); if (m2) mal = true; });
        const t = total(); h.querySelector("#pTotal").textContent = t;
        const n = Math.max(1, t);
        const rv = Almacen.revisaPreparar({ modelo_id: g.modelo_id, color: g.color }, n, Object.fromEntries(comps.map(c => [c.k, true])), { modelo_id: m.id, colores });
        const info = {}; rv.partes.forEach(pt => info[pt.cat] = pt);
        h.querySelector("#pDesc").innerHTML = comps.map(c => {
          const pt = c.cat ? info[c.cat] : null; const sinFicha = c.cat && c.por == null;
          const alcanza = !c.cat || (pt && pt.hay >= pt.necesita);
          if (!tocadas[c.k]) marcadas[c.k] = alcanza && !sinFicha;
          else if (!(alcanza && !sinFicha)) marcadas[c.k] = false;
          const puede = !sinFicha && (alcanza || !c.cat);
          return '<label class="lote comp' + (marcadas[c.k] ? " on" : "") + (puede ? "" : " no") + '"><input type="checkbox" data-k="' + c.k + '"' + (marcadas[c.k] ? " checked" : "") + (puede ? "" : " disabled") + '><div class="quien">' + esc(c.nombre) +
            '<small>' + (c.cat ? (sinFicha ? "la ficha no dice cuántos lleva" : "necesita " + (c.por * n) + " · hay " + (pt ? pt.hay : 0) + (pt && pt.fuentes.length ? " (" + pt.fuentes.map(f => f.cantidad + " " + nombreColor(f.color) + (f.modelo_id !== m.id ? " del guacal" : "")).join(", ") + ")" : "")) : "no se descuenta nada, solo se marca") + '</small>' +
            (c.cat && !sinFicha ? selectColor(c) : "") + '</div>' +
            '<div class="disp">' + (c.cat ? (sinFicha ? "" : (alcanza ? '<b>−' + (c.por * n) + '</b>' : '<span style="color:var(--rojo)">faltan ' + (c.por * n - (pt ? pt.hay : 0)) + (colores[c.k] ? " en " + esc(colores[c.k]) : "") + '</span>')) : "") + '</div></label>';
        }).join("");
        h.querySelectorAll("#pDesc [data-k][type=checkbox]").forEach(cb => cb.onchange = () => { tocadas[cb.dataset.k] = true; marcadas[cb.dataset.k] = cb.checked; cb.closest(".comp").classList.toggle("on", cb.checked); revisa(); });
        h.querySelectorAll("#pDesc select.sel-color").forEach(sel => { sel.onclick = e => e.stopPropagation(); sel.onchange = () => { colores[sel.dataset.k] = sel.value; tocadas[sel.dataset.k] = false; revisa(); }; });
        const alguna = comps.some(c => marcadas[c.k]);
        const err = h.querySelector("#pError"); err.hidden = alguna || t <= 0; err.textContent = "Marca al menos una cosa que se le puso";
        h.querySelector("#pOk").disabled = mal || t <= 0 || !quien.length || !alguna;
      };
      filas.forEach(f => {
        const l = g.lotes.find(x => x.id === f.dataset.lote); const inp = f.querySelector("input");
        f.querySelector("[data-menos]").onclick = () => { inp.value = Math.max(0, (Number(inp.value) || 0) - 1); revisa(); };
        f.querySelector("[data-mas]").onclick = () => { inp.value = Math.min(l.cantidad, (Number(inp.value) || 0) + 1); revisa(); };
        inp.oninput = revisa; inp.onfocus = () => inp.select();
      });
      h.querySelectorAll("#pQuien [data-n]").forEach(b => b.onclick = () => { quien = quien.includes(b.dataset.n) ? [] : [b.dataset.n]; h.querySelectorAll("#pQuien [data-n]").forEach(x => x.classList.toggle("on", quien.includes(x.dataset.n))); revisa(); });
      revisa();
      h.querySelector("#pOk").onclick = async () => {
        E.ultimoQuien.preparado = { nombres: quien.slice(), t: Date.now() };
        let hechos = 0;
        const cols = Object.fromEntries(comps.filter(c => c.cat && marcadas[c.k] && colores[c.k]).map(c => [c.k, colores[c.k]]));
        try {
          for (const f of filas){ const n = Number(f.querySelector("input").value) || 0; if (!n) continue; await Almacen.prepara({ lote_id: f.dataset.lote, cantidad: n, preparo: quien[0], partes: marcadas, modelo_a: m.id, colores: cols, pedido_id: pedido ? pedido.id : "", cliente: pedido ? pedido.cliente : "" }, E.yo, origen()); hechos += n; }
          cierraHoja(); grita(plural(hechos, "mueble", "muebles") + " " + m.nombre + " con " + comps.filter(c => marcadas[c.k]).map(c => c.k).join(", ") + (pedido ? " · para " + pedido.cliente : ""));
          E.etapa = "preparado"; E.sel = null; irA("muebles"); pintaTodo();
        } catch(e){ const err = h.querySelector("#pError"); err.hidden = false; err.textContent = e.message; if (hechos) pintaTodo(); }
      };
    });
}

/* ═══════════════ PLAN DEL DÍA ═══════════════ */
const nombrePlan = a => NOMBRE_PLAN[a] || ((R.ETAPAS[a] || R.PIEZAS[a] || {}).nombre || a);
const unidadPlan = p => p.tipo === "lote" ? "muebles" : (R.PIEZAS[p.de] || {}).unidad || "piezas";
function pintaPlan(){
  const caja = $("#listaPlan");
  let l = E.plan.slice().sort((a,b) => (nombrePlan(a.a) + a.creado) < (nombrePlan(b.a) + b.creado) ? -1 : 1);
  $("#resumenPlan").textContent = l.length ? plural(l.length, "pendiente", "pendientes") + " · " + fechaHoy() : fechaHoy();
  if (q("plan")) l = Busca.busca(q("plan"), l, p => p.modelo + " " + p.color + " " + nombrePlan(p.a));
  const aviso = Almacen.sinPermiso.includes("plan") ? '<div class="aviso" style="margin-bottom:10px"><b>Falta una regla en Firebase</b><p>El plan del día no se puede compartir todavía. En Firestore → Rules agrega: <code>match /plan/{id} { allow read, write: if delTaller(); }</code> y publica.</p></div>' : "";
  if (!l.length){ caja.innerHTML = aviso + (q("plan") ? sinHallar("plan", "eso en el plan") : '<div class="vacio"><b>Nada pendiente para hoy</b><p>El plan se arma desde <b>Reportes → Muebles y piezas</b>: cada renglón tiene el botón «Descontar». Lo que se descuenta baja del inventario al momento y se queda aquí hasta que alguien lo marque listo.</p></div>'); return; }
  const grupos = {}; l.forEach(p => (grupos[p.a] = grupos[p.a] || []).push(p));
  caja.innerHTML = Object.keys(grupos).map(a => '<div class="bloque-h">' + esc(nombrePlan(a)) + '<span class="n">' + grupos[a].reduce((s,p) => s + p.cantidad, 0) + '</span></div>' + grupos[a].map(p => {
    const m = modeloDe(p.modelo_id); const por = p.tipo === "pieza" ? R.piezasPorMueble(m, p.de) : null;
    const eq = por > 0 ? " = " + plural(Math.floor(p.cantidad / por), "juego", "juegos") + (p.cantidad % por ? " y " + (p.cantidad % por) : "") : "";
    return '<div class="fila plan-fila">' +
      '<div class="nombre"><b>' + esc(p.modelo) + '</b><small>de ' + esc((R.ETAPAS[p.de] || R.PIEZAS[p.de] || {}).nombre || p.de) + (p.autorizo ? ' · ' + esc(p.autorizo) : "") + '</small></div>' +
      '<div class="sub">' + chipColor(p.color) + '</div><div class="apodos">' + chipColor(p.color) + '</div>' +
      '<div class="cifra"><b>' + p.cantidad + '</b><small>' + esc(unidadPlan(p)) + esc(eq) + '</small></div>' +
      '<div class="ultimo"><span>' + esc(p.de_quien || "?") + ' · ' + esc(cuando(p.creado)) + '</span></div>' +
      '<div class="stepper"><button class="btn vino chico" data-listo="' + esc(p.id) + '">Listo</button><button class="tecla" data-edita="' + esc(p.id) + '" title="Cambiar cantidad">✎</button><button class="tecla" data-quita="' + esc(p.id) + '" title="Quitar: regresa al inventario">✕</button></div></div>';
  }).join("")).join("");
  caja.querySelectorAll("[data-listo]").forEach(b => b.onclick = () => hojaPlanListo(E.plan.find(x => x.id === b.dataset.listo)));
  caja.querySelectorAll("[data-edita]").forEach(b => b.onclick = () => hojaPlanCambia(E.plan.find(x => x.id === b.dataset.edita)));
  caja.querySelectorAll("[data-quita]").forEach(b => b.onclick = async () => { const p = E.plan.find(x => x.id === b.dataset.quita); if (!p || !exigeYo()) return; if (!confirm("¿Quitar del plan? Los " + p.cantidad + " " + unidadPlan(p) + " regresan a " + ((R.ETAPAS[p.de] || R.PIEZAS[p.de] || {}).nombre || p.de) + ".")) return; await Almacen.planQuita(p.id, E.yo, origen()); grita("Regresó al inventario"); pintaTodo(); });
}
function hojaPlanListo(p){
  if (!p || !exigeYo()) return;
  const regla = R.responsables(p.a); let quien = [];
  const rec = E.ultimoQuien[p.a]; if (rec && Date.now() - rec.t < 15*60*1000 && regla) quien = rec.nombres.filter(n => regla.opciones.includes(n));
  const pinta = sePintaEn(p.a);
  abreHoja('<h3>' + esc(nombrePlan(p.a)) + '</h3><p class="guia"><b>' + esc(p.modelo) + '</b> · ' + esc(nombreColor(p.color)) + ' · se descontaron <b>' + p.cantidad + '</b> ' + esc(unidadPlan(p)) + '. ¿Cuántos quedaron hechos? Lo que no, regresa a ' + esc((R.ETAPAS[p.de] || R.PIEZAS[p.de] || {}).nombre || p.de) + '.</p>' +
    '<div class="lote"><div class="quien">Se hicieron</div><div class="toma"><button class="tecla" data-menos>−</button><input id="pCant" type="number" inputmode="numeric" min="0" max="' + p.cantidad + '" value="' + p.cantidad + '"><button class="tecla" data-mas>＋</button></div></div><p class="guia" id="pResto"></p>' +
    (pinta ? '<div class="grupo-h">De qué color se pintaron</div>' + campoColor(p.color, true, "pColor") : "") +
    (regla ? '<div class="grupo-h">' + esc(regla.pregunta) + (regla.max > 1 ? " · hasta " + regla.max : "") + '</div><div class="cats" id="pQuien">' + regla.opciones.map(n => '<button class="cat' + (quien.includes(n) ? " on" : "") + '" data-n="' + esc(n) + '">' + esc(n) + '</button>').join("") + '</div>' : "") +
    '<p class="sin-hallar" id="pError" hidden></p><button class="btn vino grande" id="pOk" style="margin-top:12px">Confirmar</button>',
    h => {
      const inp = h.querySelector("#pCant");
      const revisa = () => { const v = Number(inp.value) || 0; const mal = v < 0 || v > p.cantidad; inp.classList.toggle("mal", mal); h.querySelector("#pResto").textContent = v < p.cantidad ? (p.cantidad - v) + " regresan a " + ((R.ETAPAS[p.de] || R.PIEZAS[p.de] || {}).nombre || p.de) : ""; const colorOk = !pinta || !!h.querySelector("#pColor").value || v === 0; h.querySelector("#pOk").disabled = mal || (v > 0 && regla && !quien.length) || !colorOk; };
      h.querySelector("[data-menos]").onclick = () => { inp.value = Math.max(0, (Number(inp.value) || 0) - 1); revisa(); };
      h.querySelector("[data-mas]").onclick = () => { inp.value = Math.min(p.cantidad, (Number(inp.value) || 0) + 1); revisa(); };
      inp.oninput = revisa; const pc = h.querySelector("#pColor"); if (pc) pc.onchange = revisa;
      h.querySelectorAll("#pQuien [data-n]").forEach(b => b.onclick = () => { const n = b.dataset.n; if (quien.includes(n)) quien = quien.filter(x => x !== n); else if (regla.max === 1) quien = [n]; else if (quien.length < regla.max) quien.push(n); else return grita("Máximo " + regla.max); h.querySelectorAll("#pQuien [data-n]").forEach(x => x.classList.toggle("on", quien.includes(x.dataset.n))); revisa(); });
      revisa();
      h.querySelector("#pOk").onclick = async () => {
        const v = Number(inp.value) || 0; const extra = {};
        if (pinta && v > 0) extra.color = h.querySelector("#pColor").value;
        if (regla && v > 0){ E.ultimoQuien[p.a] = { nombres: quien.slice(), t: Date.now() }; if (regla.campo === "armo") extra.armo = quien[0]; else if (regla.campo === "pinto") extra.pinto = quien.slice(); else if (regla.campo === "preparo") extra.preparo = quien[0]; else extra.hecho_por = quien.join(" y "); }
        try { const r = await Almacen.planListo(p.id, v, extra, E.yo, origen()); if (p.a === "armado" && extra.armo && r.hechas) anotaTrabajo("armado", extra.armo, modeloDe(p.modelo_id) || { nombre: p.modelo, familia: p.modelo.split(" ")[0] }, p.color, r.hechas); cierraHoja(); grita(r.hechas ? r.hechas + " " + unidadPlan(p) + " → " + ((R.ETAPAS[p.a] || R.PIEZAS[p.a] || {}).nombre || p.a).toLowerCase() + (r.sobran ? " · " + r.sobran + " regresaron" : "") : "Todo regresó al inventario"); pintaTodo(); }
        catch(e){ const err = h.querySelector("#pError"); err.hidden = false; err.textContent = e.message; }
      };
    });
}
function hojaPlanCambia(p){
  if (!p || !exigeYo()) return;
  const o = (p.tipo === "lote" ? E.lotes : E.piezas).find(x => x.id === p.origen_id); const disponible = o ? Number(o.cantidad || 0) : 0;
  abreHoja('<h3>Cambiar cantidad</h3><p class="guia"><b>' + esc(p.modelo) + '</b> · ' + esc(nombreColor(p.color)) + ' · ahora hay <b>' + p.cantidad + '</b> en el plan y quedan ' + disponible + ' en ' + esc((R.ETAPAS[p.de] || R.PIEZAS[p.de] || {}).nombre || p.de) + '.</p>' +
    '<label class="campo"><span>Cantidad en el plan</span><input id="cCant" type="number" inputmode="numeric" min="1" max="' + (p.cantidad + disponible) + '" value="' + p.cantidad + '"></label>' +
    '<p class="sin-hallar" id="cError" hidden></p><button class="btn vino grande" id="cOk">Guardar</button>',
    h => {
      h.querySelector("#cCant").focus(); h.querySelector("#cCant").select();
      h.querySelector("#cOk").onclick = async () => {
        try { await Almacen.planCambia(p.id, Number(h.querySelector("#cCant").value), E.yo, origen()); cierraHoja(); grita("Cambiado"); pintaTodo(); }
        catch(e){ const err = h.querySelector("#cError"); err.hidden = false; err.textContent = e.message; }
      };
    });
}
/* Desde Reportes: descontar del inventario al Plan del día */
function hojaDescontar(tipo, id, despues){
  if (!exigeYo()) return;
  const x = (tipo === "lote" ? E.lotes : E.piezas).find(y => y.id === id); if (!x) return grita("Eso ya no está");
  const a = destinoPlan(tipo, x); if (!a) return;
  const n = tipo === "lote" ? Number(x.cantidad || 0) : vivoPieza(x);
  const de = tipo === "lote" ? x.etapa : x.categoria;
  const m = modeloDe(x.modelo_id); const por = tipo === "pieza" ? (R.piezasPorMueble(m, de) || 0) : 0;
  let enJuegos = tipo === "pieza" && E.porJuego && por > 1 && n >= por;
  const tope = () => enJuegos ? Math.floor(n / por) : n;
  const sinBisagras = de === "puertas_lijadas";
  abreHoja('<h3>Descontar al plan del día</h3>' +
    '<div class="paso-a"><span class="de">' + esc((R.ETAPAS[de] || R.PIEZAS[de] || {}).nombre || de) + '</span> → <span class="a">' + esc(nombrePlan(a)) + '</span></div>' +
    '<p class="guia"><b>' + esc(x.modelo) + '</b> · ' + esc(nombreColor(x.color)) + (tipo === "lote" ? " · " + esc(R.firmaDe(x)) : "") + ' · hay <b>' + n + '</b>. Baja del inventario ahora y queda pendiente en Plan del día hasta que se marque listo.</p>' +
    (por > 1 ? '<div class="cats" id="pUnidad" style="margin-bottom:8px"><button class="cat' + (enJuegos ? "" : " on") + '" data-u="piezas">Por pieza</button><button class="cat' + (enJuegos ? " on" : "") + '" data-u="juegos"' + (n < por ? " disabled" : "") + '>Por juego (' + por + ')</button></div>' : "") +
    '<div class="lote"><div class="quien" id="pCuantas">' + (enJuegos ? "Cuántos juegos" : "Cuántas") + '</div><div class="toma"><button class="tecla" data-menos>−</button><input id="pCant" type="number" inputmode="numeric" min="1" max="' + tope() + '" value="' + tope() + '"><button class="tecla" data-mas>＋</button></div></div><p class="guia" id="pEq"></p>' +
    (sinBisagras ? '<div class="candado" style="margin:8px 0"><span>Estas puertas <b>no tienen bisagras</b>. ¿Autorizas que se pinten así?</span></div><label class="interruptor" style="margin-bottom:8px"><input type="checkbox" id="pAut"><span>Sí, autorizo pintarlas sin bisagras</span></label>' : "") +
    '<p class="sin-hallar" id="pError" hidden></p><button class="btn vino grande" id="pOk" style="margin-top:12px">Descontar</button>',
    h => {
      const inp = h.querySelector("#pCant");
      const piezasDe = () => (Number(inp.value) || 0) * (enJuegos ? por : 1);
      const revisa = () => { const v = Number(inp.value) || 0, t = tope(); inp.classList.toggle("mal", v > t || v < 1); h.querySelector("#pEq").textContent = enJuegos ? "= " + piezasDe() + " " + R.PIEZAS[de].unidad : (por > 1 && v > 0 ? R.textoEquivalencia(v, de, m).replace(/^[^=·]*/, "") : ""); const aut = !sinBisagras || h.querySelector("#pAut").checked; h.querySelector("#pOk").disabled = v > t || v < 1 || !aut; };
      h.querySelectorAll("#pUnidad [data-u]").forEach(b => b.onclick = () => { enJuegos = b.dataset.u === "juegos"; h.querySelectorAll("#pUnidad [data-u]").forEach(y => y.classList.toggle("on", y === b)); h.querySelector("#pCuantas").textContent = enJuegos ? "Cuántos juegos" : "Cuántas"; inp.max = tope(); inp.value = Math.min(Number(inp.value) || 1, tope()) || 1; revisa(); });
      h.querySelector("[data-menos]").onclick = () => { inp.value = Math.max(1, (Number(inp.value) || 0) - 1); revisa(); };
      h.querySelector("[data-mas]").onclick = () => { inp.value = Math.min(tope(), (Number(inp.value) || 0) + 1); revisa(); };
      inp.oninput = revisa; const au = h.querySelector("#pAut"); if (au) au.onchange = revisa;
      revisa();
      h.querySelector("#pOk").onclick = async () => {
        try {
          await Almacen.alPlan({ tipo, origen_id: id, cantidad: piezasDe(), a, juegos: enJuegos ? Number(inp.value) : null, autorizo: sinBisagras ? "sin bisagras, autorizó " + E.yo : "" }, E.yo, origen());
          cierraHoja(); grita(piezasDe() + " al plan del día: " + nombrePlan(a).toLowerCase()); pintaTodo();
        } catch(e){ const err = h.querySelector("#pError"); err.hidden = false; err.textContent = e.message; }
      };
    });
}

/* ═══════════════ REVISAR NOMBRES (migración) ═══════════════ */
function limpiaNombre(n){ return String(n || "").replace(/\(\?\)|\(genérico\)|\(generico\)/gi, "").replace(/\b(de\s+)?\d+\s+cajones\b/gi, "").replace(/\s+/g, " ").trim(); }
function sugiereModelo(nombre, lista){
  const n = sinAcento(limpiaNombre(nombre));
  if (/librero/.test(n)){ const mc = lista.find(m => /monte carlos 75/i.test(sinAcento(m.nombre))); if (mc) return mc; }
  const exacto = lista.find(m => sinAcento(m.nombre) === n); if (exacto) return exacto;
  if (/^petaquero /.test(n)){ const pm = lista.find(m => sinAcento(m.nombre) === n + " multifamiliar"); if (pm) return pm; }
  return Busca.busca(limpiaNombre(nombre), lista, m => m.nombre)[0] || null;
}
function revisionNombres(){
  const idsGuacal = ((window.CARGA_GUACALES || {}).guacales || []).map(g => g.id);
  const esGuacalId = id => idsGuacal.includes(id) || R.esGuacal(modeloDe(id));
  const activos = modelosActivos().filter(m => !R.esExtra(m) && !m.pendiente && !/\(gen[eé]rico\)|\(\?\)/i.test(m.nombre));
  const porNombre = {};
  const toma = (nombre, donde, modelo_id) => { const k = sinAcento(nombre); (porNombre[k] = porNombre[k] || { nombre, pedidos: 0, lotes: 0, piezas: 0, modelo_id: modelo_id || null, cantidad: 0 }); porNombre[k][donde]++; if (modelo_id) porNombre[k].modelo_id = modelo_id; };
  const esBueno = n => activos.some(m => sinAcento(m.nombre) === sinAcento(n));
  E.pedidos.forEach(p => lineasDe(p).forEach(x => { if (!x.surtido && x.modelo && !esBueno(x.modelo)) toma(x.modelo, "pedidos"); }));
  E.lotes.filter(l => Number(l.cantidad) > 0 && !esGuacalId(l.modelo_id)).forEach(l => { if (!esBueno(l.modelo) || (modeloDe(l.modelo_id) || {}).pendiente){ toma(l.modelo, "lotes", l.modelo_id); porNombre[sinAcento(l.modelo)].cantidad += Number(l.cantidad); } });
  E.piezas.filter(p => vivoPieza(p) > 0 && !esGuacalId(p.modelo_id)).forEach(p => { if (!esBueno(p.modelo) || (modeloDe(p.modelo_id) || {}).pendiente){ toma(p.modelo, "piezas", p.modelo_id); porNombre[sinAcento(p.modelo)].cantidad += vivoPieza(p); } });
  E.modelos.filter(m => m.activo !== false && !R.esExtra(m) && !esGuacalId(m.id) && (m.pendiente || /\(gen[eé]rico\)|\(\?\)/i.test(m.nombre))).forEach(m => { if (!porNombre[sinAcento(m.nombre)]) toma(m.nombre, "lotes", m.id), porNombre[sinAcento(m.nombre)].lotes = 0; });
  return Object.values(porNombre).map(x => Object.assign(x, { sugerido: sugiereModelo(x.nombre, activos.filter(m => m.id !== x.modelo_id)) })).sort((a,b) => sinAcento(a.nombre) < sinAcento(b.nombre) ? -1 : 1);
}
function tarjetaRevisarNombres(){
  const n = revisionNombres().length;
  return '<div class="' + (n ? "aviso" : "ajuste") + '"><' + (n ? "b" : "h4") + '>Revisar nombres' + (n ? " · " + plural(n, "nombre que no cuadra", "nombres que no cuadran") : " · todo cuadra") + '</' + (n ? "b" : "h4") + '><p>Busca en pedidos, muebles y piezas los nombres que no están tal cual en el catálogo (por la migración de la libreta) y los pasa al modelo correcto: lo que haya en inventario se junta con el modelo bueno y los genéricos se desactivan.</p><div class="pie"><button class="btn ' + (n ? "vino" : "") + '" id="ajNombres">Revisar</button></div></div>';
}
function hojaRevisarNombres(){
  if (!exigeYo()) return;
  const lista = revisionNombres();
  const activos = modelosActivos().filter(m => !R.esExtra(m));
  const opciones = (sel, excluir) => '<option value="">— dejar así —</option>' + activos.filter(m => m.id !== excluir).map(m => '<option value="' + esc(m.id) + '"' + (sel && sel.id === m.id ? " selected" : "") + '>' + esc(m.nombre) + (m.pendiente ? " (por revisar)" : "") + '</option>').join("");
  abreHoja('<h3>Revisar nombres</h3><p class="guia">Cada renglón es un nombre que no está tal cual en el catálogo. Escoge a qué modelo del catálogo corresponde y toca <b>Aplicar</b>. Si no estás seguro, déjalo así.</p>' +
    (lista.length ? '<div class="lotes">' + lista.map((x, i) => '<div class="lote rev" data-i="' + i + '"><div class="quien"><b>' + esc(x.nombre) + '</b><small>' + [x.pedidos ? plural(x.pedidos, "renglón de pedido", "renglones de pedido") : "", x.lotes ? plural(x.lotes, "lote", "lotes") : "", x.piezas ? plural(x.piezas, "pieza", "piezas") + " (" + x.cantidad + ")" : "", (!x.pedidos && !x.lotes && !x.piezas) ? "modelo genérico sin existencias" : ""].filter(Boolean).join(" · ") + '</small>' +
      '<select class="rev-a">' + opciones(x.sugerido, x.modelo_id) + '</select></div><div class="disp"><button class="btn vino chico" data-aplica="' + i + '"' + (x.sugerido ? "" : " disabled") + '>Aplicar</button></div></div>').join("") + '</div>'
      : '<div class="vacio"><b>Todo cuadra</b><p>No hay nombres fuera del catálogo.</p></div>') +
    '<button class="btn fantasma grande" id="rvCerrar" style="margin-top:10px">Cerrar</button>',
    h => {
      h.querySelector("#rvCerrar").onclick = cierraHoja;
      h.querySelectorAll(".rev-a").forEach(sel => sel.onchange = () => { const f = sel.closest(".lote"); f.querySelector("[data-aplica]").disabled = !sel.value; });
      h.querySelectorAll("[data-aplica]").forEach(b => b.onclick = async () => {
        const x = lista[Number(b.dataset.aplica)]; const aId = b.closest(".lote").querySelector(".rev-a").value; if (!aId) return;
        const a = modeloDe(aId);
        if (!confirm("«" + x.nombre + "» → «" + a.nombre + "». Se cambian pedidos, muebles y piezas. ¿Seguro?")) return;
        b.disabled = true; b.textContent = "…";
        try { const n = await Almacen.fusionaModelo({ nombre: x.nombre, modelo_id: x.modelo_id }, aId, E.yo, origen()); grita("Listo: " + plural(n, "renglón corregido", "renglones corregidos")); b.closest(".lote").remove(); pintaTodo(); }
        catch(e){ grita(e.message); b.disabled = false; b.textContent = "Aplicar"; }
      });
    });
}
function tarjetaArreglo(){
  const C = window.CARGA_ARREGLO; if (!C) return "";
  const hecha = Almacen.cargaHecha(C.id);
  const puede = Almacen.practica || (Almacen.modo === "nube" && Almacen.sesion);
  return '<div class="' + (hecha ? "ajuste" : "aviso") + '"><' + (hecha ? "h4" : "b") + '>' + esc(C.titulo) + (hecha ? " · ya se aplicó" : "") + '</' + (hecha ? "h4" : "b") + '><p>' +
    (hecha ? "Se aplicó " + esc(cuando(Almacen.dame("meta", C.id).hecho)) + " por " + esc(Almacen.dame("meta", C.id).por || "?") + "."
           : "Lo que el taller aclaró de los pedidos ya cargados: Monte Carlos 75, Petaquero Mónaco Multifamiliar, el Mariana Rejilla Mixta de Josefina y sus entregas (2 Midas, 1 Mónaco), se quita la «base óvalo» de Sabino y los «surtido» quedan como surtido.") + '</p>' +
    (hecha ? "" : '<div class="pie"><button class="btn vino" id="ajArreglo"' + (puede ? "" : " disabled") + '>Aplicar ahora</button></div>') + '</div>';
}
/* Lo que se movió por error el 6 de octubre en Puertas pintadas (se busca en la bitácora real) */
const ARREGLO_PUERTAS_ID = "arreglo-puertas-2026-10-06";
function movimientosDel6(){
  return E.movimientos.filter(m => (m.creado || "").slice(0, 10) === "2026-10-06" && sinAcento(m.persona || "") === "marisol" && !m.deshecho && (
    (m.tipo === "ajuste" && m.categoria === "puertas_pintadas" && /se prepararon|error/i.test(m.motivo || "")) ||
    (m.tipo === "traslado" && m.pieza_id && /kukis/i.test(m.nombre || "") && ["puertas_lijadas_bisagras", "puertas_pintadas"].includes(m.etapa_a))
  )).sort((a,b) => a.creado < b.creado ? 1 : -1);
}
function tarjetaArregloPuertas(){
  const hecha = Almacen.cargaHecha(ARREGLO_PUERTAS_ID); const ms = movimientosDel6();
  if (hecha && !ms.length) return "";
  return '<div class="' + (ms.length ? "aviso" : "ajuste") + '"><' + (ms.length ? "b" : "h4") + '>Regresar las correcciones del 6 de octubre' + (ms.length ? " · " + plural(ms.length, "movimiento", "movimientos") : " · nada pendiente") + '</' + (ms.length ? "b" : "h4") + '><p>Busca en la bitácora lo que Marisol movió ese día en Puertas pintadas («Se prepararon», «Error» y los traslados de las Kukis) y lo regresa tal como estaba, del más nuevo al más viejo. Te muestra la lista antes de hacerlo.</p>' +
    (ms.length ? '<div class="pie"><button class="btn vino" id="ajPuertas">Ver y regresar</button></div>' : "") + '</div>';
}
function hojaArregloPuertas(){
  if (!exigeYo()) return;
  const ms = movimientosDel6(); if (!ms.length) return grita("No hay nada que regresar");
  abreHoja('<h3>Regresar las correcciones del 6 de octubre</h3><p class="guia">Estos ' + ms.length + ' movimientos se van a deshacer (del más nuevo al más viejo). Lo que se restó vuelve a sumarse y lo que se sumó vuelve a restarse.</p>' +
    '<div class="bitacora" style="max-height:50vh;overflow:auto">' + ms.map(lineaMov).join("").replace(/<button[^>]*data-deshaz[^>]*>Deshacer<\/button>/g, "") + '</div>' +
    '<p class="sin-hallar" id="apError" hidden></p><button class="btn vino grande" id="apOk" style="margin-top:12px">Sí, regresar todo</button><button class="btn fantasma grande" id="apNo" style="margin-top:8px">Cancelar</button>',
    h => {
      h.querySelector("#apNo").onclick = cierraHoja;
      h.querySelector("#apOk").onclick = async () => {
        h.querySelector("#apOk").disabled = true; h.querySelector("#apOk").textContent = "Regresando…";
        let ok = 0; const fallas = [];
        for (const m of ms){ try { await Almacen.deshaz(m.id, E.yo, origen()); ok++; } catch(e){ fallas.push(descMov(m).titulo.replace(/<[^>]+>/g, "") + ": " + e.message); } }
        if (!fallas.length) await Almacen.pon("meta", { id: ARREGLO_PUERTAS_ID, hecho: new Date().toISOString(), por: E.yo, renglones: ok });
        cierraHoja(); pintaTodo();
        if (fallas.length) alert("Regresaron " + ok + ". No se pudieron " + fallas.length + ":\n" + fallas.join("\n")); else grita("Listo: " + plural(ok, "movimiento regresado", "movimientos regresados"));
      };
    });
}
/* ── Guacales compartidos (datos/carga-inicial.js → CARGA_GUACALES) ── */
function tarjetaGuacales(){
  const G = window.CARGA_GUACALES; if (!G) return "";
  const pv = Almacen.previaGuacales(G); const pend = pv.filter(x => !x.yaEs || x.variantes.length);
  if (!pend.length) return '<div class="ajuste"><h4>Guacales compartidos · activos</h4><p>' + esc(pv.map(x => x.g.nombre).join(", ")) + ' son guacales: sus muebles pintados sirven para los modelos que los usan (las puertas hacen el modelo). Se cambia en la ficha del guacal: ahí se marcan los modelos que se arman con él.</p></div>';
  return '<div class="aviso"><b>' + esc(G.titulo) + '</b><p>Según la lista de precios, «Mariana 3 cajones», «Mariana 2 lunas y 6 cajones» y «Petaquero Multifamiliar 1 pieza» son UN guacal para varios modelos. Los genéricos de la carga se vuelven ese guacal y cada modelo queda ligado: así a un guacal pintado se le cuelgan las puertas de Abanico, Cisne, Rombo… Hazlo ANTES de «Revisar nombres».</p><div class="pie"><button class="btn vino" id="ajGuacales">Ver y activar</button></div></div>';
}
function hojaGuacales(){
  if (!exigeYo()) return;
  const G = window.CARGA_GUACALES; const pv = Almacen.previaGuacales(G);
  abreHoja('<h3>' + esc(G.titulo) + '</h3><p class="guia">Esto es lo que va a cambiar. Nada se borra ni se mueve de etapa; solo cambian nombres y la liga guacal → modelos.</p>' +
    '<div class="lotes">' + pv.map(x => '<div class="lote" style="display:block"><div class="quien">' + (x.nombreViejo && x.nombreViejo !== x.g.nombre ? esc(x.nombreViejo) + ' → ' : "") + '<b>' + esc(x.g.nombre) + '</b><small>' + (x.existe ? "ya existe en la base" + (x.lotes ? " · " + plural(x.lotes, "mueble", "muebles") + " en inventario" : "") : "se crea en el catálogo") + (x.yaEs ? " · ya es guacal" : "") + '</small>' +
      '<small>' + (x.variantes.length ? "Se ligan: " + esc(x.variantes.map(m => m.nombre).join(", ")) : "Todos sus modelos ya están ligados") + '</small>' +
      (x.g.variantes.filter(n => !modelosActivos().some(m => sinAcento(m.nombre) === sinAcento(n))).length ? '<small style="color:var(--ambar)">No están en el catálogo (no se inventan): ' + esc(x.g.variantes.filter(n => !modelosActivos().some(m => sinAcento(m.nombre) === sinAcento(n))).join(", ")) + '</small>' : "") + '</div></div>').join("") + '</div>' +
    '<p class="sin-hallar" id="gError" hidden></p><button class="btn vino grande" id="gOk" style="margin-top:12px">Activar</button><button class="btn fantasma grande" id="gNo" style="margin-top:8px">Cancelar</button>',
    h => {
      h.querySelector("#gNo").onclick = cierraHoja;
      h.querySelector("#gOk").onclick = async () => {
        h.querySelector("#gOk").disabled = true;
        try { const n = await Almacen.aplicaGuacales(G, E.yo, origen()); cierraHoja(); pintaTodo(); grita("Listo: " + plural(n, "modelo ligado", "modelos ligados") + " a su guacal"); }
        catch(e){ const err = h.querySelector("#gError"); err.hidden = false; err.textContent = e.message; h.querySelector("#gOk").disabled = false; }
      };
    });
}
/* ── Colores lisos: lo que tenga un color combinado pasa al color liso de esa parte ── */
const COLORES_ID = "colores-lisos-2026-10-06";
function tarjetaColores(){
  const cambios = Almacen.previaColores();
  if (!cambios.length) return Almacen.cargaHecha(COLORES_ID) ? '<div class="ajuste"><h4>Colores lisos · listo</h4><p>Muebles, puertas, cajones y parches solo llevan un color liso. Las combinaciones («Negro puertas grises») se escogen en el pedido y al preparar se decide de qué color va cada parte.</p></div>' : "";
  return '<div class="aviso"><b>Simplificar colores · ' + plural(cambios.length, "renglón", "renglones") + '</b><p>Muebles, puertas, cajones y parches ahora solo llevan un color liso (Negro, Café, Gris…). Lo que está con una combinación («Negro completo», «Negro puertas grises») pasa al color de ESA parte: el mueble a Negro, las puertas a Gris. Los pedidos no cambian. Te muestra la lista antes de hacerlo.</p><div class="pie"><button class="btn vino" id="ajColores">Ver y simplificar</button></div></div>';
}
function hojaColores(){
  if (!exigeYo()) return;
  const cambios = Almacen.previaColores(); if (!cambios.length) return grita("No hay colores que simplificar");
  const donde = c => (R.ETAPAS[c.donde] || R.PIEZAS[c.donde] || {}).nombre || c.donde;
  abreHoja('<h3>Simplificar colores</h3><p class="guia">Estos ' + cambios.length + ' renglones cambian de color. Lo que quede con el mismo color se suma en un solo renglón.</p>' +
    '<div class="lotes" style="max-height:50vh;overflow:auto">' + cambios.map(c => '<div class="lote"><div class="quien">' + esc(c.modelo) + '<small>' + esc(donde(c)) + ' · ' + esc(c.de) + ' → <b>' + esc(c.a) + '</b></small></div><div class="disp"><b>' + c.cantidad + '</b></div></div>').join("") + '</div>' +
    '<p class="sin-hallar" id="cError" hidden></p><button class="btn vino grande" id="cOk" style="margin-top:12px">Sí, simplificar</button><button class="btn fantasma grande" id="cNo" style="margin-top:8px">Cancelar</button>',
    h => {
      h.querySelector("#cNo").onclick = cierraHoja;
      h.querySelector("#cOk").onclick = async () => {
        h.querySelector("#cOk").disabled = true;
        try { const n = await Almacen.simplificaColores(COLORES_ID, E.yo, origen()); cierraHoja(); pintaTodo(); grita("Listo: " + plural(n, "renglón", "renglones") + " con color liso"); }
        catch(e){ const err = h.querySelector("#cError"); err.hidden = false; err.textContent = e.message; h.querySelector("#cOk").disabled = false; }
      };
    });
}
async function aplicaArreglo(){
  if (!exigeYo()) return;
  const C = window.CARGA_ARREGLO; if (!C || Almacen.cargaHecha(C.id)) return;
  if (!confirm("¿Aplicar las correcciones a los pedidos?")) return;
  const n = await Almacen.arreglaPedidos(C, E.yo);
  pintaTodo(); grita("Listo: " + plural(n, "renglón corregido", "renglones corregidos"));
}

/* ═══════════════ detalle (computadora) ═══════════════ */
function pintaDetalle(){
  const caja = $("#detalle"); const s = E.sel;
  if (!s){ caja.innerHTML = '<div class="detalle-vacio">Escoge un renglón para ver su detalle</div>'; return; }
  if (s.tipo === "mueble" && E.vista === "muebles"){ caja.innerHTML = htmlDetalleMueble(); montaDetalleMueble(caja); }
  else if (s.tipo === "pieza" && E.vista === "piezas"){ caja.innerHTML = htmlDetallePieza(); montaDetallePieza(caja); }
  else if (s.tipo === "material" && E.vista === "material"){ caja.innerHTML = htmlDetalleMaterial(); montaDetalleMaterial(caja); }
  else if (s.tipo === "listo" && E.vista === "listos"){ caja.innerHTML = htmlDetalleListo(); montaDetalleListo(caja); }
  else caja.innerHTML = '<div class="detalle-vacio">Escoge un renglón para ver su detalle</div>';
}

/* ═══════════════ hoja deslizante ═══════════════ */
function abreHoja(html, montar){
  $("#panel").innerHTML = '<div class="asa"></div>' + html;
  $("#telon").classList.add("on"); document.body.style.overflow = "hidden";
  if (montar) montar($("#panel"));
}
function cierraHoja(){ paraLector(); $("#telon").classList.remove("on"); $("#panel").innerHTML = ""; document.body.style.overflow = ""; }
function cierraDesdeAfuera(){ const r = E.resolverQuien; E.resolverQuien = null; cierraHoja(); if (r) r(); }
$("#telon").addEventListener("click", e => { if (e.target.id === "telon") cierraDesdeAfuera(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#telon").classList.contains("on")) cierraDesdeAfuera(); });

/* ═══════════════ navegación ═══════════════ */
const VISTAS = ["plan","muebles","piezas","listos","pedidos","material","reportes","recados","bitacora","catalogo","apodos","ajustes"];
const EN_MAS = ["listos","reportes","recados","bitacora","catalogo","apodos","ajustes"];
function irA(v){
  if (v === "mas"){ hojaMas(); return; }
  E.vista = v;
  $$(".vista").forEach(s => s.classList.toggle("on", s.id === "v-" + v));
  $$("[data-vista]").forEach(b => b.classList.toggle("on", b.dataset.vista === v || (EN_MAS.includes(v) && b.dataset.vista === "mas")));
  if (location.hash !== "#" + v) history.replaceState(null, "", "#" + v);
  window.scrollTo(0, 0);
  pintaVista(v); if (esEscritorio()) pintaDetalle();
}
function pintaVista(v){
  if (v === "plan") pintaPlan(); else if (v === "muebles") pintaMuebles(); else if (v === "piezas") pintaPiezas(); else if (v === "listos") pintaListos(); else if (v === "pedidos") pintaPedidos();
  else if (v === "material") pintaMaterial(); else if (v === "recados") pintaRecados(); else if (v === "bitacora") pintaBitacora();
  else if (v === "catalogo") pintaCatalogo(); else if (v === "apodos") pintaCatMaterial(); else if (v === "ajustes") pintaAjustes(); else if (v === "reportes") (E.reporteAbierto ? abreReporte(E.reporteAbierto.cual, E.reporteAbierto.seccion) : pintaReportes());
}
function hojaMas(){
  const rec = E.recados.filter(r => !r.hecho).length;
  abreHoja('<h3>Más</h3><div style="display:grid;gap:8px">' +
    '<button class="btn grande" data-ir="listos">Listos para preparar</button>' +
    '<button class="btn grande" data-ir="reportes">Reportes · muebles, pintura, pedidos, semana</button>' +
    '<button class="btn grande" data-ir="recados">Recados' + (rec ? " · " + rec + " sin atender" : "") + '</button>' +
    '<button class="btn grande" data-ir="bitacora">Bitácora · quién hizo qué</button>' +
    '<button class="btn grande" data-ir="catalogo">Catálogo · fichas de los modelos</button>' +
    '<button class="btn grande" data-ir="apodos">Catálogo de material · litros, nombres y apodos</button>' +
    '<button class="btn grande" data-ir="ajustes">Ajustes</button></div>',
    p => p.querySelectorAll("[data-ir]").forEach(b => b.onclick = () => { cierraHoja(); irA(b.dataset.ir); }));
}
$$("[data-vista]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); irA(b.dataset.vista); }));
$("#yoLat").onclick = hojaQuienSoy; $("#yoCel").onclick = hojaQuienSoy;
$$("[data-registrar]").forEach(b => b.onclick = () => b.dataset.registrar === "mueble" ? registrarMueble() : registrarPieza());
$$("[data-nuevo]").forEach(b => b.onclick = () => hojaProducto());
$$("[data-nuevo-pedido]").forEach(b => b.onclick = () => hojaPedido());
$$("[data-barras]").forEach(b => b.onclick = hojaBarras);
$("#btnRecado").onclick = async () => { const i = $("#recTexto"); await ponRecado(i.value); i.value = ""; };
$("#recTexto").onkeydown = e => { if (e.key === "Enter") $("#btnRecado").click(); };
$("#salirPractica").onclick = async () => { await Almacen.setPractica(false); pintaPulso(); pintaTodo(); };
$("#formEntrada").onsubmit = async e => {
  e.preventDefault(); const m = $("#entMsg"); m.textContent = "Entrando…";
  try { await Almacen.entra($("#entMail").value.trim(), $("#entPass").value); m.textContent = ""; pintaPulso(); pintaTodo(); }
  catch(err){ m.textContent = /Invalid|wrong-password|invalid-credential|user-not-found/i.test((err.message || "") + (err.code || "")) ? "Correo o contraseña incorrectos." : "No se pudo entrar: " + (err.message || "revisa tu señal"); }
};
window.addEventListener("resize", () => { pintaTodo(); });
const temaGuardado = localStorage.getItem("alm.tema"); if (temaGuardado) document.documentElement.dataset.theme = temaGuardado;

function pintaTodo(){
  VISTAS.forEach(v => { if (v !== "ajustes" && v !== "reportes") pintaLupa(v); });
  pintaVista(E.vista);
  // Los globos de la barra lateral se calculan aunque la vista no esté abierta
  const total = calculaListos().reduce((s,x) => s + x.listos, 0) + gruposMueble("preparado").filter(g => R.faltanPartes(modeloDe(g.modelo_id), g).length).reduce((s,g) => s + g.total, 0); $("#nListos").hidden = !total; $("#nListos").textContent = total;
  const pend = E.pedidos.filter(p => p.estado !== "entregado").length; $("#nPed").hidden = !pend; $("#nPed").textContent = pend;
  const bajos = materiales().filter(p => estado(p)).length; $("#nMat").hidden = !bajos; $("#nMat").textContent = bajos;
  const rec = E.recados.filter(r => !r.hecho).length; $("#nRec").hidden = !rec; $("#nRec").textContent = rec;
  $("#nPlan").hidden = !E.plan.length; $("#nPlan").textContent = E.plan.length;
  if (esEscritorio()) pintaDetalle();
}

/* ═══════════════ actualización de la app ═══════════════ */
let swNuevo = null;
async function buscaActualizacion(){
  grita("Buscando la versión nueva…");
  try {
    if ("caches" in window){ const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
    if ("serviceWorker" in navigator){ const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); }
  } catch(e){}
  location.replace(location.pathname + "?v=" + Date.now());
}
if ("serviceWorker" in navigator && location.protocol !== "file:"){
  navigator.serviceWorker.register("sw.js").then(r => {
    r.addEventListener("updatefound", () => {
      const w = r.installing; if (!w) return;
      w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller){ swNuevo = w; $("#actualiza").hidden = false; } });
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (E.actualizando) location.reload(); });
  $("#btnActualiza").onclick = () => { E.actualizando = true; if (swNuevo) swNuevo.postMessage("activa"); else location.reload(); };
}

/* ═══════════════ arranque ═══════════════ */
$("#versionLat").textContent = "Almacén · " + ((window.CONFIG || {}).VERSION || "").split(" · ")[0];
pintaYo();
Almacen.mira("modelo", l => { E.modelos = l; pintaTodo(); });
Almacen.mira("lote", l => { E.lotes = l; pintaTodo(); });
Almacen.mira("pieza", l => { E.piezas = l; pintaTodo(); });
Almacen.mira("producto", l => { E.productos = l; pintaTodo(); });
Almacen.mira("movimiento", l => { E.movimientos = l; if (["bitacora"].includes(E.vista) || esEscritorio()) pintaTodo(); });
Almacen.mira("recado", l => { E.recados = l; if (E.vista === "recados") pintaRecados(); const n = l.filter(r => !r.hecho).length; $("#nRec").hidden = !n; $("#nRec").textContent = n; });
Almacen.mira("persona", l => { E.personas = l; });
Almacen.mira("meta", () => { if (E.vista === "ajustes") pintaAjustes(); });
Almacen.mira("pedido", l => { E.pedidos = l; if (E.vista === "pedidos") pintaPedidos(); const n = l.filter(p => p.estado !== "entregado").length; $("#nPed").hidden = !n; $("#nPed").textContent = n; });
Almacen.mira("plan", l => { E.plan = l; if (E.vista === "plan") pintaPlan(); $("#nPlan").hidden = !l.length; $("#nPlan").textContent = l.length; });
Almacen.onEstado(pintaPulso);
(async () => {
  await Almacen.arranca();
  pintaPulso();
  const h = (location.hash || "#plan").slice(1);
  irA(VISTAS.includes(h) ? h : "plan");
  Almacen.limpiaSemana().then(n => { if (n) console.log("limpieza semanal:", n); }).catch(() => {});
  if (!E.yo && !Almacen.necesitaEntrar()) hojaQuienSoy();
})();
