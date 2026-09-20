/** Cabinet footprints in metres at the hall's single station height (1.95 m): the Blender widths scaled with the model. */
const widths: Record<string,number> = {'echo-frequency':.78,'saute-survivors':.78,'cab-no-9':.82,carillon:.79,nexus:1.2,riftback:.95,riftcast:1.2,lowlight:1.21,'vgm-battle':1.08,berry:.5,safeplate:.5,briefly:.5,mina:.68,hookline:1.05,kasse:.94,telefon:.92};
export function cabinetWidth(slug:string) { return widths[slug]??.8; }
type Station = {slug:string};
// One clear edge-to-edge gap for every pair, including enough room for the taxi.
export const MACHINE_GAP = 1.52;
export function mascotOffset(item:Station) { return -cabinetWidth(item.slug)/2-MACHINE_GAP/2; }
export function stationPositions(items: readonly Station[]) {
  const positions:number[]=[];
  for(let i=0;i<items.length;i++)positions.push(i===0?0:positions[i-1]+cabinetWidth(items[i-1].slug)/2+MACHINE_GAP+cabinetWidth(items[i].slug)/2);
  return positions;
}
export function nearestStation(positions: readonly number[], x:number) {
  return positions.reduce((best,p,i)=>Math.abs(p-x)<Math.abs(positions[best]-x)?i:best,0);
}
