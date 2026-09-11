import test from 'node:test';
import assert from 'node:assert/strict';
import {tvPresentation, LOGO_FADE_MS, LOGO_HOLD_MS, SHOT_HOLD_MS, SHOT_FADE_MS} from '../../src/components/hall/presentation.mjs';

test('TV holds the logo for fifteen full seconds after its dissolve',()=>{
  assert.equal(tvPresentation(0,10).kind,'logo');
  assert.equal(tvPresentation(LOGO_FADE_MS+LOGO_HOLD_MS-1,10).kind,'logo');
  assert.deepEqual(tvPresentation(LOGO_FADE_MS+LOGO_HOLD_MS,10),{kind:'shot',index:0,duration:1200});
});
test('TV visits three captures with readable dwell time and returns to the logo',()=>{
  const first=LOGO_FADE_MS+LOGO_HOLD_MS;
  const second=first+LOGO_FADE_MS+SHOT_HOLD_MS;
  const third=second+SHOT_FADE_MS+SHOT_HOLD_MS;
  assert.equal(tvPresentation(second-1,10).index,0);
  assert.deepEqual(tvPresentation(second,10),{kind:'shot',index:1,duration:800});
  assert.equal(tvPresentation(third,10).index,2);
  assert.equal(tvPresentation(third+SHOT_FADE_MS+SHOT_HOLD_MS,10).kind,'logo');
});
test('a single capture returns to the logo without indexing missing images',()=>{
  const end=LOGO_FADE_MS+LOGO_HOLD_MS+LOGO_FADE_MS+SHOT_HOLD_MS;
  assert.equal(tvPresentation(end-1,1).index,0);
  assert.equal(tvPresentation(end,1).kind,'logo');
});
test('reduced motion, empty sources and parked TV stay on a static identity',()=>{
  for(const time of [0,17000,35000,80000]){
    assert.equal(tvPresentation(time,5,true).kind,'logo');
    assert.equal(tvPresentation(time,5,false,true).kind,'logo');
    assert.equal(tvPresentation(time,0).kind,'logo');
  }
});
