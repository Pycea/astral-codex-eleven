'use strict';

async function setInitialState(optionElement) {
  let id = optionElement.id;
  let input = optionElement.querySelector('.trigger');
  let setValue = optionShadow[id];

  if (input.classList.contains('check')) {
    input.checked = setValue;
  } else if (input.classList.contains('text')) {
    input.value = setValue;
  }
}

function createChangeHandler(optionElement) {
  let id = optionElement.id;
  let input = optionElement.querySelector('.trigger');

  if (input.classList.contains('check')) {
    input.addEventListener('change', () => {
      setOption(id, input.checked);
    });
  } else if (input.classList.contains('text')) {
    input.addEventListener('change', () => {
      setOption(id, input.value);
    });
  }
}

// Looks for structures in popup.html of the form:
//
// <div id="templateKey" class="option">
//   <input type="checkbox" id="templateKeyCheck" class="trigger check">
//   <label for="templateKeyCheck">Option description</label>
// </div>
//
// Option wrappers have the class `option`, and the input element has the class
// `trigger` plus one of `check` or `text` depending on if the value is a bool
// or a string. The label is optionally used for checkbox inputs.
window.addEventListener('DOMContentLoaded', async () => {
  await loadSavedOptions();

  for (const optionElement of document.querySelectorAll('.option')) {
    setInitialState(optionElement);
    createChangeHandler(optionElement);
  }
});