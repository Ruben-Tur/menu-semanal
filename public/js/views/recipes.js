// Recetario: listado, ficha y formulario de receta.
import { AISLES, DAYS, MEALS, UNITS, UNIT_IDS, LIMITS, slotKey } from '../lib/catalog.js';
import { formatIngredientQuantity } from '../lib/units.js';
import { ingredientKey } from '../lib/text.js';
import { h, icon, mount, confirmDialog, toast } from '../dom.js';
import * as store from '../store.js';

const SLOT_LABELS = new Map(
  DAYS.flatMap((d) => MEALS.map((m) => [slotKey(d.id, m.id), `${d.short} ${m.name.toLowerCase()}`])),
);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ---------- Listado ---------- */

export async function renderRecipeList(view) {
  const [recipes, plan] = await Promise.all([store.listRecipes(), store.getPlan()]);
  const usage = new Map();
  for (const slot of plan) usage.set(slot.recipeId, [...(usage.get(slot.recipeId) ?? []), slot.slot]);

  const cards = recipes.map((r) => {
    const slots = usage.get(r.id) ?? [];
    return h('li', { class: 'recipe-item', dataset: { key: ingredientKey(`${r.name} ${r.ingredients.map((i) => i.name).join(' ')}`) } },
      h('a', { class: 'recipe-card', href: `#/recetas/${encodeURIComponent(r.id)}` },
        h('h3', { class: 'recipe-name', text: r.name }),
        h('p', { class: 'recipe-meta mono' },
          plural(r.servings, 'ración', 'raciones'),
          r.minutes ? ` · ${r.minutes} min` : '',
          ` · ${plural(r.ingredients.length, 'ingrediente', 'ingredientes')}`),
        slots.length > 0 && h('p', { class: 'recipe-tags' },
          slots.map((s) => h('span', { class: 'tag', text: SLOT_LABELS.get(s) }))),
      ),
    );
  });

  const empty = h('p', { class: 'notice', hidden: true, text: 'Ninguna receta coincide con la búsqueda.' });
  const search = h('input', {
    id: 'recipe-search', class: 'input', type: 'search', placeholder: 'Nombre o ingrediente', autocomplete: 'off',
    on: {
      input: () => {
        const q = ingredientKey(search.value);
        let visible = 0;
        for (const li of cards) {
          li.hidden = Boolean(q) && !li.dataset.key.includes(q);
          if (!li.hidden) visible++;
        }
        empty.hidden = visible > 0;
      },
    },
  });

  mount(view,
    h('div', { class: 'view-head' },
      h('div', {},
        h('h2', { class: 'view-title', tabindex: '-1', text: 'Recetario' }),
        h('p', { class: 'view-sub' }, h('span', { class: 'mono', text: String(recipes.length) }), recipes.length === 1 ? ' receta' : ' recetas'),
      ),
      h('div', { class: 'view-actions' },
        h('a', { class: 'btn btn-primary', href: '#/recetas/nueva' }, icon('plus'), 'Nueva receta'),
      ),
    ),
    recipes.length > 0
      ? [
          h('div', { class: 'field search-field' },
            h('label', { for: 'recipe-search', class: 'label' }, 'Buscar'),
            search),
          h('ul', { class: 'recipe-grid' }, cards),
          empty,
        ]
      : h('p', { class: 'notice' }, 'El recetario está vacío. ', h('a', { href: '#/recetas/nueva', text: 'Añade tu primera receta' }), ' o recupera las de ejemplo en ', h('a', { href: '#/datos', text: 'Tus datos' }), '.'),
  );
}

/* ---------- Ficha ---------- */

export async function renderRecipeDetail(view, id) {
  const [recipe, plan] = await Promise.all([store.getRecipe(id), store.getPlan()]);
  if (!recipe) return renderNotFound(view);
  const slots = plan.filter((s) => s.recipeId === id).map((s) => s.slot);

  const remove = async () => {
    const ok = await confirmDialog({
      title: `¿Borrar «${recipe.name}»?`,
      body: slots.length
        ? [`Está en el menú (${slots.map((s) => SLOT_LABELS.get(s)).join(', ')}) y se quitará de ahí.`, 'No se puede deshacer.']
        : 'No se puede deshacer.',
      confirmText: 'Borrar receta',
      danger: true,
    });
    if (!ok) return;
    await store.deleteRecipe(id);
    toast(`Receta «${recipe.name}» borrada`);
    location.hash = '#/recetas';
  };

  mount(view,
    h('a', { class: 'back-link', href: '#/recetas' }, icon('back'), 'Recetario'),
    h('article', { class: 'recipe-detail' },
      h('div', { class: 'view-head' },
        h('div', {},
          h('h2', { class: 'view-title', tabindex: '-1', text: recipe.name }),
          h('p', { class: 'view-sub mono' },
            plural(recipe.servings, 'ración', 'raciones'),
            recipe.minutes ? ` · ${recipe.minutes} min` : ''),
        ),
        h('div', { class: 'view-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost', on: { click: remove } }, icon('trash'), 'Borrar'),
          h('a', { class: 'btn btn-primary', href: `#/recetas/${encodeURIComponent(id)}/editar` }, icon('edit'), 'Editar'),
        ),
      ),
      slots.length > 0 && h('p', { class: 'recipe-tags' }, 'En el menú: ', slots.map((s) => h('span', { class: 'tag', text: SLOT_LABELS.get(s) }))),
      h('div', { class: 'detail-cols' },
        h('section', { class: 'card', 'aria-labelledby': 'ing-title' },
          h('h3', { class: 'card-title', id: 'ing-title', text: 'Ingredientes' }),
          h('ul', { class: 'ing-list' },
            recipe.ingredients.map((ing) =>
              h('li', {},
                h('span', { class: 'ing-qty mono', text: formatIngredientQuantity(ing.quantity, ing.unit) }),
                h('span', { class: 'ing-name', text: ing.name }),
                h('span', { class: 'ing-aisle', text: ing.aisle }),
              ),
            ),
          ),
        ),
        h('section', { class: 'card', 'aria-labelledby': 'prep-title' },
          h('h3', { class: 'card-title', id: 'prep-title', text: 'Preparación' }),
          recipe.notes
            ? h('p', { class: 'prep', text: recipe.notes })
            : h('p', { class: 'muted', text: 'Sin notas de preparación.' }),
        ),
      ),
    ),
  );
}

function renderNotFound(view) {
  mount(view,
    h('a', { class: 'back-link', href: '#/recetas' }, icon('back'), 'Recetario'),
    h('h2', { class: 'view-title', tabindex: '-1', text: 'Esta receta no existe' }),
    h('p', { class: 'notice', text: 'Puede que la hayas borrado o que el enlace no sea correcto.' }),
  );
}

/* ---------- Formulario ---------- */

let rowSeq = 0;

export async function renderRecipeForm(view, id = null) {
  const [recipe, all] = await Promise.all([id ? store.getRecipe(id) : null, store.listRecipes()]);
  if (id && !recipe) return renderNotFound(view);

  // Ingredientes ya usados: sirven para autocompletar el nombre y el pasillo.
  const known = new Map();
  for (const r of all) for (const ing of r.ingredients) {
    const key = ingredientKey(ing.name);
    if (!known.has(key)) known.set(key, ing);
  }
  const datalist = h('datalist', { id: 'ingredientes-conocidos' },
    [...known.values()].map((ing) => h('option', { value: ing.name })));

  const rows = h('ol', { class: 'ing-rows' });
  const addRow = (ing = {}) => {
    const n = ++rowSeq;
    const name = h('input', {
      id: `ing-name-${n}`, class: 'input', name: 'ing-name', type: 'text', maxlength: LIMITS.ingredientName,
      list: 'ingredientes-conocidos', autocomplete: 'off', placeholder: 'Cebolla', value: ing.name ?? '',
    });
    const quantity = h('input', {
      id: `ing-qty-${n}`, class: 'input mono', name: 'ing-qty', type: 'text', inputmode: 'decimal',
      placeholder: 'al gusto', value: ing.quantity == null ? '' : String(ing.quantity).replace('.', ','),
    });
    const unit = h('select', { id: `ing-unit-${n}`, class: 'input', name: 'ing-unit' },
      UNIT_IDS.map((u) => h('option', { value: u, selected: (ing.unit ?? 'g') === u, text: UNITS[u].label })));
    const aisle = h('select', { id: `ing-aisle-${n}`, class: 'input', name: 'ing-aisle' },
      AISLES.map((a) => h('option', { value: a, selected: (ing.aisle ?? 'Frutería') === a, text: a })));

    // Si el ingrediente ya existe en otra receta, proponemos su pasillo y unidad.
    let aisleTouched = Boolean(ing.name);
    aisle.addEventListener('change', () => { aisleTouched = true; });
    name.addEventListener('change', () => {
      const match = known.get(ingredientKey(name.value));
      if (match && !aisleTouched) {
        aisle.value = match.aisle;
        if (!quantity.value) unit.value = match.unit;
      }
    });

    const row = h('li', { class: 'ing-row' },
      h('div', { class: 'field f-name' }, h('label', { for: name.id, class: 'label', text: 'Ingrediente' }), name),
      h('div', { class: 'field f-qty' }, h('label', { for: quantity.id, class: 'label', text: 'Cantidad' }), quantity),
      h('div', { class: 'field f-unit' }, h('label', { for: unit.id, class: 'label', text: 'Unidad' }), unit),
      h('div', { class: 'field f-aisle' }, h('label', { for: aisle.id, class: 'label', text: 'Pasillo' }), aisle),
      h('button', {
        type: 'button', class: 'btn btn-icon btn-remove', 'aria-label': 'Quitar ingrediente',
        on: {
          click: () => {
            const next = row.nextElementSibling ?? row.previousElementSibling;
            row.remove();
            if (!rows.children.length) addRow();
            (next?.querySelector('input') ?? rows.querySelector('input'))?.focus();
          },
        },
      }, icon('x')),
    );
    rows.append(row);
    return name;
  };

  (recipe?.ingredients?.length ? recipe.ingredients : [{}, {}, {}]).forEach((ing) => addRow(ing));

  const errorBox = h('div', { class: 'form-errors', role: 'alert', tabindex: '-1', hidden: true });

  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const ingredients = [...rows.children].map((row) => ({
      name: row.querySelector('[name="ing-name"]').value,
      quantity: row.querySelector('[name="ing-qty"]').value,
      unit: row.querySelector('[name="ing-unit"]').value,
      aisle: row.querySelector('[name="ing-aisle"]').value,
    }));
    const result = await store.saveRecipe({
      id: recipe?.id,
      name: data.get('name'),
      servings: data.get('servings'),
      minutes: data.get('minutes'),
      notes: data.get('notes'),
      ingredients,
    });

    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
    if (!result.ok) {
      showErrors(form, rows, errorBox, result.errors);
      return;
    }
    toast(recipe ? 'Cambios guardados' : 'Receta creada');
    location.hash = `#/recetas/${encodeURIComponent(result.recipe.id)}`;
  };

  const title = recipe ? 'Editar receta' : 'Nueva receta';
  const cancelHref = recipe ? `#/recetas/${encodeURIComponent(recipe.id)}` : '#/recetas';

  mount(view,
    h('a', { class: 'back-link', href: cancelHref }, icon('back'), recipe ? recipe.name : 'Recetario'),
    h('h2', { class: 'view-title', tabindex: '-1', text: title }),
    h('form', { class: 'recipe-form', novalidate: true, on: { submit } },
      errorBox,
      h('div', { class: 'card form-basics' },
        h('div', { class: 'field f-title' },
          h('label', { for: 'f-name', class: 'label', text: 'Nombre' }),
          h('input', { id: 'f-name', name: 'name', class: 'input', type: 'text', required: true, maxlength: LIMITS.recipeName, value: recipe?.name ?? '', placeholder: 'Pisto con huevo', autocomplete: 'off' })),
        h('div', { class: 'field' },
          h('label', { for: 'f-servings', class: 'label', text: 'Raciones' }),
          h('input', { id: 'f-servings', name: 'servings', class: 'input mono', type: 'number', inputmode: 'numeric', required: true, min: LIMITS.servingsMin, max: LIMITS.servingsMax, step: 1, value: String(recipe?.servings ?? 4) })),
        h('div', { class: 'field' },
          h('label', { for: 'f-minutes', class: 'label' }, 'Tiempo ', h('span', { class: 'muted', text: '(min, opcional)' })),
          h('input', { id: 'f-minutes', name: 'minutes', class: 'input mono', type: 'number', inputmode: 'numeric', min: 1, max: LIMITS.minutesMax, step: 1, value: recipe?.minutes ? String(recipe.minutes) : '' })),
      ),
      h('fieldset', { class: 'card ing-fieldset' },
        h('legend', { class: 'card-title', text: 'Ingredientes' }),
        h('p', { class: 'hint', text: 'Cantidades para las raciones de arriba. Deja la cantidad vacía para «al gusto».' }),
        rows,
        datalist,
        h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => addRow().focus() } }, icon('plus'), 'Añadir ingrediente'),
      ),
      h('div', { class: 'card' },
        h('div', { class: 'field' },
          h('label', { for: 'f-notes', class: 'label' }, 'Preparación ', h('span', { class: 'muted', text: '(opcional)' })),
          h('textarea', { id: 'f-notes', name: 'notes', class: 'input', rows: 5, maxlength: LIMITS.notes, text: recipe?.notes ?? '' })),
      ),
      h('div', { class: 'form-actions' },
        h('a', { class: 'btn btn-ghost', href: cancelHref, text: 'Cancelar' }),
        h('button', { type: 'submit', class: 'btn btn-primary' }, icon('check'), recipe ? 'Guardar cambios' : 'Crear receta'),
      ),
    ),
  );
}

function showErrors(form, rows, box, errors) {
  const fieldFor = (field) => {
    const m = /^ingredients\.(\d+)\.(name|quantity)$/.exec(field);
    if (m) {
      const row = rows.children[Number(m[1])];
      return row?.querySelector(m[2] === 'name' ? '[name="ing-name"]' : '[name="ing-qty"]');
    }
    if (field === 'ingredients') return rows.querySelector('[name="ing-name"]');
    return form.querySelector(`[name="${field}"]`);
  };
  mount(box,
    h('p', { class: 'form-errors-title', text: errors.length === 1 ? 'Revisa este dato:' : `Revisa estos ${errors.length} datos:` }),
    h('ul', {}, errors.map((e) => h('li', { text: e.message }))),
  );
  box.hidden = false;
  for (const e of errors) fieldFor(e.field)?.setAttribute('aria-invalid', 'true');
  (fieldFor(errors[0].field) ?? box).focus();
}
