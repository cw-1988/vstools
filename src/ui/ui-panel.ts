export function initUiPanel(el: HTMLElement) {
  let collapsed = false;

  el.addEventListener('click', (e: MouseEvent) => {
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
