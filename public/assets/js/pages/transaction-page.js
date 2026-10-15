/**
 * Reusable Sales and Purchases UI.
 * One form architecture for Tea, Rice, Detergents, and purchase-only materials.
 */
(function (global) {
  'use strict';

  var priceManual = false;
  var paidManual = false;

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

  function refreshAutocomplete() {
    if (!global.MBMS_AUTOCOMPLETE) {
      return;
    }
    ['tx-party', 'tx-product', 'tx-variant'].forEach(function (id) {
      global.MBMS_AUTOCOMPLETE.refresh(document.getElementById(id));
    });
  }

  function parsePrice(row) {
    if (!row) {
      return null;
    }
    if (row.price_raw != null && row.price_raw !== '') {
      return num(row.price_raw);
    }
    var raw = String(row.price == null ? '' : row.price).replace(/[^\d.-]/g, '');
    if (raw === '') {
      return null;
    }
    return num(raw);
  }

  function lastTradePrice(variantId, kind) {
    var rows = kind === 'sale'
      ? ((global.MBMS_MOCK && global.MBMS_MOCK.sales) || [])
      : ((global.MBMS_MOCK && global.MBMS_MOCK.purchases) || []);
    var best = null;
    rows.forEach(function (row) {
      if (String(row.variant_id) !== String(variantId)) {
        return;
      }
      if (!best || String(row.date || '') >= String(best.date || '')) {
        best = row;
      }
    });
    return parsePrice(best);
  }

  function availableStock() {
    var variantId = (document.getElementById('tx-variant') || {}).value || '';
    var locationId = (document.getElementById('tx-location') || {}).value || '';
    if (!variantId || !locationId || !global.MBMS_API || typeof global.MBMS_API.stockAtLocation !== 'function') {
      return { qty: null, unit: '', location: '' };
    }
    return global.MBMS_API.stockAtLocation(variantId, locationId);
  }

  function updateStockHint() {
    var hint = document.getElementById('tx-stock-hint');
    var error = document.getElementById('tx-stock-error');
    var qtyInput = document.getElementById('tx-quantity');
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
      hint.textContent = 'Choose product, variant, and location to see available stock.';
      hint.classList.remove('text-danger', 'text-success');
      if (error) {
        error.hidden = true;
        error.textContent = '';
      }
      if (qtyInput) {
        qtyInput.classList.remove('is-invalid');
      }
      return;
    }
    if (!global.MBMS_API || typeof global.MBMS_API.stockAtLocation !== 'function') {
      hint.textContent = 'Available stock is checked when you save.';
      return;
    }
    var stock = availableStock();
    var qty = stock.qty != null ? stock.qty : 0;
    var unit = stock.unit ? (' ' + stock.unit) : '';
    var place = stock.location || locationName || 'this location';
    hint.textContent = 'Available in ' + place + ': ' + qty + unit + '. Sales use stock from this location only.';
    hint.classList.toggle('text-success', qty > 0);
    hint.classList.toggle('text-danger', qty <= 0);

    var wanted = num(qtyInput && qtyInput.value);
    if (error && qtyInput) {
      if (wanted > 0 && wanted > qty) {
        error.hidden = false;
        error.textContent = 'You do not have this quantity in stock. Available: ' + qty + unit + ' in ' + place + '.';
        qtyInput.classList.add('is-invalid');
      } else {
        error.hidden = true;
        error.textContent = '';
        qtyInput.classList.remove('is-invalid');
      }
    }
  }

  function updateProfitPanel() {
    var panel = document.getElementById('tx-profit-panel');
    if (!panel || !isSales()) {
      return;
    }
    var variantId = (document.getElementById('tx-variant') || {}).value || '';
    var qty = num((document.getElementById('tx-quantity') || {}).value);
    var price = num((document.getElementById('tx-price') || {}).value);
    if (!variantId || !(price > 0)) {
      panel.hidden = true;
      return;
    }
    var cost = lastTradePrice(variantId, 'purchase');
    var costEl = document.getElementById('tx-cost-display');
    var profitEl = document.getElementById('tx-profit-display');
    panel.hidden = false;
    if (cost == null) {
      if (costEl) {
        costEl.textContent = 'No purchase yet';
      }
      if (profitEl) {
        profitEl.textContent = '—';
        profitEl.className = '';
      }
      return;
    }
    if (costEl) {
      costEl.textContent = moneyText(cost) + ' / unit';
    }
    var profit = roundMoney((price - cost) * (qty > 0 ? qty : 1));
    if (profitEl) {
      profitEl.textContent = (qty > 0 ? '' : '~ ') + moneyText(profit) + (qty > 0 ? '' : ' / unit');
      profitEl.className = profit >= 0 ? 'text-success' : 'text-danger';
    }
  }

  function syncTotals(options) {
    options = options || {};
    var qtyEl = document.getElementById('tx-quantity');
    var priceEl = document.getElementById('tx-price');
    var totalEl = document.getElementById('tx-total');
    var paidEl = document.getElementById('tx-paid');
    var remainingEl = document.getElementById('tx-remaining');
    var paymentType = document.getElementById('tx-payment-type');

    var qty = num(qtyEl && qtyEl.value);
    var price = num(priceEl && priceEl.value);
    var total = roundMoney(qty * price);
    if (totalEl) {
      totalEl.value = qty > 0 && price >= 0 ? String(total) : '';
    }

    if (paymentType && paidEl && !paidManual && !options.keepPaid) {
      if (paymentType.value === 'cash') {
        paidEl.value = totalEl && totalEl.value ? totalEl.value : '';
      } else if (paymentType.value === 'credit' && !options.fromPaid) {
        paidEl.value = '0';
      }
    }

    var paid = num(paidEl && paidEl.value);
    if (remainingEl) {
      remainingEl.value = totalEl && totalEl.value !== ''
        ? String(roundMoney(Math.max(0, total - paid)))
        : '';
    }
    updateStockHint();
    updateProfitPanel();
  }

  function applySuggestedPrice() {
    if (priceManual) {
      updateProfitPanel();
      return;
    }
    var variantId = (document.getElementById('tx-variant') || {}).value || '';
    var priceEl = document.getElementById('tx-price');
    var hint = document.getElementById('tx-price-hint');
    if (!variantId || !priceEl) {
      return;
    }
    var last = lastTradePrice(variantId, isSales() ? 'sale' : 'purchase');
    if (last != null && last >= 0) {
      priceEl.value = String(last);
      priceEl.dataset.suggested = '1';
      if (hint) {
        hint.textContent = isSales()
          ? 'Filled from last selling price. Edit if needed.'
          : 'Filled from last purchase price. Edit if needed.';
      }
    } else {
      priceEl.placeholder = isSales() ? 'Enter selling price' : 'Enter purchase price';
      if (priceEl.dataset.suggested === '1') {
        priceEl.value = '';
      }
      if (hint) {
        hint.textContent = isSales()
          ? 'No prior sale price for this variant yet.'
          : 'No prior purchase price for this variant yet.';
      }
    }
    syncTotals();
  }

  function ensureStockIndex() {
    if (!global.MBMS_API || typeof global.MBMS_API.get !== 'function') {
      return Promise.resolve();
    }
    return global.MBMS_API.get('stock', { params: { per_page: 500 } }).then(function () {
      updateStockHint();
    }).catch(function () {
      updateStockHint();
    });
  }

  function refreshCatalogAfterTrade() {
    var catalogPaths = isSales()
      ? ['tea', 'rice', 'detergents']
      : ['tea', 'rice', 'detergents', 'raw-materials', 'factory-materials'];
    var emptyCatalog = function () {
      return { types: [], products: [], variants: [], sizes: [] };
    };
    return Promise.all(catalogPaths.map(function (path) {
      return global.MBMS_RECORDS.fetchOrMock(path, emptyCatalog).catch(function () {
        return null;
      });
    })).then(function () {
      return ensureStockIndex();
    });
  }

  function fillDependentSelects() {
    var category = lockedCategory() || (document.getElementById('tx-category') || {}).value;
    var productSelect = document.getElementById('tx-product');
    var variantSelect = document.getElementById('tx-variant');
    var currentProduct = productSelect ? productSelect.value : '';
    var currentVariant = variantSelect ? variantSelect.value : '';
    global.MBMS_RECORDS.fillSelect(
      productSelect,
      global.MBMS_CATALOG.products(category),
      function (row) { return row.id; },
      function (row) { return row.name; },
      currentProduct,
      'Select product'
    );
    global.MBMS_RECORDS.fillSelect(
      variantSelect,
      global.MBMS_CATALOG.variants(category, (productSelect || {}).value),
      function (row) { return row.id; },
      function (row) { return row.label; },
      currentVariant,
      'Select variant'
    );
    refreshAutocomplete();
    priceManual = false;
    applySuggestedPrice();
    updateStockHint();
  }

  function filterRows() {
    var search = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var category = lockedCategory() || (document.getElementById('list-category') || {}).value || '';
    var location = (document.getElementById('list-location') || {}).value || '';
    var from = (document.getElementById('date-from') || {}).value || '';
    var to = (document.getElementById('date-to') || {}).value || '';
    return allRows().filter(function (row) {
      var text = (row.product + ' ' + row.customer + ' ' + row.supplier + ' ' + row.variant + ' ' + (row.payment_type || '')).toLowerCase();
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
    var totalAmount = rows.reduce(function (sum, row) {
      return sum + (row.total_raw != null ? num(row.total_raw) : num(row.total));
    }, 0);
    var remainingAmount = rows.reduce(function (sum, row) {
      return sum + (row.remaining_raw != null ? num(row.remaining_raw) : num(row.remaining));
    }, 0);
    var paidAmount = rows.reduce(function (sum, row) {
      return sum + (row.paid_raw != null ? num(row.paid_raw) : num(row.paid));
    }, 0);

    if (isSales()) {
      global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
        { icon: 'bi-cart-check', label: 'Sales', value: rows.length, tone: 'primary' },
        { icon: 'bi-cash-stack', label: 'Total', value: moneyText(totalAmount), tone: 'success' },
        { icon: 'bi-wallet2', label: 'Collected', value: moneyText(paidAmount), tone: 'accent' },
        { icon: 'bi-exclamation-circle', label: 'Receivable', value: moneyText(remainingAmount), tone: remainingAmount > 0 ? 'warning' : 'muted' }
      ]);
    } else {
      global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
        { icon: 'bi-bag-check', label: 'Purchases', value: rows.length, tone: 'primary' },
        { icon: 'bi-cash-stack', label: 'Total', value: moneyText(totalAmount), tone: 'info' },
        { icon: 'bi-wallet2', label: 'Paid', value: moneyText(paidAmount), tone: 'accent' },
        { icon: 'bi-exclamation-circle', label: 'Payable', value: moneyText(remainingAmount), tone: remainingAmount > 0 ? 'warning' : 'muted' }
      ]);
    }

    if (!rows.length) {
      global.MBMS_UI.renderEmpty(document.getElementById('tx-empty'), {
        title: 'No ' + mode() + ' yet',
        message: isSales()
          ? 'Create a new sale to update stock, customer balance, and invoice.'
          : 'Create a purchase to add stock and update supplier balance.'
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
      { key: 'total' }
    ];
    if (isSales()) {
      columns.push(
        { key: 'paid' },
        {
          render: function (row) {
            var type = String(row.payment_type || '').toLowerCase();
            if (type === 'cash') {
              return '<span class="badge text-bg-success">Cash</span>';
            }
            if (type === 'credit') {
              return '<span class="badge text-bg-warning">Credit</span>';
            }
            var rem = row.remaining_raw != null ? num(row.remaining_raw) : num(row.remaining);
            return rem > 0
              ? '<span class="badge text-bg-warning">Credit</span>'
              : '<span class="badge text-bg-success">Cash</span>';
          }
        },
        { key: 'location' },
        {
          key: 'bill',
          render: function (row) {
            if (!row.id) {
              return '';
            }
            return '<a class="btn btn-outline-primary btn-sm" href="' +
              global.MBMS_UTILS.escapeHtml(billUrl(row.id)) +
              '" target="_blank" rel="noopener"><i class="bi bi-receipt" aria-hidden="true"></i> Invoice</a>';
          }
        }
      );
    } else {
      columns.push(
        { key: 'paid' },
        {
          render: function (row) {
            var rem = row.remaining_raw != null ? num(row.remaining_raw) : num(row.remaining);
            var label = moneyText(rem);
            return rem > 0
              ? '<span class="badge text-bg-warning">' + global.MBMS_UTILS.escapeHtml(label) + '</span>'
              : '<span class="badge text-bg-success">0.00</span>';
          }
        },
        { key: 'location' }
      );
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

  function defaultFormMeta() {
    var dateEl = document.getElementById('tx-date');
    if (dateEl && !dateEl.value) {
      dateEl.value = todayIso();
    }
  }

  function setupFormLookups(preferredPartyId) {
    var locked = lockedCategory();
    var categorySelect = document.getElementById('tx-category');
    if (locked && categorySelect) {
      categorySelect.value = locked;
      categorySelect.disabled = true;
    }
    global.MBMS_RECORDS.fillSelect(
      categorySelect,
      categories(),
      function (row) { return row.id; },
      function (row) { return row.label; },
      locked || (categorySelect && categorySelect.value) || '',
      'Select category'
    );
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('tx-location'));
    if (isSales()) {
      global.MBMS_RECORDS.fillSelect(
        document.getElementById('tx-party'),
        global.MBMS_CATALOG.customers(),
        function (row) { return row.id; },
        function (row) { return row.name; },
        preferredPartyId || '',
        'Select customer'
      );
    } else {
      global.MBMS_RECORDS.fillSelect(
        document.getElementById('tx-party'),
        global.MBMS_CATALOG.suppliers(),
        function (row) { return row.id; },
        function (row) { return row.name; },
        preferredPartyId || '',
        'Select supplier'
      );
    }
    fillDependentSelects();
    defaultFormMeta();
    refreshAutocomplete();
    syncTotals({ keepPaid: true });
  }

  function warmLookups(preferredPartyId) {
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
      setupFormLookups(preferredPartyId);
    });
  }

  function openNewModal(partyId) {
    priceManual = false;
    paidManual = false;
    setupFormLookups(partyId || '');
    var modalEl = document.getElementById('txModal');
    if (modalEl) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }

  function handleReturnFromParty() {
    var open = global.MBMS_RECORDS.queryParam('open');
    var partyId = isSales()
      ? global.MBMS_RECORDS.queryParam('customer_id')
      : global.MBMS_RECORDS.queryParam('supplier_id');
    if (open === '1' || partyId) {
      openNewModal(partyId || '');
      try {
        var url = new URL(global.location.href);
        url.searchParams.delete('open');
        url.searchParams.delete('customer_id');
        url.searchParams.delete('supplier_id');
        global.history.replaceState({}, '', url.pathname + url.search + url.hash);
      } catch (err) {
        /* ignore */
      }
    }
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

      var categoryEl = document.getElementById('tx-category');
      var productEl = document.getElementById('tx-product');
      if (categoryEl) {
        categoryEl.addEventListener('change', function () {
          if (productEl) {
            productEl.value = '';
          }
          var variantSelect = document.getElementById('tx-variant');
          if (variantSelect) {
            variantSelect.value = '';
          }
          fillDependentSelects();
        });
      }
      if (productEl) {
        productEl.addEventListener('change', function () {
          var variantSelect = document.getElementById('tx-variant');
          if (variantSelect) {
            variantSelect.value = '';
          }
          fillDependentSelects();
        });
      }
      var variantEl = document.getElementById('tx-variant');
      var locationEl = document.getElementById('tx-location');
      if (variantEl) {
        variantEl.addEventListener('change', function () {
          priceManual = false;
          applySuggestedPrice();
          updateStockHint();
        });
      }
      if (locationEl) {
        locationEl.addEventListener('change', updateStockHint);
      }

      ['tx-quantity', 'tx-price', 'tx-paid', 'tx-payment-type'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) {
          return;
        }
        el.addEventListener('input', function () {
          if (id === 'tx-price') {
            priceManual = true;
          }
          if (id === 'tx-paid') {
            paidManual = true;
          }
          syncTotals({ fromPaid: id === 'tx-paid' });
        });
        el.addEventListener('change', function () {
          if (id === 'tx-payment-type') {
            paidManual = false;
          }
          syncTotals();
        });
      });

      setupFormLookups();
      warmLookups().then(function () {
        handleReturnFromParty();
      });
      ensureStockIndex();

      var form = document.getElementById('tx-form');
      global.MBMS_UI.bindReset(form, document.getElementById('tx-reset'), function () {
        priceManual = false;
        paidManual = false;
        setupFormLookups();
        updateStockHint();
      });

      var modalEl = document.getElementById('txModal');
      if (modalEl) {
        modalEl.addEventListener('show.bs.modal', function () {
          defaultFormMeta();
          if (!(document.getElementById('tx-date') || {}).value) {
            document.getElementById('tx-date').value = todayIso();
          }
          syncTotals({ keepPaid: true });
          updateStockHint();
        });
      }

      global.MBMS_UI.bindForm(form, {
        onSubmit: function (values) {
          var category = lockedCategory() || values.category;
          var product = global.MBMS_CATALOG.products(category).filter(function (row) {
            return String(row.id) === String(values.product);
          })[0];
          var variant = global.MBMS_CATALOG.variants(category, values.product).filter(function (row) {
            return String(row.id) === String(values.variant);
          })[0];
          var workLocationId = (global.MBMS_CONFIG && global.MBMS_CONFIG.getLocationId)
            ? global.MBMS_CONFIG.getLocationId()
            : values.location;
          if (workLocationId) {
            values.location = workLocationId;
          }

          var qty = num(values.quantity);
          var price = num(values.price);
          if (!(qty > 0)) {
            throw {
              message: 'Enter a quantity greater than zero.',
              errors: { quantity: ['Quantity must be greater than zero'] }
            };
          }
          if (price < 0) {
            throw {
              message: 'Price cannot be negative.',
              errors: { price: ['Price cannot be negative'] }
            };
          }

          if (isSales() && global.MBMS_API && typeof global.MBMS_API.stockAtLocation === 'function') {
            var available = global.MBMS_API.stockAtLocation(values.variant, values.location);
            if (qty > Number(available.qty || 0)) {
              var unit = available.unit ? (' ' + available.unit) : '';
              var place = available.location || 'this location';
              throw {
                message: 'You do not have this quantity in stock. Available: ' + available.qty + unit + ' in ' + place + '.',
                errors: { quantity: ['Only ' + available.qty + unit + ' available in ' + place] }
              };
            }
          }

          var total = roundMoney(qty * price);
          var paid = values.paid === '' || values.paid == null ? 0 : num(values.paid);
          if (values.payment_type === 'cash' && paid <= 0) {
            paid = total;
          }
          var remaining = roundMoney(Math.max(0, total - paid));

          var record = {
            id: 'local-' + Date.now(),
            category: category,
            product: product ? product.name : values.product,
            variant: variant ? variant.label : values.variant,
            variant_id: values.variant,
            quantity: qty,
            price: price,
            total: total,
            paid: paid,
            remaining: remaining,
            payment_type: values.payment_type || (remaining > 0 ? 'credit' : 'cash'),
            date: values.date || todayIso(),
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
                  ? 'Sale saved. Opening the invoice for print or WhatsApp.'
                  : 'Purchase saved. Stock, supplier balance, and dashboard totals were updated.')
                : 'API not connected. Sample record only. Stock was not changed in the browser.'
            });
            form.reset();
            form.classList.remove('was-validated');
            priceManual = false;
            paidManual = false;
            setupFormLookups();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('txModal')).hide();
            var partyPath = isSales() ? 'customers' : 'suppliers';
            return Promise.all([
              global.MBMS_RECORDS.fetchOrMock(partyPath, function () { return []; }).catch(function () { return null; }),
              refreshCatalogAfterTrade()
            ]).then(function () {
              return load();
            }).then(function () {
              if (isSales() && result.source === 'api' && saved.id) {
                openBill(saved.id);
              }
            });
          });
        }
      });

      load();
    }
  };
})(window);
