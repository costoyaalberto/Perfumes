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

*(Agregar más ideas acá abajo a medida que surjan, en el mismo formato.)*
