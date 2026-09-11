/** Godot's startGame promise resolves after the engine starts (not after HTML load).
 * https://docs.godotengine.org/en/stable/tutorials/platform/web/html5_shell_classref.html
 */
export function instrumentGameHtml(html, id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('Invalid game id');
  if (html.includes('function portfolioStartGame')) return html;
  if ((html.match(/engine\.startGame\(/g) ?? []).length !== 1 || !html.includes('</head>')) {
    throw new Error('Unrecognized Godot shell: ready protocol was not installed');
  }
  const bootstrap = `<script>
let portfolioGameState;
let portfolioHostOrigin;
function portfolioReport() {
  if (portfolioGameState && portfolioHostOrigin) parent.postMessage({type: portfolioGameState, id: ${JSON.stringify(id)}}, portfolioHostOrigin);
}
window.addEventListener('message', function(event) {
  if (event.source !== parent || event.data?.type !== 'portfolio:game-status' || event.data?.id !== ${JSON.stringify(id)}) return;
  if (!/^https?:\\/\\//.test(event.origin)) return;
  portfolioHostOrigin = event.origin;
  portfolioReport();
});
function portfolioStartGame(engine, ...args) {
  return Promise.resolve().then(() => engine.startGame(...args)).then(function(value) {
    portfolioGameState = 'portfolio:game-ready'; portfolioReport(); return value;
  }, function(error) {
    portfolioGameState = 'portfolio:game-error'; portfolioReport(); throw error;
  });
}
</script>`;
  return html.replace('engine.startGame(', 'portfolioStartGame(engine,').replace('</head>', `${bootstrap}</head>`);
}
