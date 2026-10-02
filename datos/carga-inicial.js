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
