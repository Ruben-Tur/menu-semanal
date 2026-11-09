// Vista «Esta semana»: comida y cena de cada día.
import { DAYS, MEALS, LIMITS, slotKey } from '../lib/catalog.js';
import { ingredientKey } from '../lib/text.js';
import { h, icon, mount, openDialog, confirmDialog, toast, srOnly } from '../dom.js';
import * as store from '../store.js';

// getDay(): 0 = domingo. Lo pasamos a nuestro orden, que empieza en lunes.
const todayId = () => DAYS[(new Date().getDay() + 6) % 7].id;

export async function renderPlan(view) {
  const [recipes, plan] = await Promise.all([store.listRecipes(), store.getPlan()]);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const bySlot = new Map(plan.filter((s) => byId.has(s.recipeId)).map((s) => [s.slot, s]));
  const today = todayId();

  const rerender = () => renderPlan(view);

  const editSlot = async (day, meal) => {
    const key = slotKey(day.id, meal.id);
    const current = bySlot.get(key);
    const result = await pickRecipe({ day, meal, recipes, current });
    if (!result) return;
    try {
      if (result.action === 'clear') {
        await store.clearSlot(key);
        toast(`${day.name}, ${meal.name.toLowerCase()}: hueco libre`);
      } else {
        await store.setSlot(key, result.recipeId, result.servings);
        toast(`${day.name}, ${meal.name.toLowerCase()}: ${byId.get(result.recipeId).name}`);
      }
    } catch (error) {
      // Por ejemplo, si la receta se ha borrado desde otra pestaña.
      console.error(error);
      toast('No se ha podido guardar. La receta puede haberse borrado en otra pestaña.');
    }
    await rerender();
    view.querySelector(`[data-slot="${key}"]`)?.focus();
  };

  const clearWeek = async () => {
    const ok = await confirmDialog({
      title: '¿Vaciar la semana?',
      body: 'Se quitan todas las comidas y cenas del menú. Las recetas no se borran.',
      confirmText: 'Vaciar semana',
      danger: true,
    });
    if (!ok) return;
    await store.clearPlan();
    await store.clearChecked();
    toast('Semana vacía. ¡A planificar!');
    await rerender();
  };

  const planned = bySlot.size;
  const total = DAYS.length * MEALS.length;

  mount(view,
    h('div', { class: 'view-head' },
      h('div', {},
        h('h2', { class: 'view-title', tabindex: '-1', text: 'Esta semana' }),
        h('p', { class: 'view-sub' },
          h('span', { class: 'mono', text: `${planned}/${total}` }), ' comidas planificadas · se guarda en este dispositivo'),
      ),
      h('div', { class: 'view-actions' },
        h('a', { class: 'btn btn-primary', href: '#/compra' }, icon('cart'), 'Lista de la compra'),
      ),
    ),
    recipes.length === 0 && h('p', { class: 'notice' },
      'Todavía no tienes recetas. ', h('a', { href: '#/recetas/nueva', text: 'Crea la primera' }), ' para poder planificar la semana.'),
    h('div', { class: 'week' },
      DAYS.map((day) =>
        h('section', { class: ['day', day.id === today && 'is-today'], 'aria-labelledby': `dia-${day.id}` },
          h('h3', { class: 'day-name', id: `dia-${day.id}` },
            h('span', { class: 'day-short', 'aria-hidden': 'true', text: day.short }),
            h('span', { class: 'day-long', text: day.name }),
            day.id === today && h('span', { class: 'day-today', text: 'hoy' }),
          ),
          MEALS.map((meal) => slotButton(day, meal, bySlot.get(slotKey(day.id, meal.id)), byId, () => editSlot(day, meal))),
        ),
      ),
    ),
    // La acción destructiva va al final, lejos del botón principal.
    planned > 0 && h('div', { class: 'view-foot' },
      h('button', { type: 'button', class: 'btn btn-ghost', on: { click: clearWeek } }, icon('trash'), 'Vaciar semana')),
  );
}

function slotButton(day, meal, slot, byId, onClick) {
  const key = slotKey(day.id, meal.id);
  if (!slot) {
    return h('button', { type: 'button', class: 'slot is-empty', dataset: { slot: key }, on: { click: onClick } },
      h('span', { class: 'slot-meal', text: meal.name }),
      h('span', { class: 'slot-add' }, icon('plus'), 'Añadir'),
      srOnly(` para el ${day.name.toLowerCase()}`),
    );
  }
  const recipe = byId.get(slot.recipeId);
  return h('button', { type: 'button', class: 'slot', dataset: { slot: key }, on: { click: onClick } },
    h('span', { class: 'slot-meal', text: meal.name }),
    h('span', { class: 'slot-recipe', text: recipe.name }),
    h('span', { class: 'slot-meta mono', text: `${slot.servings} ${slot.servings === 1 ? 'ración' : 'raciones'}` }),
    srOnly(`. ${day.name}. Cambiar`),
  );
}

/** Diálogo para elegir receta y raciones de un hueco. */
function pickRecipe({ day, meal, recipes, current }) {
  return openDialog({
    label: `${day.name}, ${meal.name.toLowerCase()}`,
    className: 'dialog-picker',
    build: (close) => {
      let selected = current?.recipeId ?? null;
      const servingsInput = h('input', {
        id: 'picker-servings', class: 'input stepper-input mono', type: 'number', inputmode: 'numeric',
        min: LIMITS.servingsMin, max: LIMITS.servingsMax, step: 1, required: true,
        value: String(current?.servings ?? recipes.find((r) => r.id === selected)?.servings ?? 2),
      });
      const step = (delta) => {
        const n = Math.min(LIMITS.servingsMax, Math.max(LIMITS.servingsMin, (Number(servingsInput.value) || 0) + delta));
        servingsInput.value = String(n);
      };

      const options = recipes.map((r) =>
        h('li', { dataset: { key: ingredientKey(r.name) } },
          h('label', { class: 'pick' },
            h('input', {
              type: 'radio', name: 'receta', value: r.id, checked: r.id === selected,
              on: { change: () => { selected = r.id; } },
            }),
            h('span', { class: 'pick-name', text: r.name }),
            r.minutes && h('span', { class: 'pick-meta mono', text: `${r.minutes} min` }),
          ),
        ),
      );
      const empty = h('li', { class: 'pick-empty', hidden: true, text: 'Ninguna receta coincide.' });
      const search = h('input', {
        id: 'picker-search', class: 'input', type: 'search', placeholder: 'Lentejas, pollo…', autocomplete: 'off',
        on: {
          input: () => {
            const q = ingredientKey(search.value);
            let visible = 0;
            for (const li of options) {
              const show = !q || li.dataset.key.includes(q);
              li.hidden = !show;
              if (show) visible++;
            }
            empty.hidden = visible > 0;
          },
        },
      });
      const error = h('p', { class: 'field-error', role: 'alert' });

      const submit = (event) => {
        event.preventDefault();
        if (!selected) {
          error.textContent = 'Elige una receta de la lista.';
          return;
        }
        if (!servingsInput.checkValidity()) {
          error.textContent = `Las raciones van de ${LIMITS.servingsMin} a ${LIMITS.servingsMax}.`;
          servingsInput.focus();
          return;
        }
        close({ action: 'set', recipeId: selected, servings: Number(servingsInput.value) });
      };

      return h('form', { class: 'dialog-body', novalidate: true, on: { submit } },
        h('h2', { class: 'dialog-title' }, `${day.name} · `, h('span', { class: 'accent', text: meal.name.toLowerCase() })),
        recipes.length === 0
          ? h('p', { class: 'dialog-text' }, 'Aún no hay recetas. ', h('a', { href: '#/recetas/nueva', text: 'Crea una' }), '.')
          : [
              h('div', { class: 'field' },
                h('label', { for: 'picker-search', class: 'label' }, 'Buscar receta'),
                search),
              h('fieldset', { class: 'pick-list-wrap' },
                h('legend', { class: 'sr-only', text: 'Receta' }),
                h('ul', { class: 'pick-list' }, options, empty)),
              h('div', { class: 'field field-inline' },
                h('label', { for: 'picker-servings', class: 'label' }, 'Raciones'),
                h('div', { class: 'stepper' },
                  h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'Una ración menos', on: { click: () => step(-1) } }, icon('minus')),
                  servingsInput,
                  h('button', { type: 'button', class: 'btn btn-icon', 'aria-label': 'Una ración más', on: { click: () => step(1) } }, icon('plus')),
                ),
              ),
              error,
            ],
        h('div', { class: 'dialog-actions' },
          current && h('button', { type: 'button', class: 'btn btn-ghost btn-left', on: { click: () => close({ action: 'clear' }) } }, icon('x'), 'Quitar'),
          h('button', { type: 'button', class: 'btn btn-ghost', text: 'Cancelar', on: { click: () => close(null) } }),
          recipes.length > 0 && h('button', { type: 'submit', class: 'btn btn-primary', text: 'Guardar' }),
        ),
      );
    },
  });
}
