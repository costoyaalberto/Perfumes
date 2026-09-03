# Backlog — mejoras pendientes (no implementadas aún)

Ideas anotadas para revisar más adelante, en lugar de meterlas de inmediato.

## 1. Mostrar dónde comprar en "Pendientes de Compra"

**Problema**: hoy la tarjeta de un pendiente de compra solo muestra "Probado en
{tienda}" — la tienda donde se probó, no necesariamente donde se piensa
comprar (la modalidad "solo probar" existe justamente para cuando se compra
en otro lado: otra tienda física, online, etc). Sin ese dato, la tarjeta
queda como un dato suelto sin plan de acción.

**Idea de solución** (a definir en detalle cuando se implemente):
- Agregar un campo a `pendientes_compra`, algo como `donde_comprar text`
  (texto libre, similar a `canal_compra` en `coleccion`) para anotar dónde
  se planea comprarlo — puede ser una tienda del catálogo o texto libre
  ("Online", "Feria X", etc).
- Pedirlo opcionalmente en el momento de mover el perfume a Pendientes de
  Compra (ej. un campo extra en el flujo de "Me gustó" cuando la modalidad
  es "solo probar"), o dejarlo editable después desde la propia tarjeta.
- Mostrarlo en la tarjeta junto a "Probado en {tienda}".

---

*(Agregar más ideas acá abajo a medida que surjan, en el mismo formato.)*
