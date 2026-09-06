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

## 6. Nueva categoría "Agotado" (distinta de "Pendientes por Probar")

**Problema**: "Pendientes por Probar" hoy mezcla dos situaciones muy
distintas:
- Se revisó en **una sola tienda** y no había stock ahí — vale la pena
  volver a preguntar pronto (días).
- Se buscó **en varias tiendas / el mercado en general** y no aparece en
  ninguna — no tiene sentido seguir preguntando seguido, conviene
  revisarlo recién en un par de semanas.

Al estar todo junto en una sola lista, se confunden entre sí.

**Idea de solución** (a definir en detalle cuando se implemente):
- Nueva tabla `agotados` (mismo espíritu que `pendientes_probar`:
  `nombre_perfume`, `referencia`, `comentario`, `fecha`).
- Desde una tarjeta de "Pendientes por Probar", una acción tipo "Agotado
  en general" que la mueve de `pendientes_probar` a `agotados` (en vez
  de "Ya volvió"/"Eliminar").
- Nueva sección/lista "Agotados" (¿dentro de la pestaña Pendientes, como
  tercera sección junto a "Pendientes por Probar" y "Movimientos
  recientes"? a definir) con su propia acción "Revisar de nuevo" (vuelve
  a Por Probar, mismo patrón que "Ya volvió") y "Eliminar".
- No hace falta recordatorio/notificación automática (fuera de alcance
  del proyecto original) — el usuario decide cuándo volver a mirar esa
  lista, la idea es solo que no se mezcle visualmente con lo que sí
  conviene revisar pronto.

---

*(Agregar más ideas acá abajo a medida que surjan, en el mismo formato.)*
