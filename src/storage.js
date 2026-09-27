import {empty} from './domain.js';
const KEY='pantry-organizer.demo.v1';
// Repository boundary: an online adapter must provide load() and save(state,revision).
// save must atomically compare revisions and reject conflicts; never last-write-wins.
export class LocalDemoRepository {
 async load(){const raw=localStorage.getItem(KEY);if(!raw)return {state:empty(),revision:0};const data=JSON.parse(raw);if(!data.state||!Array.isArray(data.state.products))throw Error('Saved demo could not be read. Export browser data before resetting.');return data;}
 async save(state,revision){const commit=async()=>{const current=await this.load();if(current.revision!==revision)throw Error('Inventory changed in another tab. Close this form and refresh before trying again.');const next={state,revision:revision+1};localStorage.setItem(KEY,JSON.stringify(next));return next;};return globalThis.navigator?.locks?navigator.locks.request(KEY,commit):commit();}
}
