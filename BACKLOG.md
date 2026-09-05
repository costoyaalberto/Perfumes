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

## 2. Reporte de "novedades" para pegar en el chat de seguimiento

**Problema**: cada vez que se agrega algo a Colección o Lista Negra, hay
que copiar la info a mano y pasarla a otro chat donde se lleva
seguimiento (espacio en la colección, en qué se basa el perfume, etc).
Es trabajo manual y repetitivo.

**Por qué no sirve el botón de "Exportar backup" que ya existe**: ese
descarga TODO (las 120+ de colección, las 90+ de lista negra, etc.) cada
vez — para pegar en un chat de seguimiento sirve un reporte de **solo lo
nuevo desde la última vez**, no un dump completo repetido.

**Idea de solución** (a definir en detalle cuando se implemente):
- Agregar una columna a `coleccion` y a `lista_negra`, algo como
  `enviado_a_seguimiento boolean not null default false`.
- Nueva función RPC (ej. `generar_reporte_seguimiento`) que junta las
  filas con `enviado_a_seguimiento = false` de ambas tablas, arma un
  texto plano legible tipo:
  ```
  === NUEVO EN COLECCIÓN ===
  1. Nombre — Referencia — Precio — Tienda/canal — Fecha

  === NUEVO EN LISTA NEGRA ===
  1. Nombre — Motivo — Tienda — Fecha
  ```
  y marca esas filas como `enviado_a_seguimiento = true` (para que la
  próxima vez solo traiga lo que se agregó después).
- Un botón (¿dónde? a definir — quizás junto al de "Exportar backup" en
  Tiendas) que muestra ese texto en un modal con botón "Copiar" (para
  pegarlo directo en el otro chat), no como descarga de archivo.
- Caso sin novedades: mostrar "No hay novedades desde el último reporte."

---

*(Agregar más ideas acá abajo a medida que surjan, en el mismo formato.)*
