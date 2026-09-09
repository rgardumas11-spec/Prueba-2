# Almacén San Bernardo

Existencias del taller Muebles San Bernardo: **muebles por etapa de producción**
(maquilado → armado → pintado; MDF → MDF pintado), **piezas** (puertas, cajones,
parches) con su equivalencia a muebles, **muebles listos para preparar**, **pedidos**,
**material** (cubetas y tambos), recados y bitácora. Se usa desde el celular y desde
varias computadoras a la vez, con una sola base compartida (Firebase).

Va **aparte** del programa de producción: repositorio propio, base propia, ni una línea
en común. Solo se copió, una vez, la ficha de cada modelo (cuántas puertas y cajones
lleva) como punto de partida; desde entonces se edita dentro de la app.

## Cómo se abre

- **Computadora**: la dirección de la app en Chrome, Edge o Safari. Se ve como programa
  de escritorio: barra lateral, tabla, panel de detalle.
- **Celular**: la misma dirección. Para que quede como app con su icono:
  - iPhone: botón **Compartir** (cuadrito con flecha) → **Agregar a pantalla de inicio**.
  - Android: menú **⋮** → **Instalar app** o **Agregar a pantalla principal**.

Cuando se publica una versión nueva, la app avisa arriba en verde y se actualiza sola.

## Qué hace

| Pantalla | Para qué |
|---|---|
| **Muebles** | Pestañas por etapa. Se **registra** solo en la primera etapa (maquilado o MDF); a las siguientes se llega con **Pasar a…**, escogiendo de qué lotes salen ("Daniel: 5 disponibles"). Nunca se puede tomar más de lo que hay. Cada lote recuerda quién lo maquiló, armó y pintó. |
| **Piezas** | Puertas (pre lijadas → lijadas → con bisagras → pintadas), cajones pintados y parches pintados, por mueble y color. Cada renglón dice a cuántos muebles equivale según la ficha del modelo: "19 puertas = 1 mueble · falta 1 para el siguiente". |
| **Listos para preparar** | Se calcula solo: muebles pintados que ya tienen sus puertas y cajones pintados. Avisa "faltan parches" y "sin ficha completa". |
| **Pedidos** | Ticket por cliente con fecha (día/mes/año), lo pedido y cuántos van entregados por renglón, con barra de avance. Más nuevos primero (se puede invertir). |
| **Resumen** | Solo consulta: todo lo que hay de cada mueble y color, por etapa y piezas. No se captura nada aquí. |
| **Material** | Cubetas y tambos con **−** y **+**, hasta 3 apodos y litros por envase. Código de barras opcional. |
| **Recados** | Avisos para el equipo, con quién ya los vio y quién los cerró. |
| **Bitácora** | Se escribe sola: cada registro, paso de etapa o corrección con fecha, hora, quién lo capturó y quién hizo el trabajo. |
| **Catálogo** | La ficha de cada modelo (madera o MDF, cajones, puertas, parches, respaldo). Se edita aquí; si falta un dato se marca en rojo y el sistema no lo inventa. |
| **Ajustes** | Quién soy, modo práctica, hojas de conteo para imprimir, revisar el aparato, versión. |

La búsqueda está detrás de la lupa de cada pantalla y perdona faltas de ortografía
("Maliana Sisne" encuentra "Mariana Cisne"); si nada se parece, dice que no lo encontró.

## Quién firma cada paso

| Paso | Quién puede |
|---|---|
| Mueble maquilado | Miguel · Luis · Daniel (uno) |
| Mueble armado | Giovanni · Rafael (uno) |
| Mueble pintado | Brandon · Antelmo · Raúl · Juan (hasta dos) |
| Mueble de MDF | Fernando (maquila y arma); al pintarlo no se pregunta |
| Puertas con bisagras | Miguel · Luis · Daniel (uno) |
| Puertas y cajones pintados | Brandon · Juan · Antelmo · Raúl · Ángel · Daniel · Jorge (uno) |

## Archivos

```
index.html          la página
estilos.css         colores del logo, celular y computadora
app.js              la pantalla
config.js           ← llaves de Firebase y versión
sw.js               abre sin señal y avisa de versiones nuevas
manifest.json       para instalarse como app
datos/reglas.js     etapas, responsables, equivalencias, listos para preparar
datos/busca.js      búsqueda tolerante
datos/catalogo.js   ficha de arranque de los modelos, colores, clientes, material
datos/almacen.js    capa de datos: nube o local, misma cara
datos/reglas-firestore.txt  reglas de la base (se pegan en Firebase)
diseno/             vista previa aprobada
```

Para publicar una versión nueva: cambiar `VERSION` en `config.js` y el número en
`sw.js`, y subir a `main`.
