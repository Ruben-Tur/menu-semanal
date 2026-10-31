import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBase, formatAmount, roundForShopping, formatIngredientQuantity } from '../public/js/lib/units.js';

test('toBase pasa kg a g y l a ml', () => {
  assert.deepEqual(toBase(1.5, 'kg'), { dim: 'masa', value: 1500 });
  assert.deepEqual(toBase(250, 'g'), { dim: 'masa', value: 250 });
  assert.deepEqual(toBase(0.75, 'l'), { dim: 'volumen', value: 750 });
  assert.deepEqual(toBase(3, 'ud'), { dim: 'unidades', value: 3 });
});

test('toBase devuelve null sin cantidad o con unidad desconocida', () => {
  assert.equal(toBase(null, 'g'), null);
  assert.equal(toBase('', 'g'), null);
  assert.equal(toBase(0, 'g'), null);
  assert.equal(toBase(-2, 'g'), null);
  assert.equal(toBase(2, 'taza'), null);
  assert.equal(toBase(Number.NaN, 'g'), null);
});

test('formatAmount cambia a kg o l a partir de 1000', () => {
  assert.equal(formatAmount('masa', 600), '600 g');
  assert.equal(formatAmount('masa', 1000), '1 kg');
  assert.equal(formatAmount('masa', 1250), '1,25 kg');
  assert.equal(formatAmount('volumen', 500), '500 ml');
  assert.equal(formatAmount('volumen', 1500), '1,5 l');
});

test('formatAmount evita decimales absurdos', () => {
  assert.equal(formatAmount('masa', 1237), '1,24 kg');
  assert.equal(formatAmount('masa', 112.5), '113 g');
  assert.equal(formatAmount('masa', 0.2), '1 g');
});

test('las unidades se redondean hacia arriba (no se compra media cebolla)', () => {
  assert.equal(roundForShopping('unidades', 1.5), 2);
  assert.equal(roundForShopping('unidades', 0.25), 1);
  // Error de coma flotante: 0,1 + 0,2 + 0,7 no debe convertirse en 2.
  assert.equal(roundForShopping('unidades', 0.1 + 0.2 + 0.7), 1);
  assert.equal(formatAmount('unidades', 3), '3 ud.');
});

test('las cucharadas se redondean a media', () => {
  assert.equal(formatAmount('cucharadas', 1.3), '1,5 cda.');
  assert.equal(formatAmount('cucharaditas', 0.1), '0,5 cdta.');
});

test('formatIngredientQuantity muestra «al gusto» sin cantidad', () => {
  assert.equal(formatIngredientQuantity(null, 'g'), 'al gusto');
  assert.equal(formatIngredientQuantity(1.5, 'kg'), '1,5 kg');
  assert.equal(formatIngredientQuantity(2, 'cda'), '2 cda.');
});
