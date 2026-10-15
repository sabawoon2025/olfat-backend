/**
 * Sales and purchase returns UI.
 */
(function (global) {
  'use strict';

  var currentKind = 'sale';

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

  function formatQty(value) {
    var n = num(value);
    if (Math.abs(n - Math.round(n)) < 0.0001) {
      return String(Math.round(n));
    }
    return String(Math.round(n * 10000) / 10000);
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

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

  function itemReturnable(item) {
    if (!item) {
      return 0;
    }
    if (item.returnable_raw != null) {
      return Math.max(0, num(item.returnable_raw));
    }
    var qty = item.quantity_raw != null ? num(item.quantity_raw) : num(item.quantity);
    var returned = item.returned_quantity_raw != null
      ? num(item.returned_quantity_raw)
      : num(item.returned_quantity);
    return Math.max(0, qty - returned);
  }

  function docItems(doc) {
    return (doc && doc.items && doc.items.length) ? doc.items : [];
  }

  function docHasReturnable(doc) {
    var items = docItems(doc);
    if (!items.length) {
      return num(doc && doc.quantity) > 0;
    }
    return items.some(function (item) {
      return itemReturnable(item) > 0.00001;
    });
  }

  function refreshAutocomplete() {
    if (!global.MBMS_AUTOCOMPLETE) {
      return;
    }
    ['ret-sale', 'ret-purchase'].forEach(function (id) {
      global.MBMS_AUTOCOMPLETE.refresh(document.getElementById(id));
    });
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
    var partyCol = document.getElementById('ret-party-col');
    if (partyCol) {
      partyCol.textContent = currentKind === 'purchase' ? 'Supplier' : 'Customer';
    }
    var linkSales = document.getElementById('ret-link-sales');
    var linkPurchases = document.getElementById('ret-link-purchases');
    if (linkSales) {
      linkSales.classList.toggle('btn-outline-primary', currentKind === 'sale');
      linkSales.classList.toggle('btn-outline-secondary', currentKind !== 'sale');
    }
    if (linkPurchases) {
      linkPurchases.classList.toggle('btn-outline-primary', currentKind === 'purchase');
      linkPurchases.classList.toggle('btn-outline-secondary', currentKind !== 'purchase');
    }
    syncFormKind();
    global.MBMS_UTILS.setIconHeading(
      document.getElementById('ret-modal-title'),
      'bi-arrow-return-left',
      currentKind === 'purchase' ? 'Record purchase return' : 'Record sales return'
    );
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

  function selectedDoc() {
    var kind = (document.getElementById('ret-kind') || {}).value || currentKind;
    if (kind === 'purchase') {
      var purchaseId = (document.getElementById('ret-purchase') || {}).value || '';
      return purchaseOptions().filter(function (row) {
        return String(row.id) === String(purchaseId);
      })[0] || null;
    }
    var saleId = (document.getElementById('ret-sale') || {}).value || '';
    return salesOptions().filter(function (row) {
      return String(row.id) === String(saleId);
    })[0] || null;
  }

  function selectedItem() {
    var doc = selectedDoc();
    var items = docItems(doc);
    var itemId = (document.getElementById('ret-item') || {}).value || '';
    if (!items.length) {
      return null;
    }
    return items.filter(function (item) {
      return String(item.id) === String(itemId);
    })[0] || items[0] || null;
  }

  function fillLookups() {
    var returnableSales = salesOptions().filter(docHasReturnable);
    var returnablePurchases = purchaseOptions().filter(docHasReturnable);

    global.MBMS_RECORDS.fillSelect(
      document.getElementById('ret-sale'),
      returnableSales,
      function (row) { return row.id; },
      function (row) {
        return (row.reference_no || ('#' + row.id)) +
          ' · ' + (row.customer || 'Customer') +
          ' · ' + (row.product || 'Sale') +
          ' · ' + (row.date || '');
      },
      '',
      returnableSales.length ? 'Select sale' : 'No returnable sales'
    );
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('ret-purchase'),
      returnablePurchases,
      function (row) { return row.id; },
      function (row) {
        return (row.reference_no || ('#' + row.id)) +
          ' · ' + (row.supplier || 'Supplier') +
          ' · ' + (row.product || 'Purchase') +
          ' · ' + (row.date || '');
      },
      '',
      returnablePurchases.length ? 'Select purchase' : 'No returnable purchases'
    );
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('ret-location'));
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('list-location'),
      global.MBMS_RECORDS.locations(),
      function (row) { return row.id; },
      function (row) { return row.name; },
      '',
      'All locations'
    );
    refreshAutocomplete();
  }

  function fillItemSelect(doc) {
    var select = document.getElementById('ret-item');
    var items = docItems(doc).filter(function (item) {
      return itemReturnable(item) > 0.00001;
    });
    if (!items.length && doc) {
      items = docItems(doc);
    }
    global.MBMS_RECORDS.fillSelect(
      select,
      items,
      function (row) { return row.id; },
      function (row) {
        return (row.product || 'Item') +
          (row.variant ? ' · ' + row.variant : '') +
          ' · returnable ' + formatQty(itemReturnable(row)) +
          (row.unit ? ' ' + row.unit : '');
      },
      items[0] ? items[0].id : '',
      items.length ? 'Select item' : 'No items'
    );
  }

  function updatePreview() {
    var item = selectedItem();
    var qty = num((document.getElementById('ret-quantity') || {}).value);
    var returnable = item ? itemReturnable(item) : num((document.getElementById('ret-returnable') || {}).value);
    var unitPrice = item
      ? (item.unit_price_raw != null ? num(item.unit_price_raw) : num(item.unit_price))
      : num((document.getElementById('ret-unit-price') || {}).value);
    var amount = roundMoney(qty * unitPrice);
    var unit = item ? (item.unit || '') : ((document.getElementById('ret-unit') || {}).value || '');
    var hint = document.getElementById('ret-qty-hint');
    var error = document.getElementById('ret-qty-error');
    var refund = document.getElementById('ret-refund');
    var preview = document.getElementById('ret-preview');

    if (refund) {
      refund.value = moneyText(amount);
    }
    if (hint) {
      hint.textContent = item
        ? ('Returnable: ' + formatQty(returnable) + (unit ? ' ' + unit : '') +
          ' · already returned: ' + formatQty(item.returned_quantity_raw != null ? item.returned_quantity_raw : item.returned_quantity))
        : 'Select a sale or purchase first.';
    }
    if (error) {
      var invalid = qty > 0 && returnable > 0 && qty > returnable + 0.00001;
      error.hidden = !invalid;
      error.textContent = invalid
        ? ('Quantity exceeds returnable amount (' + formatQty(returnable) + ').')
        : '';
    }
    if (preview) {
      preview.hidden = !item;
      document.getElementById('ret-preview-returnable').textContent =
        formatQty(returnable) + (unit ? ' ' + unit : '');
      document.getElementById('ret-preview-qty').textContent =
        formatQty(qty) + (unit ? ' ' + unit : '');
      document.getElementById('ret-preview-price').textContent = moneyText(unitPrice);
      document.getElementById('ret-preview-amount').textContent = moneyText(amount);
    }
  }

  function fillDocFields() {
    var kind = (document.getElementById('ret-kind') || {}).value || 'sale';
    var doc = selectedDoc();
    if (!doc) {
      document.getElementById('ret-party').value = '';
      document.getElementById('ret-product').value = '';
      document.getElementById('ret-variant').value = '';
      document.getElementById('ret-unit').value = '';
      document.getElementById('ret-sale-item-id').value = '';
      document.getElementById('ret-purchase-item-id').value = '';
      document.getElementById('ret-unit-price').value = '';
      document.getElementById('ret-returnable').value = '';
      fillItemSelect(null);
      updatePreview();
      return;
    }

    document.getElementById('ret-party').value = kind === 'purchase'
      ? (doc.supplier || '')
      : (doc.customer || '');

    if (doc.location_id) {
      var locSelect = document.getElementById('ret-location');
      if (locSelect) {
        var hasOption = Array.prototype.some.call(locSelect.options, function (opt) {
          return String(opt.value) === String(doc.location_id);
        });
        if (!hasOption && doc.location) {
          var opt = document.createElement('option');
          opt.value = String(doc.location_id);
          opt.textContent = doc.location;
          locSelect.appendChild(opt);
        }
        locSelect.value = String(doc.location_id);
      }
    }

    fillItemSelect(doc);
    fillItemFields();
  }

  function fillItemFields() {
    var kind = (document.getElementById('ret-kind') || {}).value || 'sale';
    var item = selectedItem();
    var doc = selectedDoc();
    if (!item && doc) {
      document.getElementById('ret-product').value = doc.product || '';
      document.getElementById('ret-variant').value = doc.variant || '';
      document.getElementById('ret-unit').value = '';
      updatePreview();
      return;
    }
    if (!item) {
      updatePreview();
      return;
    }

    var returnable = itemReturnable(item);
    var unitPrice = item.unit_price_raw != null ? num(item.unit_price_raw) : num(item.unit_price);

    document.getElementById('ret-product').value = item.product || '';
    document.getElementById('ret-variant').value = item.variant || '';
    document.getElementById('ret-unit').value = item.unit || '';
    document.getElementById('ret-unit-price').value = String(unitPrice);
    document.getElementById('ret-returnable').value = String(returnable);
    document.getElementById('ret-sale-item-id').value = kind === 'sale' ? String(item.id || '') : '';
    document.getElementById('ret-purchase-item-id').value = kind === 'purchase' ? String(item.id || '') : '';

    var qtyInput = document.getElementById('ret-quantity');
    if (qtyInput && (!qtyInput.value || num(qtyInput.value) > returnable)) {
      qtyInput.value = returnable > 0 ? formatQty(returnable) : '';
      qtyInput.max = returnable > 0 ? String(returnable) : '';
    }
    updatePreview();
  }

  function applyListFilters(rows) {
    var search = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var location = (document.getElementById('list-location') || {}).value || '';
    var from = (document.getElementById('date-from') || {}).value || '';
    var to = (document.getElementById('date-to') || {}).value || '';
    return rows.filter(function (row) {
      var text = [
        row.party,
        row.product,
        row.variant,
        row.reason,
        row.original_ref,
        row.reference_no,
        row.sale_id,
        row.purchase_id
      ].join(' ').toLowerCase();
      return (!search || text.indexOf(search) !== -1)
        && (!location || String(row.location_id) === String(location) || String(row.location) === String(location))
        && (!from || !row.date || row.date >= from)
        && (!to || !row.date || row.date <= to);
    });
  }

  function summarize(rows) {
    var qty = 0;
    var amount = 0;
    rows.forEach(function (row) {
      qty += row.quantity_raw != null ? num(row.quantity_raw) : num(row.quantity);
      amount += row.amount_raw != null ? num(row.amount_raw) : num(row.amount);
    });
    return [
      {
        icon: 'bi-arrow-return-left',
        label: currentKind === 'purchase' ? 'Purchase returns' : 'Sales returns',
        value: rows.length,
        tone: 'primary'
      },
      { icon: 'bi-box-seam', label: 'Qty returned', value: formatQty(qty), tone: 'info' },
      {
        icon: 'bi-cash-coin',
        label: 'Amount',
        value: moneyText(amount),
        tone: currentKind === 'purchase' ? 'warning' : 'success'
      }
    ];
  }

  function render(source) {
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    var rows = applyListFilters(returnRows());
    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), summarize(rows));

    if (!rows.length) {
      document.getElementById('ret-table-wrap').hidden = true;
      document.getElementById('ret-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('ret-empty'), {
        title: currentKind === 'purchase' ? 'No purchase returns yet' : 'No sales returns yet',
        message: 'Use New return to record one against an original sale or purchase.'
      });
      return;
    }
    document.getElementById('ret-empty').hidden = true;
    document.getElementById('ret-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderTable(document.getElementById('ret-body'), rows, [
      { key: 'date' },
      {
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(row.reference_no || row.id || '');
        }
      },
      {
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(row.original_ref || row.sale_id || row.purchase_id || '');
        }
      },
      { key: 'party' },
      { key: 'product' },
      { key: 'variant' },
      { key: 'quantity' },
      {
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(row.amount || moneyText(row.amount_raw));
        }
      },
      { key: 'reason' },
      { key: 'location' }
    ]);
  }

  function load() {
    render();
    return global.MBMS_RECORDS.fetchOrMock(endpoint(), function () { return []; })
      .then(function (result) {
        render(result.source);
      })
      .catch(function () {
        render('error');
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

  function resetFormExtras() {
    var form = document.getElementById('ret-form');
    if (!form) {
      return;
    }
    var date = document.getElementById('ret-date');
    if (date) {
      date.value = todayIso();
    }
    syncFormKind();
    fillDocFields();
    document.getElementById('ret-qty-error').hidden = true;
  }

  global.MBMS_PAGE = {
    active: 'returns',
    title: 'Returns',
    onReady: function () {
      setKind('sale');
      fillLookups();
      if (global.MBMS_API && typeof global.MBMS_API.ensureLocations === 'function') {
        global.MBMS_API.ensureLocations().then(fillLookups).catch(function () {});
      }
      warmDocs();
      resetFormExtras();

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
      document.getElementById('ret-item').addEventListener('change', fillItemFields);
      document.getElementById('ret-quantity').addEventListener('input', updatePreview);
      document.getElementById('ret-quantity').addEventListener('change', updatePreview);

      ['module-search', 'list-location', 'date-from', 'date-to'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', load);
          el.addEventListener('change', load);
        }
      });

      document.getElementById('retModal').addEventListener('show.bs.modal', function () {
        var kindSelect = document.getElementById('ret-kind');
        if (kindSelect) {
          kindSelect.value = currentKind;
        }
        syncFormKind();
        fillLookups();
        if (!(document.getElementById('ret-date') || {}).value) {
          document.getElementById('ret-date').value = todayIso();
        }
      });

      global.MBMS_UI.bindReset(document.getElementById('ret-form'), document.getElementById('ret-reset'), function () {
        resetFormExtras();
      });

      var form = document.getElementById('ret-form');
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (form.dataset.submitting === '1') {
          return;
        }
        updatePreview();
        var values = global.MBMS_UTILS.formToObject(form);
        var kind = values.kind || currentKind;
        var qty = num(values.quantity);
        var returnable = num(values.returnable);
        var item = selectedItem();
        if (item) {
          returnable = itemReturnable(item);
        }
        if (!form.checkValidity()) {
          form.classList.add('was-validated');
          return;
        }
        if (qty <= 0) {
          global.MBMS_UI.notify({ type: 'danger', message: 'Return quantity must be greater than zero.' });
          return;
        }
        if (returnable > 0 && qty > returnable + 0.00001) {
          document.getElementById('ret-qty-error').hidden = false;
          document.getElementById('ret-qty-error').textContent =
            'Quantity exceeds returnable amount (' + formatQty(returnable) + ').';
          return;
        }

        global.MBMS_UI.confirm({
          title: kind === 'purchase' ? 'Record purchase return' : 'Record sales return',
          message: kind === 'purchase'
            ? 'This removes stock and adjusts supplier balance if Laravel accepts the request.'
            : 'This restocks and adjusts customer balance if Laravel accepts the request.',
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
            sale_item_id: values.sale_item_id || (item && kind === 'sale' ? item.id : ''),
            purchase_item_id: values.purchase_item_id || (item && kind === 'purchase' ? item.id : ''),
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
            return warmDocs().then(load);
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
