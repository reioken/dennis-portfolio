import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { instrumentGameHtml } from '../arcade/ready-protocol.mjs';
import { relativeJsAssets } from './asset-graph.mjs';

test('asset graph follows minified imports, all quote styles and lazy tables', () => {
  const source = 'import{x}from"./a.js";import\'./b.js\';import(`./c.js`);const deps=["./d.js"];';
  assert.deepEqual(relativeJsAssets(source), ['./a.js', './b.js', './c.js', './d.js']);
});

test('ready protocol waits for engine resolution and supports late host queries', async () => {
  const html=instrumentGameHtml('<head></head><script>engine.startGame({});</script>', 'test-game');
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const messages=[]; let listener; let resolve;
  const parent={postMessage: (...args)=>messages.push(args)};
  const context=vm.createContext({parent, window:{addEventListener: (_,fn)=>listener=fn}, engine:{startGame:()=>new Promise(r=>resolve=r)}});
  vm.runInContext(script,context);
  const boot=vm.runInContext('portfolioStartGame(engine)', context);
  await Promise.resolve();
  listener({source:parent,origin:'https://portfolio.test',data:{type:'portfolio:game-status',id:'test-game'}});
  assert.equal(messages.length,0);
  resolve(); await boot;
  assert.equal(messages[0][0].type,'portfolio:game-ready');
  assert.equal(messages[0][1],'https://portfolio.test');
  listener({source:{},origin:'https://other.test',data:{type:'portfolio:game-status',id:'test-game'}});
  assert.equal(messages.length,1);
  listener({source:parent,origin:'https://portfolio.test',data:{type:'portfolio:game-status',id:'test-game'}});
  assert.equal(messages.length,2);
});

test('unsupported shell fails closed instead of claiming a ready build', () => {
  assert.throws(()=>instrumentGameHtml('<head></head>', 'test-game'), /Unrecognized/);
  assert.throws(()=>instrumentGameHtml('<head></head>', '../route'), /Invalid/);
});

test('engine failure reports an error and preserves the rejected boot promise', async () => {
  const html = instrumentGameHtml('<head></head><script>engine.startGame({});</script>', 'broken-game');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const messages = []; let listener;
  const parent = { postMessage: (...args) => messages.push(args) };
  const context = vm.createContext({ parent, window: { addEventListener: (_, fn) => listener = fn }, engine: { startGame: () => Promise.reject(new Error('missing pack')) } });
  vm.runInContext(script, context);
  listener({source: parent, origin: 'https://portfolio.test', data: {type: 'portfolio:game-status', id: 'broken-game'}});
  await assert.rejects(vm.runInContext('portfolioStartGame(engine)', context), /missing pack/);
  assert.equal(messages[0][0].type, 'portfolio:game-error');
  assert.equal(messages.some(([message]) => message.type === 'portfolio:game-ready'), false);
});
