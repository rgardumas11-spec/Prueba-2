/* ═══════════════════════════════════════════════════════════════════════════
   Almacén San Bernardo — la pantalla.
   Muebles y material con − y +, búsqueda guiada (lupa → qué ver → nombre),
   recados, bitácora, apodos y litros, ajustes con modo práctica y
   diagnóstico del aparato. Celular y computadora con el mismo código.
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";

/* ── utilidades ── */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sinAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const iniciales = n => String(n || "?").trim().split(/\s+/).map(p => p[0]).join("").slice(0,2).toUpperCase();
const CAT = window.CATALOGO || {};
const esEscritorio = () => matchMedia("(min-width:1024px)").matches;
const esApple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function reloj(iso){ return new Date(iso).toLocaleTimeString("es-MX", {hour:"2-digit", minute:"2-digit"}); }
function cuando(iso){
  const d = Math.floor((Date.now() - new Date(iso).getTime())/1000);
  if (d < 60) return "ahorita";
  if (d < 3600) return "hace " + Math.floor(d/60) + " min";
  if (d < 86400) return "hoy " + reloj(iso);
  if (d < 172800) return "ayer " + reloj(iso);
  return new Date(iso).toLocaleDateString("es-MX", {day:"numeric", month:"short"});
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
  clearTimeout(relojGrito); relojGrito = setTimeout(() => g.classList.remove("on"), 2600);
};
const TINTES = { negro:"#20232a", café:"#6B4A2F", cafe:"#6B4A2F", nogal:"#8A5A32", gris:"#8D9299", blanco:"#F3F3EF",
  rojo:"#A63122", rosa:"#D98BA5", azul:"#3C6FA8", amarillo:"#D9A521", crema:"#E4D6B4", "iron-man":"#A63122" };
function tinte(c){ c = sinAcento(c); for (const k in TINTES) if (c.startsWith(sinAcento(k))) return TINTES[k]; return "#9AA095"; }

/* ── estado de pantalla ── */
const E = {
  yo: localStorage.getItem("alm.yo") || "",
  vista: "muebles",
  productos: [], movimientos: [], recados: [], personas: [], pedidos: [],
  busca: { mueble: {cat:"", q:""}, material: {cat:"", q:""} },
  sel: null,
  pend: new Map(), relojes: new Map(),
  apodosCambios: new Map()
};
const origen = () => (esEscritorio() ? "computadora" : "celular");

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
  else if (Almacen.modo === "nube" && Almacen.enLinea){ t.textContent = "Compartido en vivo con el taller" + (Almacen.pendientes ? " · subiendo " + Almacen.pendientes + " pendientes" : ""); }
  else if (Almacen.modo === "nube"){ p.classList.add("sin"); t.textContent = "Sin señal: lo que hagas se guarda aquí y se sube al volver"; }
  else if (Almacen.hayNube){ p.classList.add("local"); t.textContent = "Sin sesión: guardando solo en este aparato"; }
  else { p.classList.add("local"); t.textContent = "Guardando solo en este aparato (falta conectar la base)"; }
  $("#practicaBanda").hidden = !Almacen.practica;
  $("#yoEstadoLat").textContent = Almacen.practica ? "PRÁCTICA" : (Almacen.modo === "nube" ? "EN LÍNEA" : "LOCAL");
  $("#entrada").hidden = !Almacen.necesitaEntrar();
}

/* ═══════════════ productos: ayudantes ═══════════════ */
const vivo = p => Math.max(0, Number(p.cantidad || 0) + (E.pend.get(p.id) || 0));
const titulo = p => (p.tipo === "material" && p.apodos && p.apodos[0]) ? p.apodos[0] : p.nombre;
const subtitulo = p => p.tipo === "material"
  ? [p.nombre !== titulo(p) ? p.nombre : "", p.marca, p.codigo].filter(Boolean).join(" · ")
  : [p.categoria].filter(Boolean).join(" · ");
const estado = p => { const n = vivo(p), m = Number(p.minimo || 0); return n === 0 ? "cero" : (m > 0 && n <= m ? "bajo" : ""); };
const catsDe = tipo => tipo === "material" ? (CAT.categoriasMaterial || []) : (CAT.categoriasMueble || []);
const catDe = p => p.tipo === "material" ? (p.presentacion === "Tambo" ? "Tambos" : p.presentacion === "Cubeta" ? "Cubetas" : (p.categoria || "")) : (p.categoria || "");
function coincide(p, q){
  if (!q) return true;
  const pajar = sinAcento([p.nombre, ...(p.apodos || []), p.color, p.categoria, p.codigo, p.barras, p.marca].join(" "));
  return sinAcento(q).split(/\s+/).filter(Boolean).every(w => pajar.includes(w));
}
function ultimoMov(p){
  return E.movimientos.filter(m => m.producto_id === p.id).sort((a,b) => a.creado < b.creado ? 1 : -1)[0];
}
function filtrados(tipo){
  const b = E.busca[tipo];
  let l = E.productos.filter(p => p.tipo === tipo && p.activo !== false);
  if (b.cat) l = l.filter(p => catDe(p) === b.cat);
  l = l.filter(p => coincide(p, b.q));
  const orden = ["cero","bajo",""];
  return l.sort((a,b) => (sinAcento(titulo(a)) > sinAcento(titulo(b)) ? 1 : sinAcento(titulo(a)) < sinAcento(titulo(b)) ? -1 : sinAcento(a.color) > sinAcento(b.color) ? 1 : -1));
}

/* ═══════════════ tablero ═══════════════ */
function pintaTablero(tipo){
  const caja = $(tipo === "mueble" ? "#tableroMueble" : "#tableroMaterial");
  const todos = E.productos.filter(p => p.tipo === tipo && p.activo !== false);
  const bajos = todos.filter(p => estado(p) === "bajo"), ceros = todos.filter(p => estado(p) === "cero");
  const hoy = new Date().toISOString().slice(0,10);
  const movsHoy = E.movimientos.filter(m => (m.creado || "").slice(0,10) === hoy && todos.some(p => p.id === m.producto_id));
  const ultimo = movsHoy.sort((a,b) => a.creado < b.creado ? 1 : -1)[0];
  const cuarto = tipo === "material"
    ? '<div class="tile"><small>Litros en almacén</small><b>' + Math.round(todos.reduce((s,p) => s + vivo(p) * Number(p.litros || 0), 0)) + '</b><span>en ' + todos.reduce((s,p) => s + vivo(p), 0) + ' envases</span></div>'
    : '<div class="tile"><small>Piezas en total</small><b>' + todos.reduce((s,p) => s + vivo(p), 0) + '</b><span>' + todos.length + ' artículos</span></div>';
  caja.innerHTML =
    '<div class="tile amb" data-filtro="bajo"><small>Por acabarse</small><b>' + bajos.length + '</b><span>' + esc(bajos.slice(0,3).map(titulo).join(" · ") || "ninguno") + '</span></div>' +
    '<div class="tile roj" data-filtro="cero"><small>' + (tipo === "material" ? "Sin envases" : "Sin piezas") + '</small><b>' + ceros.length + '</b><span>' + esc(ceros.slice(0,3).map(titulo).join(" · ") || "ninguno") + '</span></div>' +
    '<div class="tile ver"><small>Movimientos hoy</small><b>' + movsHoy.length + '</b><span>' + (ultimo ? "último: " + esc(ultimo.persona) + ", " + reloj(ultimo.creado) : "nada todavía") + '</span></div>' + cuarto;
  caja.querySelectorAll("[data-filtro]").forEach(t => t.onclick = () => { E.busca[tipo].q = t.dataset.filtro === "bajo" ? "" : ""; E.busca[tipo].soloEstado = t.dataset.filtro; pintaBuscador(tipo); pintaLista(tipo); });
}

/* ═══════════════ buscador guiado ═══════════════ */
function pintaBuscador(tipo){
  const caja = $(tipo === "mueble" ? "#buscadorMueble" : "#buscadorMaterial");
  const b = E.busca[tipo];
  const cats = catsDe(tipo);
  caja.innerHTML =
    '<div class="pasos">' +
      '<div class="paso"><span class="num">1</span><button class="lupa" data-lupa aria-label="Buscar"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></button><span class="titulo">¿Qué quieres ver?</span></div>' +
      '<div class="paso"><span class="num">2</span><div class="cats">' +
        '<button class="cat' + (!b.cat ? " on" : "") + '" data-cat="">' + (tipo === "material" ? "Todo el material" : "Todo") + '</button>' +
        cats.map(c => '<button class="cat' + (b.cat === c ? " on" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join("") +
      '</div></div>' +
      '<div class="paso" style="flex:1"><span class="num">3</span>' +
        '<label class="campo-busca"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h6"/></svg>' +
        '<input data-q placeholder="' + (tipo === "material" ? "Escribe el nombre o el apodo…" : "Escribe el mueble o el color…") + '" value="' + esc(b.q) + '" autocomplete="off">' +
        (b.q ? '<button class="limpia" data-limpia aria-label="Limpiar">×</button>' : "") + '</label>' +
        '<button class="btn" data-barras title="Leer código de barras"><svg viewBox="0 0 24 24"><path d="M4 5v14M8 5v14M11 5v14M15 5v14M20 5v14M18 5v14" stroke-width="1.4"/></svg><span class="solo-escritorio-inline">Código</span></button>' +
      '</div>' +
    '</div>' +
    '<p class="pista" data-pista></p>';
  caja.querySelector("[data-lupa]").onclick = () => { caja.querySelector("[data-q]").focus(); caja.scrollIntoView({block:"start", behavior:"smooth"}); };
  caja.querySelectorAll("[data-cat]").forEach(c => c.onclick = () => { b.cat = c.dataset.cat; b.soloEstado = ""; pintaBuscador(tipo); pintaLista(tipo); caja.querySelector("[data-q]").focus(); });
  const inp = caja.querySelector("[data-q]");
  inp.oninput = () => { b.q = inp.value; b.soloEstado = ""; pintaLista(tipo); const l = caja.querySelector("[data-limpia]"); if (l) l.hidden = !b.q; };
  inp.onkeydown = e => {
    if (e.key === "Escape"){ b.q = ""; pintaBuscador(tipo); pintaLista(tipo); }
    const primero = filtrados(tipo)[0];
    if (!primero) return;
    if (e.key === "+" || e.key === "="){ e.preventDefault(); mueve(primero.id, +1); }
    if (e.key === "-"){ e.preventDefault(); mueve(primero.id, -1); }
    if (e.key === "Enter"){ e.preventDefault(); selecciona(primero.id); }
  };
  const lim = caja.querySelector("[data-limpia]"); if (lim) lim.onclick = () => { b.q = ""; pintaBuscador(tipo); pintaLista(tipo); };
  caja.querySelector("[data-barras]").onclick = () => hojaBarras(tipo);
}

/* ═══════════════ lista ═══════════════ */
function pintaLista(tipo){
  const caja = $(tipo === "mueble" ? "#listaMueble" : "#listaMaterial");
  const b = E.busca[tipo];
  let l = filtrados(tipo);
  if (b.soloEstado) l = l.filter(p => estado(p) === b.soloEstado);
  const total = E.productos.filter(p => p.tipo === tipo && p.activo !== false);
  $(tipo === "mueble" ? "#resumenMueble" : "#resumenMaterial").textContent =
    total.length ? total.length + (tipo === "mueble" ? " artículos · " : " productos · ") + total.reduce((s,p) => s + vivo(p), 0) + (tipo === "mueble" ? " piezas" : " envases") : "";
  const pista = $(tipo === "mueble" ? "#buscadorMueble [data-pista]" : "#buscadorMaterial [data-pista]");
  if (pista) pista.innerHTML = (b.q || b.cat || b.soloEstado)
    ? l.length + " resultado" + (l.length === 1 ? "" : "s") + (b.cat ? " en <b>" + esc(b.cat) + "</b>" : "") + (b.soloEstado ? " <b>" + (b.soloEstado === "bajo" ? "por acabarse" : "sin existencia") + "</b>" : "") + (esEscritorio() ? " · <b>+</b> suma · <b>−</b> resta · <b>Enter</b> abre el detalle" : "")
    : (esEscritorio() ? "Escribe y aparece. <b>+</b> suma · <b>−</b> resta al primero de la lista · <b>Enter</b> abre el detalle" : "Toca el nombre para ver el detalle");
  pintaTablero(tipo);

  if (!total.length){
    caja.innerHTML = '<div class="aviso"><b>' + (tipo === "mueble" ? "Empieza tu inventario de muebles" : "Empieza tu lista de material") + '</b>' +
      '<p>' + (tipo === "mueble" ? "Agrega el primer artículo con el botón de abajo. El catálogo te completa modelo y color." : "Puedo dejarte los 6 productos que ya identificamos por sus etiquetas para que solo pongas cuántos hay.") + '</p>' +
      '<div class="pie">' + (tipo === "material" ? '<button class="btn vino" data-sembrar>Poner los 6 productos</button>' : "") + '<button class="btn" data-nuevo="' + tipo + '">＋ Agregar</button></div></div>';
    const s = caja.querySelector("[data-sembrar]"); if (s) s.onclick = sembrarMaterial;
    caja.querySelector("[data-nuevo]").onclick = () => hojaProducto(tipo);
    return;
  }
  if (!l.length){ caja.innerHTML = '<div class="vacio"><b>Nada por aquí</b><p>Ningún ' + (tipo === "mueble" ? "artículo" : "producto") + ' coincide. Prueba con menos letras o quita el filtro.</p></div>'; return; }

  const enc = tipo === "material"
    ? '<div class="encabezado-lista"><span>Producto</span><span>Otros apodos</span><span class="pres">Presentación</span><span class="d">Hay</span><span class="d min">Mín</span><span>Último movimiento</span><span></span></div>'
    : '<div class="encabezado-lista"><span>Mueble</span><span>Color</span><span class="pres">Categoría</span><span class="d">Hay</span><span class="d min">Mín</span><span>Último movimiento</span><span></span></div>';
  caja.innerHTML = enc + l.map(p => filaHtml(p)).join("");
  caja.querySelectorAll("[data-mas]").forEach(x => x.onclick = e => { e.stopPropagation(); mueve(x.dataset.mas, +1); });
  caja.querySelectorAll("[data-menos]").forEach(x => x.onclick = e => { e.stopPropagation(); mueve(x.dataset.menos, -1); });
  caja.querySelectorAll("[data-abre]").forEach(x => x.onclick = () => selecciona(x.dataset.abre, true));
}
function filaHtml(p){
  const n = vivo(p), est = estado(p), u = ultimoMov(p);
  const sello = est === "cero" ? '<span class="sello roj">se acabó</span>' : est === "bajo" ? '<span class="sello amb">pocos</span>' : "";
  const colorChip = p.tipo === "mueble" && p.color ? '<span class="chip color"><span class="punto" style="background:' + tinte(p.color) + '"></span>' + esc(p.color) + '</span>' : "";
  const otros = (p.apodos || []).slice(p.tipo === "material" ? 1 : 0);
  const pres = p.tipo === "material" ? esc((p.presentacion || "") + (p.litros ? " " + p.litros + " L" : "")) : esc(p.categoria || "");
  return '<div class="fila ' + est + (E.sel === p.id ? " sel" : "") + '" data-id="' + p.id + '">' +
    '<div class="nombre" data-abre="' + p.id + '"><b>' + esc(titulo(p)) + '</b>' + (subtitulo(p) ? '<small>' + esc(subtitulo(p)) + '</small>' : "") + '</div>' +
    '<div class="sub">' + colorChip + (p.tipo === "mueble" && p.categoria ? '<span>' + esc(p.categoria) + '</span>' : "") + (p.tipo === "material" ? '<span>' + pres + '</span>' : "") + (p.minimo ? '<span style="color:var(--tinta3)">mín ' + p.minimo + '</span>' : "") + sello + '</div>' +
    '<div class="apodos">' + (p.tipo === "mueble" ? colorChip : otros.map(a => '<span class="chip">' + esc(a) + '</span>').join("")) + '</div>' +
    '<div class="pres">' + pres + '</div>' +
    '<div class="cant' + (E.pend.get(p.id) ? " pend" : "") + '" data-abre="' + p.id + '">' + n + (esEscritorio() ? sello : "") + '</div>' +
    '<div class="min">' + (p.minimo || "—") + '</div>' +
    '<div class="ultimo">' + (u ? '<b>' + esc(u.persona || "?") + ' · ' + esc(cuando(u.creado)) + '</b><span>' + (u.delta > 0 ? "+" : "") + (u.delta || "") + (u.motivo ? " · " + esc(u.motivo) : "") + '</span>' : '<span>sin movimientos</span>') + '</div>' +
    '<div class="stepper"><button class="tecla" data-menos="' + p.id + '" aria-label="Quitar uno"' + (n === 0 ? " disabled" : "") + '>−</button>' +
      '<span class="cant' + (E.pend.get(p.id) ? " pend" : "") + '">' + n + '</span>' +
      '<button class="tecla" data-mas="' + p.id + '" aria-label="Agregar uno">＋</button></div>' +
    '</div>';
}

/* Sumar o restar: la pantalla cambia al instante; los toques seguidos se
   juntan en un solo envío. */
function mueve(id, d){
  if (!exigeYo()) return;
  const p = E.productos.find(x => x.id === id); if (!p) return;
  if (d < 0 && vivo(p) === 0) return;
  E.pend.set(id, (E.pend.get(id) || 0) + d);
  pintaLista(p.tipo); if (E.sel === id) pintaDetalle();
  clearTimeout(E.relojes.get(id));
  E.relojes.set(id, setTimeout(() => confirma(id), 650));
}
async function confirma(id, motivo){
  const d = E.pend.get(id); if (!d) return;
  E.pend.delete(id);
  const p = E.productos.find(x => x.id === id);
  const regla = (p && d > 0 && p.tipo === "mueble") ? (CAT.quienHizo || {})[p.categoria] : null;
  let hechoPor = "";
  if (regla){
    const nombres = await pideQuienHizo(p, d, regla);
    if (nombres === null){ pintaLista(p.tipo); if (E.sel === id) pintaDetalle(); return; }   // canceló: no pasa nada
    hechoPor = nombres.join(" y ");
    motivo = (motivo ? motivo + " · " : "") + "hizo: " + hechoPor;
  }
  await Almacen.ajusta(id, d, E.yo, motivo || "", origen(), hechoPor);
}

/* "¿Quién lo hizo?" — solo al sumar en las secciones que lo piden. Recuerda
   la última respuesta de esa sección unos minutos para que sea un solo toque. */
E.ultimoQuien = {};
function pideQuienHizo(p, d, regla){
  return new Promise(resolve => {
    const rec = E.ultimoQuien[p.categoria];
    let marcados = (rec && Date.now() - rec.t < 15*60*1000) ? rec.nombres.slice() : [];
    const max = regla.max || 1;
    abreHoja('<h3>¿Quién lo hizo?</h3><p class="guia"><b>+' + d + '</b> · ' + esc(titulo(p)) + (p.color ? " · " + esc(p.color) : "") + ' · ' + esc(p.categoria) + (max > 1 ? " · puedes marcar hasta " + max : "") + '</p>' +
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
        ok.onclick = () => { E.ultimoQuien[p.categoria] = {nombres: marcados.slice(), t: Date.now()}; cierraHojaSin(); resolve(marcados); };
        h.querySelector("#quienNo").onclick = () => { cierraHojaSin(); resolve(null); };
        $("#telon").dataset.cancela = "1";
      });
    E.resolverQuien = () => resolve(null);
  });
}
function cierraHojaSin(){ E.resolverQuien = null; cierraHoja(); }

/* ═══════════════ detalle ═══════════════ */
function selecciona(id, abrir){
  E.sel = id;
  const p = E.productos.find(x => x.id === id); if (!p) return;
  pintaLista(p.tipo);
  if (esEscritorio()) pintaDetalle(); else if (abrir) abreHoja(htmlDetalle(p), montaDetalle);
}
function pintaDetalle(){
  const caja = $("#detalle");
  const p = E.productos.find(x => x.id === E.sel);
  if (!p){ caja.innerHTML = '<div class="detalle-vacio">Escoge un renglón para ver su detalle</div>'; return; }
  caja.innerHTML = htmlDetalle(p); montaDetalle(caja);
}
function htmlDetalle(p){
  const n = vivo(p);
  const movs = E.movimientos.filter(m => m.producto_id === p.id).sort((a,b) => a.creado < b.creado ? 1 : -1).slice(0,12);
  const unidad = p.tipo === "material" ? (p.presentacion ? p.presentacion.toLowerCase() + (n === 1 ? "" : "s") : "envases") : "piezas";
  return '<h2>' + esc(titulo(p)) + '</h2><div class="sub">' + esc([p.nombre !== titulo(p) ? p.nombre : "", p.marca, p.color, p.categoria].filter(Boolean).join(" · ")) + '</div>' +
    '<div class="grande-cant"><b>' + n + '</b><span>' + esc(unidad) + (p.litros ? "<br>de " + p.litros + " L<br><b style='font-size:13px;color:var(--tinta2)'>" + Math.round(n * p.litros) + " L</b>" : "") + '</span>' +
      '<div class="stepper"><button class="tecla" data-menos="' + p.id + '"' + (n === 0 ? " disabled" : "") + '>−</button><button class="tecla on" data-mas="' + p.id + '">＋</button></div></div>' +
    '<dl class="ficha">' +
      ((p.apodos || []).length ? '<dt>Apodos</dt><dd><div class="apodos">' + p.apodos.map(a => '<span class="chip">' + esc(a) + '</span>').join("") + '</div></dd>' : "") +
      (p.codigo ? '<dt>Código</dt><dd style="font-family:var(--mono);font-size:13px">' + esc(p.codigo) + '</dd>' : "") +
      (p.barras ? '<dt>Barras</dt><dd style="font-family:var(--mono);font-size:13px">' + esc(p.barras) + '</dd>' : "") +
      '<dt>Mínimo</dt><dd>' + (p.minimo ? p.minimo + " · avisa al llegar" : "sin mínimo") + '</dd>' +
      (p.por_quien ? '<dt>Último</dt><dd>' + esc(p.por_quien) + (p.tocado ? " · " + esc(cuando(p.tocado)) : "") + '</dd>' : "") +
    '</dl>' +
    '<div class="acciones"><button class="btn" data-conteo="' + p.id + '">Poner cantidad exacta</button><button class="btn" data-editar="' + p.id + '">Editar</button><button class="btn fantasma" data-quitar="' + p.id + '">Quitar</button></div>' +
    '<h3>Últimos movimientos</h3>' +
    (movs.length ? movs.map(m => '<div class="linea"><span class="reloj">' + esc(cuando(m.creado)) + '</span><span class="delta ' + (m.delta > 0 ? "mas" : m.delta < 0 ? "menos" : "") + '">' + (m.delta > 0 ? "+" + m.delta : (m.delta || "·")) + '</span><span class="det"><b>' + esc(m.persona || "?") + '</b><small>' + esc(m.motivo || m.tipo || "") + (m.resultado != null ? " · quedan " + m.resultado : "") + '</small></span></div>').join("")
               : '<div class="vacio" style="padding:14px"><p style="margin:0">Todavía nadie lo ha movido.</p></div>');
}
function montaDetalle(caja){
  caja.querySelectorAll("[data-mas]").forEach(x => x.onclick = () => mueve(x.dataset.mas, +1));
  caja.querySelectorAll("[data-menos]").forEach(x => x.onclick = () => mueve(x.dataset.menos, -1));
  caja.querySelectorAll("[data-conteo]").forEach(x => x.onclick = () => hojaConteo(x.dataset.conteo));
  caja.querySelectorAll("[data-editar]").forEach(x => x.onclick = () => { const p = E.productos.find(y => y.id === x.dataset.editar); hojaProducto(p.tipo, p); });
  caja.querySelectorAll("[data-quitar]").forEach(x => x.onclick = async () => {
    const p = E.productos.find(y => y.id === x.dataset.quitar);
    if (!confirm("¿Quitar «" + titulo(p) + "» del inventario?")) return;
    await Almacen.parcha("producto", p.id, {activo:false});
    await Almacen.anota({producto_id:p.id, nombre:p.nombre, color:p.color || "", tipo:"baja", persona:E.yo, motivo:"quitado del inventario", origen:origen()});
    E.sel = null; cierraHoja(); pintaTodo(); grita("Quitado");
  });
}

/* ═══════════════ formularios ═══════════════ */
function hojaProducto(tipo, p){
  p = p || {};
  const nuevo = !p.id;
  const esMat = tipo === "material";
  const cats = catsDe(tipo);
  const grupos = CAT.gruposColor || [];
  const pres = CAT.presentaciones || [];
  abreHoja('<h3>' + (nuevo ? (esMat ? "Agregar producto" : "Agregar artículo") : "Editar") + '</h3>' +
    (esMat
      ? '<label class="campo"><span>Nombre de la etiqueta</span><input id="fNombre" value="' + esc(p.nombre || "") + '" placeholder="LACA INDUSTRIAL NITRO…"></label>' +
        '<label class="campo"><span>Cómo le dicen (apodo principal)</span><input id="fApodo" value="' + esc((p.apodos || [])[0] || "") + '" placeholder="laca amarilla"></label>' +
        '<label class="campo"><span>Marca</span><input id="fMarca" value="' + esc(p.marca || "") + '" placeholder="HiCoat"></label>' +
        '<div class="dupla"><label class="campo"><span>Presentación</span><select id="fPres">' + pres.map(x => '<option value="' + esc(x.n) + '|' + x.l + '"' + (p.presentacion === x.n && Number(p.litros) === x.l ? " selected" : "") + '>' + esc(x.n) + ' ' + x.l + ' L</option>').join("") + '<option value="|"' + (!p.presentacion ? " selected" : "") + '>Otra / no sé</option></select></label>' +
        '<label class="campo"><span>Litros por envase</span><input id="fLitros" type="number" inputmode="decimal" min="0" step="0.5" value="' + (p.litros != null ? p.litros : "") + '"></label></div>' +
        '<div class="dupla"><label class="campo"><span>Código del fabricante</span><input id="fCodigo" value="' + esc(p.codigo || "") + '" placeholder="13261"></label>' +
        '<label class="campo"><span>Código de barras</span><input id="fBarras" inputmode="numeric" value="' + esc(p.barras || "") + '" placeholder="7506180720880"></label></div>'
      : '<label class="campo"><span>Mueble</span><input id="fNombre" list="dlModelos" value="' + esc(p.nombre || "") + '" placeholder="Monarca Midas" autocomplete="off"></label>' +
        '<datalist id="dlModelos">' + (CAT.modelos || []).map(m => '<option value="' + esc(m) + '">').join("") + '</datalist>' +
        '<label class="campo"><span>Color</span><select id="fColor"><option value="">— sin color —</option>' + grupos.map(g => '<optgroup label="' + esc(g.grupo) + '">' + g.colores.map(c => '<option' + (p.color === c ? " selected" : "") + '>' + esc(c) + '</option>').join("") + '</optgroup>').join("") + '</select></label>' +
        '<label class="campo"><span>¿Qué es?</span><select id="fCat">' + cats.map(c => '<option' + ((p.categoria || "Mueble terminado") === c ? " selected" : "") + '>' + esc(c) + '</option>').join("") + '</select></label>'
    ) +
    '<div class="dupla"><label class="campo"><span>' + (esMat ? "Envases que hay" : "Piezas que hay") + '</span><input id="fCant" type="number" inputmode="numeric" min="0" value="' + (nuevo ? 0 : vivo(p)) + '"' + (nuevo ? "" : " disabled title='Cambia la cantidad con − y +, o con Poner cantidad exacta'") + '></label>' +
    '<label class="campo"><span>Avisar cuando baje a</span><input id="fMin" type="number" inputmode="numeric" min="0" value="' + Number(p.minimo || 0) + '"></label></div>' +
    '<button class="btn vino grande" id="fOk">' + (nuevo ? "Agregar" : "Guardar cambios") + '</button>',
    h => {
      const g = id => h.querySelector(id);
      if (esMat && g("#fPres")) g("#fPres").onchange = () => { const [,l] = g("#fPres").value.split("|"); if (l) g("#fLitros").value = l; };
      g("#fNombre").focus();
      g("#fOk").onclick = async () => {
        if (!exigeYo()) return;
        const nombre = g("#fNombre").value.trim(); if (!nombre) return grita("Falta el nombre");
        const datos = { tipo, nombre, categoria: esMat ? "" : g("#fCat").value, minimo: Math.max(0, Number(g("#fMin").value || 0)), por_quien: E.yo };
        if (esMat){
          const ap = g("#fApodo").value.trim();
          datos.apodos = ap ? [ap].concat((p.apodos || []).filter(a => a !== ap)).slice(0,3) : (p.apodos || []);
          datos.marca = g("#fMarca").value.trim(); datos.codigo = g("#fCodigo").value.trim(); datos.barras = g("#fBarras").value.trim().replace(/\s+/g, "");
          datos.presentacion = g("#fPres").value.split("|")[0] || (p.presentacion || ""); datos.litros = g("#fLitros").value === "" ? null : Number(g("#fLitros").value);
          datos.categoria = datos.presentacion === "Tambo" ? "Tambos" : datos.presentacion === "Cubeta" ? "Cubetas" : "";
          datos.color = "";
        } else { datos.color = g("#fColor").value; datos.apodos = p.apodos || []; }
        if (nuevo){
          datos.cantidad = Math.max(0, Number(g("#fCant").value || 0));
          const f = await Almacen.pon("producto", datos);
          await Almacen.anota({producto_id:f.id, nombre:f.nombre, color:f.color || "", tipo:"alta", delta:f.cantidad, resultado:f.cantidad, persona:E.yo, motivo:"artículo nuevo", origen:origen()});
          E.sel = f.id; grita("Agregado");
        } else { await Almacen.parcha("producto", p.id, datos); grita("Guardado"); }
        cierraHoja(); pintaTodo();
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
        const nuevo = Math.max(0, Number(h.querySelector("#cCant").value || 0));
        const d = nuevo - vivo(p);
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

/* ═══════════════ código de barras (opción) ═══════════════ */
let lector = null;
function hojaBarras(tipo){
  abreHoja('<h3>Código de barras</h3><p class="guia">Apunta la cámara al código, o escríbelo abajo si no lo lee.</p>' +
    '<div id="camBarras"><video id="vidBarras" muted playsinline hidden></video><button class="btn grande" id="btnCam">Abrir cámara</button></div>' +
    '<label class="campo" style="margin-top:12px"><span>O escribe el código</span><input id="codBarras" inputmode="numeric" placeholder="7506180720880" autocomplete="off"></label>' +
    '<button class="btn vino grande" id="okBarras">Buscar</button><div class="resultado-barras" id="resBarras" style="margin-top:10px"></div>',
    h => {
      const inp = h.querySelector("#codBarras");
      const resolver = cod => {
        cod = String(cod || "").replace(/\s+/g, "").trim(); if (!cod) return;
        const p = E.productos.find(x => x.activo !== false && x.barras && x.barras === cod);
        if (p){ paraLector(); cierraHoja(); irA(p.tipo === "material" ? "material" : "muebles"); selecciona(p.id, true); grita("Encontrado: " + titulo(p)); return; }
        h.querySelector("#resBarras").innerHTML = '<div class="aviso"><b>Código ' + esc(cod) + ' no está registrado</b><p>Escoge a qué producto pertenece y lo dejo guardado para la próxima.</p></div>' +
          E.productos.filter(x => x.tipo === tipo && x.activo !== false).sort((a,b) => sinAcento(titulo(a)) > sinAcento(titulo(b)) ? 1 : -1).slice(0,40)
            .map(x => '<button class="btn" style="justify-content:flex-start" data-liga="' + x.id + '">' + esc(titulo(x)) + (x.color ? " · " + esc(x.color) : "") + '</button>').join("");
        h.querySelectorAll("[data-liga]").forEach(b => b.onclick = async () => { await Almacen.parcha("producto", b.dataset.liga, {barras:cod}); paraLector(); cierraHoja(); selecciona(b.dataset.liga, true); grita("Código guardado"); });
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
    await lector.decodeFromVideoDevice(undefined, video, (res, err) => {
      if (res){ if (navigator.vibrate) navigator.vibrate(60); resolver(res.getText()); }
    });
    btn.textContent = "Leyendo… apunta al código";
  } catch(e){
    video.hidden = true; btn.disabled = false; btn.textContent = "Abrir cámara";
    grita(e && e.name === "NotAllowedError" ? "No diste permiso a la cámara. Escribe el código." : "No se pudo abrir la cámara. Escribe el código.");
  }
}
function paraLector(){ try { lector && lector.reset(); } catch(e){} lector = null; }
function cargaScript(src){ return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("no cargó")); document.head.appendChild(s); }); }

/* ═══════════════ recados ═══════════════ */
function pintaRecados(){
  const caja = $("#listaRecados");
  const l = E.recados.slice().sort((a,b) => a.creado < b.creado ? 1 : -1);
  const pend = l.filter(r => !r.hecho).length;
  $("#resumenRecados").textContent = l.length ? (pend ? pend + " sin atender" : "todo atendido") : "";
  const nuevos = l.filter(r => !r.hecho && !(r.vistos || {})[E.yo]).length;
  $("#globoRec").hidden = !nuevos; $("#globoRec").textContent = nuevos;
  $("#nRec").hidden = !pend; $("#nRec").textContent = pend;
  if (!l.length){ caja.innerHTML = '<div class="vacio"><b>No hay recados</b><p>Aquí van los avisos que antes se perdían en la libreta. Escribe uno arriba y todos lo ven.</p></div>'; return; }
  caja.innerHTML = l.map(r => {
    const vistos = Object.keys(r.vistos || {}).filter(v => v !== r.de);
    return '<article class="tarjeta' + (r.hecho ? " lista" : r.urgente ? " urge" : "") + '"><div class="enc"><span class="av">' + esc(iniciales(r.de)) + '</span><b>' + esc(r.de || "Alguien") + '</b>' + (r.para ? '<span style="color:var(--tinta2)">para ' + esc(r.para) + '</span>' : "") + '<span class="hora">' + esc(cuando(r.creado)) + '</span></div>' +
      '<div class="cuerpo">' + esc(r.texto) + '</div><div class="pie"><span class="visto">' + (vistos.length ? "Visto: " + esc(vistos.join(", ")) : "Nadie lo ha visto") + '</span>' +
      (r.hecho ? '<button class="btn fantasma" data-reabre="' + r.id + '">Reabrir</button>' : '<button class="btn" data-hecho="' + r.id + '">✓ Ya quedó</button>') +
      '<button class="btn fantasma" data-borra="' + r.id + '">Borrar</button></div></article>';
  }).join("");
  caja.querySelectorAll("[data-hecho]").forEach(b => b.onclick = () => { if (exigeYo()) Almacen.parcha("recado", b.dataset.hecho, {hecho:true}); });
  caja.querySelectorAll("[data-reabre]").forEach(b => b.onclick = () => Almacen.parcha("recado", b.dataset.reabre, {hecho:false}));
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

/* ═══════════════ pedidos (formato ticket) ═══════════════ */
function pintaPedidos(){
  const caja = $("#listaPedidos");
  const l = E.pedidos.slice().sort((a,b) => (a.estado === "entregado") - (b.estado === "entregado") || (a.creado < b.creado ? 1 : -1));
  const pend = l.filter(p => p.estado !== "entregado").length;
  $("#resumenPedidos").textContent = l.length ? pend + " por entregar" : "";
  $("#nPed").hidden = !pend; $("#nPed").textContent = pend;
  if (!l.length){ caja.innerHTML = '<div class="vacio"><b>Sin pedidos</b><p>Agrega el primero con el botón. Cada pedido queda como un ticket con el cliente, la fecha y lo que pidió.</p></div>'; return; }
  caja.innerHTML = '<div class="tickets">' + l.map(p => {
    const lineas = Array.isArray(p.lineas) ? p.lineas : [];
    const piezas = lineas.reduce((s,x) => s + Number(x.cantidad || 0), 0);
    return '<article class="ticket' + (p.estado === "entregado" ? " entregado" : "") + '">' +
      '<div class="t-cab"><span class="t-caja">MUEBLES</span><span class="t-script">San Bernardo</span></div>' +
      '<div class="t-linea"></div>' +
      '<div class="t-fila"><span>CLIENTE</span><b>' + esc(p.cliente) + '</b></div>' +
      '<div class="t-fila"><span>FECHA</span><b>' + esc(isoADma(p.fecha) || "—") + '</b></div>' +
      '<div class="t-fila"><span>CAPTURÓ</span><b>' + esc(p.de || "?") + '</b></div>' +
      '<div class="t-linea"></div>' +
      (lineas.length ? lineas.map(x => '<div class="t-item"><span class="t-n">' + Number(x.cantidad || 0) + '</span><span class="t-desc">' + esc(x.modelo) + (x.color ? '<small>' + esc(x.color) + '</small>' : "") + '</span></div>').join("") : '<div class="t-item"><span class="t-desc" style="color:var(--tinta3)">sin renglones</span></div>') +
      '<div class="t-linea"></div>' +
      '<div class="t-fila"><span>TOTAL</span><b>' + piezas + ' pieza' + (piezas === 1 ? "" : "s") + '</b></div>' +
      (p.notas ? '<div class="t-notas">' + esc(p.notas) + '</div>' : "") +
      '<div class="t-estado">' + (p.estado === "entregado" ? "✓ ENTREGADO" : "PENDIENTE") + '</div>' +
      '<div class="t-acciones">' + (p.estado === "entregado" ? '<button class="btn fantasma" data-reabre="' + p.id + '">Reabrir</button>' : '<button class="btn" data-entrega="' + p.id + '">✓ Entregado</button>') + '<button class="btn fantasma" data-edita="' + p.id + '">Editar</button><button class="btn fantasma" data-borra="' + p.id + '">Borrar</button></div>' +
    '</article>';
  }).join("") + '</div>';
  caja.querySelectorAll("[data-entrega]").forEach(b => b.onclick = () => { if (exigeYo()) Almacen.parcha("pedido", b.dataset.entrega, {estado:"entregado"}); });
  caja.querySelectorAll("[data-reabre]").forEach(b => b.onclick = () => Almacen.parcha("pedido", b.dataset.reabre, {estado:"pendiente"}));
  caja.querySelectorAll("[data-edita]").forEach(b => b.onclick = () => hojaPedido(E.pedidos.find(x => x.id === b.dataset.edita)));
  caja.querySelectorAll("[data-borra]").forEach(b => b.onclick = () => { if (confirm("¿Borrar este pedido?")) Almacen.borra("pedido", b.dataset.borra); });
}
function hojaPedido(p){
  p = p || {}; const nuevo = !p.id;
  let lineas = (Array.isArray(p.lineas) && p.lineas.length) ? p.lineas.map(x => Object.assign({}, x)) : [{modelo:"", color:"", cantidad:1}];
  const grupos = CAT.gruposColor || [];
  const opcionesColor = sel => '<option value="">— color —</option>' + grupos.map(g => '<optgroup label="' + esc(g.grupo) + '">' + g.colores.map(c => '<option' + (sel === c ? " selected" : "") + '>' + esc(c) + '</option>').join("") + '</optgroup>').join("");
  const filaHtml_ = (x, i) => '<div class="p-linea" data-i="' + i + '"><input class="p-cant" type="number" inputmode="numeric" min="1" value="' + (x.cantidad || 1) + '" aria-label="Cantidad"><input class="p-modelo" list="dlModelosP" placeholder="Mueble" value="' + esc(x.modelo || "") + '" autocomplete="off"><select class="p-color">' + opcionesColor(x.color) + '</select><button class="btn fantasma p-quita" aria-label="Quitar renglón">×</button></div>';
  abreHoja('<h3>' + (nuevo ? "Nuevo pedido" : "Editar pedido") + '</h3>' +
    '<label class="campo"><span>Cliente</span><input id="pCliente" list="dlClientes" value="' + esc(p.cliente || "") + '" placeholder="Sr. Pedro Orozco" autocomplete="off"></label>' +
    '<datalist id="dlClientes">' + (CAT.clientes || []).map(c => '<option value="' + esc(c) + '">').join("") + '</datalist>' +
    '<datalist id="dlModelosP">' + (CAT.modelos || []).map(m => '<option value="' + esc(m) + '">').join("") + '</datalist>' +
    '<label class="campo"><span>Fecha (día/mes/año)</span><input id="pFecha" inputmode="numeric" placeholder="dd/mm/aaaa" value="' + esc(isoADma(p.fecha) || isoADma(hoyIso())) + '"></label>' +
    '<div class="grupo-h">Lo que pidió</div><div id="pLineas">' + lineas.map(filaHtml_).join("") + '</div>' +
    '<button class="btn" id="pMas" style="margin:6px 0 14px">＋ Otro renglón</button>' +
    '<label class="campo"><span>Notas</span><textarea id="pNotas" placeholder="urgente, con lámpara, entregar en…">' + esc(p.notas || "") + '</textarea></label>' +
    '<button class="btn vino grande" id="pOk">' + (nuevo ? "Guardar pedido" : "Guardar cambios") + '</button>',
    h => {
      const cont = h.querySelector("#pLineas");
      const leer = () => Array.from(cont.querySelectorAll(".p-linea")).map(f => ({ cantidad: Math.max(0, Number(f.querySelector(".p-cant").value || 0)), modelo: f.querySelector(".p-modelo").value.trim(), color: f.querySelector(".p-color").value }));
      const enlaza = () => cont.querySelectorAll(".p-quita").forEach(b => b.onclick = () => { if (cont.children.length > 1) b.closest(".p-linea").remove(); });
      enlaza();
      h.querySelector("#pMas").onclick = () => { cont.insertAdjacentHTML("beforeend", filaHtml_({cantidad:1}, cont.children.length)); enlaza(); cont.lastElementChild.querySelector(".p-modelo").focus(); };
      const f = h.querySelector("#pFecha");
      f.oninput = () => { let v = f.value.replace(/[^\d]/g, "").slice(0,8); if (v.length > 4) v = v.slice(0,2) + "/" + v.slice(2,4) + "/" + v.slice(4); else if (v.length > 2) v = v.slice(0,2) + "/" + v.slice(2); f.value = v; };
      h.querySelector("#pCliente").focus();
      h.querySelector("#pOk").onclick = async () => {
        if (!exigeYo()) return;
        const cliente = h.querySelector("#pCliente").value.trim(); if (!cliente) return grita("Falta el cliente");
        const iso = dmaAIso(f.value); if (f.value && !iso) return grita("La fecha va día/mes/año, por ejemplo 04/09/2026");
        const ls = leer().filter(x => x.modelo && x.cantidad > 0);
        const datos = { cliente, fecha: iso || null, lineas: ls, notas: h.querySelector("#pNotas").value.trim(), estado: p.estado || "pendiente", de: p.de || E.yo };
        if (nuevo) await Almacen.pon("pedido", datos); else await Almacen.parcha("pedido", p.id, datos);
        cierraHoja(); grita(nuevo ? "Pedido guardado" : "Guardado"); pintaPedidos();
      };
    });
}

/* ═══════════════ bitácora ═══════════════ */
function pintaBitacora(){
  const caja = $("#listaBitacora");
  const dias = {};
  E.movimientos.forEach(m => { const d = (m.creado || "").slice(0,10); (dias[d] = dias[d] || []).push(m); });
  const ord = Object.keys(dias).sort().reverse().slice(0,30);
  if (!ord.length){ caja.innerHTML = '<div class="vacio"><b>Todavía no hay movimientos</b><p>Cada vez que alguien suma, resta o agrega algo, queda aquí con su nombre y su hora.</p></div>'; return; }
  caja.innerHTML = ord.map(d => '<div class="dia">' + esc(fechaLarga(d)) + '</div>' + dias[d].sort((a,b) => a.creado < b.creado ? 1 : -1).map(m =>
    '<div class="linea"><span class="reloj">' + esc(reloj(m.creado)) + '</span><span class="delta ' + (m.delta > 0 ? "mas" : m.delta < 0 ? "menos" : "") + '">' + (m.delta > 0 ? "+" + m.delta : (m.delta || "·")) + '</span>' +
    '<span class="det"><b>' + esc(m.nombre || m.tipo) + '</b>' + (m.color ? " · " + esc(m.color) : "") + '<small>' + esc(m.persona || "?") + (m.motivo ? " · " + esc(m.motivo) : m.hecho_por ? " · hizo: " + esc(m.hecho_por) : m.tipo && !m.delta ? " · " + esc(m.tipo) : "") + (m.resultado != null ? " · quedan " + m.resultado : "") + (m.origen ? " · " + esc(m.origen) : "") + '</small></span></div>').join("")).join("");
}

/* ═══════════════ apodos y litros ═══════════════ */
function pintaApodos(){
  const caja = $("#listaApodos");
  const q = $("#buscaApodos").value;
  const grupos = [["Material", E.productos.filter(p => p.tipo === "material" && p.activo !== false)], ["Muebles · apodos nada más (aquí no hay litros)", E.productos.filter(p => p.tipo === "mueble" && p.activo !== false)]];
  let html = "";
  grupos.forEach(([titulo_, l]) => {
    l = l.filter(p => coincide(p, q)).sort((a,b) => sinAcento(titulo(a)) > sinAcento(titulo(b)) ? 1 : -1);
    if (!l.length) return;
    html += '<div class="grupo-apodos">' + esc(titulo_) + '</div>' + l.map(p => {
      const c = E.apodosCambios.get(p.id) || {};
      const apodos = c.apodos || p.apodos || [];
      const litros = c.litros !== undefined ? c.litros : p.litros;
      return '<div class="fila-apodo' + (E.apodosCambios.has(p.id) ? " cambiada" : "") + '" data-id="' + p.id + '">' +
        '<div class="nom"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' + esc(p.nombre) + (p.color ? ' <span class="chip color"><span class="punto" style="background:' + tinte(p.color) + '"></span>' + esc(p.color) + '</span>' : "") + '</div>' +
        '<div class="apodos">' + apodos.map((a,i) => '<span class="chip edit" data-quita="' + i + '" title="Quitar">' + esc(a) + ' ×</span>').join("") +
          (apodos.length < 3 ? '<span class="chip mas" data-agrega>＋ apodo</span>' : '<span style="font-size:11px;color:var(--tinta3)">ya tiene 3</span>') + '</div>' +
        (p.tipo === "material" ? '<div class="litros"><input type="number" inputmode="decimal" min="0" step="0.5" data-litros value="' + (litros != null ? litros : "") + '" placeholder="?"> L por ' + esc((p.presentacion || "envase").toLowerCase()) + '</div>' : '<div class="litros" style="color:var(--tinta3)">—</div>') +
      '</div>';
    }).join("");
  });
  caja.innerHTML = html || '<div class="vacio"><b>Nada que mostrar</b><p>Agrega productos primero.</p></div>';
  caja.querySelectorAll(".fila-apodo").forEach(f => {
    const id = f.dataset.id; const p = E.productos.find(x => x.id === id);
    const actual = () => (E.apodosCambios.get(id) || {}).apodos || p.apodos || [];
    f.querySelectorAll("[data-quita]").forEach(ch => ch.onclick = () => { const a = actual().slice(); a.splice(Number(ch.dataset.quita), 1); cambiaApodo(id, {apodos:a}); });
    const mas = f.querySelector("[data-agrega]");
    if (mas) mas.onclick = () => {
      mas.outerHTML = '<span class="chip edit"><input data-nuevo placeholder="nuevo apodo" maxlength="30"></span>';
      const inp = f.querySelector("[data-nuevo]"); inp.focus();
      const ok = () => { const v = inp.value.trim(); if (v && !actual().includes(v)) cambiaApodo(id, {apodos: actual().concat([v]).slice(0,3)}); else pintaApodos(); };
      inp.onkeydown = e => { if (e.key === "Enter") ok(); if (e.key === "Escape") pintaApodos(); };
      inp.onblur = ok;
    };
    const lit = f.querySelector("[data-litros]");
    if (lit) lit.onchange = () => cambiaApodo(id, {litros: lit.value === "" ? null : Number(lit.value)});
  });
  const n = E.apodosCambios.size;
  $("#guardarApodos").disabled = !n; $("#guardarApodos").textContent = n ? "Guardar " + n + " cambio" + (n === 1 ? "" : "s") : "Guardar cambios";
  $("#deshacerApodos").hidden = !n;
}
function cambiaApodo(id, cambio){ E.apodosCambios.set(id, Object.assign({}, E.apodosCambios.get(id) || {}, cambio)); pintaApodos(); }
async function guardarApodos(){
  if (!exigeYo()) return;
  for (const [id, c] of E.apodosCambios){ const p = E.productos.find(x => x.id === id); if (!p) continue; await Almacen.parcha("producto", id, Object.assign({}, c, {por_quien:E.yo})); }
  const n = E.apodosCambios.size; E.apodosCambios.clear(); pintaApodos(); grita("Guardado: " + n + " cambio" + (n === 1 ? "" : "s"));
}

/* ═══════════════ ajustes ═══════════════ */
function pintaAjustes(){
  const C = window.CONFIG || {};
  $("#ajustes").innerHTML =
    '<div class="ajuste"><h4>Quién soy</h4><p>' + (E.yo ? "Estás como <b>" + esc(E.yo) + "</b>." : "Todavía no has dicho quién eres.") + '</p><div class="acciones"><button class="btn" id="ajYo">Cambiar de persona</button>' + (Almacen.sesion ? '<button class="btn fantasma" id="ajSalir">Cerrar sesión</button>' : "") + '</div></div>' +
    '<div class="ajuste"><h4>Modo práctica</h4><p>Para jugar sin miedo: datos de juguete, solo en este aparato. El inventario real ni se entera.</p><label class="interruptor"><input type="checkbox" id="ajPractica"' + (Almacen.practica ? " checked" : "") + '> <span>' + (Almacen.practica ? "Practicando" : "Apagado") + '</span></label></div>' +
    '<div class="ajuste"><h4>Revisar este aparato</h4><p>Prueba una por una las cosas que la app necesita y te dice cómo arreglar lo que falle.</p><div class="acciones"><button class="btn" id="ajDiag">Revisar ahora</button></div><div class="diag" id="diag" style="margin-top:10px"></div></div>' +
    '<div class="ajuste"><h4>Exportar e imprimir</h4><p>Todo lo que hay, a Excel; o una hoja para hacer el conteo físico caminando el almacén.</p><div class="acciones"><button class="btn" data-exporta="mueble">Muebles a Excel</button><button class="btn" data-exporta="material">Material a Excel</button><button class="btn" data-imprime="mueble">Hoja de conteo muebles</button><button class="btn" data-imprime="material">Hoja de conteo material</button></div></div>' +
    '<div class="ajuste"><h4>Instalar en el celular</h4><p>' + (esApple ? "En iPhone: botón <b>Compartir</b> (el cuadrito con la flecha) → <b>Agregar a pantalla de inicio</b>." : "En Android: menú <b>⋮</b> → <b>Agregar a pantalla principal</b> o <b>Instalar app</b>.") + ' Queda con su icono y abre en un segundo.</p></div>' +
    '<div class="ajuste"><h4>Versión</h4><p><b>' + esc(C.VERSION || "?") + '</b> · ' + (Almacen.hayNube ? "base compartida conectada" : "sin base compartida (faltan llaves en config.js)") + '</p><div class="acciones"><button class="btn" id="ajActualiza">Buscar actualización</button><button class="btn fantasma" id="ajTema">Claro / oscuro</button></div></div>';
  $("#ajYo").onclick = hojaQuienSoy;
  const s = $("#ajSalir"); if (s) s.onclick = async () => { await Almacen.sale(); pintaPulso(); pintaTodo(); };
  $("#ajPractica").onchange = async e => { await Almacen.setPractica(e.target.checked); pintaPulso(); pintaTodo(); grita(e.target.checked ? "Modo práctica encendido" : "De vuelta a lo real"); };
  $("#ajDiag").onclick = diagnostico;
  $("#ajActualiza").onclick = buscaActualizacion;
  $("#ajTema").onclick = () => { const osc = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.dataset.theme = osc ? "light" : "dark"; localStorage.setItem("alm.tema", document.documentElement.dataset.theme); };
  enlazaExportar($("#ajustes"));
}
async function diagnostico(){
  const caja = $("#diag"); const filas = [];
  const fila = (ok, t, arreglo) => filas.push('<div class="r"><span class="' + (ok === true ? "ok" : ok === false ? "no" : "duda") + '">' + (ok === true ? "✓" : ok === false ? "✗" : "?") + '</span><span>' + t + (arreglo ? '<small>' + arreglo + '</small>' : "") + '</span></div>');
  const pinta = () => { caja.innerHTML = filas.join(""); };
  fila(navigator.onLine !== false, "Conexión a internet", navigator.onLine === false ? "Sin señal ahora. Lo que hagas se guarda y se sube después." : "");
  fila(Almacen.hayNube ? (Almacen.modo === "nube") : null, "Base compartida", !Almacen.hayNube ? "Faltan las llaves de Supabase en config.js" : Almacen.modo !== "nube" ? "No has iniciado sesión" : "");
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
    try { const s = await navigator.mediaDevices.getUserMedia({audio:true}); s.getTracks().forEach(t => t.stop()); fila(true, "Micrófono", esApple ? "Para dictar usa el 🎤 del teclado del iPhone." : ""); }
    catch(e){ fila(false, "Micrófono", e.name === "NotAllowedError" ? (esApple ? "iPhone: Ajustes → Safari → Micrófono → Permitir. Y el 🎤 del teclado funciona aunque esto falle." : "Android: candado en la barra → Permisos → Micrófono") : "No se encontró micrófono."); }
    pinta();
  }
  fila("BarcodeDetector" in window ? true : null, "Lector de código de barras", "BarcodeDetector" in window ? "Nativo, rápido." : "Se usa el lector de respaldo (funciona, un poco más lento).");
  fila(true, "Versión instalada: " + esc((window.CONFIG || {}).VERSION || "?"));
  pinta();
}

/* ═══════════════ exportar e imprimir ═══════════════ */
function enlazaExportar(raiz){
  raiz.querySelectorAll("[data-exporta]").forEach(b => b.onclick = () => exporta(b.dataset.exporta));
  raiz.querySelectorAll("[data-imprime]").forEach(b => b.onclick = () => imprime(b.dataset.imprime));
}
function exporta(tipo){
  const l = E.productos.filter(p => p.tipo === tipo && p.activo !== false);
  const cab = tipo === "material" ? ["Nombre etiqueta","Apodos","Categoría","Marca","Código","Barras","Presentación","Litros","Hay","Mínimo","Litros totales","Último","Quién"]
                                  : ["Mueble","Color","Categoría","Apodos","Hay","Mínimo","Último","Quién"];
  const filas = l.map(p => tipo === "material"
    ? [p.nombre, (p.apodos || []).join(", "), p.categoria, p.marca, p.codigo, p.barras, p.presentacion, p.litros, vivo(p), p.minimo, p.litros ? vivo(p) * p.litros : "", p.tocado ? new Date(p.tocado).toLocaleString("es-MX") : "", p.por_quien]
    : [p.nombre, p.color, p.categoria, (p.apodos || []).join(", "), vivo(p), p.minimo, p.tocado ? new Date(p.tocado).toLocaleString("es-MX") : "", p.por_quien]);
  const csv = "﻿" + [cab].concat(filas).map(r => r.map(v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(";")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
  a.download = (tipo === "material" ? "material" : "muebles") + "-" + new Date().toISOString().slice(0,10) + ".csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function imprime(tipo){
  const l = E.productos.filter(p => p.tipo === tipo && p.activo !== false).sort((a,b) => sinAcento(titulo(a)) > sinAcento(titulo(b)) ? 1 : -1);
  $("#impresion").innerHTML = '<h1>Hoja de conteo · ' + (tipo === "material" ? "Material" : "Muebles") + '</h1><p>' + esc((window.CONFIG || {}).TALLER || "") + ' · ' + new Date().toLocaleDateString("es-MX", {weekday:"long", day:"numeric", month:"long", year:"numeric"}) + ' · contó: ______________</p>' +
    '<table><thead><tr><th>' + (tipo === "material" ? "Producto" : "Mueble") + '</th><th>' + (tipo === "material" ? "Presentación" : "Color · categoría") + '</th><th>Sistema</th><th>Contado</th><th>Notas</th></tr></thead><tbody>' +
    l.map(p => '<tr><td>' + esc(titulo(p)) + (p.nombre !== titulo(p) ? '<br><small>' + esc(p.nombre) + '</small>' : "") + '</td><td>' + esc(tipo === "material" ? (p.presentacion || "") + (p.litros ? " " + p.litros + " L" : "") : [p.color, p.categoria].filter(Boolean).join(" · ")) + '</td><td class="n">' + vivo(p) + '</td><td class="blanco"></td><td></td></tr>').join("") + '</tbody></table>';
  $("#impresion").hidden = false; window.print(); setTimeout(() => { $("#impresion").hidden = true; }, 500);
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
function irA(v){
  if (v === "mas"){ hojaMas(); return; }
  E.vista = v;
  $$(".vista").forEach(s => s.classList.toggle("on", s.id === "v-" + v));
  $$("[data-vista]").forEach(b => b.classList.toggle("on", b.dataset.vista === v || (v === "recados" || v === "bitacora" || v === "apodos" || v === "ajustes") && b.dataset.vista === "mas"));
  if (location.hash !== "#" + v) history.replaceState(null, "", "#" + v);
  window.scrollTo(0, 0);
  if (v === "recados") pintaRecados(); if (v === "bitacora") pintaBitacora(); if (v === "apodos") pintaApodos(); if (v === "ajustes") pintaAjustes(); if (v === "pedidos") pintaPedidos();
}
function hojaMas(){
  abreHoja('<h3>Más</h3><div style="display:grid;gap:8px">' +
    '<button class="btn grande" data-ir="recados">Recados' + (E.recados.filter(r => !r.hecho).length ? ' · ' + E.recados.filter(r => !r.hecho).length + ' sin atender' : "") + '</button>' +
    '<button class="btn grande" data-ir="bitacora">Bitácora · quién hizo qué</button>' +
    '<button class="btn grande" data-ir="apodos">Apodos y litros</button>' +
    '<button class="btn grande" data-ir="ajustes">Ajustes · práctica · revisar aparato</button></div>',
    p => p.querySelectorAll("[data-ir]").forEach(b => b.onclick = () => { cierraHoja(); irA(b.dataset.ir); }));
}
$$("[data-vista]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); irA(b.dataset.vista); }));
$("#fabLupa").onclick = () => { const v = (E.vista === "material") ? "material" : "muebles"; irA(v); const c = $(v === "material" ? "#buscadorMaterial [data-q]" : "#buscadorMueble [data-q]"); if (c){ c.focus(); c.scrollIntoView({block:"start", behavior:"smooth"}); } };
$("#yoLat").onclick = hojaQuienSoy; $("#yoCel").onclick = hojaQuienSoy;
$$("[data-nuevo]").forEach(b => b.onclick = () => hojaProducto(b.dataset.nuevo));
$$("[data-nuevo-pedido]").forEach(b => b.onclick = () => hojaPedido());
enlazaExportar(document);
$("#btnRecado").onclick = async () => { const i = $("#recTexto"); await ponRecado(i.value); i.value = ""; };
$("#recTexto").onkeydown = e => { if (e.key === "Enter") $("#btnRecado").click(); };
$("#buscaApodos").oninput = pintaApodos;
$("#guardarApodos").onclick = guardarApodos;
$("#deshacerApodos").onclick = () => { E.apodosCambios.clear(); pintaApodos(); };
$("#salirPractica").onclick = async () => { await Almacen.setPractica(false); pintaPulso(); pintaTodo(); };
$("#formEntrada").onsubmit = async e => {
  e.preventDefault(); const m = $("#entMsg"); m.textContent = "Entrando…";
  try { await Almacen.entra($("#entMail").value.trim(), $("#entPass").value); m.textContent = ""; pintaPulso(); pintaTodo(); }
  catch(err){ m.textContent = /Invalid/i.test(err.message || "") ? "Correo o contraseña incorrectos." : "No se pudo entrar: " + (err.message || "revisa tu señal"); }
};
window.addEventListener("resize", () => { pintaTodo(); });
const temaGuardado = localStorage.getItem("alm.tema"); if (temaGuardado) document.documentElement.dataset.theme = temaGuardado;

function pintaTodo(){
  pintaBuscador("mueble"); pintaBuscador("material");
  pintaLista("mueble"); pintaLista("material");
  if (esEscritorio()) pintaDetalle();
  if (E.vista === "recados") pintaRecados(); if (E.vista === "bitacora") pintaBitacora(); if (E.vista === "apodos") pintaApodos(); if (E.vista === "ajustes") pintaAjustes(); if (E.vista === "pedidos") pintaPedidos();
  const mBajos = E.productos.filter(p => p.tipo === "mueble" && p.activo !== false && estado(p)).length;
  const tBajos = E.productos.filter(p => p.tipo === "material" && p.activo !== false && estado(p)).length;
  $("#nMue").hidden = !mBajos; $("#nMue").textContent = mBajos; $("#nMat").hidden = !tBajos; $("#nMat").textContent = tBajos;
}

/* ═══════════════ actualización de la app ═══════════════ */
let swNuevo = null;
function buscaActualizacion(){
  if (!("serviceWorker" in navigator)) return grita("Este navegador no guarda la app; siempre abre la última versión.");
  navigator.serviceWorker.getRegistration().then(r => { if (!r) return grita("Aún no instalada; ya tienes la última."); r.update().then(() => setTimeout(() => { if (!swNuevo) grita("Ya tienes la última versión."); }, 1500)); });
}
if ("serviceWorker" in navigator && location.protocol !== "file:"){
  navigator.serviceWorker.register("sw.js").then(r => {
    r.addEventListener("updatefound", () => {
      const w = r.installing; if (!w) return;
      w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller){ swNuevo = w; $("#actualiza").hidden = false; } });
    });
  }).catch(() => {});
  // Solo se recarga cuando la persona pidió actualizar; la primera instalación no debe parpadear.
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (E.actualizando) location.reload(); });
  $("#btnActualiza").onclick = () => { E.actualizando = true; if (swNuevo) swNuevo.postMessage("activa"); else location.reload(); };
}

/* ═══════════════ arranque ═══════════════ */
$("#versionLat").textContent = "Almacén · " + ((window.CONFIG || {}).VERSION || "").split(" · ")[0];
pintaYo();
Almacen.mira("producto", l => { E.productos = l; pintaTodo(); });
Almacen.mira("movimiento", l => { E.movimientos = l; pintaTodo(); });
Almacen.mira("recado", l => { E.recados = l; pintaRecados(); });
Almacen.mira("persona", l => { E.personas = l; });
Almacen.mira("pedido", l => { E.pedidos = l; pintaPedidos(); });
Almacen.onEstado(pintaPulso);
(async () => {
  await Almacen.arranca();
  pintaPulso();
  const h = (location.hash || "#muebles").slice(1);
  irA(["muebles","material","pedidos","recados","bitacora","apodos","ajustes"].includes(h) ? h : "muebles");
  if (!E.yo && !Almacen.necesitaEntrar()) hojaQuienSoy();
})();
