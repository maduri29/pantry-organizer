export type StockLevel = 'ready' | 'low' | 'out';

export interface PantryItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  unit: 'items' | 'g' | 'kg' | 'lb';
  location: 'Pantry' | 'Fridge' | 'Freezer';
  level: StockLevel;
}

export const categories = [
  'Vegetables',
  'Fruit',
  'Rice & grains',
  'Millets',
  'Dals & beans',
  'Atta & flours',
  'Rava & semolina',
  'Pasta & noodles',
  'Baking & dessert ingredients',
  'Whole spices & herbs',
  'Ground spices & masalas',
  'Oils & ghee',
  'Pickles, chutneys & condiments',
  'Sugar, jaggery & sweeteners',
  'Nuts & seeds',
  'Dried fruit',
  'Bread & bakery',
  'Dairy & eggs',
  'Meat & poultry',
  'Fish & seafood',
  'Plant-based proteins',
  'Packaged meals',
  'Snacks & sweets',
  'Drinks',
  'Kitchen & food storage supplies',
  'Cleaning & laundry',
  'Personal care',
  'Household essentials',
  'Other',
] as const;

const assignments: Array<[string, (typeof categories)[number]]> = [
  ['Aluminum foil', 'Kitchen & food storage supplies'],
  ['Baking powder', 'Baking & dessert ingredients'],
  ['Bay leaves', 'Whole spices & herbs'],
  ['Bounty', 'Cleaning & laundry'],
  ['Bread flour', 'Atta & flours'],
  ['Candles', 'Household essentials'],
  ['Cashews', 'Nuts & seeds'],
  ['Chaat masala', 'Ground spices & masalas'],
  ['Chia seeds', 'Nuts & seeds'],
  ['Cleaning towels', 'Cleaning & laundry'],
  ['Cocoa powder', 'Baking & dessert ingredients'],
  ['Coriander seeds', 'Whole spices & herbs'],
  ['Crest tooth paste', 'Personal care'],
  ['Custard powder', 'Baking & dessert ingredients'],
  ['Dawn dishwash soap', 'Cleaning & laundry'],
  ['Disinfecting wipes', 'Cleaning & laundry'],
  ['Falooda', 'Baking & dessert ingredients'],
  ['Finish dishwasher pods', 'Cleaning & laundry'],
  ['Flax seeds', 'Nuts & seeds'],
  ['Fridge water filter', 'Kitchen & food storage supplies'],
  ['Gallon food bags', 'Kitchen & food storage supplies'],
  ['Hemp seeds', 'Nuts & seeds'],
  ['Honey', 'Sugar, jaggery & sweeteners'],
  ['Idli rava', 'Rice & grains'],
  ['Jaggery', 'Sugar, jaggery & sweeteners'],
  ['Jowar flour', 'Atta & flours'],
  ['Lighter', 'Household essentials'],
  ['Maggie', 'Pasta & noodles'],
  ['Mishri', 'Sugar, jaggery & sweeteners'],
  ['Mustard seeds', 'Whole spices & herbs'],
  ['Onions', 'Vegetables'],
  ['Pancakes', 'Bread & bakery'],
  ['Pheni', 'Pasta & noodles'],
  ['Poha thick', 'Rice & grains'],
  ['Potatoes', 'Vegetables'],
  ['Pumpkin seeds', 'Nuts & seeds'],
  ['Quinoa', 'Rice & grains'],
  ['Raisins', 'Dried fruit'],
  ['Red chillis', 'Whole spices & herbs'],
  ['Rice flour', 'Atta & flours'],
  ['Salt', 'Ground spices & masalas'],
  ['Sambar powder', 'Ground spices & masalas'],
  ['Scrub daddy', 'Cleaning & laundry'],
  ['Self liners', 'Kitchen & food storage supplies'],
  ['Sesame seeds', 'Nuts & seeds'],
  ['Sooji', 'Rava & semolina'],
  ['Sunflower seeds', 'Nuts & seeds'],
  ['Swiffer wet clothes', 'Cleaning & laundry'],
  ['Takeaway boxes', 'Kitchen & food storage supplies'],
  ['Toilet wand refills', 'Cleaning & laundry'],
  ['Trashbags', 'Cleaning & laundry'],
  ['Veemicelli', 'Pasta & noodles'],
  ['Yeast', 'Baking & dessert ingredients'],
];

const lowNames = new Set(['Baking powder', 'Dawn dishwash soap', 'Poha thick', 'Trashbags', 'Yeast']);
const outNames = new Set(['Red chillis', 'Flax seeds']);

// Illustrative stock only; names mirror household foods, values are in-memory demo data.
export const seedItems: PantryItem[] = assignments.map(([name, category], index) => {
  const level: StockLevel = outNames.has(name) ? 'out' : lowNames.has(name) ? 'low' : 'ready';
  const unit: PantryItem['unit'] = index % 8 === 0 ? 'lb' : index % 5 === 0 ? 'kg' : index % 3 === 0 ? 'g' : 'items';
  const location: PantryItem['location'] = index % 13 === 0 ? 'Fridge' : index % 19 === 0 ? 'Freezer' : 'Pantry';
  return { id: `demo-${index + 1}`, name, category, amount: level === 'out' ? 0 : level === 'low' ? 1 : 3 + (index % 6), unit, location, level };
});
