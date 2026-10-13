/**
 * Sales and purchase returns UI.
 */
(function (global) {
  'use strict';

  var currentKind = 'sale';

  function salesOptions() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.sales) || [];
  }

  function purchaseOptions() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.purchases) || [];
  }

  function returnRows() {
    if (currentKind === 'purchase') {
      return (global.MBMS_MOCK && global.MBMS_MOCK.purchaseReturns) || [];
    }
    return (global.MBMS_MOCK && global.MBMS_MOCK.returns) || [];
  }

  function endpoint() {
    return currentKind === 'purchase' ? 'purchase-returns' : 'sales-returns';
  }

  function setKind(kind) {
    currentKind = kind === 'purchase' ? 'purchase' : 'sale';
    global.MBMS_UTILS.qsa('[data-return-kind]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-return-kind') === currentKind);
    });
    var kindSelect = document.getElementById('ret-kind');
    if (kindSelect) {
      kindSelect.value = currentKind;
    }
    syncFormKind();
    var title = document.getElementById('ret-modal-title');
    if (title) {
      title.textContent = currentKind === 'purchase' ? 'Record purchase return' : 'Record sales return';
    }
  }

  function syncFormKind() {
    var kind = (document.getElementById('ret-kind') || {}).value || currentKind;
    var isPurchase = kind === 'purchase';
    global.MBMS_UTILS.qsa('[data-sale-fields]').forEach(function (el) {
      el.hidden = isPurchase;
    });
    global.MBMS_UTILS.qsa('[data-purchase-fields]').forEach(function (el) {
      el.hidden = !isPurchase;
    });
    var saleSelect = document.getElementById('ret-sale');
    var purchaseSelect = document.getElementById('ret-purchase');
    if (saleSelect) {
      saleSelect.required = !isPurchase;
      if (isPurchase) {
        saleSelect.value = '';
      }
    }
    if (purchaseSelect) {
      purchaseSelect.required = isPurchase;
      if (!isPurchase) {
        purchaseSelect.value = '';
      }
    }
  }

  function fillLookups() {
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('ret-sale'),
      salesOptions(),
      function (row) { return row.id; },
      function (row) {
        return (row.reference_no || row.id) + ' · ' + (row.product || 'Sale') + ' · ' + (row.date || '');
      }
    );
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('ret-purchase'),
      purchaseOptions(),
      function (row) { return row.id; },
      function (row) {
        return (row.reference_no || row.id) + ' · ' + (row.product || 'Purchase') + ' · ' + (row.date || '');
      }
    );
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('ret-location'));
  }

  function fillDocFields() {
    var kind = (document.getElementById('ret-kind') || {}).value || 'sale';
    if (kind === 'purchase') {
      var purchaseId = document.getElementById('ret-purchase').value;
      var purchase = purchaseOptions().filter(function (row) { return String(row.id) === String(purchaseId); })[0];
      if (!purchase) {
        return;
      }
      document.getElementById('ret-product').value = purchase.product || '';
      document.getElementById('ret-variant').value = purchase.variant || '';
      document.getElementById('ret-unit').value = (purchase.items && purchase.items[0] && purchase.items[0].unit) || '';
      return;
    }
    var saleId = document.getElementById('ret-sale').value;
    var sale = salesOptions().filter(function (row) { return String(row.id) === String(saleId); })[0];
    if (!sale) {
      return;
    }
    document.getElementById('ret-product').value = sale.product || '';
    document.getElementById('ret-variant').value = sale.variant || '';
    document.getElementById('ret-unit').value = (sale.items && sale.items[0] && sale.items[0].unit) || '';
  }

  function render(source) {
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    var rows = returnRows();
    if (!rows.length) {
      document.getElementById('ret-table-wrap').hidden = true;
      document.getElementById('ret-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('ret-empty'), {
        title: currentKind === 'purchase' ? 'No purchase returns yet' : 'No sales returns yet',
        message: 'Returns you record will show up here.'
      });
      return;
    }
    document.getElementById('ret-empty').hidden = true;
    document.getElementById('ret-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderTable(document.getElementById('ret-body'), rows, [
      { key: 'date' },
      {
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(row.sale_id || row.purchase_id || '');
        }
      },
      { key: 'product' },
      { key: 'variant' },
      { key: 'quantity' },
      { key: 'reason' },
      { key: 'location' }
    ]);
  }

  function load() {
    render();
    return global.MBMS_RECORDS.fetchOrMock(endpoint(), function () { return []; })
      .then(function (result) {
        render(result.source);
      });
  }

  function warmDocs() {
    return Promise.all([
      global.MBMS_RECORDS.fetchOrMock('sales', function () { return []; }),
      global.MBMS_RECORDS.fetchOrMock('purchases', function () { return []; })
    ]).then(function () {
      fillLookups();
    }).catch(function () {
      fillLookups();
    });
  }

  global.MBMS_PAGE = {
    active: 'returns',
    title: 'Returns',
    onReady: function () {
      setKind('sale');
      fillLookups();
      warmDocs();

      global.MBMS_UTILS.qsa('[data-return-kind]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setKind(btn.getAttribute('data-return-kind'));
          load();
        });
      });

      document.getElementById('ret-kind').addEventListener('change', function () {
        setKind(document.getElementById('ret-kind').value);
        fillDocFields();
      });
      document.getElementById('ret-sale').addEventListener('change', fillDocFields);
      document.getElementById('ret-purchase').addEventListener('change', fillDocFields);
      global.MBMS_UI.bindReset(document.getElementById('ret-form'), document.getElementById('ret-reset'), function () {
        syncFormKind();
      });

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
        var values = global.MBMS_UTILS.formToObject(form);
        var kind = values.kind || currentKind;
        global.MBMS_UI.confirm({
          title: kind === 'purchase' ? 'Record purchase return' : 'Record sales return',
          message: kind === 'purchase'
            ? 'This will remove stock and adjust supplier balance if Laravel accepts the request.'
            : 'This will restock and adjust customer balance if Laravel accepts the request.',
          confirmLabel: 'Submit return'
        }).then(function (ok) {
          if (!ok) {
            return;
          }
          form.dataset.submitting = '1';
          var submitter = form.querySelector('[type="submit"]');
          global.MBMS_UI.setButtonLoading(submitter, true);
          var path = kind === 'purchase' ? 'purchase-returns' : 'sales-returns';
          var record = {
            id: 'local-' + Date.now(),
            sale_id: values.sale_id,
            purchase_id: values.purchase_id,
            product: values.product,
            variant: values.variant,
            quantity: values.quantity,
            unit: values.unit,
            reason: values.reason,
            date: values.date,
            location: values.location,
            location_id: values.location
          };
          global.MBMS_RECORDS.submitOrMock('post', path, record).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? 'Return saved. Stock and balances updated by Laravel.'
                : 'API not connected. Sample return only.'
            });
            form.reset();
            form.classList.remove('was-validated');
            bootstrap.Modal.getOrCreateInstance(document.getElementById('retModal')).hide();
            setKind(kind);
            warmDocs();
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
