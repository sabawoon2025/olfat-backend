/**
 * Lightweight searchable autocomplete over native <select> fields.
 * Keeps the select in the form (for validation/submit) and syncs the chosen value.
 */
(function (global) {
  'use strict';

  var AUTO_IDS = {
    'tx-party': true,
    'tx-product': true,
    'tx-variant': true,
    'pay-person': true,
    'purchase-supplier': true,
    'sale-customer': true,
    'dmg-product': true,
    'ret-sale': true,
    'ret-purchase': true
  };

  function shouldEnhance(select) {
    if (!select || select.tagName !== 'SELECT' || select.dataset.acBound === '1') {
      return false;
    }
    if (select.dataset.ac === '0' || select.disabled || select.multiple) {
      return false;
    }
    if (select.dataset.ac === '1' || AUTO_IDS[select.id] || select.classList.contains('mbms-ac')) {
      return true;
    }
    return select.options && select.options.length > 8;
  }

  function optionList(select) {
    return Array.prototype.slice.call(select.options || []).filter(function (opt) {
      return opt.value !== '';
    }).map(function (opt) {
      return { value: opt.value, label: opt.textContent || opt.label || opt.value };
    });
  }

  function closePanel(wrap) {
    var panel = wrap.querySelector('.mbms-ac-panel');
    if (panel) {
      panel.hidden = true;
    }
    wrap.classList.remove('is-open');
  }

  function openPanel(wrap) {
    var panel = wrap.querySelector('.mbms-ac-panel');
    if (panel) {
      panel.hidden = false;
    }
    wrap.classList.add('is-open');
  }

  function renderOptions(wrap, select, query) {
    var panel = wrap.querySelector('.mbms-ac-panel');
    var input = wrap.querySelector('.mbms-ac-input');
    if (!panel || !input) {
      return;
    }
    var q = String(query || '').toLowerCase().trim();
    var rows = optionList(select).filter(function (row) {
      return !q || row.label.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 80);

    if (!rows.length) {
      panel.innerHTML = '<div class="mbms-ac-empty">No matches</div>';
      openPanel(wrap);
      return;
    }

    panel.innerHTML = rows.map(function (row) {
      var active = String(row.value) === String(select.value) ? ' is-active' : '';
      return (
        '<button type="button" class="mbms-ac-option' + active + '" data-value="' +
        global.MBMS_UTILS.escapeHtml(row.value) + '" role="option">' +
        global.MBMS_UTILS.escapeHtml(row.label) +
        '</button>'
      );
    }).join('');
    openPanel(wrap);
  }

  function setDisplay(wrap, select) {
    var input = wrap.querySelector('.mbms-ac-input');
    if (!input) {
      return;
    }
    var selected = select.options[select.selectedIndex];
    if (selected && selected.value) {
      input.value = selected.textContent || selected.label || '';
    } else if (document.activeElement !== input) {
      input.value = '';
    }
  }

  function enhance(select) {
    if (!shouldEnhance(select)) {
      if (select && select.dataset.acBound === '1') {
        setDisplay(select.closest('.mbms-ac-wrap'), select);
      }
      return select;
    }

    var wrap = document.createElement('div');
    wrap.className = 'mbms-ac-wrap';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('mbms-ac-native');
    select.dataset.acBound = '1';
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    var input = document.createElement('input');
    input.type = 'search';
    input.className = 'form-control mbms-ac-input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = select.getAttribute('data-ac-placeholder') ||
      (select.options[0] && !select.options[0].value ? select.options[0].textContent : 'Type to search…');
    if (select.required) {
      input.setAttribute('aria-required', 'true');
    }
    input.setAttribute('aria-autocomplete', 'list');
    wrap.appendChild(input);

    var icon = document.createElement('i');
    icon.className = 'bi bi-search mbms-ac-icon';
    icon.setAttribute('aria-hidden', 'true');
    wrap.appendChild(icon);

    var panel = document.createElement('div');
    panel.className = 'mbms-ac-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'listbox');
    wrap.appendChild(panel);

    setDisplay(wrap, select);

    input.addEventListener('focus', function () {
      renderOptions(wrap, select, input.value);
      input.select();
    });
    input.addEventListener('input', function () {
      if (select.value) {
        select.value = '';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      renderOptions(wrap, select, input.value);
    });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closePanel(wrap);
        setDisplay(wrap, select);
        input.blur();
      }
      if (event.key === 'Enter') {
        var first = panel.querySelector('.mbms-ac-option');
        if (first && !panel.hidden) {
          event.preventDefault();
          first.click();
        }
      }
    });

    panel.addEventListener('mousedown', function (event) {
      var btn = event.target.closest('.mbms-ac-option');
      if (!btn) {
        return;
      }
      event.preventDefault();
      select.value = btn.getAttribute('data-value') || '';
      setDisplay(wrap, select);
      closePanel(wrap);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    document.addEventListener('click', function (event) {
      if (!wrap.contains(event.target)) {
        closePanel(wrap);
        setDisplay(wrap, select);
      }
    });

    select.addEventListener('change', function () {
      setDisplay(wrap, select);
    });

    return select;
  }

  function refresh(select) {
    if (!select) {
      return;
    }
    if (select.dataset.acBound === '1') {
      setDisplay(select.closest('.mbms-ac-wrap'), select);
      return;
    }
    enhance(select);
  }

  function enhanceAll(root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('select.form-select, select[data-ac]'), function (select) {
      enhance(select);
    });
  }

  global.MBMS_AUTOCOMPLETE = {
    enhance: enhance,
    refresh: refresh,
    enhanceAll: enhanceAll
  };
})(window);
