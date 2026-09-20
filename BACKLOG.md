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

## 9. Tienda "Otras" para perfumes encontrados fuera de las tiendas habituales

**Problema**: a veces aparece un perfume en un lugar que no es ninguna
de las tiendas ya cargadas (puesto ambulante, otra ciudad, etc.) y hoy
no hay dónde anotarlo sin crear una tienda nueva de una sola vez.

**Idea de solución** (a definir en detalle cuando se implemente):
- Agregar una tienda especial "Otras" (fija, no editable/eliminable como
  las demás) para usar en esos casos puntuales.
- Revisar si conviene pedir un campo libre de texto (dónde exactamente)
  cuando se elige "Otras", ya que agrupa lugares distintos entre sí.

---

## 10. "Exportar tienda" — texto para pasarle a una IA antes de probar

**Problema**: antes de ir a probar a una tienda, hoy se le pasa el
contexto a una IA (para que sugiera en qué fijarse) usando screenshots
de la app — funciona, pero es más incómodo que pasar texto plano.

**Idea de solución**: botón "Exportar tienda" en la pestaña Datos, junto
a los otros dos. Al tocarlo, pregunta qué tienda (de las tiendas
activas), y arma un texto plano con los perfumes que están "Por Probar"
en esa tienda y su información (nombre, referencia, precio, disponible
con/sin probador, comentario) — mismo patrón que el reporte de
novedades: modal con el texto y botón "Copiar". Mismo alcance que ese
reporte: es una función de solo lectura, no cambia datos ni agrega
tablas nuevas (reusa `listar_por_probar` filtrado por tienda, o una RPC
liviana equivalente).

---

## 11. Mostrar "Pendientes de Compra" también en la lista de su tienda (Por Probar)

**Problema**: un perfume que pasó a "Pendientes de Compra" tiene una
tienda asignada (dónde comprarlo), pero hoy solo aparece en la pestaña
Pendientes. Si en una visita a esa tienda no se entra a esa pestaña,
es fácil recorrer todo "Por Probar", probar todo y salir sin comprar el
que ya estaba decidido, porque no aparece en el lugar donde de verdad se
está mirando en ese momento.

**Idea de solución** (a definir en detalle cuando se implemente):
- En la vista "Por Probar", dentro del grupo de la tienda que
  corresponda, mostrar también los perfumes que están en "Pendientes de
  Compra" con esa misma tienda asignada — enmarcados con un color
  distintivo para que salten a la vista.
- Ojo: el dorado ya está tomado por "destacados" (item 8) — hay que
  elegir otro color para no confundir ambos casos (por ejemplo el
  morado de marca, o un verde/azul que no choque con los chips
  existentes).
- Definir si esa tarjeta ahí es solo informativa (clickeable → lleva a
  editar/gestionar en Pendientes de Compra) o si conviene una acción
  rápida tipo "Ya lo compré" directamente ahí mismo, para no tener que
  cambiar de pestaña.
- No implica cambio de modelo de datos (pendientes_compra ya guarda
  tienda_id) — es una consulta que junta ambas listas para pintarlas
  juntas por tienda.

---

*(Agregar más ideas acá abajo a medida que surjan, en el mismo formato.)*
