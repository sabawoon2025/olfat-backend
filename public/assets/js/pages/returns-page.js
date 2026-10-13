/**
 * Sales return UI. Backend adjusts stock. Frontend only submits the request.
 */
(function (global) {
  'use strict';

  function mockList() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.returns) || [];
  }

  function salesOptions() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.sales) || [];
  }

  function allRows() {
    return mockList();
  }

  function fillSaleSelect() {
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('ret-sale'),
      salesOptions(),
      function (row) { return row.id; },
      function (row) {
        return (row.reference_no || row.id) + ' · ' + (row.product || 'Sale') + ' · ' + (row.date || '');
      }
    );
  }

  function render(source) {
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    var rows = allRows();
    if (!rows.length) {
      document.getElementById('ret-table-wrap').hidden = true;
      document.getElementById('ret-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('ret-empty'), {
        title: 'No returns yet',
        message: 'Returns you record will show up here.'
      });
      return;
    }
    document.getElementById('ret-empty').hidden = true;
    document.getElementById('ret-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderTable(document.getElementById('ret-body'), rows, [
      { key: 'date' }, { key: 'sale_id' }, { key: 'product' }, { key: 'variant' }, { key: 'quantity' }, { key: 'reason' }, { key: 'location' }
    ]);
  }

  function load() {
    render();
    return global.MBMS_RECORDS.fetchOrMock('sales-returns', mockList)
      .then(function (result) {
        render(result.source);
      });
  }

  function warmSales() {
    return global.MBMS_RECORDS.fetchOrMock('sales', function () { return []; })
      .then(function () {
        fillSaleSelect();
      })
      .catch(function () {
        fillSaleSelect();
      });
  }

  function fillSaleFields() {
    var saleId = document.getElementById('ret-sale').value;
    var sale = salesOptions().filter(function (row) { return String(row.id) === String(saleId); })[0];
    if (!sale) {
      return;
    }
    document.getElementById('ret-product').value = sale.product || '';
    document.getElementById('ret-variant').value = sale.variant || '';
  }

  global.MBMS_PAGE = {
    active: 'returns',
    title: 'Sales Returns',
    onReady: function () {
      fillSaleSelect();
      warmSales();
      global.MBMS_RECORDS.fillWorkLocation(document.getElementById('ret-location'));
      document.getElementById('ret-sale').addEventListener('change', fillSaleFields);
      global.MBMS_UI.bindReset(document.getElementById('ret-form'), document.getElementById('ret-reset'));

      var form = document.getElementById('ret-form');
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (form.dataset.submitting === '1') {
          return;
        }
        if (!form.checkValidity()) {
          form.classList.add('was-validated');
          return;
        }
        global.MBMS_UI.confirm({
          title: 'Record return',
          message: 'This will request a sales return. Stock will only change if Laravel accepts the request.',
          confirmLabel: 'Submit return'
        }).then(function (ok) {
          if (!ok) {
            return;
          }
          form.dataset.submitting = '1';
          var submitter = form.querySelector('[type="submit"]');
          global.MBMS_UI.setButtonLoading(submitter, true);
          var values = global.MBMS_UTILS.formToObject(form);
          var sale = salesOptions().filter(function (row) { return String(row.id) === String(values.sale_id); })[0] || {};
          var record = {
            id: 'local-' + Date.now(),
            sale_id: values.sale_id,
            product: values.product || sale.product,
            variant: values.variant || sale.variant,
            quantity: values.quantity,
            unit: values.unit,
            reason: values.reason,
            condition: values.condition,
            date: values.date,
            location: values.location,
            location_id: values.location
          };
          global.MBMS_RECORDS.submitOrMock('post', 'sales-returns', record, function (body) {
            return global.MBMS_RECORDS.storeSave('returns', body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? 'Return sent. The backend will adjust stock.'
                : 'API not connected. Sample return only. Browser stock was not changed.'
            });
            form.reset();
            form.classList.remove('was-validated');
            bootstrap.Modal.getOrCreateInstance(document.getElementById('retModal')).hide();
            warmSales();
            load();
          }).catch(function (error) {
            global.MBMS_UI.notify({
              type: 'danger',
              title: 'Return not saved',
              message: global.MBMS_UTILS.getErrorMessage(error)
            });
          }).finally(function () {
            form.dataset.submitting = '';
            global.MBMS_UI.setButtonLoading(submitter, false);
          });
        });
      });

      load();
    }
  };
})(window);
