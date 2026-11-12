const form = document.querySelector('#audit');
const editor = document.querySelector('#editor');
const edit = document.querySelector('#edit');
const run = document.querySelector('#run');
const source = document.querySelector('#source');
const claims = document.querySelector('#claims');
const status = document.querySelector('#status');
const results = document.querySelector('#results');
const buttons = document.querySelector('#examples');
const empty = document.querySelector('#review-empty');
const count = document.querySelector('#result-count');
const product = document.querySelector('#product');
const evidence = document.querySelector('#document');
const verdictBadge = document.querySelector('#verdict');
const evidenceClaim = document.querySelector('#evidence-claim');
const note = document.querySelector('#evidence-note');
let activeSource = '';
let activeClaims = [];

const verdictLabels = {
  supported: 'Supported',
  contradicted: 'Contradiction',
  missing: 'Evidence missing',
  review: 'Verify manually',
};

function showEvidence({ verdict, quote }, claim, button) {
  for (const choice of results.querySelectorAll('button')) {
    choice.setAttribute('aria-pressed', String(choice === button));
  }
  verdictBadge.hidden = false;
  verdictBadge.dataset.verdict = verdict;
  verdictBadge.textContent = verdictLabels[verdict];
  evidenceClaim.hidden = false;
  evidenceClaim.textContent = claim;
  const match = quote ? activeSource.indexOf(quote) : -1;
  if (match === -1) {
    evidence.textContent = activeSource;
    note.textContent = 'No supporting excerpt was identified for this claim.';
    return;
  }
  const highlight = document.createElement('mark');
  highlight.textContent = quote;
  evidence.replaceChildren(activeSource.slice(0, match), highlight, activeSource.slice(match + quote.length));
  note.textContent = '';
}

function render(rows, message) {
  results.replaceChildren();
  const flagged = rows.filter(({ verdict }) => verdict !== 'supported').length;
  count.textContent = flagged + ' of ' + rows.length + ' claims need review';
  empty.hidden = true;
  let selected;
  rows.forEach((row, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'claim';
    button.setAttribute('aria-pressed', 'false');
    const title = document.createElement('strong');
    title.textContent = activeClaims[index];
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.dataset.verdict = row.verdict;
    badge.textContent = verdictLabels[row.verdict];
    button.append(title, badge);
    button.addEventListener('click', () => showEvidence(row, activeClaims[index], button));
    results.append(button);
    if (!selected && row.verdict === 'contradicted') selected = button;
  });
  (selected || results.firstElementChild)?.click();
  status.textContent = message;
}

function loadExample(item, button) {
  activeSource = item.source;
  activeClaims = item.claims;
  product.textContent = item.name;
  for (const choice of buttons.querySelectorAll('button')) {
    choice.setAttribute('aria-pressed', String(choice === button));
  }
  const rows = item.labels.map((verdict, index) => ({ verdict, quote: item.quotes[index] }));
  render(rows, 'Annotated sample · Human-reviewed verdicts');
}

async function audit(sourceText, claimLines, custom) {
  const controls = [run, edit, ...buttons.querySelectorAll('button')];
  controls.forEach((control) => { control.disabled = true; });
  status.textContent = 'Checking claims with the local model…';
  try {
    const response = await fetch('/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: sourceText, claims: claimLines }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    activeSource = sourceText;
    activeClaims = claimLines;
    if (custom) {
      product.textContent = 'Custom listing';
      buttons.querySelectorAll('button').forEach((choice) => choice.setAttribute('aria-pressed', 'false'));
    }
    render(data.results, 'AI audit · ' + data.model + ' · Verify verdicts before publishing');
  } catch (error) {
    status.textContent = error.message || 'The audit could not complete.';
  } finally {
    controls.forEach((control) => { control.disabled = false; });
  }
}

fetch('examples.json').then((response) => {
  if (!response.ok) throw Error();
  return response.json();
}).then((examples) => {
  examples.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.name;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => loadExample(item, button));
    buttons.append(button);
  });
  buttons.firstElementChild?.click();
}).catch(() => {
  status.textContent = 'Sample products could not load. You can enter your own text.';
});

edit.addEventListener('click', () => {
  source.value = activeSource;
  claims.value = activeClaims.join('\n');
  editor.showModal();
});
document.querySelector('#close').addEventListener('click', () => editor.close());
run.addEventListener('click', () => {
  if (!activeSource) edit.click();
  else audit(activeSource, activeClaims, false);
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const lines = claims.value.split('\n').map((line) => line.trim()).filter(Boolean);
  editor.close();
  audit(source.value, lines, true);
});
