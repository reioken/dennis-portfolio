// One page, two games: /rarer/?mode=depth plays Spelunkle Depths, anything else
// the classic dig. Depths swaps in its own markup before its view module runs.
const depth=new URLSearchParams(location.search).get('mode')==='depth';
if(depth){
 document.title='Spelunkle Depths · Choose a depth';
 document.querySelector('meta[name="description"]')?.setAttribute('content','Choose a depth, then name something that belongs there. A new way to play Spelunkle.');
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./depth.css?v=cea0b2abe3a6',import.meta.url).href;document.head.append(css);
 document.body.innerHTML='<a class="skip-link" href="#depth">Skip to the game</a>'
  +'<header class="site-header"><a class="brand" href="./">Spelunkle<span>Depths · a new way to dig</span></a><nav aria-label="Site"><a class="quiet-button" href="./" data-icon="ui-back">Classic</a></nav></header>'
  +'<main><section id="depth" class="depth" aria-label="Spelunkle Depths"><h1>Spelunkle Depths</h1><p class="depth-hook">Choose a depth, then name something that belongs there.</p></section></main>'
  +'<footer class="site-footer"><p class="footer-edition">Depths is a new mode being tested. Progress stays in this browser. Rankings use 12-month English Wikipedia pageview counts (CC0 1.0); article names come from Wikipedia (CC BY-SA 4.0).</p></footer>'
  +'<div id="announcement" class="sr-only" role="status" aria-live="polite"></div>';
 await import('./depth-view.js?v=cea0b2abe3a6');
}else await import('./game.js?v=cea0b2abe3a6');
