class NexusLogo extends HTMLElement {
  static get observedAttributes() {
    return ['active', 'label', 'size', 'src'];
  }

  connectedCallback() {
    if (!this.dataset.ready) {
      this.dataset.ready = 'true';
      this.render();
      this.bindInteraction();
    }

    this.syncAttributes();
  }

  attributeChangedCallback() {
    if (this.dataset.ready) this.syncAttributes();
  }

  render() {
    const motes = Array.from(
      { length: 10 },
      (_, index) => `<span class="nx-sp__mote m${index + 1}"></span>`,
    ).join('');

    const glints = Array.from(
      { length: 6 },
      (_, index) => `<span class="nx-sp__glint g${index + 1}"></span>`,
    ).join('');

    this.innerHTML = `
      <span class="nx-sp is-live">
        <span class="nx-sp__aura"></span>
        <span class="nx-sp__aura nx-sp__aura--core"></span>
        <span class="nx-sp__rays"></span>
        <span class="nx-sp__dust">${motes}</span>
        <span class="nx-sp__wrap">
          <span class="nx-sp__burst"></span>
          ${glints}
          <span class="nx-sp__mark">
            <img alt="" aria-hidden="true" />
          </span>
        </span>
      </span>
    `;
  }

  bindInteraction() {
    const setHot = (active) => {
      if (!this.hasAttribute('active')) {
        this.querySelector('.nx-sp')?.classList.toggle('is-hot', active);
      }
    };

    this.addEventListener('pointerenter', () => setHot(true));
    this.addEventListener('pointerleave', () => setHot(false));
    this.addEventListener('focusin', () => setHot(true));
    this.addEventListener('focusout', () => setHot(false));

  }

  syncAttributes() {
    const root = this.querySelector('.nx-sp');
    const image = this.querySelector('img');
    const label = this.getAttribute('label') || 'NEXUS';
    const size = this.getAttribute('size');
    const src = this.getAttribute('src') || './nexus-logo.svg';

    this.setAttribute('role', 'img');
    this.setAttribute('aria-label', label);
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;

    if (size) {
      const value = /^\d+(\.\d+)?$/.test(size) ? `${size}px` : size;
      this.style.setProperty('--nexus-logo-size', value);
    }

    root?.classList.toggle('is-hot', this.hasAttribute('active'));
    if (image && image.getAttribute('src') !== src) image.setAttribute('src', src);
  }
}

if (!customElements.get('nexus-logo')) {
  customElements.define('nexus-logo', NexusLogo);
}
