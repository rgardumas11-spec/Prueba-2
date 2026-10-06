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
| **Plan del día** | Lo que hoy se va a hacer. Se arma desde Reportes → Muebles y piezas con el botón **Descontar**: baja del inventario al momento y queda aquí pendiente. **Listo** pregunta cuántas se hicieron (el resto regresa a su sección), el lápiz cambia la cantidad y la ✕ lo regresa todo. Puertas lijadas sin bisagras piden autorización para pintarse. |
| **Muebles** | Pestañas por etapa. En la primera etapa (maquilado o MDF) se **registra** lo recién hecho. En las demás, **Registrar** escoge entre lo que hay en la etapa anterior y lo descuenta de ahí solo ("Daniel: 5 disponibles"); también se puede **Pasar a…** desde la etapa de origen. Nunca se puede tomar más de lo que hay. Cada lote recuerda quién lo maquiló, armó y pintó. |
| **Piezas** | Puertas: Uriel → por lijar → lijadas (con/sin bisagras) → pintadas. Cajones: **armados → pintados**. Parches: **por lijar → lijados → pintados**, solo para modelos cuya ficha dice cuántos parches llevan. Cada renglón dice cuántas piezas hay y a cuántos **juegos** equivalen; si sobran sueltas (no completan juego) sale en rojo. El botón **Por pieza / Por juego** hace que − y ＋ muevan de una en una o un juego completo; al registrar o pasar también se puede escribir la cantidad en juegos. Puertas por mueble y color en cadena: **Puertas Uriel** (disponibles para que Uriel las pre lije) → **Puertas por lijar** → **Puertas lijadas** (arriba las que ya tienen bisagras, abajo las que no; botón **Embisagrar**) → **Puertas pintadas** (solo desde las que tienen bisagras). Cajones y parches pintados aparte. Cada renglón dice a cuántos muebles equivale según la ficha: "19 puertas = 1 mueble · falta 1 para el siguiente". |
| **Listos para preparar** | Se calcula solo: muebles pintados que ya tienen sus puertas y cajones pintados. Avisa "faltan parches" y "sin ficha completa". |
| **Pedidos** | Un renglón puede ser **surtido** (el cliente deja escoger los modelos de una familia); al entregarlo hay que decir qué muebles se dieron. Los nombres que no están en el catálogo salen con un sello rojo. Ticket por cliente con fecha (día/mes/año), lo pedido y cuántos van entregados por renglón, con barra de avance. Más nuevos primero (se puede invertir). |
| **Material** | Cubetas · Tambos (sellados en el almacén) · Tambos en cabina. Un tambo pasa del almacén a la cabina con **Pasar a cabina**; en cabina solo se resta hasta cero. Cubetas: − y +. |
| **Mueble preparado** | Etapa final: desde Mueble pintado o MDF pintado, **Preparar** descuenta las puertas, cajones y parches pintados del modelo y pregunta quién lo preparó (César, Raúl, Gabino). |
| **Recados** | Agrupados por semana del taller (sábado a viernes). Al registrar un mueble maquilado se pone solo un recado con quién lo maquiló. Lo marcado como hecho se ve transparente y se borra el domingo a las 12 de la noche. |
| **Reportes** | Muebles y piezas (Zona de muebles y Zona de piezas, una tabla por sección, o solo la sección que escojas), Pintura, Pedidos (por cliente: qué falta y qué hay para cubrirlo) y **Movimientos de la semana** (todo lo hecho de sábado a viernes; la nube lo borra el domingo en la noche, así que se baja en PDF antes). En computadora se imprime; en celular se baja en PDF. |
| **Recados** | Avisos para el equipo, con quién ya los vio y quién los cerró. |
| **Bitácora** | Se escribe sola: cada registro, paso de etapa o corrección con fecha, hora, quién lo capturó y quién hizo el trabajo. |
| **Catálogo** | La ficha de cada modelo agrupada por familia (Mariana, Monarca… y MDF hasta abajo). Se edita aquí; si falta un dato se marca en rojo y el sistema no lo inventa. Al final, **Piezas extras**: piezas que se agregan solo por nombre, entran a Puertas Uriel y llegan hasta lijadas. |
| **Color** | Lo que todavía no se pinta no tiene color (es stock almacenado). El color se escoge al pasar a Mueble pintado, MDF pintado o Puertas pintadas. |
| **Catálogo de material** | Todo el material con **litros · nombre · apodo**, editable al tocarlo. El apodo es el nombre con el que se ve en Material. |
| **Ajustes** | **Revisar nombres**: encuentra nombres de pedidos, muebles y piezas que no están tal cual en el catálogo y los fusiona con el modelo correcto. Cargas de la libreta (pedidos de septiembre, stock y pintura del 2 de octubre; el stock se puede volver a dejar como ese día), quién soy, modo práctica, hojas de conteo para imprimir, revisar el aparato, versión. |

La búsqueda está detrás de la lupa de cada pantalla y perdona faltas de ortografía
("Maliana Sisne" encuentra "Mariana Cisne"); si nada se parece, dice que no lo encontró.

## Quién firma cada paso

| Paso | Quién puede |
|---|---|
| Mueble maquilado | Miguel · Luis · Daniel (uno) |
| Mueble armado | Giovanni · Luis · Daniel (uno) |
| Mueble pintado | Brandon · Antelmo · Raúl · Juan (hasta dos) |
| Mueble preparado | César · Raúl · Gabino (uno) |
| Mueble de MDF | Fernando (maquila y arma); al pintarlo no se pregunta |
| Embisagrar puertas | Miguel · Daniel · Luis (uno). Ningún otro paso de puertas pregunta |
| Cajones pintados | Brandon · Juan · Antelmo · Raúl · Ángel · Daniel · Jorge (uno) |

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
datos/carga-inicial.js   el stock y la pintura del 2 de octubre y los pedidos de septiembre, copiados de la libreta; se cargan desde Ajustes
datos/almacen.js    capa de datos: nube o local, misma cara
datos/reglas-firestore.txt  reglas de la base (se pegan en Firebase)
diseno/             vista previa aprobada
```

Para publicar una versión nueva: cambiar `VERSION` en `config.js` y el número en
`sw.js`, y subir a `main`.
