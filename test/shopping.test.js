import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, buildShoppingList, collectIngredients, groupByAisle, shoppingListToText } from '../public/js/lib/shopping.js';

const ing = (name, quantity, unit, aisle) => ({ name, quantity, unit, aisle });

const lentejas = {
  id: 'lentejas',
  name: 'Lentejas con verduras',
  servings: 4,
  ingredients: [
    ing('Lentejas pardinas', 400, 'g', 'Despensa'),
    ing('Cebolla', 1, 'ud', 'Frutería'),
    ing('Zanahoria', 2, 'ud', 'Frutería'),
    ing('Aceite de oliva', 3, 'cda', 'Despensa'),
    ing('Sal', null, 'g', 'Despensa'),
  ],
};

const salmon = {
  id: 'salmon',
  name: 'Salmón al horno',
  servings: 2,
  ingredients: [
    ing('Salmón', 300, 'g', 'Pescadería'),
    ing('cebolla ', 0.5, 'ud', 'Frutería'),
    ing('Patatas', 0.5, 'kg', 'Frutería'),
    ing('Sal', null, 'g', 'Despensa'),
  ],
};

const tortilla = {
  id: 'tortilla',
  name: 'Tortilla de patatas',
  servings: 4,
  ingredients: [
    ing('Patatas', 600, 'g', 'Frutería'),
    ing('Huevos', 6, 'ud', 'Lácteos y huevos'),
    ing('Cebolla', 1, 'ud', 'Frutería'),
    ing('Aceite de oliva', 0.2, 'l', 'Despensa'),
    ing('Patatas', 2, 'ud', 'Frutería'),
  ],
};

const recipes = [lentejas, salmon, tortilla];
const byId = new Map(recipes.map((r) => [r.id, r]));

test('escala las cantidades a las raciones de cada hueco', () => {
  const lines = collectIngredients([{ slot: 'lun-comida', recipeId: 'lentejas', servings: 2 }], byId);
  const lentil = lines.find((l) => l.key === 'lentejas pardinas');
  assert.deepEqual(lentil.amount, { dim: 'masa', value: 200 });
  assert.equal(lentil.recipe, 'Lentejas con verduras');
});

test('ignora huecos vacíos y recetas borradas', () => {
  const lines = collectIngredients(
    [{ slot: 'lun-comida', recipeId: 'no-existe', servings: 2 }, null],
    byId,
  );
  assert.equal(lines.length, 0);
});

test('suma el mismo ingrediente aunque cambien mayúsculas, tildes y unidades (g + kg)', () => {
  const list = buildShoppingList(
    [
      { slot: 'lun-comida', recipeId: 'salmon', servings: 4 }, // 1 kg de patatas, 1 cebolla
      { slot: 'mar-cena', recipeId: 'tortilla', servings: 4 }, // 600 g de patatas, 1 cebolla
    ],
    recipes,
  );
  const fruteria = list.groups.find((g) => g.aisle === 'Frutería');
  const patatas = fruteria.items.find((i) => i.key === 'patatas');
  // 1000 g + 600 g = 1,6 kg; y las 2 unidades se mantienen aparte.
  assert.equal(patatas.quantityText, '1,6 kg + 2 ud.');
  const cebolla = fruteria.items.find((i) => i.key === 'cebolla');
  assert.equal(cebolla.quantityText, '2 ud.');
  assert.deepEqual(cebolla.recipes, ['Salmón al horno', 'Tortilla de patatas']);
});

test('suma ml con l y pasa las cucharadas a ml si el producto ya va por volumen', () => {
  const list = buildShoppingList(
    [
      { slot: 'lun-comida', recipeId: 'lentejas', servings: 4 },
      { slot: 'lun-cena', recipeId: 'tortilla', servings: 2 },
    ],
    recipes,
  );
  const aceite = list.groups.flatMap((g) => g.items).find((i) => i.key === 'aceite de oliva');
  // 100 ml (0,2 l a media receta) + 3 cucharadas × 15 ml
  assert.equal(aceite.quantityText, '145 ml');
});

test('lo que solo va en cucharadas se queda en cucharadas', () => {
  const list = buildShoppingList([{ slot: 'lun-comida', recipeId: 'lentejas', servings: 8 }], recipes);
  const aceite = list.groups.flatMap((g) => g.items).find((i) => i.key === 'aceite de oliva');
  assert.equal(aceite.quantityText, '6 cda.');
});

test('los ingredientes sin cantidad aparecen «al gusto» una sola vez', () => {
  const list = buildShoppingList(
    [
      { slot: 'lun-comida', recipeId: 'lentejas', servings: 4 },
      { slot: 'mar-comida', recipeId: 'salmon', servings: 2 },
    ],
    recipes,
  );
  const sal = list.groups.flatMap((g) => g.items).filter((i) => i.key === 'sal');
  assert.equal(sal.length, 1);
  assert.equal(sal[0].quantityText, 'al gusto');
});

test('agrupa por pasillos en el orden del súper y ordena alfabéticamente', () => {
  const list = buildShoppingList(
    [
      { slot: 'lun-comida', recipeId: 'lentejas', servings: 4 },
      { slot: 'mar-comida', recipeId: 'salmon', servings: 2 },
      { slot: 'mie-cena', recipeId: 'tortilla', servings: 4 },
    ],
    recipes,
  );
  assert.deepEqual(
    list.groups.map((g) => g.aisle),
    ['Frutería', 'Pescadería', 'Lácteos y huevos', 'Despensa'],
  );
  assert.deepEqual(
    list.groups[0].items.map((i) => i.name),
    ['Cebolla', 'Patatas', 'Zanahoria'],
  );
  assert.equal(list.meals, 3);
  assert.equal(list.total, 8);
});

test('un pasillo desconocido va a «Otros»', () => {
  const groups = groupByAisle(aggregate([
    { key: 'x', name: 'X', aisle: 'Inventado', amount: null, recipe: 'R' },
  ]));
  assert.equal(groups[0].aisle, 'Otros');
});

test('un menú vacío da una lista vacía', () => {
  const list = buildShoppingList([], recipes);
  assert.deepEqual(list, { meals: 0, total: 0, groups: [] });
});

test('el texto para compartir omite lo ya marcado', () => {
  const list = buildShoppingList([{ slot: 'lun-comida', recipeId: 'salmon', servings: 2 }], recipes);
  const text = shoppingListToText(list, new Set(['sal']));
  assert.match(text, /PESCADERÍA\n- Salmón: 300 g/);
  assert.doesNotMatch(text, /^- Sal$/m);
});
