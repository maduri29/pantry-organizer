import React from 'react';
import type { Product } from '../types.ts';

type IllustrationKind =
  | 'grain'
  | 'flour'
  | 'noodles'
  | 'spice'
  | 'seeds'
  | 'fruit'
  | 'honey'
  | 'bread'
  | 'vegetable'
  | 'beans'
  | 'dairy'
  | 'herbs'
  | 'oil'
  | 'jar'
  | 'cleaning'
  | 'storage'
  | 'care'
  | 'home'
  | 'meal'
  | 'avocado'
  | 'berries'
  | 'peas'
  | 'yogurt'
  | 'rice';

const named: Record<string, IllustrationKind> = {
  avocado: 'avocado',
  avocados: 'avocado',
  blueberries: 'berries',
  'frozen peas': 'peas',
  'greek yogurt': 'yogurt',
  yogurt: 'yogurt',
  'basmati rice': 'rice',
  rice: 'rice',
  honey: 'honey',
  jaggery: 'honey',
  mishri: 'honey',
  raisins: 'fruit',
  'red chillis': 'spice',
  'chaat masala': 'spice',
  salt: 'spice',
  'sambar powder': 'spice',
  'coriander seeds': 'herbs',
  'mustard seeds': 'herbs',
  quinoa: 'grain',
  poha: 'grain',
  'idli rava': 'grain',
  sooji: 'flour',
  'bread flour': 'flour',
  'jowar flour': 'flour',
  'rice flour': 'flour',
  maggi: 'noodles',
  veemicelli: 'noodles',
  vermicelli: 'noodles',
  flour: 'flour',
  foil: 'storage',
  'takeaway boxes': 'storage',
  'food bags': 'storage',
  crest: 'care',
  candles: 'home',
  lighter: 'home',
  dawn: 'cleaning',
  finish: 'cleaning'
};

const byCategory: Record<string, IllustrationKind> = {
  Vegetables: 'vegetable',
  Fruit: 'fruit',
  'Rice & grains': 'rice',
  Millets: 'grain',
  'Dals & beans': 'beans',
  'Atta & flours': 'flour',
  'Rava & semolina': 'flour',
  'Pasta & noodles': 'noodles',
  'Baking & dessert ingredients': 'flour',
  'Whole spices & herbs': 'herbs',
  'Ground spices & masalas': 'spice',
  'Oils & ghee': 'oil',
  'Pickles, chutneys & condiments': 'jar',
  'Sugar, jaggery & sweeteners': 'honey',
  'Nuts & seeds': 'seeds',
  'Dried fruit': 'fruit',
  'Bread & bakery': 'bread',
  'Dairy & eggs': 'dairy',
  'Plant-based proteins': 'beans',
  'Kitchen & food storage supplies': 'storage',
  'Cleaning & laundry': 'cleaning',
  'Personal care': 'care',
  'Household essentials': 'home',
  'Packaged meals': 'meal',
  'Snacks & sweets': 'bread',
  Drinks: 'jar',
  'Grains & pulses': 'rice',
  'Meat & fish': 'meal',
  Snacks: 'bread',
  Other: 'jar'
};

// Color belongs to each food's material, never to a tile behind the illustration.
const drawings: Record<IllustrationKind, React.ReactNode> = {
  avocado: (
    <>
      <path
        className="food-fill"
        d="M12 3c-3 0-3 4-5 7-2 3-4 6-2 9 2 3 10 3 13 0 3-3 0-7-2-10-1-3-1-6-4-6Z"
      />
      <path
        className="food-detail"
        d="M12 6c-2 0-2 3-4 6-2 3-3 5-1 6 2 2 7 2 9 0 2-2 0-4-2-7-1-2-1-5-2-5Z"
      />
      <ellipse className="food-seed" cx="11.8" cy="15.5" rx="3" ry="3.4" />
    </>
  ),
  berries: (
    <>
      <path className="food-leaf" d="M11 7c1-4 4-5 7-4-1 4-4 5-7 4Z" />
      <circle className="food-fill" cx="9" cy="10" r="4" />
      <circle className="food-fill" cx="16" cy="12" r="4" />
      <circle className="food-detail" cx="10" cy="17" r="4.5" />
      <path d="m8 8 1 2 2-1m4 1 1 2 2-1m-10 5 2 1 1-2" />
    </>
  ),
  peas: (
    <>
      <path className="food-fill" d="m6 4 12 1-1 5 2 9-15 1 2-10Z" />
      <path className="food-detail" d="m6 8 11 1 1 8-13 1Z" />
      <path d="m6 4 12 1M5 20l14-1" />
      <circle className="food-leaf" cx="9" cy="13" r="2" />
      <circle className="food-leaf" cx="14" cy="14" r="2" />
    </>
  ),
  yogurt: (
    <>
      <path className="food-detail" d="m5 7 2 13h10l2-13Z" />
      <path className="food-fill" d="m6 11 1 6h10l1-6Z" />
      <path className="food-detail" d="M4 5c4-2 12-2 16 0v2H4Z" />
      <path d="M10 13h4m-3 2h2" />
    </>
  ),
  rice: (
    <>
      <path className="food-detail" d="m7 3 10 1-1 4 3 12H5L8 8Z" />
      <path className="food-fill" d="M6 13h12l1 7H5Z" />
      <path d="m8 5 8 1M10 10l1 2m3-2-1 2m-3 4 1 1m3-1-1 2" />
    </>
  ),
  grain: (
    <>
      <path className="food-fill" d="M13 7c-4-3-8 0-8 4 0 5 5 8 9 7 5-1 7-6 4-10-1-1-3-2-5-1Z" />
      <path d="M9 9c1 3 3 5 7 6M12 7c-1 3 0 6 2 9" />
      <circle cx="8" cy="13" r=".6" />
      <circle cx="16" cy="11" r=".6" />
    </>
  ),
  flour: (
    <>
      <path className="food-fill" d="M7 5h10l-1 3 2 3v8H6v-8l2-3-1-3Z" />
      <path d="M8 8h8M7 12h10M9 15h6" />
      <path d="m10 18 2-3 2 3" />
    </>
  ),
  noodles: (
    <>
      <path className="food-fill" d="M5 8h14l-1 11H6L5 8Z" />
      <path d="M8 8c0-3 2-4 4-4s4 1 4 4M8 12h8M9 15h6" />
      <path d="m11 12 2 3" />
    </>
  ),
  spice: (
    <>
      <path className="food-detail" d="M8 5h8v3H8z" />
      <path className="food-fill" d="M7 8h10v11H7z" />
      <path d="M8 13c2-2 6-2 8 0M10 15h4" />
      <circle cx="10" cy="10" r=".5" />
      <circle cx="14" cy="10" r=".5" />
    </>
  ),
  seeds: (
    <>
      <path className="food-fill" d="M6 14c2-5 8-8 12-7 1 5-2 11-7 12-3 0-5-2-5-5Z" />
      <path d="M7 18c2-4 5-6 10-9" />
      <circle cx="10" cy="14" r=".7" />
      <circle cx="14" cy="11" r=".7" />
    </>
  ),
  fruit: (
    <>
      <path
        className="food-fill"
        d="M12 8c-5-4-9 0-8 5 1 4 3 7 6 7 1 0 2-.5 3-.5s2 .5 3 .5c3 0 5-4 6-7 1-5-3-9-8-5h-2Z"
      />
      <path className="food-leaf" d="M12 8c0-3 2-5 5-5-1 3-2 4-5 5Z" />
    </>
  ),
  honey: (
    <>
      <path className="food-detail" d="M8 5h8v3H8z" />
      <path className="food-fill" d="M7 8h10v11H7z" />
      <path d="M8 13c2-1 6-1 8 0v3H8zM10 11h4" />
    </>
  ),
  bread: (
    <>
      <path className="food-fill" d="M5 11c0-4 3-7 7-7s7 3 7 7v8H5v-8Z" />
      <path d="M9 9v3M13 8v3M16 10v2M5 15h14" />
    </>
  ),
  vegetable: (
    <>
      <path className="food-fill" d="M6 12c0-4 3-7 7-7 4 0 6 4 5 8-1 4-5 7-9 5-2-1-3-3-3-6Z" />
      <path d="M12 6c0-2 2-3 4-3M11 8c-2-2-4-1-5 0M9 12h.1M14 11h.1M12 15h.1" />
    </>
  ),
  beans: (
    <>
      <path
        className="food-fill"
        d="M5 9c1-3 4-4 6-2l6 6c2 2 1 5-2 6s-5 0-7-2l-2-2c-2-2-2-4-1-6Z"
      />
      <circle cx="9" cy="10" r="1" />
      <circle cx="13" cy="14" r="1" />
      <circle cx="15" cy="17" r="1" />
    </>
  ),
  dairy: (
    <>
      <path className="food-detail" d="M8 5h8l2 4v10H6V9l2-4Z" />
      <path className="food-fill" d="M6 12h12v5H6Z" />
      <path d="M8 5l2 4M16 5l-2 4M6 9h12M9 13h6M12 12v4" />
    </>
  ),
  herbs: (
    <>
      <path d="M12 19V6" />
      <path
        className="food-leaf"
        d="M12 11c-4 0-6-2-6-5 4 0 6 2 6 5ZM12 15c4 0 6-2 6-5-4 0-6 2-6 5Z"
      />
      <path d="M9 19h6" />
    </>
  ),
  oil: (
    <>
      <path className="food-fill" d="M10 4h4v3h2l1 3v9H7v-9l1-3h2V4Z" />
      <path d="M8 10h8M10 14h4M12 11c-2 2-2 3 0 4 2-1 2-2 0-4Z" />
    </>
  ),
  jar: (
    <>
      <path className="food-detail" d="M7 6h10v2H7z" />
      <path className="food-fill" d="M6 8h12v11H6z" />
      <path d="M8 12h8M9 15h6" />
      <circle cx="12" cy="10" r=".5" />
    </>
  ),
  cleaning: (
    <>
      <path className="food-fill" d="M10 4h5v3l2 2v10H7V9l3-2V4Z" />
      <path d="M10 7h5M8 13h8M10 16h4m-6 3 2-2m2 2 2-2m2 2 1-1" />
    </>
  ),
  storage: (
    <>
      <path className="food-fill" d="M5 9h14v10H5z" />
      <path className="food-detail" d="M7 6h10v3H7z" />
      <path d="M5 12h14M9 15h6M8 9V7m8 2V7" />
    </>
  ),
  care: (
    <>
      <path className="food-detail" d="M9 5h6v3H9z" />
      <path className="food-fill" d="M7 8h10v11H7z" />
      <path d="M10 12h4M12 10v5M9 5V3h6v2" />
    </>
  ),
  home: (
    <>
      <path className="food-fill" d="M12 4c2 3 5 5 5 9a5 5 0 1 1-10 0c0-4 3-6 5-9Z" />
      <path d="M12 12c-1 2-1 3 0 4 1-1 1-2 0-4Z" />
    </>
  ),
  meal: (
    <>
      <path className="food-fill" d="M5 10h14c0 5-3 9-7 9s-7-4-7-9Z" />
      <path d="M4 10c1-3 4-5 8-5s7 2 8 5M8 7c1 2 2 3 4 3s3-1 4-3" />
    </>
  )
};

export const FoodIllustration: React.FC<{ product: Product }> = ({ product }) => {
  const name = product.name.trim().toLowerCase();
  const kind = named[name] ?? byCategory[product.category] ?? 'meal';
  return (
    <span className={`food-art food-art-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false" role="presentation">
        {drawings[kind]}
      </svg>
    </span>
  );
};
