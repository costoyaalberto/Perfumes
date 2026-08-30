# Informe de estado — Perfumes Tracker

> Generado para retomar la conversación original (donde se armó el prompt inicial) y decidir próximos pasos.

## 1. Resumen

Se construyó y desplegó una PWA de seguimiento de perfumes (probar / pendientes de compra / colección / lista negra), siguiendo el prompt original casi al pie de la letra, con algunas decisiones de seguridad y funciones adicionales acordadas durante el desarrollo. **Está en producción y en uso activo.**

- Repo: `costoyaalberto/perfumes`, rama `claude/new-session-yw4bez`
- Deploy: Netlify (manual, drag-and-drop de un `.zip`), URL tipo `https://<random>.netlify.app`
- Backend: Supabase (proyecto ya creado y con el schema aplicado)
- Stack frontend: HTML + CSS + JS vanilla (`type="module"`), sin build step
- Estado: **funcionando**, con datos reales cargados (colección, lista negra, por probar, tiendas)

## 2. Decisión de seguridad tomada

El prompt original pedía explícitamente comparar alternativas antes de elegir. Se presentaron 3 opciones (RPC-only, header+RLS, o solo-cliente sin protección real) y el usuario eligió:

**Patrón "solo RPC"**: las 8 tablas tienen Row Level Security activado *sin ninguna política* para `anon`/`authenticated` (bloqueo total de la API REST directa, incluso con la `anon key` visible en el código). Toda lectura/escritura pasa por ~25 funciones Postgres `SECURITY DEFINER` que reciben un `token` de sesión (UUID) como parámetro y lo validan contra la tabla `app_sessions` antes de tocar cualquier dato. El PIN se valida vía `validar_pin()`, que compara un hash (`pgcrypto`/`crypt`) y emite el token (válido 90 días, guardado en `localStorage` del dispositivo).

## 3. Modelo de datos (tablas)

| Tabla | Propósito |
|---|---|
| `tiendas` | Catálogo de tiendas físicas (11 cargadas) |
| `por_probar` + `por_probar_tienda` | Perfumes por probar; un perfume puede estar en N tiendas con precio/comentario/disponibilidad/modalidad propios por tienda |
| `pendientes_compra` | Probado y gustado en modalidad "solo probar", esperando comprarlo en otro lado |
| `pendientes_probar` *(agregada durante el desarrollo, no estaba en el prompt original)* | Perfumes que resultaron **sin stock en ninguna tienda** al ir a buscarlos; quedan aquí para revisar más adelante si volvieron a aparecer |
| `coleccion` | Perfumes comprados |
| `lista_negra` | Perfumes probados y rechazados, con motivo obligatorio |
| `app_sessions` / `app_config` | Sesión del PIN (token + expiración) y hash del PIN |

## 4. Funcionalidad implementada

### Por Probar (vista principal, agrupada por tienda)
- Tarjetas con nombre, referencia/dupe, precio, disponibilidad (con/sin probador), modalidad (comprar aquí/solo probar), comentario.
- Acciones: **Me gustó** (→ Colección si "comprar aquí", pidiendo precio final; → Pendientes de Compra si "solo probar"), **No me gustó** (pide motivo obligatorio → Lista Negra), **Sin probador** (solo cambia el flag en esa tienda), **+ Otra tienda** (agrega el mismo perfume a otra tienda sin duplicar el registro).
- **Click en la tarjeta** (fuera de los botones) → modal de edición: nombre/referencia (compartidos entre tiendas si el perfume está en varias), precio/comentario/disponibilidad/modalidad (propios de esa tienda), botón **"Sin stock"** (mueve el perfume completo a Pendientes por Probar) y **"Quitar de esta tienda"** (borra solo esa fila, sin mover a ningún lado).
- Nombres de tienda **clickeables para colapsar/expandir** su lista de tarjetas.
- **Buscador por nombre** + botón toggle **"Solo sin probador"** (para planear qué revisar en la próxima ronda de tiendas).
- Chequeo de duplicados por similitud de nombre (normaliza tildes/mayúsculas/espacios) al crear un perfume nuevo, comparando contra las 4 tablas; pide confirmación explícita si hay coincidencia.

### Pendientes (una pestaña, dos secciones)
- **Pendientes de Compra**: "Ya lo compré" (pide tienda/canal + precio → Colección).
- **Pendientes por Probar**: "Ya volvió" (reingresa a Por Probar eligiendo tienda) o "Eliminar" definitivo.
- El badge numérico de la pestaña suma ambas listas.

### Colección y Lista Negra
- Solo lectura + búsqueda por nombre.
- Toggle de orden: **Nombre** / **Fecha (recientes primero)**.

### Tiendas
- Ver / agregar / activar-desactivar tiendas del catálogo.

### Importar
- 3 cajas de texto (Colección, Lista Negra, Por Probar) con formato delimitado por `|`, una línea por registro; reporta errores por línea (ej. tienda que no existe en el catálogo).

### PWA
- Instalable (manifest + iconos generados + service worker con cache del app shell; nunca cachea llamadas a Supabase).
- Tag de versión visible arriba a la derecha (`v3` actualmente) para confirmar que un redeploy manual a Netlify sí tomó los cambios.

## 5. Datos ya cargados en producción

- **Tiendas** (11): Productos de Lujo, Lodoro, Sairam, Yauras, Alisha Perfumes, Silk Perfumes, Mundo Aromas, Multimarcas Perfumes, Elite Perfumes, Oferta Perfumes, Zara.
- **Colección**: 120 perfumes (solo nombres; sin tienda/precio/fecha reales — el usuario indicó que no le importa completar esos datos históricos).
- **Lista Negra**: 91 perfumes con motivo de rechazo.
- **Por Probar**: ~91 perfumes únicos repartidos en las 11 tiendas (3 de ellos correctamente agrupados en 2 tiendas cada uno).

### Puntos dejados abiertos al usuario durante la carga inicial (sin resolver aún)
- Una nota cortada ("Torino 21", junto a Lattafa Maahir Honor en Lodoro) — significado desconocido.
- Otra nota cortada en Alisha ("Armaf Club De Nuit Private Key To My Dreams... pero comprar en—") sin tienda especificada.
- Posible duplicado real en Oferta Perfumes: "Versus Ocean Bleu" aparece dos veces (con y sin "Hombre" en el nombre), quedaron como 2 tarjetas separadas a propósito para no perder datos.
- Dos perfumes que ya estaban en Lista Negra ("Armaf Club de Nuit Lionheart Man", "Mykonos Reflection") se volvieron a agregar a Por Probar porque el usuario lo pidió explícitamente ("de nuevo").

## 6. Decisiones de diseño relevantes (por si se retoma en otra conversación)

- Sin clasificación por familia olfativa, sin comparación automática de notas, sin scraping de precios/disponibilidad — **explícitamente fuera de alcance** desde el prompt original, se mantuvo así.
- App de un solo usuario, sin roles ni multi-tenant.
- Deploy 100% manual (arrastrar `.zip` a Netlify); no hay CI/CD ni conexión Git↔Netlify.
- Las credenciales de Supabase (URL + publishable key) están hardcodeadas en `js/config.js` — es seguro porque esa clave por sí sola no da acceso a datos (ver sección 2).

## 7. Recomendaciones para próximos pasos (aún no implementadas, a decidir)

1. **Exportar/backup** (CSV o JSON) de las 4 tablas de datos — barato de implementar, buena red de seguridad dado que todo vive en un solo proyecto gratuito de Supabase.
2. **Numeritos rápidos** arriba de alguna vista (total por probar, total gastado en colección) — cosmético, bajo esfuerzo.
3. Resolver los puntos abiertos de la sección 5 (Torino 21, la nota cortada de Alisha, el posible duplicado de Oferta Perfumes) cuando el usuario tenga tiempo de revisarlos dentro de la app.

## 8. Estructura del repositorio

```
├── index.html
├── manifest.json
├── sw.js
├── css/styles.css
├── icons/icon-192.png, icon-512.png
├── js/
│   ├── config.js        (credenciales Supabase)
│   ├── api.js            (wrapper de todas las llamadas RPC)
│   ├── auth.js            (login por PIN)
│   ├── modal.js, store.js, duplicados.js, utils.js
│   └── views/             (porProbar, pendientes, coleccion, listaNegra, tiendas, importar)
├── supabase/schema.sql   (tablas + RLS + ~25 funciones RPC, idempotente)
├── SETUP.md               (guía paso a paso: Supabase, PIN, Netlify, formato de importación)
└── INFORME.md             (este archivo)
```
