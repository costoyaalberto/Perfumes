# Perfumes Tracker — Guía de configuración

Esta app es una PWA (HTML + CSS + JS vanilla) que usa **Supabase** como base de
datos y backend, protegida por un PIN de 4 dígitos validado en el servidor
(no solo en el navegador). Sigue esta guía en orden: primero Supabase, luego
la app, luego el deploy.

---

## 1. Crear tu cuenta y proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita
   (puedes usar tu cuenta de GitHub o Google para registrarte más rápido).
2. Una vez dentro, haz clic en **"New project"**.
3. Completa:
   - **Name**: `perfumes-tracker` (o el nombre que quieras).
   - **Database Password**: genera una contraseña fuerte y **guárdala** en
     un lugar seguro (no la necesitarás para la app, pero sí si algún día
     quieres conectarte directo a la base de datos).
   - **Region**: elige la más cercana a Chile (por ejemplo, `South America
     (São Paulo)` si está disponible, o la más cercana disponible).
4. Haz clic en **"Create new project"** y espera 1-2 minutos mientras
   Supabase aprovisiona tu proyecto.

## 2. Ejecutar el script de creación de tablas

1. En el menú lateral de tu proyecto, entra a **SQL Editor**.
2. Haz clic en **"New query"**.
3. Abre el archivo [`supabase/schema.sql`](supabase/schema.sql) de este
   proyecto, copia **todo su contenido** y pégalo en el editor.
4. Haz clic en **"Run"** (o `Ctrl+Enter`).
5. Deberías ver un mensaje de éxito. Este script:
   - Crea las 8 tablas de la app (`tiendas`, `por_probar`,
     `por_probar_tienda`, `pendientes_compra`, `coleccion`, `lista_negra`,
     `app_sessions`, `app_config`).
   - Activa **Row Level Security (RLS)** en todas ellas y **revoca todo
     acceso directo** para los roles públicos (`anon`/`authenticated`):
     ni siquiera con la clave pública se puede leer o escribir una tabla
     directo por la API REST.
   - Crea ~20 **funciones RPC** (`listar_por_probar`, `me_gusto`,
     `crear_tienda`, etc.) que son la única forma de leer o modificar
     datos. Cada una exige un `token` de sesión válido (ver sección de
     seguridad más abajo) y son a las que la propia app llama.

Es seguro volver a ejecutar el script si necesitas reaplicarlo (usa
`create table if not exists` y `create or replace function`).

## 3. Conectar la app con tu proyecto

1. En Supabase, ve a **Project Settings → API**.
2. Copia el **Project URL** (algo como `https://xxxxx.supabase.co`).
3. Copia la clave **`anon` `public`** (NO la `service_role`, esa nunca debe
   usarse en el frontend).
4. Abre el archivo [`js/config.js`](js/config.js) de este proyecto y
   reemplaza los valores:

   ```js
   export const SUPABASE_URL = 'https://xxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...'; // tu anon public key
   ```

5. Guarda el archivo.

> La `anon key` queda visible en el código fuente de la app — eso es
> normal y esperado en cualquier app Supabase sin backend propio. Por eso
> el script del paso 2 se aseguró de que esa clave, por sí sola, no dé
> acceso a ninguna tabla: solo permite ejecutar las funciones RPC, y esas
> funciones exigen un token de sesión válido.

## 4. Definir tu PIN inicial

El PIN no se guarda en texto plano: se guarda como un *hash* (con la
función `crypt()` de Postgres) en la tabla `app_config`.

1. En el **SQL Editor** de Supabase, crea una nueva consulta y ejecuta lo
   siguiente, **reemplazando `1234` por el PIN de 4 dígitos que quieras
   usar**:

   ```sql
   insert into app_config (id, pin_hash)
   values (1, crypt('1234', gen_salt('bf')))
   on conflict (id) do update set pin_hash = excluded.pin_hash;
   ```

2. Ejecuta (`Run`). Esto crea (o actualiza) tu PIN.
3. Para cambiar el PIN más adelante, vuelve a ejecutar la misma consulta
   con el nuevo PIN — el `on conflict` se encarga de reemplazarlo.

## 5. Cómo funciona la seguridad del PIN (resumen)

- Al ingresar el PIN correcto, el frontend llama a la función
  `validar_pin(pin)`, que compara el hash y, si coincide, crea una fila en
  `app_sessions` con un `token` (UUID) válido por 90 días y lo retorna.
- El navegador guarda ese `token` en `localStorage` (por eso solo pides el
  PIN una vez por dispositivo, hasta que expire o cierres sesión).
- **Todas** las demás operaciones (listar perfumes, mover a colección,
  importar datos, etc.) son funciones RPC que reciben ese `token` como
  parámetro y lo validan contra `app_sessions` antes de tocar cualquier
  tabla.
- Las tablas en sí tienen RLS activado sin políticas para los roles
  públicos, así que la API REST estándar de Supabase (`/rest/v1/tabla`)
  no devuelve ni acepta nada directamente, con o sin la anon key.
- Cerrar sesión (botón ⏻ en la app) solo borra el token del dispositivo;
  no invalida la fila en `app_sessions` en el servidor (para eso tendría
  que borrarse manualmente en Supabase o esperar a que expire a los 90
  días). Para un uso personal esto es suficiente.

## 6. Probar la app en local (opcional)

Como usa `<script type="module">`, necesitas servirla por HTTP (no
funciona abriendo `index.html` directo con `file://`). Con Python
instalado, desde la carpeta del proyecto:

```bash
python3 -m http.server 8080
```

Y abre `http://localhost:8080` en tu navegador.

## 7. Deploy a Netlify (arrastrar carpeta)

1. Ve a [app.netlify.com](https://app.netlify.com) e inicia sesión.
2. En el dashboard, busca la zona que dice algo como **"Drag and drop your
   site output folder here"** (la misma que usas en tu otro proyecto).
3. Arrastra la carpeta completa de este proyecto (la que contiene
   `index.html`, `manifest.json`, `sw.js`, `css/`, `js/`, `icons/`).
4. Netlify la publicará en una URL tipo `https://algo-random.netlify.app`.
   Puedes cambiar el nombre del sitio desde **Site settings → Change site
   name**.
5. Abre esa URL desde tu celular y tu PC: en ambos deberías ver la misma
   pantalla de PIN, y una vez dentro, los mismos datos (vienen de la misma
   base Supabase).
6. En el celular, usa "Agregar a pantalla de inicio" / "Instalar app"
   desde el menú del navegador para instalarla como PWA.

> Nota: cada vez que edites algo (por ejemplo, `js/config.js` con tus
> credenciales), tendrás que volver a arrastrar la carpeta completa a
> Netlify para republicar los cambios — igual que en tu otro proyecto.

## 8. Importación masiva de tus datos actuales

Dentro de la app, entra a la pestaña **"Importar"**. Hay tres cuadros de
texto, uno por cada tipo de dato, cada uno con su formato de línea
(campos separados por `|`). Las líneas vacías o que empiezan con `#` se
ignoran.

**Antes de importar, ve a la pestaña "Tiendas" y crea ahí las ~10 tiendas
de tu catálogo** — los formatos de "Lista Negra" y "Por Probar" necesitan
que el nombre de tienda ya exista (si no coincide exactamente con el
catálogo, la app te muestra un error por línea y no importa esa fila; el
nombre no distingue mayúsculas ni tildes).

### Colección

```
nombre_perfume | referencia | tienda_o_canal | precio | fecha_compra (AAAA-MM-DD, opcional) | comentario (opcional)
```

- `tienda_o_canal`: si coincide con una tienda de tu catálogo se guarda
  como tal; si no (por ejemplo "AliExpress" o "Online"), se guarda como
  texto libre en el canal de compra.
- Ejemplo:
  ```
  Bleu de Chanel | Dupe Zara Vibe | Tienda Central | 15000 | 2025-03-10 | Muy buena duración
  Sauvage | | AliExpress | 8000 | | Compra online, sin probarlo antes
  ```

### Lista Negra

```
nombre_perfume | motivo | tienda (opcional, debe existir en Tiendas) | fecha (AAAA-MM-DD, opcional) | comentario (opcional)
```

- Ejemplo:
  ```
  Invictus | Muy dulce para mi gusto | Tienda Norte | 2025-01-15 | Se sentía artificial
  ```

### Por Probar

Una línea **por cada tienda** donde el perfume está listado. Si el mismo
perfume aparece en varias tiendas, repite el nombre y la referencia en
varias líneas — la app los agrupa automáticamente en un solo registro con
varias tiendas asociadas.

```
nombre_perfume | referencia | tienda (debe existir en Tiendas) | precio | disponibilidad (con_probador/sin_probador) | modalidad (comprar_aqui/solo_probar) | comentario
```

- Ejemplo:
  ```
  Aventus | Dupe Y | Tienda Norte | 12000 | con_probador | comprar_aqui | Pendiente probar en la piel
  Aventus | Dupe Y | Tienda Central | 11000 | sin_probador | solo_probar |
  ```
  Esto crea **un** perfume "Aventus" listado en dos tiendas distintas.

Después de pegar tus datos en cada cuadro, presiona **"Importar"**. La app
te mostrará cuántos registros se importaron y, si hubo líneas con errores
(por ejemplo, una tienda que no existe), te dirá exactamente en qué línea
está el problema para que la corrijas y la vuelvas a pegar.

---

## Resumen de archivos del proyecto

- `supabase/schema.sql` — script único para crear todo en Supabase.
- `js/config.js` — tus credenciales de Supabase (URL + anon key).
- `index.html`, `css/`, `js/` — la PWA en sí.
- `manifest.json`, `sw.js`, `icons/` — configuración de instalación como
  app (PWA) y caché básico del app shell.
