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

## 7. Tema oscuro fijo (negro + morado) — sin toggle, sin modo claro

Cambiar la app de tema claro a tema oscuro fijo (sin toggle, sin modo
claro — solo oscuro, siempre). Mantener el morado ya usado en el header
y en el badge "Comprar aquí" como color de acento; no introducir una
paleta nueva.

**Estado actual del CSS (revisado, para cuando se implemente)**: los
colores base SÍ están centralizados como variables en `:root` de
`css/styles.css` (`--violet`, `--bg`, `--card-bg`, `--border`, `--text`,
`--muted`, `--green`, `--red`, `--amber`, etc.) — el cambio de esas
variables debería propagarse solo. Pero los colores de los **chips/
badges** (`.chip-price`, `.chip-ok`, `.chip-warn`, `.chip-buy`,
`.chip-try`) están con hex hardcodeado directo en cada clase, no en
variables — hay que centralizarlos primero (agregar variables nuevas
para cada par fondo/texto de badge) y recién ahí aplicar la paleta,
para no repetir el mismo hex en varios lugares. Lo mismo revisar en
inputs/modal/toast, que usan `white`/rgba hardcodeados en vez de
variables en algunos puntos.

**Paleta objetivo**:
- Fondo de página: `#0d0d0f`
- Fondo de tarjetas: `#1c1c1f`
- Borde de tarjetas: `#2c2c30`
- Texto principal: `#f2f2f0`
- Texto secundario/muted: `#a8a8ac`
- Badge precio — fondo `#3a2a12`, texto `#f5c26b`
- Badge "Con probador" — fondo `#163a24`, texto `#4ade80`
- Badge "Sin probador" — variante rojo/ámbar apagado consistente con el
  resto (fondo oscuro + texto claro del mismo tono, mismo patrón que los
  demás badges)
- Badge "Comprar aquí" — fondo `#241b3d`, texto `#b39ddb` (mantiene el
  morado de marca)
- Badge "Solo probar" — mantener su distinción visual actual, adaptada a
  fondo oscuro con el mismo criterio
- Botón "Me gustó" — fondo `#1f7a4c`, texto blanco
- Botón "No me gustó" — fondo `#a13333`, texto blanco
- Botón "Sin probador" / outline — borde `#3d3d40`, texto `#f2f2f0`,
  fondo transparente

**Alcance**: todas las vistas (Por Probar, Pendientes por Probar,
Pendientes de Compra, Colección, Lista Negra, Tiendas, Datos), más
modales, inputs, dropdowns, y el header morado (verificar que siga
funcionando bien sobre el nuevo fondo). Revisar contraste de cada badge
— deben ser legibles bajo luz de tienda.

**Qué NO hacer**: no tocar layout/estructura/lógica funcional (solo
color/estilo), no agregar switch de tema ni persistencia por usuario
(el oscuro pasa a ser el único modo), no tocar modelo de datos ni RPCs.

**Al terminar**: subir el número de versión visible en la UI y verificar
visualmente las vistas antes de dar por cerrado.

---

*(Agregar más ideas acá abajo a medida que surjan, en el mismo formato.)*
