/**
 * Home expenses. Separate from business accounting and profit/loss.
 * Categories: built-in defaults + saved custom categories + “Add new…”.
 */
(function (global) {
  'use strict';

  var NEW_CATEGORY_VALUE = '__new__';
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

  function categoryOptionsForForm() {
    return categories().concat([{ id: NEW_CATEGORY_VALUE, label: '+ Add new category…' }]);
  }

  function selectNewCategoryMode(focusInput) {
    var select = document.getElementById('exp-category');
    if (select) {
      if (!Array.prototype.some.call(select.options || [], function (opt) {
        return opt.value === NEW_CATEGORY_VALUE;
      })) {
        fillCategory(NEW_CATEGORY_VALUE);
      } else {
        select.value = NEW_CATEGORY_VALUE;
      }
    }
    setNewCategoryVisible(true);
    if (focusInput) {
      var input = document.getElementById('exp-category-new');
      if (input) {
        input.focus();
        input.select();
      }
    }
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
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('list-category'),
      categories(),
      function (row) { return row.label; },
      function (row) { return row.label; },
      selected || '',
      'All categories'
    );
  }

  function setNewCategoryVisible(show) {
    var wrap = document.getElementById('exp-category-new-wrap');
    var input = document.getElementById('exp-category-new');
    if (wrap) {
      wrap.hidden = !show;
    }
    if (input) {
      input.required = !!show;
      if (!show) {
        input.value = '';
      }
    }
  }

  function fillCategory(selected) {
    var select = document.getElementById('exp-category');
    var value = selected || '';
    var isCustom = value
      && value !== NEW_CATEGORY_VALUE
      && !categories().some(function (row) {
        return row.label.toLowerCase() === String(value).toLowerCase();
      });

    global.MBMS_RECORDS.fillSelect(
      select,
      categoryOptionsForForm(),
      function (row) { return row.id; },
      function (row) { return row.label; },
      isCustom ? NEW_CATEGORY_VALUE : value,
      'Select category'
    );

    if (isCustom) {
      setNewCategoryVisible(true);
      var input = document.getElementById('exp-category-new');
      if (input) {
        input.value = value;
      }
    } else {
      setNewCategoryVisible(value === NEW_CATEGORY_VALUE);
    }
  }

  function loadSavedCategories() {
    if (!global.MBMS_API || typeof global.MBMS_API.get !== 'function') {
      savedCategories = (global.MBMS_MOCK && global.MBMS_MOCK.homeExpenseCategories) || [];
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
    setNewCategoryVisible(false);
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
    // fillCategory may switch to "Add new" for unknown labels; keep the name filled.
    if ((document.getElementById('exp-category') || {}).value === NEW_CATEGORY_VALUE) {
      var input = document.getElementById('exp-category-new');
      if (input) {
        input.value = record.category || '';
      }
    }
    global.MBMS_UTILS.setIconHeading(document.getElementById('exp-form-title'), 'bi-pencil', 'Edit expense');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('expModal')).show();
  }

  function resolveCategory(values) {
    var selected = normalizeCategoryLabel(values.category);
    if (selected === NEW_CATEGORY_VALUE) {
      return normalizeCategoryLabel(values.category_new);
    }
    return selected;
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
        if (this.value === NEW_CATEGORY_VALUE) {
          selectNewCategoryMode(true);
          return;
        }
        setNewCategoryVisible(false);
      });

      var addCategoryBtn = document.getElementById('exp-add-category-btn');
      if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', function () {
          selectNewCategoryMode(true);
        });
      }

      document.getElementById('expModal').addEventListener('show.bs.modal', function () {
        if (!(document.getElementById('exp-id') || {}).value && !(document.getElementById('exp-date') || {}).value) {
          document.getElementById('exp-date').value = todayIso();
        }
        fillCategory((document.getElementById('exp-category') || {}).value || '');
      });

      global.MBMS_UI.bindReset(document.getElementById('exp-form'), document.getElementById('exp-reset'), function () {
        document.getElementById('exp-id').value = '';
        document.getElementById('exp-date').value = todayIso();
        fillCategory();
        setNewCategoryVisible(false);
        global.MBMS_UTILS.setIconHeading(document.getElementById('exp-form-title'), 'bi-plus-lg', 'Add expense');
      });

      global.MBMS_UI.bindForm(document.getElementById('exp-form'), {
        onSubmit: function (values) {
          var id = values.id;
          var amount = roundMoney(num(values.amount));
          var category = resolveCategory(values);

          if (!(amount > 0)) {
            throw {
              message: 'Enter an amount greater than zero.',
              errors: { amount: ['Amount must be greater than zero'] }
            };
          }
          if (!category) {
            throw {
              message: values.category === NEW_CATEGORY_VALUE
                ? 'Enter a name for the new category.'
                : 'Select a category.',
              errors: values.category === NEW_CATEGORY_VALUE
                ? { category_new: ['Required'] }
                : { category: ['Required'] }
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
                ? ('Expense saved' + (values.category === NEW_CATEGORY_VALUE ? ' and category “‘ + category + '” added.' : '.'))
                : 'API not connected. Sample expense only.'
            });
            document.getElementById('exp-form').reset();
            setNewCategoryVisible(false);
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
