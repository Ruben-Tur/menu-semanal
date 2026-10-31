// Recetas y menú de ejemplo que se cargan la primera vez que se abre la app.
// Cantidades para el número de raciones indicado en cada receta.

const i = (name, quantity, unit, aisle) => ({ name, quantity, unit, aisle });

const F = 'Frutería';
const C = 'Carnicería';
const P = 'Pescadería';
const CH = 'Charcutería';
const L = 'Lácteos y huevos';
const PA = 'Panadería';
const D = 'Despensa';
const CO = 'Congelados';
const B = 'Bebidas';

export const SEED_RECIPES = [
  {
    id: 'lentejas-con-verduras',
    name: 'Lentejas con verduras',
    servings: 4,
    minutes: 60,
    notes: 'Sofríe la cebolla, el pimiento y el ajo, añade el pimentón fuera del fuego y luego las lentejas, la zanahoria y la patata. Cubre con agua y cuece a fuego lento unos 45 minutos.',
    ingredients: [
      i('Lentejas pardinas', 400, 'g', D),
      i('Cebolla', 1, 'ud', F),
      i('Zanahoria', 2, 'ud', F),
      i('Pimiento verde', 1, 'ud', F),
      i('Patatas', 300, 'g', F),
      i('Dientes de ajo', 2, 'ud', F),
      i('Pimentón dulce', 1, 'cdta', D),
      i('Aceite de oliva virgen extra', 3, 'cda', D),
      i('Sal', null, 'g', D),
    ],
  },
  {
    id: 'salmon-al-horno',
    name: 'Salmón al horno con patatas',
    servings: 4,
    minutes: 35,
    notes: 'Hornea las patatas en rodajas con la cebolla 20 minutos a 200 °C. Coloca encima el salmón con limón y eneldo y hornea 12 minutos más.',
    ingredients: [
      i('Salmón', 600, 'g', P),
      i('Patatas', 800, 'g', F),
      i('Cebolla', 1, 'ud', F),
      i('Limón', 1, 'ud', F),
      i('Eneldo', null, 'g', D),
      i('Aceite de oliva virgen extra', 4, 'cda', D),
      i('Sal', null, 'g', D),
    ],
  },
  {
    id: 'pasta-con-pesto',
    name: 'Pasta con pesto',
    servings: 4,
    minutes: 20,
    notes: 'Tritura la albahaca con los piñones, el ajo, el parmesano y el aceite. Mezcla con la pasta recién escurrida y los tomates cherry partidos por la mitad.',
    ingredients: [
      i('Espaguetis', 400, 'g', D),
      i('Albahaca fresca', 50, 'g', F),
      i('Piñones', 30, 'g', D),
      i('Queso parmesano', 60, 'g', L),
      i('Dientes de ajo', 1, 'ud', F),
      i('Aceite de oliva virgen extra', 100, 'ml', D),
      i('Tomates cherry', 250, 'g', F),
    ],
  },
  {
    id: 'pollo-al-curry',
    name: 'Pollo al curry',
    servings: 4,
    minutes: 40,
    notes: 'Dora el pollo troceado, retíralo y sofríe la cebolla, el ajo y el jengibre. Añade el curry, el tomate y la leche de coco, vuelve a meter el pollo y cuece 20 minutos. Sirve con arroz basmati.',
    ingredients: [
      i('Contramuslos de pollo', 800, 'g', C),
      i('Cebolla', 1, 'ud', F),
      i('Dientes de ajo', 2, 'ud', F),
      i('Jengibre fresco', 20, 'g', F),
      i('Curry en polvo', 2, 'cda', D),
      i('Leche de coco', 400, 'ml', D),
      i('Tomate triturado', 200, 'g', D),
      i('Arroz basmati', 300, 'g', D),
      i('Aceite de oliva virgen extra', 2, 'cda', D),
    ],
  },
  {
    id: 'tortilla-y-ensalada',
    name: 'Tortilla de patatas y ensalada',
    servings: 4,
    minutes: 45,
    notes: 'Confita las patatas y la cebolla en el aceite a fuego medio, escúrrelas y mézclalas con los huevos batidos. Cuaja la tortilla por los dos lados. Acompaña con lechuga y tomate aliñados.',
    ingredients: [
      i('Patatas', 800, 'g', F),
      i('Huevos', 6, 'ud', L),
      i('Cebolla', 1, 'ud', F),
      i('Aceite de oliva virgen extra', 250, 'ml', D),
      i('Lechuga', 1, 'ud', F),
      i('Tomates', 2, 'ud', F),
      i('Barra de pan', 1, 'ud', PA),
      i('Sal', null, 'g', D),
    ],
  },
  {
    id: 'paella-mixta',
    name: 'Paella mixta',
    servings: 4,
    minutes: 50,
    notes: 'Dora el pollo, añade el calamar, las judías y los guisantes. Sofríe el tomate con el ajo y el pimentón, incorpora el caldo caliente con el azafrán y reparte el arroz. 18 minutos sin remover; las gambas, los últimos 5.',
    ingredients: [
      i('Arroz bomba', 400, 'g', D),
      i('Contramuslos de pollo', 400, 'g', C),
      i('Gambas', 300, 'g', P),
      i('Calamar', 250, 'g', P),
      i('Judías verdes planas', 200, 'g', F),
      i('Guisantes congelados', 100, 'g', CO),
      i('Tomate triturado', 150, 'g', D),
      i('Dientes de ajo', 2, 'ud', F),
      i('Pimentón dulce', 1, 'cdta', D),
      i('Azafrán en hebras', null, 'g', D),
      i('Caldo de pescado', 1, 'l', D),
      i('Aceite de oliva virgen extra', 4, 'cda', D),
      i('Limón', 1, 'ud', F),
    ],
  },
  {
    id: 'merluza-en-salsa-verde',
    name: 'Merluza en salsa verde',
    servings: 4,
    minutes: 30,
    notes: 'Dora el ajo picado, añade la harina y el vino, y luego el caldo y el perejil. Cuece la merluza y las almejas en la salsa moviendo la cazuela hasta que ligue.',
    ingredients: [
      i('Merluza en rodajas', 800, 'g', P),
      i('Almejas', 250, 'g', P),
      i('Dientes de ajo', 3, 'ud', F),
      i('Perejil fresco', 1, 'ud', F),
      i('Harina de trigo', 1, 'cda', D),
      i('Vino blanco', 100, 'ml', B),
      i('Caldo de pescado', 200, 'ml', D),
      i('Aceite de oliva virgen extra', 4, 'cda', D),
    ],
  },
  {
    id: 'crema-de-calabacin',
    name: 'Crema de calabacín',
    servings: 4,
    minutes: 30,
    notes: 'Pocha el puerro, añade el calabacín y la patata en dados y cubre con el caldo. Cuece 20 minutos, agrega los quesitos y tritura. Sirve con taquitos de jamón por encima.',
    ingredients: [
      i('Calabacín', 1, 'kg', F),
      i('Puerro', 1, 'ud', F),
      i('Patatas', 200, 'g', F),
      i('Quesitos', 4, 'ud', L),
      i('Caldo de verduras', 500, 'ml', D),
      i('Taquitos de jamón serrano', 80, 'g', CH),
      i('Aceite de oliva virgen extra', 2, 'cda', D),
      i('Sal', null, 'g', D),
    ],
  },
  {
    id: 'garbanzos-con-espinacas',
    name: 'Garbanzos con espinacas',
    servings: 4,
    minutes: 25,
    notes: 'Fríe el pan y el ajo, y májalos con el comino, el pimentón y el vinagre. Rehoga las espinacas, añade los garbanzos y el majado con un poco de agua y deja que espese 10 minutos.',
    ingredients: [
      i('Garbanzos cocidos', 800, 'g', D),
      i('Espinacas frescas', 300, 'g', F),
      i('Dientes de ajo', 3, 'ud', F),
      i('Barra de pan', 0.25, 'ud', PA),
      i('Comino molido', 1, 'cdta', D),
      i('Pimentón dulce', 1, 'cdta', D),
      i('Vinagre de Jerez', 1, 'cda', D),
      i('Aceite de oliva virgen extra', 4, 'cda', D),
    ],
  },
];

// Menú de ejemplo para dos personas, con el sábado para cuatro.
export const SEED_PLAN = [
  { slot: 'lun-comida', recipeId: 'lentejas-con-verduras', servings: 2 },
  { slot: 'lun-cena', recipeId: 'crema-de-calabacin', servings: 2 },
  { slot: 'mar-comida', recipeId: 'salmon-al-horno', servings: 2 },
  { slot: 'mie-comida', recipeId: 'pasta-con-pesto', servings: 2 },
  { slot: 'mie-cena', recipeId: 'merluza-en-salsa-verde', servings: 2 },
  { slot: 'jue-comida', recipeId: 'pollo-al-curry', servings: 2 },
  { slot: 'vie-comida', recipeId: 'tortilla-y-ensalada', servings: 2 },
  { slot: 'vie-cena', recipeId: 'garbanzos-con-espinacas', servings: 2 },
  { slot: 'sab-comida', recipeId: 'paella-mixta', servings: 4 },
];
