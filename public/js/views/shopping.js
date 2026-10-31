// Lista de la compra generada a partir del menú, agrupada por pasillos.
import { buildShoppingList, shoppingListToText } from '../lib/shopping.js';
import { h, icon, mount, toast } from '../dom.js';
import * as store from '../store.js';

export async function renderShopping(view) {
  const [recipes, plan, checked] = await Promise.all([store.listRecipes(), store.getPlan(), store.getChecked()]);
  const list = buildShoppingList(plan, recipes);

  if (list.meals === 0) {
    mount(view,
      head(list, null),
      h('div', { class: 'empty' },
        h('p', { class: 'empty-title', text: 'Aún no hay nada que comprar' }),
        h('p', { class: 'muted', text: 'La lista se genera sola con las recetas que pongas en el menú de la semana.' }),
        h('a', { class: 'btn btn-primary', href: '#/semana' }, icon('calendar'), 'Planificar la semana'),
      ),
    );
    return;
  }

  // Solo cuentan las marcas de productos que siguen en la lista.
  const keys = new Set(list.groups.flatMap((g) => g.items.map((i) => i.key)));
  const done = new Set([...checked].filter((k) => keys.has(k)));

  const progress = h('progress', { id: 'compra-progreso', class: 'progress', max: list.total, value: done.size });
  const counter = h('span', { class: 'mono' });
  const updateCounter = () => {
    progress.value = done.size;
    counter.textContent = `${done.size}/${list.total}`;
    view.querySelector('.shopping')?.classList.toggle('is-complete', done.size === list.total);
  };

  const onToggle = async (event) => {
    const input = event.currentTarget;
    const { key } = input.dataset;
    if (input.checked) done.add(key); else done.delete(key);
    input.closest('.item').classList.toggle('is-checked', input.checked);
    updateCounter();
    // Aviso al terminar un pasillo: pequeño premio por ir tachando.
    const group = input.closest('.aisle');
    const remaining = group.querySelectorAll('input:not(:checked)').length;
    group.classList.toggle('is-done', remaining === 0);
    if (input.checked && remaining === 0) toast(`${group.dataset.aisle}: completo`);
    try {
      await store.setChecked(key, input.checked);
    } catch {
      toast('No se ha podido guardar la marca');
    }
  };

  const share = async () => {
    const text = shoppingListToText(list, done);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Lista de la compra', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast('Lista copiada: pégala donde quieras');
    } catch (error) {
      if (error?.name !== 'AbortError') toast('No se ha podido compartir la lista');
    }
  };

  const uncheckAll = async () => {
    await store.clearChecked();
    toast('Lista desmarcada');
    await renderShopping(view);
  };

  const hideChecked = Boolean(await store.getHideChecked());
  const hideToggle = h('input', {
    id: 'ocultar-marcados', type: 'checkbox', class: 'switch-input', checked: hideChecked,
    on: {
      change: async (e) => {
        view.querySelector('.shopping').classList.toggle('hide-checked', e.currentTarget.checked);
        await store.setHideChecked(e.currentTarget.checked);
      },
    },
  });

  mount(view,
    head(list, [
      h('button', { type: 'button', class: 'btn btn-ghost', on: { click: uncheckAll }, disabled: done.size === 0 }, icon('x'), 'Desmarcar todo'),
      h('button', { type: 'button', class: 'btn btn-primary', on: { click: share } }, icon('share'), 'Compartir'),
    ]),
    h('div', { class: 'shopping-bar' },
      h('label', { for: 'compra-progreso', class: 'progress-label' }, 'En el carro ', counter),
      progress,
      h('label', { class: 'switch', for: 'ocultar-marcados' }, hideToggle, h('span', { class: 'switch-track', 'aria-hidden': 'true' }), 'Ocultar lo marcado'),
    ),
    h('div', { class: ['shopping', hideChecked && 'hide-checked'] },
      list.groups.map((group) => {
        const groupDone = group.items.every((i) => done.has(i.key));
        const id = `pasillo-${group.aisle.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '-')}`;
        return h('section', { class: ['aisle', groupDone && 'is-done'], 'aria-labelledby': id, dataset: { aisle: group.aisle } },
          h('h3', { class: 'aisle-name', id },
            group.aisle,
            h('span', { class: 'aisle-count mono', text: String(group.items.length) })),
          h('ul', { class: 'items' },
            group.items.map((item, index) => {
              const inputId = `${id}-${index}`;
              const isDone = done.has(item.key);
              return h('li', { class: ['item', isDone && 'is-checked'] },
                h('input', { id: inputId, type: 'checkbox', class: 'check-input', checked: isDone, dataset: { key: item.key }, on: { change: onToggle } }),
                h('label', { for: inputId, class: 'check' },
                  h('span', { class: 'check-box', 'aria-hidden': 'true' }, icon('check', 'check-mark')),
                  h('span', { class: 'item-text' },
                    h('span', { class: 'item-line' },
                      h('span', { class: 'item-name', text: item.name }),
                      h('span', { class: 'item-qty mono', text: item.quantityText })),
                    h('span', { class: 'item-recipes', text: item.recipes.join(' · ') }),
                  ),
                ),
              );
            }),
          ),
        );
      }),
      h('p', { class: 'shopping-done', text: '¡Compra hecha! Todo está en el carro.' }),
    ),
  );
  updateCounter();
}

function head(list, actions) {
  return h('div', { class: 'view-head' },
    h('div', {},
      h('h2', { class: 'view-title', tabindex: '-1', text: 'Lista de la compra' }),
      h('p', { class: 'view-sub' },
        'Agrupada por pasillos',
        list.meals > 0 && [' · ', h('span', { class: 'mono', text: String(list.meals) }), list.meals === 1 ? ' comida del menú' : ' comidas del menú']),
    ),
    actions && h('div', { class: 'view-actions' }, actions),
  );
}
