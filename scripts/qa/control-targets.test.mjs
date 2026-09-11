import test from 'node:test';
import assert from 'node:assert/strict';
import { controlTargets } from '../../src/components/work/control-targets.mjs';
test('joystick halves meet at the centre without overlapping',()=>{
 const {joy:r}=controlTargets({joy:{x:100,y:100,w:20,h:30}});
 assert.equal(r.w,88); assert.equal(r.x+r.w/2,110); assert.ok(r.h>=44);
});
test('clustered cabinet buttons retain their centres without stealing neighbour clicks',()=>{
 const source={joy:{x:100,y:100,w:22,h:30},btn_0:{x:160,y:108,w:18,h:14},btn_1:{x:181,y:108,w:18,h:14},start_0:{x:181,y:133,w:18,h:14}};
 const targets=controlTargets(source), entries=Object.entries(targets);
 for(const [name,r] of entries){const s=source[name],x=s.x+s.w/2,y=s.y+s.h/2;assert.ok(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h,name+' centre');}
 for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){const a=entries[i][1],b=entries[j][1];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'no overlapping actions');}
});
