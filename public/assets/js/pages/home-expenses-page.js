/**
 * Home expenses. Separate from business accounting and profit/loss.
 */
(function (global) {
  'use strict';

  var DEFAULT_CATEGORIES = [
    { id: 'food', label: 'Food' },
    { id: 'household', label: 'Household' },
    { id: 'personal', label: 'Personal' },
    { id: 'transport', label: 'Transport' },
    { id: 'medical', label: 'Medical' },
    { id: 'other', label: 'Other' }
  ];

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

  function categories() {
    var fromMock = (global.MBMS_MOCK && global.MBMS_MOCK.homeExpenseCategories) || [];
    if (fromMock.length) {
      return fromMock;
    }
    var fromRows = {};
    records().forEach(function (row) {
      if (row.category) {
        fromRows[row.category] = true;
      }
    });
    var extras = Object.keys(fromRows).filter(function (label) {
      return !DEFAULT_CATEGORIES.some(function (row) {
        return row.label === label;
      });
    }).map(function (label) {
      return { id: label, label: label };
    });
    return DEFAULT_CATEGORIES.concat(extras);
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

  function fillCategory(selected) {
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('exp-category'),
      categories(),
      function (row) { return row.label; },
      function (row) { return row.label; },
      selected || '',
      'Select category'
    );
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
    return global.MBMS_RECORDS.fetchOrMock('home-expenses', seed)
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
        global.MBMS_UTILS.setIconHeading(document.getElementById('exp-form-title'), 'bi-plus-lg', 'Add expense');
      });

      global.MBMS_UI.bindForm(document.getElementById('exp-form'), {
        onSubmit: function (values) {
          var id = values.id;
          var amount = roundMoney(num(values.amount));
          if (!(amount > 0)) {
            throw {
              message: 'Enter an amount greater than zero.',
              errors: { amount: ['Amount must be greater than zero'] }
            };
          }
          if (!values.category) {
            throw {
              message: 'Select a category.',
              errors: { category: ['Required'] }
            };
          }

          var method = id ? 'put' : 'post';
          var path = 'home-expenses' + (id ? '/' + id : '');
          var expenseDate = values.date || values.expense_date || todayIso();
          var record = {
            category: values.category,
            description: values.description || null,
            amount: amount,
            date: expenseDate,
            expense_date: expenseDate
          };

          return global.MBMS_RECORDS.submitOrMock(method, path, record).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Expense saved.' : 'API not connected. Sample expense only.'
            });
            document.getElementById('exp-form').reset();
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
