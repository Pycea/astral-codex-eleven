'use strict';

function addHovertext(optionElement) {
  const id = optionElement.id;
  const iconUri = chrome.runtime.getURL('icons/questionmark.svg');
  const icon = document.createElement('img');
  icon.src = iconUri;
  icon.className = 'help-icon';
  const tooltip = document.createElement('span');
  tooltip.id = `${id}-tooltip`;
  tooltip.className = 'tooltip';
  tooltip.textContent = OPTIONS[id]?.hovertext;
  tooltip.style.display = 'none';
  optionElement.appendChild(icon);
  document.getElementById('tooltips').appendChild(tooltip);

  icon.addEventListener('mouseover', function() {
    tooltip.style.display = 'inline';

    const windowHeight = window.innerHeight;
    const tooltipHeight = tooltip.offsetHeight;
    const iconTop = this.getBoundingClientRect().top;
    const iconBottom = this.getBoundingClientRect().bottom;
    const topSpace = iconTop - tooltipHeight;
    const bottomSpace = windowHeight - iconBottom - tooltipHeight;

    if (topSpace >= 8) {
      tooltip.style.top = `${iconTop - tooltipHeight - 4}px`;
    } else if (bottomSpace >= 8) {
      tooltip.style.top = `${iconBottom + 4}px`;
    } else {
      tooltip.style.top = '4px';
    }
  });

  icon.addEventListener('mouseout', () => {
    tooltip.style.display = 'none';
  });
}

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
    addHovertext(optionElement);
    setInitialState(optionElement);
    createChangeHandler(optionElement);
  }
});
