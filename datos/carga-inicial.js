/* ═══════════════════════════════════════════════════════════════════════════
   Stock del viernes 2 de octubre de 2026, copiado de las dos hojas del taller.
   Se carga UNA vez desde Ajustes → "Stock del 2 de octubre". Borra todo lo
   que haya en muebles y piezas y pone esto. El material no se toca.

   Reglas que se siguieron (dictadas por el taller):
   · Los números de puertas de la hoja 1 son JUEGOS por mueble; la app los
     convierte a puertas con la ficha del modelo (×).
   · Lo que no se ha pintado no tiene color (stock almacenado).
   · "Hoy se pintan" cuenta ya como pintado.
   · Lo que no está en el catálogo se agrega en amarillo (pendiente de revisar).
   · Muebles armados "genéricos" (Monarca normal, Mariana de 3 cajones…) se
     cargan con ese nombre, en amarillo.
   ═══════════════════════════════════════════════════════════════════════════ */
/* Hoja de pintura del mismo día. Se carga con su propio botón; SUMA a lo que haya
   (no borra material). Los nombres nuevos van tal cual los escribió el taller;
   los que ya existían (confirmado por el taller) se suman al mismo producto. */
window.CARGA_PINTURA = {
  id: "carga-pintura-2026-10-02",
  titulo: "Pintura del 2 de octubre",
  motivo: "pintura del 2 de octubre (libreta)",
  /* {nombre, presentacion, cantidad (almacén), cabina (abiertos en cabina), apodos} */
  material: [
    // Tambos sellados en el almacén + tambos abiertos en cabina (1 cada uno)
    { nombre: "Rojo bermellón",      presentacion: "Tambo", cantidad: 1, cabina: 1, apodos: ["rojo bermellón"] },
    { nombre: "Gris",                presentacion: "Tambo", cantidad: 3, cabina: 1, apodos: ["gris"] },
    { nombre: "DIM NEGRO",           presentacion: "Tambo", cantidad: 2, cabina: 0 },
    { nombre: "Nogal rojizo (café)", presentacion: "Tambo", cantidad: 1, cabina: 1, apodos: ["nogal rojizo"] },
    { nombre: "Blanco",              presentacion: "Tambo", cantidad: 1, cabina: 1, apodos: ["blanco"] },
    { nombre: "Solvente",            presentacion: "Tambo", cantidad: 1, cabina: 0, apodos: ["solvente"] },
    { nombre: "MEZCLA DIM-500",      presentacion: "Tambo", cantidad: 3, cabina: 1 },
    { nombre: "Fondo negro",         presentacion: "Tambo", cantidad: 0, cabina: 1, apodos: ["fondo negro"] },
    { nombre: "Sellador",            presentacion: "Tambo", cantidad: 0, cabina: 1, apodos: ["sellador"] },
    { nombre: "Laca negra",          presentacion: "Tambo", cantidad: 0, cabina: 1, apodos: ["laca negra"] },
    // Cubetas (brillos, fondos, selladores)
    { nombre: "Laca industrial TRO naranja",            presentacion: "Cubeta", cantidad: 1,  apodos: ["laca naranja"] },
    { nombre: "HICEL FONDO TRANSPARENTE DELICIAS",     presentacion: "Cubeta", cantidad: 21 },
    { nombre: "Acabado PU Versátil B010",               presentacion: "Cubeta", cantidad: 18, apodos: ["acabado PU"] },
    { nombre: "Aguarrás sintético",                     presentacion: "Cubeta", cantidad: 1,  apodos: ["aguarrás"] },
    { nombre: "BARNIZ PU BLANCO ESTABLE ALTO BRILLO",   presentacion: "Cubeta", cantidad: 3 },
    { nombre: "Laca ultrable Hipol 1768",               presentacion: "Cubeta", cantidad: 6,  apodos: ["laca ultrable"] },
    { nombre: "Barniz de poliuretano mate",             presentacion: "Cubeta", cantidad: 1,  apodos: ["barniz mate"] },
    { nombre: "Catalizador para poliuretano",           presentacion: "Cubeta", cantidad: 13, apodos: ["catalizador poliuretano"] },
    { nombre: "Laca blanca Hicel Amozoc",               presentacion: "Cubeta", cantidad: 1,  apodos: ["laca blanca"] },
    { nombre: "Hipol 5004 laca X-Mate A.D.",            presentacion: "Cubeta", cantidad: 1,  apodos: ["laca X-Mate"] },
    { nombre: "PUP-015 Polyprimer negro",               presentacion: "Cubeta", cantidad: 1,  apodos: ["polyprimer negro"] },
    { nombre: "LACA INDUSTRIAL NITRO AMARILLO OXIDO",   presentacion: "Cubeta", cantidad: 1 },
    { nombre: "Sellador S-270",                         presentacion: "Cubeta", cantidad: 1,  apodos: ["sellador S-270"] },
    { nombre: "Laca industrial de nitro azul CL",       presentacion: "Cubeta", cantidad: 1,  apodos: ["laca azul"] },
    { nombre: "CF-6040 CATALIZADOR",                    presentacion: "Cubeta", cantidad: 4 }
  ]
};

window.CARGA_INICIAL = {
  id: "carga-2026-10-02",
  titulo: "Stock del 2 de octubre",
  motivo: "stock del 2 de octubre (libreta)",

  /* Modelos que no estaban en el catálogo. Las fichas son las que dio el taller;
     lo que no dijo queda en null (falta dato). Todos quedan "por revisar". */
  modelos: [
    { id: "N-ropero-san-jose",   nombre: "Ropero San José",   familia: "Ropero",    tipo: "madera", cajones: 4,    total_puertas: 3,  puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null },
    { id: "N-ropero-alondra",    nombre: "Ropero Alondra",    familia: "Ropero",    tipo: "madera", cajones: 6,    total_puertas: 3,  puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null },
    { id: "N-ropero-maya",       nombre: "Ropero Maya",       familia: "Ropero",    tipo: "madera", cajones: 4,    total_puertas: 3,  puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null },
    { id: "N-ropero-ovalo",      nombre: "Ropero Óvalo",      familia: "Ropero",    tipo: "madera", cajones: 3,    total_puertas: 3,  puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null, nota: "El taller dijo «3 cajones» cuando se preguntó por puertas; se puso 3 y 3. Revisar." },
    { id: "N-monarca-cisne",     nombre: "Monarca Cisne",     familia: "Monarca",   tipo: "madera", cajones: null, total_puertas: 10, puertas_grandes: 2, puertas_grandes_luna: 2, puertas_chicas: 6, puertas_chicas_luna: 0, lleva_parches: null, lleva_respaldo: null },
    { id: "N-petaquero-monaco",  nombre: "Petaquero Mónaco Multifamiliar", familia: "Petaquero", tipo: "madera", cajones: null, total_puertas: 6, puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null },
    { id: "N-mariana-rombo-2l",  nombre: "Mariana Rombo 2L",  familia: "Mariana",   tipo: "madera", cajones: null, total_puertas: 5,  puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null },
    { id: "N-librero-jumbo",     nombre: "Librero Jumbo",     familia: "Librero",   tipo: "mdf",    cajones: null, total_puertas: null, puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null },
    // Genéricos: así vienen en la libreta cuando el mueble todavía puede ser de varios modelos
    { id: "G-monarca-normal",    nombre: "Monarca normal (Abanico / Mónaco)", familia: "Monarca",   tipo: "madera", cajones: 4, total_puertas: 10, puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null, nota: "Genérico: cuando se sepa el modelo, pasarlo al que sea." },
    { id: "G-mariana-3-cajones", nombre: "Mariana 3 cajones (genérico)",      familia: "Mariana",   tipo: "madera", cajones: 3, total_puertas: null, puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null, nota: "Genérico: cualquier Mariana de 3 cajones." },
    { id: "G-mariana-2-lunas",   nombre: "Mariana 2 lunas (genérico)",        familia: "Mariana",   tipo: "madera", cajones: null, total_puertas: null, puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null, nota: "En la libreta: «Marianas 2L c/c». Revisar qué modelo es." },
    { id: "G-petaquero-multi",   nombre: "Petaquero Multifamiliar (genérico)", familia: "Petaquero", tipo: "madera", cajones: 6, total_puertas: 6, puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null, nota: "Genérico: el taller dijo «son multifamiliares» sin modelo." },
    { id: "G-librero",           nombre: "Librero (genérico)",                familia: "Librero",   tipo: "mdf",    cajones: null, total_puertas: null, puertas_grandes: null, puertas_grandes_luna: null, puertas_chicas: null, puertas_chicas_luna: null, lleva_parches: null, lleva_respaldo: null, nota: "12 libreros N2 sin decir de cuántas pulgadas." }
  ],

  /* Muebles: [modelo, etapa, cantidad, color, maquilo, armo] — color "" = sin color todavía */
  muebles: [
    // Hoja 1, abajo: armados (listos para pintar)
    ["Monarca normal (Abanico / Mónaco)", "armado", 1, ""],
    ["Mariana 3 cajones (genérico)",      "armado", 20, ""],
    ["Mariana Rayas",                     "armado", 3, ""],
    ["Cajonera Amanda 5 cajones",         "armado", 2, ""],
    ["Cajonera Amanda 10 cajones",        "armado", 1, ""],
    ["Vitrina Kukis",                     "armado", 2, ""],
    ["Vitrina Angelita",                  "armado", 8, ""],
    ["Ropero Deysi",                      "armado", 2, ""],
    ["Ropero Poliéster",                  "armado", 3, ""],
    // Hoja 1, N2: muebles de MDF hechos por Fernando
    ["Recámara Óvalo",                    "mdf", 6, "", "Fernando", "Fernando"],
    ["Alacena Delfina Con porta garrafón","mdf", 1, "", "Fernando", "Fernando"],
    ["Alacena Midas",                     "mdf", 5, "", "Fernando", "Fernando"],
    ["Tocador Cisne",                     "mdf", 3, "", "Fernando", "Fernando"],
    ["Tocador Óvalo",                     "mdf", 7, "", "Fernando", "Fernando"],
    ["Librero (genérico)",                "mdf", 12, "", "Fernando", "Fernando"],
    // Hoja 2: huacales pintados
    ["Monarca Midas Con lámpara",         "pintado", 2, "Negro completo"],
    ["Ropero San José",                   "pintado", 9, "Café completo"],
    ["Petaquero Multifamiliar (genérico)","pintado", 5, "Negro completo"],
    ["Mariana 2 lunas (genérico)",        "pintado", 5, "Negro completo"],
    ["Mariana 3 cajones (genérico)",      "pintado", 20, "Negro completo"],
    ["Librero Jumbo",                     "mdf_pintado", 2, "Negro completo", "Fernando", "Fernando"]
  ],

  /* Puertas: [modelo, sección, JUEGOS, color]. La app multiplica por las puertas del modelo. */
  juegos: [
    // Hoja 1, arriba: ya lijadas (sin bisagras)
    ["Monarca Mónaco", "puertas_lijadas", 4], ["Monarca México Con lámpara", "puertas_lijadas", 1], ["Monarca Abanico", "puertas_lijadas", 7],
    ["Monarca Colonial", "puertas_lijadas", 2], ["Monarca Tablero", "puertas_lijadas", 3], ["Monarca Midas", "puertas_lijadas", 17],
    ["Monarca Mariposa", "puertas_lijadas", 2], ["Monarca Rejilla Mixta", "puertas_lijadas", 5], ["Monarca Midas Con lámpara", "puertas_lijadas", 9],
    ["Monarca Duela", "puertas_lijadas", 7], ["Monarca Maya", "puertas_lijadas", 18], ["Monarca Liso 2.40", "puertas_lijadas", 2],
    ["Monarca Cisne", "puertas_lijadas", 5], ["Monarca México", "puertas_lijadas", 1], ["Monarca Rombo", "puertas_lijadas", 8], ["Monarca Óvalo", "puertas_lijadas", 4],
    ["Mariana Mariposa", "puertas_lijadas", 5], ["Mariana Rombo", "puertas_lijadas", 2], ["Mariana Cisne", "puertas_lijadas", 14],
    ["Mariana Abanico", "puertas_lijadas", 10], ["Mariana Maya", "puertas_lijadas", 17], ["Mariana Rayas", "puertas_lijadas", 3],
    ["Mariana Midas", "puertas_lijadas", 18], ["Mariana Ramas", "puertas_lijadas", 2], ["Mariana Rejilla Mixta 3 cajones", "puertas_lijadas", 2],
    ["Mariana Duela Abatible", "puertas_lijadas", 2], ["Mariana México", "puertas_lijadas", 2], ["Mariana Tablero", "puertas_lijadas", 2], ["Mariana Canadá", "puertas_lijadas", 1],
    ["Petaquero Abanico Multifamiliar", "puertas_lijadas", 1], ["Petaquero Óvalo Multifamiliar", "puertas_lijadas", 1], ["Petaquero Cisne Multifamiliar", "puertas_lijadas", 4],
    ["Petaquero Rombo Multifamiliar", "puertas_lijadas", 11], ["Petaquero Rejilla Mixta Multifamiliar", "puertas_lijadas", 1], ["Petaquero Mariposa Multifamiliar", "puertas_lijadas", 5],
    ["Petaquero Maya Multifamiliar", "puertas_lijadas", 9],
    ["Ropero Deysi", "puertas_lijadas", 2], ["Ropero Alondra", "puertas_lijadas", 1], ["Ropero Óvalo", "puertas_lijadas", 7], ["Ropero Sammy", "puertas_lijadas", 10], ["Ropero Palomo", "puertas_lijadas", 4],
    ["Vitrina Angelita", "puertas_lijadas", 10], ["Vitrina Kukis", "puertas_lijadas", 12],
    // Hoja 1, en medio: por lijar
    ["Monarca Midas Con lámpara", "puertas_por_lijar", 15], ["Monarca Maya", "puertas_por_lijar", 3], ["Monarca México", "puertas_por_lijar", 5],
    ["Monarca Duela Con lámpara", "puertas_por_lijar", 2], ["Monarca Rombo", "puertas_por_lijar", 8], ["Monarca África", "puertas_por_lijar", 4],
    ["Mariana Maya", "puertas_por_lijar", 4], ["Mariana Tablero", "puertas_por_lijar", 18], ["Mariana Abanico", "puertas_por_lijar", 15],
    ["Mariana Cisne", "puertas_por_lijar", 1], ["Mariana Mónaco", "puertas_por_lijar", 4],
    ["Ropero Alondra", "puertas_por_lijar", 9], ["Ropero Maya", "puertas_por_lijar", 10], ["Ropero Óvalo", "puertas_por_lijar", 10], ["Ropero San José", "puertas_por_lijar", 30],
    ["Petaquero Mónaco Multifamiliar", "puertas_por_lijar", 4], ["Petaquero Liso Multifamiliar", "puertas_por_lijar", 1],
    ["Vitrina Angelita", "puertas_por_lijar", 5], ["Vitrina Kukis", "puertas_por_lijar", 6],
    // Hoja 2: puertas pintadas (con color; "hoy se pintan" ya cuenta)
    ["Monarca Maya", "puertas_pintadas", 4, "Café completo"], ["Monarca Cisne", "puertas_pintadas", 1, "Negro completo"],
    ["Monarca Midas Con lámpara", "puertas_pintadas", 2, "Gris completo"], ["Cómoda Midas", "puertas_pintadas", 2, "Café completo"],
    ["Ropero San José", "puertas_pintadas", 13, "Café completo"], ["Ropero Sammy", "puertas_pintadas", 4, "Negro completo"],
    ["Petaquero Cisne Multifamiliar", "puertas_pintadas", 1, "Negro completo"], ["Petaquero Cisne Multifamiliar", "puertas_pintadas", 2, "Café completo"],
    ["Petaquero Óvalo Multifamiliar", "puertas_pintadas", 4, "Café completo"], ["Petaquero Maya Multifamiliar", "puertas_pintadas", 5, "Negro completo"],
    ["Petaquero Rombo Multifamiliar", "puertas_pintadas", 5, "Café completo"], ["Vitrina Kukis", "puertas_pintadas", 9, "Negro puertas grises"],
    ["Mariana Mónaco", "puertas_pintadas", 1, "Blanco completo"], ["Mariana Rombo 2L", "puertas_pintadas", 5, "Café completo"],
    ["Mariana Midas", "puertas_pintadas", 2, "Gris completo"], ["Mariana Midas", "puertas_pintadas", 6, "Café completo"],
    ["Mariana Abanico", "puertas_pintadas", 6, "Café completo"], ["Mariana Rombo", "puertas_pintadas", 2, "Café completo"],
    ["Mariana Rejilla Mixta 3 cajones", "puertas_pintadas", 2, "Café completo"], ["Mariana México", "puertas_pintadas", 2, "Café completo"],
    ["Mariana Cisne", "puertas_pintadas", 2, "Negro completo"], ["Mariana Duela Abatible", "puertas_pintadas", 2, "Negro completo"]
  ]
};

/* ═══════════════════════════════════════════════════════════════════════════
   Pedidos de la libreta (septiembre de 2026), copiados de las 4 fotos.
   Se cargan UNA vez desde Ajustes → "Pedidos de la libreta". Se SUMAN a los
   pedidos que ya haya (no borran nada).
   · Lo que el taller dijo que ya se entregó va con `entregado` = cantidad.
   · Los nombres que no se entendieron van tal cual la libreta, con "(?)",
     para que el taller los corrija con Editar; no se inventó ningún modelo.
   · "Surtidos" / "diferente color" se guardan como texto, sin modelo.
   · Los renglones tachados con raya al inicio de las fotos 3 y 4 no se
     cargaron: no se ve de qué cliente son y ya estaban tachados.
   Renglón: [mueble, color, cantidad, entregado]
   ═══════════════════════════════════════════════════════════════════════════ */
window.CARGA_PEDIDOS = {
  id: "carga-pedidos-2026-10-05",
  titulo: "Pedidos de la libreta (septiembre)",
  pedidos: [
    { cliente: "Sr. Alfredo, Lupe Lupita", fecha: "2026-09-30", notas: "5 % de descuento", lineas: [
      ["Ropero Elvis", "Negro puertas blancas", 1, 0] ] },
    { cliente: "Sr. Edgar Vazquez", fecha: "2026-09-24", notas: "", lineas: [
      ["Monarca Lámpara (?)", "Negro puertas grises", 4, 0],
      ["Monarca África", "", 4, 0],
      ["Monarca Maya", "Negro puertas blancas", 4, 0],
      ["Ropero Óvalo", "", 10, 0],
      ["Ropero San José", "", 4, 0] ] },
    { cliente: "Guillermo Perez", fecha: "2026-09-24", notas: "", lineas: [
      ["Cómoda Rombo", "", 1, 0],
      ["Vitrina Angelita", "Negro completo", 1, 0],
      ["Librero Monte Carlos 75 pulgadas", "", 1, 0] ] },
    { cliente: "Hector De La Rosa", fecha: "2026-09-25", notas: "Sammy: la libreta dice «negro + gris»", lineas: [
      ["Monarca Rombo", "Café completo", 6, 0],
      ["Ropero Sammy", "Negro puertas grises", 8, 0],
      ["Cómoda Midas", "Negro completo", 6, 0] ] },
    { cliente: "Unión Mueblera Poblana", fecha: "2026-09-25", notas: "Bustos", lineas: [
      ["Monarca Rombo", "Negro puertas cafés", 1, 0],
      ["Monarca Midas", "Negro puertas grises", 1, 0],
      ["Monarca Lámpara (?)", "Negro puertas cafés", 1, 0],
      ["Monarca Midas Con lámpara", "Negro puertas cafés", 1, 0],
      ["Vitrina Kukis", "Café completo", 1, 0],
      ["Vitrina Kukis", "Negro completo", 1, 0],
      ["Mariana Canadá", "", 1, 0],
      ["Mariana surtido", "", 2, 0, { surtido: true, familia: "Mariana" }],
      ["Librero Plasma (?)", "Negro completo", 2, 0] ] },
    { cliente: "Sr. Sabino Ramos", fecha: "2026-09-29", notas: "Libres", lineas: [
      ["Mariana surtido (diferente color)", "", 10, 0, { surtido: true, familia: "Mariana" }],
      ["Mariana surtido", "Gris completo", 2, 0, { surtido: true, familia: "Mariana" }],
      ["Vitrina Kukis", "", 8, 0],
      ["Monarca surtido", "", 3, 0, { surtido: true, familia: "Monarca" }],
      ["Tocador Óvalo", "", 6, 0] ] },
    { cliente: "Gregorio Zacapa", fecha: "2026-09-29", notas: "", lineas: [
      ["Monarca surtido", "", 18, 0, { surtido: true, familia: "Monarca" }],
      ["Mariana surtido", "", 15, 0, { surtido: true, familia: "Mariana" }],
      ["Ropero San José", "", 20, 0] ] },
    { cliente: "Asociación Mueblera", fecha: "2026-09-23", notas: "Las 12 cómodas Amanda ya se entregaron. Junto a las Amanda de 10 cajones la libreta tiene una «P» y un «7».", lineas: [
      ["Mariana 3 cajones (genérico)", "Negro puertas cafés", 10, 0],
      ["Mariana 2 lunas (genérico)", "", 5, 0],
      ["Cajonera Amanda 5 cajones", "", 12, 12],
      ["Cajonera Amanda 10 cajones", "Café completo", 5, 0],
      ["Vitrina Kukis", "Negro puertas cafés", 3, 0],
      ["Monarca Lámpara (?)", "Negro puertas cafés", 2, 0],
      ["Ropero San José", "Café completo", 3, 0] ] },
    { cliente: "Sra. Josefina Celis", fecha: "2026-09-24", notas: "Los petaqueros ya se entregaron. De las Marianas: 2 Midas negro puertas grises y 1 Mónaco negro puertas blancas ya se entregaron.", lineas: [
      ["Petaquero Rombo Multifamiliar", "Café completo", 2, 2],
      ["Petaquero Cisne Multifamiliar", "Café completo", 2, 2],
      ["Petaquero Tablero Multifamiliar", "Gris completo", 2, 2],
      ["Petaquero Rejilla Mixta Multifamiliar", "Gris completo", 2, 2],
      ["Petaquero Duela Multifamiliar", "", 2, 2],
      ["Petaquero Mónaco Multifamiliar", "Blanco completo", 2, 2],
      ["Petaquero México Multifamiliar", "Negro completo", 2, 2],
      ["Petaquero Midas Multifamiliar", "Gris completo", 2, 2],
      ["Mariana Rombo", "Café completo", 2, 0],
      ["Mariana Cisne", "Negro completo", 2, 0],
      ["Mariana Tablero", "Gris completo", 2, 0],
      ["Mariana Rejilla Mixta 3 cajones", "Café completo", 2, 0],
      ["Mariana Duela Abatible", "Negro completo", 2, 0],
      ["Mariana Mónaco", "Negro puertas blancas", 2, 1],
      ["Mariana México", "Café completo", 2, 0],
      ["Mariana Midas", "Negro puertas grises", 2, 2] ] },
    { cliente: "Sr. Pedro Orozco", fecha: "2026-09-09", notas: "", lineas: [
      ["Monarca Cisne", "Negro completo", 5, 0],
      ["Monarca Cisne", "Negro puertas grises", 5, 5],
      ["Monarca Midas Con lámpara", "Negro puertas grises", 3, 3],
      ["Monarca Midas Con lámpara", "Negro puertas cafés", 5, 5],
      ["Monarca Rombo", "Negro completo", 5, 0],
      ["Monarca Rombo", "Café completo", 5, 0],
      ["Monarca Óvalo", "Negro completo", 5, 0],
      ["Librero Monte Carlos 75 pulgadas", "Negro completo", 3, 0] ] }
  ]
};

/* Correcciones a los pedidos que YA se cargaron con la versión 2.4 (nombres que el taller
   aclaró después). Se aplican UNA vez desde Ajustes → "Correcciones de la libreta".
   cambios: { cliente, modelo (como quedó cargado), color?, pon: {…} | borrar: true } */
window.CARGA_ARREGLO = {
  id: "arreglo-pedidos-2026-10-06",
  titulo: "Correcciones de la libreta",
  cambios: [
    { cliente: "Guillermo Perez",     modelo: "Librero Monte Carlos (¿pulgadas?)", pon: { modelo: "Librero Monte Carlos 75 pulgadas" } },
    { cliente: "Sr. Pedro Orozco",    modelo: "Librero Monte Carlos (¿pulgadas?)", pon: { modelo: "Librero Monte Carlos 75 pulgadas" } },
    { cliente: "Sra. Josefina Celis", modelo: "Petaquero Mónaco (?)",              pon: { modelo: "Petaquero Mónaco Multifamiliar" } },
    { cliente: "Sra. Josefina Celis", modelo: "Mariana (no se lee el modelo) (?)", pon: { modelo: "Mariana Rejilla Mixta 3 cajones" } },
    { cliente: "Sra. Josefina Celis", modelo: "Mariana Mónaco",                    pon: { color: "Negro puertas blancas", entregado: 1 } },
    { cliente: "Sra. Josefina Celis", modelo: "Mariana Midas",                     pon: { color: "Negro puertas grises", entregado: 2 } },
    { cliente: "Sr. Sabino Ramos",    modelo: "Base Óvalo, solo la base (?)",       borrar: true },
    { cliente: "",                    modelo: "Mariana surtido",                   pon: { surtido: true, familia: "Mariana" } },
    { cliente: "",                    modelo: "Mariana surtido (diferente color)", pon: { surtido: true, familia: "Mariana", modelo: "Mariana surtido" } },
    { cliente: "",                    modelo: "Monarca surtido",                   pon: { surtido: true, familia: "Monarca" } }
  ]
};
