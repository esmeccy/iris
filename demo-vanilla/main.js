// Deliberately creates a card at runtime: dynamic DOM can't be statically
// traced, so Iris should attribute it to the nearest tagged ancestor
// (the #cards container from index.html).
const card = document.createElement('article');
card.className = 'card card--dynamic';
card.innerHTML = `
  <header class="card-header">
    <h3 class="card-title">Born at runtime</h3>
    <span class="badge legacy-accent">js</span>
  </header>
  <p class="card-text">This card was created by main.js after page load.</p>
  <button class="button button--primary" type="button">Inspect me</button>
`;
document.querySelector('#cards').appendChild(card);
