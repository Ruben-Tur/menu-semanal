# menu-semanal

Planificador de menús semanales: organiza la comida y la cena de cada día con tu propio recetario y genera la lista de la compra sumada y agrupada por pasillos del súper. Es una PWA que funciona sin conexión y guarda los datos solo en tu dispositivo.

## Características

- **Recetario:** crear, editar y borrar recetas con raciones, tiempo, preparación e ingredientes (nombre, cantidad, unidad y pasillo). Al escribir un ingrediente que ya existe en otra receta, se propone su pasillo. Buscador por nombre o ingrediente.
- **Menú de la semana:** comida y cena de lunes a domingo; en cada hueco se elige la receta y las raciones. En el móvil, un día por fila; en escritorio, la semana entera en siete columnas. El día de hoy se marca.
- **Lista de la compra automática:**
  - escala cada receta a las raciones del hueco (una receta de 4 raciones puesta para 2 usa la mitad);
  - suma los ingredientes repetidos aunque estén escritos distinto («Calabacín», «calabacin»);
  - normaliza las unidades: g y kg se suman en una sola cantidad, igual que ml y l; las cucharadas se pasan a ml si el producto ya se compra por volumen (1 cda. = 15 ml, 1 cdta. = 5 ml);
  - redondea las unidades hacia arriba (no se compra media cebolla) y deja «al gusto» lo que no tiene cantidad;
  - agrupa por pasillos en el orden del súper (Frutería, Carnicería, Pescadería, Charcutería, Lácteos y huevos, Panadería, Despensa, Congelados, Bebidas, Otros) e indica en qué recetas va cada producto;
  - los productos se tachan al marcarlos, las marcas se guardan, hay barra de progreso, opción de ocultar lo marcado y botón para compartir o copiar la lista en texto.
- **Sin conexión:** service worker con caché versionada de toda la app; se instala en el móvil como una app. Cuando hay una versión nueva, avisa y se actualiza con un botón.
- **Copia de seguridad:** exportar todo a un archivo JSON e importarlo (con validación completa antes de tocar nada).
- **Primera vez:** carga nueve recetas españolas de ejemplo y un menú de ejemplo para dos personas.
- Tema claro y oscuro según el sistema, usable con teclado y lector de pantalla, sin scroll horizontal de 375 a 1600 px.

## Privacidad: qué datos guarda y dónde

Todo se guarda en el navegador del usuario con IndexedDB (base de datos `menu-semanal`): recetas, menú, productos marcados y la preferencia «ocultar lo marcado». No hay cuentas, ni servidor de datos, ni analítica, ni servicios de terceros (ni fuentes ni CDN). El servidor solo entrega archivos estáticos y no registra peticiones. La copia de seguridad es un archivo que se descarga el propio usuario.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Interfaz | HTML, CSS propio y JavaScript con módulos ES, sin frameworks ni paso de compilación |
| Datos | IndexedDB con un pequeño envoltorio de promesas (`public/js/db.js`) |
| Sin conexión | Service Worker y manifiesto de aplicación web |
| Servidor | `node:http` sin dependencias (`server.mjs`) |
| Pruebas | `node:test` |

Cero dependencias de npm.

## Requisitos

- Node.js 22.9 o superior (solo para el servidor local y las pruebas)
- Un navegador moderno (Edge, Chrome, Firefox o Safari recientes)

## Instalación

```bash
git clone https://github.com/Ruben-Tur/menu-semanal.git
cd menu-semanal
npm start                   # http://localhost:4323
```

No hace falta `npm install`. Para cambiar el puerto o la URL pública, copia `.env.example` como `.env` (opcional):

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (por defecto 4323) |
| `HOST` | Interfaz en la que escucha (por defecto `127.0.0.1`, solo este equipo) |
| `SITE_URL` | URL pública sin barra final. Se usa en la URL canónica, Open Graph, `sitemap.xml`, `robots.txt` y `llms.txt`. Con `https` se activan HSTS y `upgrade-insecure-requests` |

> El service worker solo funciona en `localhost` o con HTTPS. Para probarla en el móvil hay que publicarla con HTTPS.

Todas las rutas de la app (HTML, manifiesto y service worker) son relativas, así que también funciona dentro de una carpeta de otra web: el portfolio la sirve en `/demos/menu-semanal/` como archivos estáticos.

## Uso

1. **Recetas:** revisa las de ejemplo o crea las tuyas con «Nueva receta». Las cantidades son para las raciones de la receta.
2. **Semana:** pulsa un hueco (comida o cena de un día), elige la receta y las raciones.
3. **Compra:** abre la lista y ve marcando lo que metes en el carro. Funciona sin cobertura.
4. **Tus datos:** descarga una copia de seguridad, restáurala en otro dispositivo, instala la app o empieza de cero.

## Estructura

```
menu-semanal/
├── server.mjs                 # Servidor estático: MIME, cabeceras de seguridad, CSP, límites
├── public/                    # Todo lo que se sirve
│   ├── index.html             # Contenido estático (título, resumen, funciones) + JSON-LD
│   ├── offline.html           # Página para navegaciones sin red
│   ├── sw.js                  # Service worker (caché versionada)
│   ├── manifest.webmanifest
│   ├── robots.txt, sitemap.xml, llms.txt, og.png
│   ├── css/styles.css
│   ├── icons/                 # SVG, PNG 192/512, maskable y apple-touch-icon
│   └── js/
│       ├── app.js             # Arranque, rutas por hash, estado de conexión
│       ├── db.js              # Envoltorio de IndexedDB
│       ├── store.js           # Operaciones de datos (siempre validadas)
│       ├── dom.js             # Creación segura de DOM (sin innerHTML), diálogos y avisos
│       ├── install.js         # Registro del service worker e instalación
│       ├── seed.js            # Recetas y menú de ejemplo
│       ├── lib/               # Lógica pura, sin DOM ni IndexedDB (la que se prueba)
│       │   ├── catalog.js     # Días, comidas, pasillos, unidades y límites
│       │   ├── units.js       # Normalización, redondeo y formato de cantidades
│       │   ├── shopping.js    # Escalado, suma y agrupación de la lista de la compra
│       │   ├── validate.js    # Validación de recetas y copias de seguridad
│       │   └── text.js        # Limpieza de textos y claves de ingrediente
│       └── views/             # Semana, recetario, compra y «Tus datos»
├── test/                      # Pruebas con node:test
├── design/                    # Fuentes del icono maskable y de la imagen para redes
└── scripts/render-assets.mjs  # Genera los PNG con Edge sin ventana (solo al cambiar el diseño)
```

## Seguridad

- Todo el texto del usuario se pinta con `textContent`; no se usa `innerHTML` en ningún sitio.
- Las recetas se validan y limpian antes de guardarlas (longitudes, rangos, unidades y pasillos de una lista cerrada, solo campos conocidos).
- Importación: máximo 2 MB, JSON válido, versión y aplicación correctas, máximo 500 recetas y 40 ingredientes por receta, huecos del menú existentes y recetas referenciadas. Si algo falla no se importa nada, y antes de sustituir los datos se pide confirmación.
- Servidor: solo `GET`/`HEAD`, protección contra salto de directorios (incluidos enlaces simbólicos y archivos ocultos), CSP estricta sin `unsafe-inline`, `nosniff`, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, límite de peticiones por IP, tiempos de espera y errores sin detalles internos.

## Pruebas

```bash
npm test
```

28 pruebas de la lógica pura: conversión y formato de unidades, redondeos, escalado por raciones, suma de ingredientes repetidos (g + kg, ml + l, cucharadas a ml), agrupación por pasillos, texto para compartir, validación de recetas y de copias de seguridad (incluidos archivos manipulados), y que el service worker precachee todos los archivos de la app.
