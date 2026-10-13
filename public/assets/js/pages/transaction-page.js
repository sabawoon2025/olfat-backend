/**
 * Reusable Sales and Purchases UI.
 * One form architecture for Tea, Rice, Detergents, and purchase-only materials.
 */
(function (global) {
  'use strict';

  function mode() {
    return document.body.getAttribute('data-transaction') || 'sales';
  }

  function isSales() {
    return mode() === 'sales';
  }

  function lockedCategory() {
    return document.body.getAttribute('data-category') || '';
  }

  function categories() {
    return isSales() ? global.MBMS_CATALOG.saleCategories() : global.MBMS_CATALOG.purchaseCategories();
  }

  function mockList() {
    return isSales()
      ? ((global.MBMS_MOCK && global.MBMS_MOCK.sales) || [])
      : ((global.MBMS_MOCK && global.MBMS_MOCK.purchases) || []);
  }

  function storeKey() {
    return mode();
  }

  function endpoint() {
    return mode();
  }

  function allRows() {
    return mockList();
  }

  function updateStockHint() {
    var hint = document.getElementById('tx-stock-hint');
    if (!hint || !isSales()) {
      return;
    }
    var variantId = (document.getElementById('tx-variant') || {}).value || '';
    var locationId = (document.getElementById('tx-location') || {}).value || '';
    var locationSelect = document.getElementById('tx-location');
    var locationName = '';
    if (locationSelect && locationSelect.selectedIndex >= 0) {
      locationName = locationSelect.options[locationSelect.selectedIndex].textContent || '';
    }
    if (!variantId || !locationId) {
      hint.textContent = 'Choose product, variant, and province to see available stock there.';
      return;
    }
    if (!global.MBMS_API || typeof global.MBMS_API.stockAtLocation !== 'function') {
      hint.textContent = 'Available stock for the selected province is checked when you save.';
      return;
    }
    var stock = global.MBMS_API.stockAtLocation(variantId, locationId);
    var qty = stock.qty != null ? stock.qty : 0;
    var unit = stock.unit ? (' ' + stock.unit) : '';
    var place = stock.location || locationName || 'this province';
    hint.textContent = 'Available in ' + place + ': ' + qty + unit + '. Sales cannot use stock from other provinces.';
  }

  function ensureStockIndex() {
    if (!isSales() || !global.MBMS_API || typeof global.MBMS_API.get !== 'function') {
      return Promise.resolve();
    }
    return global.MBMS_API.get('stock', { params: { per_page: 500 } }).then(function () {
      updateStockHint();
    }).catch(function () {
      updateStockHint();
    });
  }

  function fillDependentSelects() {
    var category = lockedCategory() || (document.getElementById('tx-category') || {}).value;
    var productSelect = document.getElementById('tx-product');
    var variantSelect = document.getElementById('tx-variant');
    var currentProduct = productSelect ? productSelect.value : '';
    global.MBMS_RECORDS.fillSelect(
      productSelect,
      global.MBMS_CATALOG.products(category),
      function (row) { return row.id; },
      function (row) { return row.name; },
      currentProduct
    );
    global.MBMS_RECORDS.fillSelect(
      variantSelect,
      global.MBMS_CATALOG.variants(category, (productSelect || {}).value),
      function (row) { return row.id; },
      function (row) { return row.label; }
    );
    updateStockHint();
  }

  function filterRows() {
    var search = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var category = lockedCategory() || (document.getElementById('list-category') || {}).value || '';
    var location = (document.getElementById('list-location') || {}).value || '';
    var from = (document.getElementById('date-from') || {}).value || '';
    var to = (document.getElementById('date-to') || {}).value || '';
    return allRows().filter(function (row) {
      var text = (row.product + ' ' + row.customer + ' ' + row.supplier + ' ' + row.variant).toLowerCase();
      var okSearch = !search || text.indexOf(search) !== -1;
      var okCat = !category || row.category === category;
      var okLoc = !location || row.location === location;
      var okFrom = !from || row.date >= from;
      var okTo = !to || row.date <= to;
      return okSearch && okCat && okLoc && okFrom && okTo;
    });
  }

  function billUrl(saleId) {
    var base = (global.MBMS_NAV && global.MBMS_NAV.asset)
      ? global.MBMS_NAV.asset('pages/bill.html')
      : 'bill.html';
    return base + '?id=' + encodeURIComponent(saleId);
  }

  function openBill(saleId) {
    if (!saleId) {
      return;
    }
    global.open(billUrl(saleId), '_blank', 'noopener');
  }

  function renderList(source) {
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    var partyKey = isSales() ? 'customer' : 'supplier';
    var rows = filterRows();
    var body = document.getElementById('tx-list-body');
    if (!rows.length) {
      global.MBMS_UI.renderEmpty(document.getElementById('tx-empty'), {
        title: 'No ' + mode() + ' yet',
        message: 'New records will show up here.'
      });
      document.getElementById('tx-table-wrap').hidden = true;
      document.getElementById('tx-empty').hidden = false;
      return;
    }
    document.getElementById('tx-empty').hidden = true;
    document.getElementById('tx-table-wrap').hidden = false;
    var columns = [
      { key: 'date' },
      { key: 'category' },
      { key: 'product' },
      { key: 'variant' },
      { key: partyKey },
      { key: 'quantity' },
      { key: 'total' },
      { key: 'location' }
    ];
    if (isSales()) {
      columns.push({
        key: 'bill',
        render: function (row) {
          if (!row.id) {
            return '';
          }
          return '<a class="btn btn-outline-primary btn-sm" href="' +
            global.MBMS_UTILS.escapeHtml(billUrl(row.id)) +
            '" target="_blank" rel="noopener">Bill</a>';
        }
      });
    }
    global.MBMS_RECORDS.renderTable(body, rows, columns);
  }

  function load() {
    renderList();
    return global.MBMS_RECORDS.fetchOrMock(endpoint(), mockList)
      .then(function (result) {
        renderList(result.source);
      });
  }

  function setupFormLookups() {
    var locked = lockedCategory();
    var categorySelect = document.getElementById('tx-category');
    if (locked) {
      categorySelect.value = locked;
      categorySelect.disabled = true;
    }
    global.MBMS_RECORDS.fillSelect(
      categorySelect,
      categories(),
      function (row) { return row.id; },
      function (row) { return row.label; },
      locked
    );
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('tx-location'));
    if (isSales()) {
      global.MBMS_RECORDS.fillSelect(
        document.getElementById('tx-party'),
        global.MBMS_CATALOG.customers(),
        function (row) { return row.id; },
        function (row) { return row.name; }
      );
    } else {
      global.MBMS_RECORDS.fillSelect(
        document.getElementById('tx-party'),
        global.MBMS_CATALOG.suppliers(),
        function (row) { return row.id; },
        function (row) { return row.name; }
      );
    }
    fillDependentSelects();
  }

  function warmLookups() {
    var catalogPaths = isSales()
      ? ['tea', 'rice', 'detergents']
      : ['tea', 'rice', 'detergents', 'raw-materials', 'factory-materials'];
    var partyPath = isSales() ? 'customers' : 'suppliers';
    var emptyCatalog = function () {
      return { types: [], products: [], variants: [], sizes: [] };
    };
    return Promise.all(
      catalogPaths.map(function (path) {
        return global.MBMS_RECORDS.fetchOrMock(path, emptyCatalog).catch(function () {
          return null;
        });
      }).concat([
        global.MBMS_RECORDS.fetchOrMock(partyPath, function () { return []; }).catch(function () {
          return null;
        })
      ])
    ).then(function () {
      setupFormLookups();
    });
  }

  global.MBMS_PAGE = {
    active: document.body.getAttribute('data-page'),
    title: (document.querySelector('h1') && document.querySelector('h1').textContent) || (isSales() ? 'Sales' : 'Purchases'),
    onReady: function () {
      global.MBMS_RECORDS.fillSelect(
        document.getElementById('list-category'),
        categories(),
        function (row) { return row.id; },
        function (row) { return row.label; },
        lockedCategory(),
        'All categories'
      );
      global.MBMS_RECORDS.fillSelect(
        document.getElementById('list-location'),
        global.MBMS_RECORDS.locations(),
        function (row) { return row.name; },
        function (row) { return row.name; },
        '',
        'All locations'
      );
      if (lockedCategory() && document.getElementById('list-category')) {
        document.getElementById('list-category').value = lockedCategory();
        document.getElementById('list-category').disabled = true;
      }

      ['module-search', 'list-category', 'list-location', 'date-from', 'date-to'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', load);
          el.addEventListener('change', load);
        }
      });

      document.getElementById('tx-category').addEventListener('change', fillDependentSelects);
      document.getElementById('tx-product').addEventListener('change', fillDependentSelects);
      var variantEl = document.getElementById('tx-variant');
      var locationEl = document.getElementById('tx-location');
      if (variantEl) {
        variantEl.addEventListener('change', updateStockHint);
      }
      if (locationEl) {
        locationEl.addEventListener('change', updateStockHint);
      }
      setupFormLookups();
      warmLookups();
      ensureStockIndex();

      var form = document.getElementById('tx-form');
      global.MBMS_UI.bindReset(form, document.getElementById('tx-reset'), function () {
        setupFormLookups();
        updateStockHint();
      });

      global.MBMS_UI.bindForm(form, {
        onSubmit: function (values) {
          var category = lockedCategory() || values.category;
          var product = global.MBMS_CATALOG.products(category).filter(function (row) { return String(row.id) === String(values.product); })[0];
          var variant = global.MBMS_CATALOG.variants(category, values.product).filter(function (row) { return String(row.id) === String(values.variant); })[0];
          var workLocationId = (global.MBMS_CONFIG && global.MBMS_CONFIG.getLocationId)
            ? global.MBMS_CONFIG.getLocationId()
            : values.location;
          if (workLocationId) {
            values.location = workLocationId;
          }
          if (isSales() && global.MBMS_API && typeof global.MBMS_API.stockAtLocation === 'function') {
            var available = global.MBMS_API.stockAtLocation(values.variant, values.location);
            var wanted = Number(values.quantity);
            if (!isNaN(wanted) && wanted > Number(available.qty || 0)) {
              var unit = available.unit ? (' ' + available.unit) : '';
              var place = available.location || 'this province';
              throw {
                message: 'You have only ' + available.qty + unit + ' in ' + place + '.',
                errors: { quantity: ['Only ' + available.qty + unit + ' available in ' + place] }
              };
            }
          }
          var record = {
            id: 'local-' + Date.now(),
            category: category,
            product: product ? product.name : values.product,
            variant: variant ? variant.label : values.variant,
            variant_id: values.variant,
            quantity: values.quantity,
            price: values.price,
            total: values.total,
            paid: values.paid,
            remaining: values.remaining,
            payment_type: values.payment_type,
            date: values.date,
            location: values.location,
            location_id: values.location,
            notes: values.notes
          };
          if (isSales()) {
            record.customer = values.party;
          } else {
            record.supplier = values.party;
          }
          return global.MBMS_RECORDS.submitOrMock('post', endpoint(), record, function (body) {
            return global.MBMS_RECORDS.storeSave(storeKey(), body);
          }).then(function (result) {
            var saved = global.MBMS_UTILS.unwrap(result.data) || result.data || {};
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              title: result.source === 'api' ? 'Saved' : 'Saved locally',
              message: result.source === 'api'
                ? (isSales()
                  ? 'Sale saved. Opening the bill for print or WhatsApp.'
                  : 'The transaction was sent to Laravel. Stock will be updated by the backend.')
                : 'API not connected. Sample record only. Stock was not changed in the browser.'
            });
            form.reset();
            form.classList.remove('was-validated');
            setupFormLookups();
            ensureStockIndex();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('txModal')).hide();
            load();
            if (isSales() && result.source === 'api' && saved.id) {
              openBill(saved.id);
            }
          });
        }
      });

      load();
    }
  };
})(window);
