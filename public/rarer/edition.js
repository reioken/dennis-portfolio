import {categories} from './core.js?v=a55994f72823';
export const utcDay=(now=new Date())=>now.toISOString().slice(0,10);
export function selectCategories(catalog,day){
 const offset=Math.floor((Date.parse(day+'T00:00:00Z')-Date.parse('2026-09-13T00:00:00Z'))/86400000);
 const pool=catalog.categories;
 const start=((offset*3)%pool.length+pool.length)%pool.length;
 return Array.from({length:3},(_,i)=>pool[(start+i)%pool.length]);
}
export const edition={daily:false,date:null,catalog:null};
export async function loadDaily(){
 const response=await fetch('./data/catalog.json');
 if(!response.ok)throw Error('The answer catalog could not load. Please reload.');
 const catalog=await response.json();
 if(!Array.isArray(catalog.categories)||catalog.categories.length<6||catalog.categories.some(c=>!c.entries?.length))throw Error('The answer catalog is incomplete.');
 Object.assign(edition,{daily:true,date:utcDay(),catalog});
 categories.splice(0,categories.length,...selectCategories(catalog,edition.date));
}
export function useDay(day){edition.date=day;categories.splice(0,categories.length,...selectCategories(edition.catalog,day));}
