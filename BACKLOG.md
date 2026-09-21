# Backlog — mejoras pendientes (no implementadas aún)

Ideas anotadas para revisar más adelante, en lugar de meterlas de inmediato.

## ~~1. "Pendientes de Compra" necesita más que una tarjeta estática~~ — Hecho (v6)

Implementado: campo `donde_comprar` (se pide opcionalmente al mover un
perfume a Pendientes de Compra desde "Me gustó", y se ve en la tarjeta
como "🛒 Comprar en: X"), tarjeta clickeable para editar nombre/
referencia/comentario/`donde_comprar`, y botón para eliminar
definitivamente. De paso, en "Pendientes por Probar" la tienda sin stock
ahora también se muestra como línea propia en la tarjeta ("📍 Sin stock
en: X"), no solo dentro del modal de "Ya volvió".

---

## ~~3. Renombrar pestaña "Importar" a "Datos" y mover ahí el backup~~ — Hecho (v8)

Implementado: la pestaña pasó a llamarse **Datos**, con dos botones
grandes arriba de todo ("⬇ Exportar backup completo (JSON)" y
"📋 Generar reporte de novedades"), y debajo sigue la importación masiva
que ya existía.

---

## ~~2. Reporte de "novedades" para pegar en el chat de seguimiento~~ — Hecho (v8)

Implementado con el enfoque de ventana de tiempo (últimas 48h por
`created_at`, no una columna "ya enviado"): botón "📋 Generar reporte de
novedades" en la pestaña Datos, abre un modal con el texto (perfumes
nuevos en Colección y en Lista Negra) y botón "Copiar" para pegarlo
directo en el chat de seguimiento.

---

## ~~4. Editar tarjetas de "Pendientes por Probar"~~ — Hecho (v8)

Implementado: tarjeta clickeable (fuera de los botones) que abre un
modal de editar nombre/referencia/comentario.

---

## ~~5. Lista Negra: poder editar y borrar~~ — Hecho (v8)

Implementado: tarjeta clickeable con modal de editar nombre/motivo/
comentario, y botón "Eliminar" con confirmación (resuelve los
duplicados de la carga inicial).

---

## ~~6. Nueva categoría "Agotado" (distinta de "Pendientes por Probar")~~ — Hecho (v9)

Implementado: nueva tabla `agotados` (`nombre_perfume`, `referencia`,
`comentario`, `fecha`). Desde una tarjeta de "Pendientes por Probar", el
botón "Agotado en general" la mueve a `agotados`. Nueva sección
"Agotados" dentro de la pestaña Pendientes (bajo "Pendientes por
Probar"), con tarjeta clickeable para editar, botón "Revisar de nuevo"
(vuelve a Por Probar, mismo patrón que "Ya volvió") y "Eliminar". Sin
recordatorio automático, como estaba definido.

---

## ~~7. Tema oscuro fijo (negro + morado) — sin toggle, sin modo claro~~ — Hecho (v9)

Implementado con la paleta exacta pedida (fondo `#0d0d0f`, tarjetas
`#1c1c1f`, texto `#f2f2f0`, badges de precio/con-probador/comprar-aquí
con sus hex definidos, botones "Me gustó"/"No me gustó" con sus verdes/
rojos apagados, outline `#3d3d40`). De paso se centralizaron en
variables CSS los colores de chips/badges (antes hardcodeados por
clase) y los de inputs/modal/toast, que antes usaban `white`/rgba
sueltos. Sin toggle ni modo claro — es el único tema ahora. Se agregó
borde sutil a las tarjetas y demás superficies para que se distingan
del fondo sin depender solo de la sombra.

---

## ~~8. Destacar visualmente las tarjetas marcadas con ★~~ — Hecho (v9)

Implementado: la tarjeta de un perfume `destacado = true` en Por Probar
ahora tiene borde dorado (`#e0a72b`, el mismo tono de la estrella
activa) y un fondo con un leve tinte dorado, además de la estrellita
llena.

---

## ~~9. Tienda "Otras" para perfumes encontrados fuera de las tiendas habituales~~ — Hecho (v12)

Implementado en su versión más simple (decidida al implementar): tienda
"Otras" sembrada por el script de esquema, sin ningún tratamiento
especial — es una tienda normal más, editable/eliminable como cualquier
otra desde la pestaña Tiendas. El detalle de dónde exactamente se
encontró el perfume se anota en el comentario de cada perfume, como ya
se podía hacer.

---

## ~~10. "Exportar tienda" — texto para pasarle a una IA antes de probar~~ — Hecho (v12)

Implementado tal cual estaba pensado: botón "🔍 Exportar tienda" en la
pestaña Datos, pide qué tienda (de las activas), y arma un texto con
los perfumes "Por Probar" de esa tienda (nombre, referencia, precio,
disponibilidad, modalidad, comentario) en un modal con botón "Copiar".
Sin RPC nueva — reusa `listar_por_probar` filtrado en el cliente.

---

## ~~11. Mostrar "Pendientes de Compra" también en la lista de su tienda (Por Probar)~~ — Hecho (v12)

Implementado: dentro de cada grupo de tienda en "Por Probar" aparecen
también los perfumes que están en "Pendientes de Compra" con esa misma
tienda (la tienda donde se probó), con borde y fondo celeste/azul
(`#3b82f6`, distinto del dorado de "destacados") y chip "Pendiente de
compra". Decisiones tomadas: esa tarjeta es solo el botón "Ya lo
compré" (sin click para editar — para eso está la pestaña Pendientes),
y se muestra siempre ahí, sin verse afectada por la búsqueda ni los
filtros de "Por Probar", para que el recordatorio no se pierda.

---

## ~~12. Buscar también por "referencia" (perfume que se imita), en todas las listas~~ — Hecho (v12)

Implementado en las tres vistas: "Por Probar" ahora busca por nombre y
referencia (Colección ya lo hacía). Para Lista Negra se decidió agregar
la columna `referencia` a la tabla (antes no existía) — se sumó a
`listar_lista_negra`, `editar_lista_negra`, `importar_lista_negra`, al
modal de editar, al formato de importación, al buscador, y de paso se
completó `no_me_gusto` y `exportar_datos` para que la referencia del
perfume rechazado se traspase automáticamente a Lista Negra (se había
quedado afuera al agregar la columna).

---

## 13. Completar referencias faltantes en Colección/Lista Negra con ayuda de una IA

**Problema**: los perfumes cargados antes de que existiera el campo
"referencia" (o importados sin ese dato) no tienen esa información, y
cargarla a mano uno por uno es lento. La idea es exportar esos casos,
pedirle a una IA que investigue a qué perfume imita cada uno, y subir
el resultado de vuelta a la app.

**Idea de solución (recomendada)**:
- **Exportar**: botón "🔍 Exportar referencias faltantes" en la pestaña
  Datos. Genera un texto de solo lectura (modal + botón "Copiar", mismo
  patrón que el reporte de novedades) con los perfumes de Colección que
  tienen `referencia` vacía, una línea por perfume en formato
  `id|nombre_perfume`. Se usa el `id` (no solo el nombre) porque el
  nombre no es único — puede haber más de una compra del mismo dupe — y
  así el reimport no actualiza la fila equivocada.
- **Reimportar**: nueva sección en Datos con una caja de texto donde se
  pega lo que devuelva la IA en formato `id|referencia` (una línea por
  perfume), y un botón que actualiza *solo* el campo `referencia` de esas
  filas ya existentes por id. Es una operación distinta a los imports
  masivos que ya existen (esos crean filas nuevas; esto actualiza filas
  existentes) — necesita una RPC nueva por tabla, tipo
  `actualizar_referencias_coleccion(p_token, p_items jsonb)`, que valide
  cada id y reporte errores por línea igual que los imports actuales.
- Aplica a **Colección** y, desde que el item 12 agregó la columna
  `referencia` a **Lista Negra** también, se puede replicar la misma
  exportación/reimportación ahí (RPC `actualizar_referencias_lista_negra`
  equivalente).

---

*(Agregar más ideas acá abajo a medida que surjan, en el mismo formato.)*
