# Backlog — mejoras pendientes (no implementadas aún)

Ideas anotadas para revisar más adelante, en lugar de meterlas de inmediato.

## 1. "Pendientes de Compra" necesita más que una tarjeta estática

**Problema A — falta dónde comprar**: hoy la tarjeta solo muestra "Probado en
{tienda}" — la tienda donde se probó, no necesariamente donde se piensa
comprar (la modalidad "solo probar" existe justamente para cuando se compra
en otro lado: otra tienda física, online, etc). Sin ese dato, la tarjeta
queda como un dato suelto sin plan de acción.

**Problema B — no es editable**: la tarjeta solo tiene el botón "Ya lo
compré". Si en el lugar donde pensaba comprarlo no hay stock (mismo
escenario que "Sin stock" en Por Probar, pero acá no existe ese camino),
no hay forma de anotar el cambio de plan ni editar nada — solo esperar.

**Idea de solución** (a definir en detalle cuando se implemente):
- Agregar un campo a `pendientes_compra`, algo como `donde_comprar text`
  (texto libre, similar a `canal_compra` en `coleccion`) para anotar dónde
  se planea comprarlo — puede ser una tienda del catálogo o texto libre
  ("Online", "Feria X", etc). Mostrarlo en la tarjeta junto a "Probado en
  {tienda}".
- Hacer la tarjeta clickeable (mismo patrón que "Por Probar"): abrir un
  modal de editar con comentario, referencia y `donde_comprar`.
- Revisar si además hace falta un camino tipo "Sin stock donde pensaba
  comprarlo" (¿actualizar `donde_comprar` nomás, o algo más elaborado?
  a definir cuando se implemente) y una opción de eliminar definitivo
  (mismo criterio que se usó para Colección).

---

*(Agregar más ideas acá abajo a medida que surjan, en el mismo formato.)*
