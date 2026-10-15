/**
 * Customer and supplier payment UI.
 * Does not calculate official account balances.
 */
(function (global) {
  'use strict';

  function partyType() {
    return global.MBMS_RECORDS.queryParam('type') === 'supplier' ? 'supplier' : 'customer';
  }

  function isCustomer() {
    return partyType() === 'customer';
  }

  function mockList() {
    return isCustomer()
      ? ((global.MBMS_MOCK && global.MBMS_MOCK.customerPayments) || [])
      : ((global.MBMS_MOCK && global.MBMS_MOCK.supplierPayments) || []);
  }

  function storeKey() {
    return isCustomer() ? 'customerPayments' : 'supplierPayments';
  }

  function endpoint() {
    return isCustomer() ? 'payments/customers' : 'payments/suppliers';
  }

  function allRows() {
    return mockList();
  }

  function render(source) {
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    var search = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var rows = allRows().filter(function (row) {
      return !search || String(row.person + ' ' + row.description).toLowerCase().indexOf(search) !== -1;
    });
    if (!rows.length) {
      document.getElementById('pay-table-wrap').hidden = true;
      document.getElementById('pay-empty').hidden = false;
      global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), []);
      global.MBMS_UI.renderEmpty(document.getElementById('pay-empty'), {
        title: 'No payments yet',
        message: 'Payments you record will show up here.'
      });
      return;
    }
    document.getElementById('pay-empty').hidden = true;
    document.getElementById('pay-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      { icon: 'bi-cash-coin', label: 'Payments', value: rows.length }
    ]);
    global.MBMS_RECORDS.renderTable(document.getElementById('pay-list-body'), rows, [
      { key: 'date' },
      { key: 'person' },
      { key: 'amount' },
      { key: 'description' },
      { key: 'user' },
      { key: 'location' }
    ]);
  }

  function load() {
    render();
    return global.MBMS_RECORDS.fetchOrMock(endpoint(), mockList)
      .then(function (result) {
        render(result.source);
      });
  }

  global.MBMS_PAGE = {
    active: 'payments',
    title: 'Payments',
    onReady: function () {
      var type = partyType();
      document.querySelectorAll('[data-pay-tab]').forEach(function (link) {
        link.classList.toggle('is-active', link.getAttribute('data-pay-tab') === type);
      });
      global.MBMS_UTILS.setIconHeading(
        document.getElementById('pay-title'),
        'bi-cash-coin',
        isCustomer() ? 'Customer payments' : 'Supplier payments'
      );
      document.getElementById('party-label').textContent = isCustomer() ? 'Customer' : 'Supplier';

      global.MBMS_RECORDS.fillSelect(
        document.getElementById('pay-person'),
        isCustomer() ? global.MBMS_CATALOG.customers() : global.MBMS_CATALOG.suppliers(),
        function (row) { return row.id; },
        function (row) { return row.name; }
      );
      global.MBMS_RECORDS.fillWorkLocation(document.getElementById('pay-location'));

      document.getElementById('module-search').addEventListener('input', global.MBMS_UTILS.debounce(load, 250));
      global.MBMS_UI.bindReset(document.getElementById('pay-form'), document.getElementById('pay-reset'), function () {
        global.MBMS_RECORDS.fillSelect(
          document.getElementById('pay-person'),
          isCustomer() ? global.MBMS_CATALOG.customers() : global.MBMS_CATALOG.suppliers(),
          function (row) { return row.id; },
          function (row) { return row.name; }
        );
        global.MBMS_RECORDS.fillWorkLocation(document.getElementById('pay-location'));
      });

      global.MBMS_UI.bindForm(document.getElementById('pay-form'), {
        onSubmit: function (values) {
          var record = {
            person: values.person,
            person_id: values.person,
            amount: values.amount,
            date: values.date,
            description: values.description,
            user: values.user || 'Signed-in user',
            location: values.location,
            location_id: values.location
          };
          return global.MBMS_RECORDS.submitOrMock('post', endpoint(), record, function (body) {
            return global.MBMS_RECORDS.storeSave(storeKey(), body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? 'Payment sent to Laravel. Official balances stay on the backend.'
                : 'API not connected. Sample payment only. No local balance was calculated.'
            });
            document.getElementById('pay-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('payModal')).hide();
            load();
          });
        }
      });

      load();
    }
  };
})(window);
