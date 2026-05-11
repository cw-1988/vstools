/** @param {HTMLElement} el */
export function initUiPanel(el) {
  let collapsed = false;

  /** @param {MouseEvent} e */
  el.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.matches('h2')) {
      collapsed = !collapsed;
      update();
    }
  });

  update();

  function update() {
    el.classList.toggle('collapsed', collapsed);
  }
}
