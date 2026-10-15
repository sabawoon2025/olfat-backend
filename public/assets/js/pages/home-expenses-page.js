/**
 * Home expenses. Separate from business accounting and profit/loss.
 * Category: pick an existing one, or type a new name in the field below.
 */
(function (global) {
  'use strict';

  var RETIRED_CATEGORIES = {
    other: true,
    'other home expenses': true,
    'سایر مصارف خانه': true
  };

  var DEFAULT_CATEGORIES = [
    { id: 'Food', label: 'Food' },
    { id: 'Household', label: 'Household' },
    { id: 'Personal', label: 'Personal' },
    { id: 'Transport', label: 'Transport' },
    { id: 'Medical', label: 'Medical' }
  ];

  var savedCategories = [];

  function num(value) {
    var n = Number(String(value == null ? '' : value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }

  function roundMoney(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function moneyText(n) {
    return roundMoney(n).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function normalizeCategoryLabel(label) {
    return String(label == null ? '' : label).trim();
  }

  function isRetiredCategory(label) {
    return !!RETIRED_CATEGORIES[normalizeCategoryLabel(label).toLowerCase()];
  }

  function rememberLocalCategory(label) {
    var text = normalizeCategoryLabel(label);
    if (!text || isRetiredCategory(text)) {
      return;
    }
    var exists = savedCategories.some(function (row) {
      var value = normalizeCategoryLabel(row && (row.label || row.id || row));
      return value.toLowerCase() === text.toLowerCase();
    });
    if (!exists) {
      savedCategories.push({ id: text, label: text });
    }
    global.MBMS_MOCK = global.MBMS_MOCK || {};
    global.MBMS_MOCK.homeExpenseCategories = savedCategories.slice();
  }

  function categories() {
    var map = {};
    function add(label) {
      var text = normalizeCategoryLabel(label);
      if (!text || isRetiredCategory(text)) {
        return;
      }
      var key = text.toLowerCase();
      if (!map[key]) {
        map[key] = { id: text, label: text };
      }
    }

    DEFAULT_CATEGORIES.forEach(function (row) { add(row.label); });
    savedCategories.forEach(function (row) {
      add(row && (row.label || row.id || row));
    });
    records().forEach(function (row) {
      add(row.category);
    });

    return Object.keys(map).sort().map(function (key) {
      return map[key];
    });
  }

  function seed() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.homeExpenses) || [];
  }

  function records() {
    return seed();
  }

  function findRecord(id) {
    return records().filter(function (row) {
      return String(row.id) === String(id);
    })[0] || null;
  }

  function filteredRows() {
    var query = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var category = (document.getElementById('list-category') || {}).value || '';
    var from = (document.getElementById('date-from') || {}).value || '';
    var to = (document.getElementById('date-to') || {}).value || '';
    return records().filter(function (row) {
      var text = [row.description, row.category, row.user, row.reference_no].join(' ').toLowerCase();
      return (!query || text.indexOf(query) !== -1)
        && (!category || row.category === category)
        && (!from || !row.date || row.date >= from)
        && (!to || !row.date || row.date <= to);
    });
  }

  function fillListCategory(selected) {
    var select = document.getElementById('list-category');
    if (select) {
      select.setAttribute('data-ac', '0');
    }
    global.MBMS_RECORDS.fillSelect(
      select,
      categories(),
      function (row) { return row.label; },
      function (row) { return row.label; },
      selected || '',
      'All categories'
    );
  }

  function fillCategory(selected) {
    var select = document.getElementById('exp-category');
    var input = document.getElementById('exp-category-new');
    var value = normalizeCategoryLabel(selected);
    var known = categories().some(function (row) {
      return row.label.toLowerCase() === value.toLowerCase();
    });

    if (select) {
      select.setAttribute('data-ac', '0');
    }

    global.MBMS_RECORDS.fillSelect(
      select,
      categories(),
      function (row) { return row.id; },
      function (row) { return row.label; },
      known ? value : '',
      'Select category'
    );

    if (input) {
      input.value = known || !value ? '' : value;
    }
  }

  function syncCategoryInputs(source) {
    var select = document.getElementById('exp-category');
    var input = document.getElementById('exp-category-new');
    if (!select || !input) {
      return;
    }
    if (source === 'select' && select.value) {
      input.value = '';
    }
    if (source === 'input' && normalizeCategoryLabel(input.value)) {
      select.value = '';
    }
  }

  function resolveCategory(values) {
    var typed = normalizeCategoryLabel(values.category_new);
    if (typed) {
      return typed;
    }
    return normalizeCategoryLabel(values.category);
  }

  function loadSavedCategories() {
    if (!global.MBMS_API || typeof global.MBMS_API.get !== 'function') {
      savedCategories = ((global.MBMS_MOCK && global.MBMS_MOCK.homeExpenseCategories) || []).filter(function (row) {
        return !isRetiredCategory(row && (row.label || row.id || row));
      });
      return Promise.resolve(savedCategories);
    }

    return global.MBMS_API.get('home-expenses/categories').then(function (response) {
      var rows = global.MBMS_UTILS.unwrap(response.data);
      if (rows == null) {
        rows = response.data;
      }
      rows = global.MBMS_UTILS.unwrap(rows);
      if (!Array.isArray(rows) && rows && Array.isArray(rows.data)) {
        rows = rows.data;
      }
      savedCategories = (Array.isArray(rows) ? rows : []).filter(function (row) {
        return !isRetiredCategory(row && (row.label || row.id || row));
      });
      global.MBMS_MOCK = global.MBMS_MOCK || {};
      global.MBMS_MOCK.homeExpenseCategories = savedCategories.slice();
      return savedCategories;
    }).catch(function () {
      savedCategories = ((global.MBMS_MOCK && global.MBMS_MOCK.homeExpenseCategories) || []).filter(function (row) {
        return !isRetiredCategory(row && (row.label || row.id || row));
      });
      return savedCategories;
    });
  }

  function render(source) {
    var rows = filteredRows();
    var total = 0;
    rows.forEach(function (row) {
      total += row.amount_raw != null ? num(row.amount_raw) : num(row.amount);
    });

    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      { icon: 'bi-receipt', label: 'Expenses', value: rows.length, tone: 'primary' },
      { icon: 'bi-cash-stack', label: 'Total', value: moneyText(total), tone: 'warning' }
    ]);

    if (!rows.length) {
      document.getElementById('exp-table-wrap').hidden = true;
      document.getElementById('exp-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('exp-empty'), {
        title: 'No home expenses yet',
        message: 'Add household spending you want to track separately from the business.'
      });
      return;
    }

    document.getElementById('exp-empty').hidden = true;
    document.getElementById('exp-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderTable(document.getElementById('exp-body'), rows, [
      { key: 'date' },
      { key: 'category' },
      {
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(row.description || '—');
        }
      },
      {
        render: function (row) {
          return '<span class="mbms-stock-pill is-warning">' +
            global.MBMS_UTILS.escapeHtml(row.amount || moneyText(row.amount_raw)) +
            '</span>';
        }
      },
      {
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(row.user || '—');
        }
      },
      {
        render: function (row) {
          return global.MBMS_RECORDS.actionButton(
            { 'data-edit-expense': row.id },
            'Edit',
            'bi-pencil'
          );
        }
      }
    ]);
  }

  function load() {
    var selectedCategory = (document.getElementById('list-category') || {}).value || '';
    render();
    return loadSavedCategories()
      .then(function () {
        return global.MBMS_RECORDS.fetchOrMock('home-expenses', seed);
      })
      .then(function (result) {
        fillListCategory(selectedCategory);
        fillCategory((document.getElementById('exp-category') || {}).value || '');
        render(result.source);
      })
      .catch(function () {
        render('error');
      });
  }

  function openCreate() {
    var form = document.getElementById('exp-form');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('exp-id').value = '';
    document.getElementById('exp-date').value = todayIso();
    global.MBMS_UTILS.setIconHeading(document.getElementById('exp-form-title'), 'bi-plus-lg', 'Add expense');
    fillCategory();
  }

  function openEdit(id) {
    var record = findRecord(id);
    if (!record) {
      return;
    }
    fillCategory(record.category);
    global.MBMS_UTILS.fillForm(document.getElementById('exp-form'), {
      id: record.id,
      category: record.category,
      description: record.description || '',
      amount: record.amount_raw != null ? String(record.amount_raw) : String(record.amount || '').replace(/,/g, ''),
      date: record.date
    });
    // Keep typed custom category in the new-name field when it is not in the dropdown yet.
    fillCategory(record.category);
    global.MBMS_UTILS.setIconHeading(document.getElementById('exp-form-title'), 'bi-pencil', 'Edit expense');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('expModal')).show();
  }

  global.MBMS_PAGE = {
    active: 'home-expenses',
    title: 'Home Expenses',
    onReady: function () {
      fillListCategory();
      fillCategory();

      document.getElementById('module-search').addEventListener('input', global.MBMS_UTILS.debounce(function () {
        render();
      }, 250));
      ['list-category', 'date-from', 'date-to'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('change', function () {
            render();
          });
        }
      });

      document.getElementById('add-expense').addEventListener('click', openCreate);
      document.getElementById('exp-body').addEventListener('click', function (event) {
        var button = event.target.closest('[data-edit-expense]');
        if (button) {
          openEdit(button.getAttribute('data-edit-expense'));
        }
      });

      document.getElementById('exp-category').addEventListener('change', function () {
        syncCategoryInputs('select');
      });
      document.getElementById('exp-category-new').addEventListener('input', function () {
        syncCategoryInputs('input');
      });

      document.getElementById('expModal').addEventListener('show.bs.modal', function () {
        if (!(document.getElementById('exp-id') || {}).value && !(document.getElementById('exp-date') || {}).value) {
          document.getElementById('exp-date').value = todayIso();
        }
        if (!(document.getElementById('exp-id') || {}).value) {
          fillCategory();
        }
      });

      global.MBMS_UI.bindReset(document.getElementById('exp-form'), document.getElementById('exp-reset'), function () {
        document.getElementById('exp-id').value = '';
        document.getElementById('exp-date').value = todayIso();
        fillCategory();
        global.MBMS_UTILS.setIconHeading(document.getElementById('exp-form-title'), 'bi-plus-lg', 'Add expense');
      });

      global.MBMS_UI.bindForm(document.getElementById('exp-form'), {
        onSubmit: function (values) {
          var id = values.id;
          var amount = roundMoney(num(values.amount));
          var category = resolveCategory(values);
          var wasNew = !!normalizeCategoryLabel(values.category_new);

          if (!(amount > 0)) {
            throw {
              message: 'Enter an amount greater than zero.',
              errors: { amount: ['Amount must be greater than zero'] }
            };
          }
          if (!category) {
            throw {
              message: 'Select a category or type a new category name.',
              errors: {
                category: ['Select a category or type a new one below'],
                category_new: ['Or type a new category name']
              }
            };
          }
          if (category.length > 80) {
            throw {
              message: 'Category name must be 80 characters or fewer.',
              errors: { category_new: ['Max 80 characters'] }
            };
          }

          var method = id ? 'put' : 'post';
          var path = 'home-expenses' + (id ? '/' + id : '');
          var expenseDate = values.date || values.expense_date || todayIso();
          var record = {
            category: category,
            description: values.description || null,
            amount: amount,
            date: expenseDate,
            expense_date: expenseDate
          };

          return global.MBMS_RECORDS.submitOrMock(method, path, record).then(function (result) {
            rememberLocalCategory(category);
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? ('Expense saved' + (wasNew ? ' and category "' + category + '" added.' : '.'))
                : 'API not connected. Sample expense only.'
            });
            document.getElementById('exp-form').reset();
            fillCategory();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('expModal')).hide();
            if (global.MBMS_API && global.MBMS_API.invalidateCaches) {
              global.MBMS_API.invalidateCaches(['homeExpenses']);
            }
            load();
          });
        }
      });

      if (!(document.getElementById('exp-date') || {}).value) {
        document.getElementById('exp-date').value = todayIso();
      }

      load();
    }
  };
})(window);
