export const units = ['level','items','g','kg','ml','L','packs'];
export const locations = ['Pantry','Fridge','Freezer'];
export const categories = ['Vegetables','Fruit','Grains & pulses','Spices & seasonings','Dairy & eggs','Meat & fish','Canned & packaged foods','Snacks','Drinks','Other'];
export const today = () => new Date().toLocaleDateString('en-CA');
const id = () => crypto.randomUUID();
export const empty = () => ({products:[],batches:[],movements:[],shopping:[]});
const positive = n => {if(!Number.isFinite(n)||n<=0)throw Error('Enter an amount greater than zero.'); return n;};
export const total = (s,p) => p.unit==='level'?Math.max(0,...s.batches.filter(b=>b.productId===p.id).map(b=>b.quantity)):s.batches.filter(b=>b.productId===p.id).reduce((n,b)=>n+b.quantity,0);
export const level = n => n===0?'Out':n<=0.25?'Low':n<=0.5?'Half':'Full';
export function add(s, input) {
  const name = input.name.trim(); if(!name)throw Error('Give this food a name.');
  if(!units.includes(input.unit)||!locations.includes(input.location)||!input.category?.trim() || input.category.length>60)throw Error('Choose a valid unit, category and location.');
  if(input.unit==='level'){if(![0,0.25,0.5,1].includes(input.quantity))throw Error('Choose a stock level.');input.minimum=0.25;}else positive(input.quantity); if(!Number.isFinite(input.minimum)||input.minimum<0)throw Error('Minimum stock cannot be negative.');
  if(input.expiry && !/^\d{4}-\d{2}-\d{2}$/.test(input.expiry))throw Error('Choose a valid date.');
  let p=s.products.find(p=>p.name.toLowerCase()===name.toLowerCase()&&p.unit===input.unit);
  if(!p){p={id:id(),name,unit:input.unit,category:input.category,minimum:input.minimum,checkedAt:new Date().toISOString()};s.products.push(p);}
  p.checkedAt=new Date().toISOString();
  const existing=input.unit==='level'?s.batches.find(b=>b.productId===p.id&&b.location===input.location):null;
  if(existing){existing.quantity=input.quantity;existing.expiry=input.expiry||null;existing.checkedAt=new Date().toISOString();s.movements.push({id:id(),productId:p.id,batchId:existing.id,type:'restock',quantity:input.quantity,at:new Date().toISOString()});return p;}
  const b={id:id(),productId:p.id,quantity:input.quantity,location:input.location,expiry:input.expiry||null,checkedAt:new Date().toISOString()};s.batches.push(b);
  s.movements.push({id:id(),productId:p.id,batchId:b.id,type:'restock',quantity:input.quantity,at:new Date().toISOString()});return p;
}
export function move(s,batchId,type,quantity){
  const b=s.batches.find(b=>b.id===batchId); if(!b)throw Error('This batch no longer exists.');
  if(!['consume','discard','correct'].includes(type))throw Error('Unknown stock action.');
  if(s.products.find(p=>p.id===b.productId).unit==='level' && (type!=='correct'||![0,0.25,0.5,1].includes(quantity)))throw Error('Choose a remaining stock level.');
  if(type==='correct'){if(!Number.isFinite(quantity)||quantity<0)throw Error('The corrected amount must be zero or greater.');}
  else {positive(quantity);if(quantity>b.quantity)throw Error('That is more than you have in this batch.');}
  b.checkedAt=new Date().toISOString();
  const delta=type==='correct'?quantity-b.quantity:-quantity;
  b.quantity=Math.round((b.quantity+delta)*1e6)/1e6;
  s.movements.push({id:id(),productId:b.productId,batchId:b.id,type,quantity:type==='correct'?delta:quantity,at:new Date().toISOString()});
}
export const isLow=(s,p)=>total(s,p)<=p.minimum;
export const expiryDays = date => date ? Math.round((Date.parse(date+'T12:00:00')-Date.parse(today()+'T12:00:00'))/86400000) : Infinity;
export function suggest(s,p){if(s.shopping.some(i=>i.productId===p.id&&i.status==='open'))return; s.shopping.push({id:id(),productId:p.id,quantity:Math.max(1,p.minimum-total(s,p)),status:'open'});}
export function purchase(s,itemId,input){const item=s.shopping.find(i=>i.id===itemId);if(!item||item.status!=='open')throw Error('This item was already restocked.');const p=s.products.find(p=>p.id===item.productId);add(s,{...p,...input});item.status='purchased';}
export function deleteFood(s,productId){
 const product=s.products.find(p=>p.id===productId);if(!product)throw Error('This food no longer exists.');
 const batchIds=new Set(s.batches.filter(b=>b.productId===productId).map(b=>b.id));
 s.products=s.products.filter(p=>p.id!==productId);
 s.batches=s.batches.filter(b=>b.productId!==productId);
 s.movements=s.movements.filter(m=>m.productId!==productId&&!batchIds.has(m.batchId));
 s.shopping=s.shopping.filter(i=>i.productId!==productId);
 return product;
}
export function bulkRestock(s,entries){
 if(!entries.length)throw Error('Select at least one food you bought.');
 if(new Set(entries.map(e=>e.productId)).size!==entries.length)throw Error('A food was selected more than once.');
 const next=structuredClone(s);
 for(const entry of entries){const p=next.products.find(p=>p.id===entry.productId);if(!p)throw Error('This food no longer exists.');const item=next.shopping.find(i=>i.productId===p.id&&i.status==='open');if(item)purchase(next,item.id,entry);else add(next,{...p,...entry});}
 Object.assign(s,next);
}
export function demo(){const s=empty();for(const a of [ ['Avocados','items','Fruit','Pantry',2,2,2],['Greek yogurt','g','Dairy & eggs','Fridge',400,200,3],['Basmati rice','kg','Grains & pulses','Pantry',1.5,0.5,null],['Blueberries','packs','Fruit','Fridge',1,1,1],['Frozen peas','g','Vegetables','Freezer',600,200,null]]) {const [name,unit,category,location,quantity,minimum,days]=a;const d=new Date();d.setDate(d.getDate()+(days||0));add(s,{name,unit,category,location,quantity,minimum,expiry:days?d.toLocaleDateString('en-CA'):''});}return s;}
