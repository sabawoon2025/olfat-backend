/**
 * Home expenses. Separate from business accounting and profit/loss.
 */
(function (global) {
  'use strict';

  function categories() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.homeExpenseCategories) || [];
  }

  function seed() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.homeExpenses) || [];
  }

  function records() {
    return global.MBMS_RECORDS.mergeList('homeExpenses', seed());
  }

  function findRecord(id) {
    return records().filter(function (row) { return row.id === id; })[0] || null;
  }

  function render(source) {
    var query = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var category = (document.getElementById('list-category') || {}).value || '';
    var rows = records().filter(function (row) {
      return (!query || String(row.description + ' ' + row.category).toLowerCase().indexOf(query) !== -1)
        && (!category || row.category === category);
    });
    global.MBMS_RECORDS.showBanner(
      document.getElementById('source-banner'),
      source,
      'Showing sample home expenses. These are not business costs and do not affect profit/loss.'
    );
    if (!rows.length) {
      document.getElementById('exp-table-wrap').hidden = true;
      document.getElementById('exp-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('exp-empty'), {
        title: 'No home expenses yet',
        message: 'Home expenses stay outside business profit.'
      });
      return;
    }
    document.getElementById('exp-empty').hidden = true;
    document.getElementById('exp-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderTable(document.getElementById('exp-body'), rows, [
      { key: 'date' },
      { key: 'category' },
      { key: 'description' },
      { key: 'amount' },
      { key: 'user' },
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
    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      { icon: 'bi-receipt', label: 'Expenses', value: rows.length }
    ]);
  }

  function load() {
    render();
    return global.MBMS_RECORDS.fetchOrMock('home-expenses', seed)
      .then(function (result) {
        render(result.source);
      });
  }

  function openCreate() {
    var form = document.getElementById('exp-form');
    form.reset();
    document.getElementById('exp-id').value = '';
    global.MBMS_UTILS.setIconHeading(document.getElementById('exp-form-title'), 'bi-plus-lg', 'Add home expense');
    fillCategory();
  }

  function openEdit(id) {
    var record = findRecord(id);
    if (!record) {
      return;
    }
    fillCategory(record.category);
    global.MBMS_UTILS.fillForm(document.getElementById('exp-form'), record);
    global.MBMS_UTILS.setIconHeading(document.getElementById('exp-form-title'), 'bi-pencil', 'Edit home expense');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('expModal')).show();
  }

  function fillCategory(selected) {
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('exp-category'),
      categories(),
      function (row) { return row.label; },
      function (row) { return row.label; },
      selected
    );
  }

  global.MBMS_PAGE = {
    active: 'home-expenses',
    title: 'Home Expenses',
    onReady: function () {
      global.MBMS_RECORDS.fillSelect(
        document.getElementById('list-category'),
        categories(),
        function (row) { return row.label; },
        function (row) { return row.label; },
        '',
        'All categories'
      );
      fillCategory();

      document.getElementById('module-search').addEventListener('input', global.MBMS_UTILS.debounce(load, 250));
      document.getElementById('list-category').addEventListener('change', load);
      document.getElementById('add-expense').addEventListener('click', openCreate);
      document.getElementById('exp-body').addEventListener('click', function (event) {
        var button = event.target.closest('[data-edit-expense]');
        if (button) {
          openEdit(button.getAttribute('data-edit-expense'));
        }
      });

      global.MBMS_UI.bindReset(document.getElementById('exp-form'), document.getElementById('exp-reset'), fillCategory);

      global.MBMS_UI.bindForm(document.getElementById('exp-form'), {
        onSubmit: function (values) {
          var id = values.id;
          var method = id ? 'put' : 'post';
          var path = 'home-expenses' + (id ? '/' + id : '');
          var record = {
            id: id || ('local-' + Date.now()),
            category: values.category,
            description: values.description,
            amount: values.amount,
            date: values.date,
            user: values.user || 'Signed-in user'
          };
          return global.MBMS_RECORDS.submitOrMock(method, path, record, function (body) {
            if (id) {
              return global.MBMS_RECORDS.storeUpdate('homeExpenses', id, body);
            }
            return global.MBMS_RECORDS.storeSave('homeExpenses', body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? 'Home expense saved. It does not change business profit/loss.'
                : 'API not connected. Sample home expense only. Profit/loss was not changed.'
            });
            document.getElementById('exp-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('expModal')).hide();
            load();
          });
        }
      });

      load();
    }
  };
})(window);
