# Almacén San Bernardo

Existencias de **muebles** (por sección: pintados, armados, maquilados, puertas…) y de
**material** (cubetas y tambos) para el taller Muebles San Bernardo. Se usa desde el
celular y desde varias computadoras a la vez, con una sola base compartida.

Va **aparte** del programa de producción: repositorio propio, base propia, ni una línea
en común.

## Cómo se abre

- **Computadora**: la dirección de la app en Chrome, Edge o Safari. Se ve como programa
  de escritorio: barra lateral, tabla, teclado.
- **Celular**: la misma dirección. Para que quede como app con su icono:
  - iPhone: botón **Compartir** (cuadrito con flecha) → **Agregar a pantalla de inicio**.
  - Android: menú **⋮** → **Instalar app** o **Agregar a pantalla principal**.

Cuando se publica una versión nueva, la app avisa arriba en verde y se actualiza sola.
No hay que borrarla ni volver a instalar nada.

## Qué hace

| Pantalla | Para qué |
|---|---|
| **Muebles** | Cada mueble por sección y color con **−** y **+**. Al sumar en las secciones de pintura, armado, maquilado y MDF, pregunta **quién lo hizo**. |
| **Material** | Cubetas y tambos con **−** y **+**. Cada producto con su nombre de etiqueta y hasta 3 apodos. |
| **Pedidos** | Cliente, fecha (día/mes/año) y lo que pidió, en formato de ticket. |
| **Recados** | Avisos para el equipo, con quién ya los vio y quién los cerró. |
| **Bitácora** | Se escribe sola: cada movimiento con hora, quién lo anotó y quién hizo el trabajo. |
| **Apodos y litros** | Aquí **solo** se cambian apodos (máximo 3) y litros por envase. Nada más. |
| **Ajustes** | Quién soy, **modo práctica** (datos de juguete), **revisar este aparato**, exportar a Excel, hoja de conteo, versión. |

La lupa: ① toca la lupa → ② escoge qué quieres ver → ③ escribe el nombre → aparece y le
sumas o restas. En computadora, con la tecla **+** o **−** se ajusta el primero de la lista.

## Para probar sin miedo

- **Modo práctica** (Ajustes): datos de juguete, solo en ese aparato. El inventario real
  ni se entera. Se apaga y todo vuelve.
- **Revisar este aparato** (Ajustes): prueba cámara, micrófono, conexión, guardado e
  instalación, y dice cómo arreglar lo que falle en ese teléfono. **Nunca hace falta
  borrar la app para probar el micrófono.**

## Archivos

```
index.html          la página
estilos.css         colores del logo, celular y computadora
app.js              la pantalla
config.js           ← el único que se toca: llaves de Supabase y versión
sw.js               abre sin señal y avisa de versiones nuevas
manifest.json       para instalarse como app
datos/catalogo.js   modelos, colores agrupados, secciones, quién hace qué
datos/almacen.js    capa de datos: nube o local, misma cara
datos/esquema.sql   la base (se pega una vez en Supabase)
diseno/             vista previa aprobada
```

Para publicar una versión nueva: cambiar `VERSION` en `config.js` y el número en
`sw.js`, y subir a `main`.
