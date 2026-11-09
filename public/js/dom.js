// Ayudantes para crear DOM de forma segura. Los textos siempre van como nodos
// de texto (textContent), nunca como HTML: así un nombre de receta como
// «<img onerror=…>» se ve tal cual y no se ejecuta.

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Crea un elemento. `props` admite:
 * - class, text, id, y cualquier atributo (como string, número o booleano)
 * - on: { click: fn, … } para eventos
 * - dataset: { clave: valor }
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'on') for (const [ev, fn] of Object.entries(value)) el.addEventListener(ev, fn);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'value') el.value = value;
    else if (key === 'checked') el.checked = Boolean(value);
    else if (key.startsWith('on') || key === 'style' || key === 'innerHTML') {
      // Nada de manejadores en línea ni estilos en atributo (la CSP tampoco los dejaría).
      throw new Error(`Propiedad no permitida en h(): ${key}`);
    } else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Sustituye el contenido de un elemento. */
export function mount(parent, ...children) {
  parent.replaceChildren();
  append(parent, children);
}

// Iconos de trazo (24×24). Son constantes del código, no datos del usuario.
const ICONS = {
  calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7h6',
  cart: 'M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9 20h.01M17 20h.01',
  save: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  back: 'M15 6l-6 6 6 6',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.9M15.5 5.1a3 3 0 0 1 0 5.8',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  upload: 'M12 21V9M7 14l5-5 5 5M5 3h14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
};

export function icon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name] ?? '');
  svg.append(path);
  return svg;
}

/** Texto solo para lectores de pantalla. */
export const srOnly = (text) => h('span', { class: 'sr-only', text });

let toastTimer;
/** Aviso breve en la parte inferior (región aria-live). */
export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
}

/**
 * Abre un <dialog> modal construido con `build(close)` y devuelve una promesa
 * con el valor pasado a `close`. Escape o el botón «Cancelar» devuelven `null`.
 */
export function openDialog({ label, className = '', build }) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: ['dialog', className], 'aria-label': label });
    let result = null;
    const close = (value = null) => {
      result = value;
      dialog.close();
    };
    // Si se cambia de vista con el diálogo abierto (un enlace de dentro, el botón
    // «Atrás»), se cierra: si no, se quedaría encima de la vista nueva.
    const onHashChange = () => close(null);
    window.addEventListener('hashchange', onHashChange);
    dialog.addEventListener('close', () => {
      window.removeEventListener('hashchange', onHashChange);
      dialog.remove();
      resolve(result);
    });
    // Clic en el fondo (fuera de la caja) cierra el diálogo.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close(null);
    });
    dialog.append(build(close));
    document.body.append(dialog);
    dialog.showModal();
  });
}

/**
 * Confirmación con botones propios. Devuelve `true` si se acepta. En las acciones
 * peligrosas el foco empieza en «Cancelar», para que un Intro sin mirar no borre nada.
 */
export async function confirmDialog({ title, body, confirmText = 'Aceptar', danger = false }) {
  const result = await openDialog({
    label: title,
    build: (close) =>
      h('form', { class: 'dialog-body', method: 'dialog', on: { submit: (e) => { e.preventDefault(); close(true); } } },
        h('h2', { class: 'dialog-title', text: title }),
        ...[].concat(body).map((p) => h('p', { class: 'dialog-text', text: p })),
        h('div', { class: 'dialog-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost', text: 'Cancelar', autofocus: danger, on: { click: () => close(null) } }),
          h('button', { type: 'submit', class: ['btn', danger ? 'btn-danger' : 'btn-primary'], text: confirmText, autofocus: !danger }),
        ),
      ),
  });
  return result === true;
}
