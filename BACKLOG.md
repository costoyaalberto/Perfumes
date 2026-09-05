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

## 3. Renombrar pestaña "Importar" a "Datos" y mover ahí el backup

**Decisión**: la pestaña **Importar** (la última de la barra) pasa a
llamarse **Datos**. Ahí van a vivir tanto la importación masiva (lo que
ya existe) como el botón de **"Exportar backup (JSON)"** (que hoy vive
en Tiendas, donde no se ve/no es intuitivo encontrarlo) y, cuando se
implemente, el botón del reporte de novedades (item 2). Botón de backup
más grande y prominente (arriba o abajo de la página, a definir cuando
se implemente).

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

**Decisión de enfoque**: en vez de una columna "ya enviado" (que nunca
se pierde nada pero requiere marcar/desmarcar), usar una **ventana de
tiempo**: perfumes agregados a Colección o Lista Negra en las **últimas
24-48 horas** (a definir el número exacto, quizás seleccionable al
generar el reporte). Más simple de implementar — no toca el esquema de
las tablas — con la contra de que si pasan más de 2 días sin generar el
reporte, algo podría quedar afuera. Aceptable dado el uso real (se
genera apenas después de comprar/rechazar algo).

**Idea de solución** (a definir en detalle cuando se implemente):
- Nueva función RPC (ej. `generar_reporte_seguimiento(p_token uuid, p_horas int default 48)`)
  que junta `coleccion` (por `created_at`/`fecha_compra`) y `lista_negra`
  (por `created_at`/`fecha`) de las últimas `p_horas` horas, arma un
  texto plano legible tipo:
  ```
  === NUEVO EN COLECCIÓN (últimas 48h) ===
  1. Nombre — Referencia — Precio — Tienda/canal — Fecha

  === NUEVO EN LISTA NEGRA (últimas 48h) ===
  1. Nombre — Motivo — Tienda — Fecha
  ```
- Botón en la pestaña **Datos** (ver item 3) que muestra ese texto en un
  modal con botón "Copiar" (para pegarlo directo en el otro chat), no
  como descarga de archivo.
- Caso sin novedades: mostrar "No hay novedades en las últimas X horas."

---

*(Agregar más ideas acá abajo a medida que surjan, en el mismo formato.)*
