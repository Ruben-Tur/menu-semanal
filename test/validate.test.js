import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseQuantity, sanitizeRecipe, validateBackup } from '../public/js/lib/validate.js';
import { SEED_RECIPES, SEED_PLAN } from '../public/js/seed.js';

const recipe = (overrides = {}) => ({
  id: 'r1',
  name: 'Crema de calabacín',
  servings: '4',
  minutes: '30',
  notes: 'Triturar en caliente.',
  ingredients: [
    { name: 'Calabacín', quantity: '1,5', unit: 'kg', aisle: 'Frutería' },
    { name: '', quantity: '', unit: 'g', aisle: 'Despensa' }, // fila vacía del formulario
  ],
  ...overrides,
});

test('parseQuantity acepta coma decimal y vacío', () => {
  assert.deepEqual(parseQuantity('1,5'), { ok: true, value: 1.5 });
  assert.deepEqual(parseQuantity(' 200 '), { ok: true, value: 200 });
  assert.deepEqual(parseQuantity(''), { ok: true, value: null });
  assert.equal(parseQuantity('-1').ok, false);
  assert.equal(parseQuantity('0').ok, false);
  assert.equal(parseQuantity('1e9').ok, false);
  assert.equal(parseQuantity('dos').ok, false);
  // Lo que se redondearía a 0 no se acepta (se guardaría como «al gusto»).
  assert.equal(parseQuantity('0,0001').ok, false);
  assert.deepEqual(parseQuantity('0,0005'), { ok: true, value: 0.001 });
});

test('sanitizeRecipe limpia y descarta filas vacías', () => {
  const { ok, recipe: r } = sanitizeRecipe(recipe({ name: '  Crema   de calabacín ' }));
  assert.equal(ok, true);
  assert.equal(r.name, 'Crema de calabacín');
  assert.equal(r.servings, 4);
  assert.equal(r.minutes, 30);
  assert.equal(r.ingredients.length, 1);
  assert.deepEqual(r.ingredients[0], { name: 'Calabacín', quantity: 1.5, unit: 'kg', aisle: 'Frutería' });
});

test('sanitizeRecipe rechaza datos que no cuadran', () => {
  assert.equal(sanitizeRecipe(recipe({ name: '' })).ok, false);
  assert.equal(sanitizeRecipe(recipe({ servings: '0' })).ok, false);
  assert.equal(sanitizeRecipe(recipe({ servings: '2.5' })).ok, false);
  assert.equal(sanitizeRecipe(recipe({ ingredients: [] })).ok, false);
  assert.equal(sanitizeRecipe(recipe({ id: '../../x' })).ok, false);
  const bad = sanitizeRecipe(recipe({ ingredients: [{ name: 'Sal', quantity: 'mucha', unit: 'g', aisle: 'Despensa' }] }));
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0].message, /Sal/);
});

test('sanitizeRecipe corrige unidades y pasillos desconocidos y quita campos extra', () => {
  // JSON.parse crea «__proto__» como propiedad propia, igual que un archivo importado.
  const extra = JSON.parse('{"__proto__": {"polluted": true}, "html": "<img src=x onerror=alert(1)>"}');
  const { recipe: r } = sanitizeRecipe(recipe({
    ingredients: [{ name: 'Algo', quantity: 1, unit: 'taza', aisle: 'Ferretería', extra: 'x' }],
    ...extra,
  }));
  assert.deepEqual(r.ingredients[0], { name: 'Algo', quantity: 1, unit: 'ud', aisle: 'Otros' });
  assert.equal('html' in r, false);
  assert.equal(r.polluted, undefined);
});

test('el texto se guarda tal cual (se escapa al pintarlo, no al guardarlo)', () => {
  const { recipe: r } = sanitizeRecipe(recipe({ name: '<b>Tarta</b> & café' }));
  assert.equal(r.name, '<b>Tarta</b> & café');
});

test('una copia exportada se puede volver a importar', () => {
  const recipes = SEED_RECIPES.map((r) => sanitizeRecipe(r).recipe);
  const backup = JSON.parse(JSON.stringify(createBackup({ recipes, plan: SEED_PLAN, checked: ['cebolla'] })));
  const result = validateBackup(backup);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.data.recipes.length, SEED_RECIPES.length);
  assert.deepEqual(result.data.plan, SEED_PLAN);
  assert.deepEqual(result.data.checked, ['cebolla']);
});

test('validateBackup rechaza archivos ajenos o corruptos', () => {
  assert.equal(validateBackup(null).ok, false);
  assert.equal(validateBackup([]).ok, false);
  assert.equal(validateBackup({ app: 'otra' }).ok, false);
  assert.equal(validateBackup({ app: 'menu-semanal', version: 2, recipes: [] }).ok, false);
  assert.equal(validateBackup({ app: 'menu-semanal', version: 1 }).ok, false);
});

test('validateBackup rechaza menús que apuntan a recetas que no existen', () => {
  const result = validateBackup({
    app: 'menu-semanal',
    version: 1,
    recipes: [sanitizeRecipe(recipe()).recipe],
    plan: [{ slot: 'lun-comida', recipeId: 'fantasma', servings: 2 }],
  });
  assert.equal(result.ok, false);
});

test('validateBackup rechaza huecos inventados o repetidos e ids duplicados', () => {
  const r = sanitizeRecipe(recipe()).recipe;
  const base = { app: 'menu-semanal', version: 1, recipes: [r] };
  assert.equal(validateBackup({ ...base, plan: [{ slot: 'xyz', recipeId: 'r1', servings: 2 }] }).ok, false);
  assert.equal(validateBackup({
    ...base,
    plan: [
      { slot: 'lun-cena', recipeId: 'r1', servings: 2 },
      { slot: 'lun-cena', recipeId: 'r1', servings: 3 },
    ],
  }).ok, false);
  assert.equal(validateBackup({ ...base, recipes: [r, r] }).ok, false);
});
