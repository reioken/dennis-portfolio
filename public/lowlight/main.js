(() => {
  function initialize() {
const stage = document.getElementById('record-stage');
  const note = document.getElementById('record-note');
  const caption = document.getElementById('theme-caption');
  const buttons = [...document.querySelectorAll('[data-record]')];
  const previews = [...document.querySelectorAll('[data-preview]')];
  const records = {
    reborn: { theme: 'Obsidian', note: 'Reborn · Obsidian, with color from the cover.' },
    starboy: { theme: 'Frosted Glass', note: 'Starboy · Frosted Glass, with a soft desktop backdrop.' },
    bloodhail: { theme: 'Obsidian', note: 'Bloodhail · Obsidian, with a quieter, warmer palette.' }
  };
  if (!stage || !note || !caption) return;
  let revision = 0;
  async function select(button) {
    const key = button.dataset.record;
    const record = records[key];
    const preview = previews.find(image => image.dataset.preview === key);
    if (!record || !preview) return;
    const current = ++revision;
    preview.loading = "eager";
    try { await preview.decode(); } catch { note.textContent = 'This preview could not load. Please try again.'; return; }
    if (current !== revision) return;
    stage.dataset.active = key;
    for (const image of previews) image.hidden = image !== preview;
    for (const item of buttons) item.setAttribute('aria-pressed', String(item === button));
    note.textContent = record.note;
    caption.textContent = record.theme;
  }
  for (const [index, button] of buttons.entries()) {
    button.addEventListener('click', () => void select(button));
    button.addEventListener('keydown', event => {
      if (!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
      void select(buttons[next]);
    });
  }
  }
  document.addEventListener('astro:after-swap', initialize);
  initialize();
})();
