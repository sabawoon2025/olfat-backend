/**
 * Reusable Sales and Purchases UI.
 * Sales supports multiple product lines; purchases keep a single-line form.
 */
(function (global) {
  'use strict';

  var priceManual = false;
  var paidManual = false;
  var lineSeq = 0;

  function mode() {
    return document.body.getAttribute('data-transaction') || 'sales';
  }

  function isSales() {
    return mode() === 'sales';
  }

  function usesMultiLines() {
    return !!document.getElementById('tx-lines');
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

  function lineNodes() {
    return Array.prototype.slice.call(document.querySelectorAll('#tx-lines .mbms-sale-line'));
  }

  function workLocationId(fallback) {
    if (global.MBMS_CONFIG && typeof global.MBMS_CONFIG.getLocationId === 'function') {
      var configured = global.MBMS_CONFIG.getLocationId();
      if (configured) {
        return configured;
      }
    }
    return fallback || (document.getElementById('tx-location') || {}).value || '';
  }

  function refreshAutocomplete(root) {
    if (!global.MBMS_AUTOCOMPLETE) {
      return;
    }
    if (root) {
      global.MBMS_AUTOCOMPLETE.enhanceAll(root);
      return;
    }
    ['tx-party', 'tx-product', 'tx-variant'].forEach(function (id) {
      global.MBMS_AUTOCOMPLETE.refresh(document.getElementById(id));
    });
    if (usesMultiLines()) {
      global.MBMS_AUTOCOMPLETE.enhanceAll(document.getElementById('tx-lines'));
    }
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
      var matches = String(row.variant_id) === String(variantId);
      if (!matches && Array.isArray(row.items)) {
        matches = row.items.some(function (item) {
          return String(item.product_variant_id || item.variant_id) === String(variantId);
        });
      }
      if (!matches) {
        return;
      }
      if (!best || String(row.date || '') >= String(best.date || '')) {
        best = row;
      }
    });
    if (!best) {
      return null;
    }
    if (Array.isArray(best.items) && best.items.length) {
      var line = best.items.filter(function (item) {
        return String(item.product_variant_id || item.variant_id) === String(variantId);
      })[0] || best.items[0];
      if (line && line.unit_price_raw != null) {
        return num(line.unit_price_raw);
      }
      if (line && line.unit_price != null) {
        return num(line.unit_price);
      }
    }
    return parsePrice(best);
  }

  function stockFor(variantId, locationId) {
    if (!variantId || !locationId || !global.MBMS_API || typeof global.MBMS_API.stockAtLocation !== 'function') {
      return { qty: null, unit: '', location: '' };
    }
    return global.MBMS_API.stockAtLocation(variantId, locationId);
  }

  function availableStock() {
    var variantId = (document.getElementById('tx-variant') || {}).value || '';
    var locationId = workLocationId();
    return stockFor(variantId, locationId);
  }

  function updateLineStockHint(lineEl) {
    if (!lineEl || !isSales()) {
      return;
    }
    var hint = lineEl.querySelector('[data-line="stock-hint"]');
    var error = lineEl.querySelector('[data-line="stock-error"]');
    var qtyInput = lineEl.querySelector('[data-line="quantity"]');
    var variantId = (lineEl.querySelector('[data-line="variant"]') || {}).value || '';
    var locationId = workLocationId();
    var locationSelect = document.getElementById('tx-location');
    var locationName = '';
    if (locationSelect && locationSelect.selectedIndex >= 0) {
      locationName = locationSelect.options[locationSelect.selectedIndex].textContent || '';
    }
    if (!hint) {
      return;
    }
    if (!variantId || !locationId) {
      hint.textContent = '';
      hint.classList.remove('is-ok', 'is-bad');
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
      hint.textContent = 'Stock checked on save';
      hint.classList.remove('is-ok', 'is-bad');
      return;
    }
    var stock = stockFor(variantId, locationId);
    var qty = stock.qty != null ? stock.qty : 0;
    var unit = stock.unit ? (' ' + stock.unit) : '';
    var place = stock.location || locationName || 'this location';
    hint.textContent = 'Stock in ' + place + ': ' + qty + unit;
    hint.classList.toggle('is-ok', qty > 0);
    hint.classList.toggle('is-bad', qty <= 0);

    var wanted = num(qtyInput && qtyInput.value);
    if (error && qtyInput) {
      if (wanted > 0 && wanted > qty) {
        error.hidden = false;
        error.textContent = 'Only ' + qty + unit + ' available.';
        qtyInput.classList.add('is-invalid');
      } else {
        error.hidden = true;
        error.textContent = '';
        qtyInput.classList.remove('is-invalid');
      }
    }
  }

  function updateStockHint() {
    if (usesMultiLines()) {
      lineNodes().forEach(updateLineStockHint);
      return;
    }
    var hint = document.getElementById('tx-stock-hint');
    var error = document.getElementById('tx-stock-error');
    var qtyInput = document.getElementById('tx-quantity');
    if (!hint || !isSales()) {
      return;
    }
    var variantId = (document.getElementById('tx-variant') || {}).value || '';
    var locationId = workLocationId();
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

  function updateLineTotals(lineEl) {
    if (!lineEl) {
      return 0;
    }
    var qty = num((lineEl.querySelector('[data-line="quantity"]') || {}).value);
    var price = num((lineEl.querySelector('[data-line="price"]') || {}).value);
    var total = roundMoney(qty * price);
    var totalEl = lineEl.querySelector('[data-line="line-total"]');
    var totalDisplay = lineEl.querySelector('[data-line="line-total-display"]');
    var show = qty > 0 && price >= 0;
    if (totalEl) {
      totalEl.value = show ? String(total) : '';
    }
    if (totalDisplay) {
      totalDisplay.textContent = show ? moneyText(total) : '0.00';
    }
    updateLineStockHint(lineEl);
    return show ? total : 0;
  }

  function updateProfitPanel() {
    var panel = document.getElementById('tx-profit-panel');
    if (!panel || !isSales()) {
      return;
    }
    var costEl = document.getElementById('tx-cost-display');
    var profitEl = document.getElementById('tx-profit-display');

    if (usesMultiLines()) {
      var totalCost = 0;
      var totalProfit = 0;
      var priced = 0;
      var withCost = 0;
      lineNodes().forEach(function (lineEl) {
        var variantId = (lineEl.querySelector('[data-line="variant"]') || {}).value || '';
        var qty = num((lineEl.querySelector('[data-line="quantity"]') || {}).value);
        var price = num((lineEl.querySelector('[data-line="price"]') || {}).value);
        if (!variantId || !(price >= 0) || !(qty > 0)) {
          return;
        }
        priced += 1;
        var cost = lastTradePrice(variantId, 'purchase');
        if (cost == null) {
          return;
        }
        withCost += 1;
        totalCost += cost * qty;
        totalProfit += (price - cost) * qty;
      });
      if (!priced) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      if (!withCost) {
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
        costEl.textContent = moneyText(totalCost);
      }
      if (profitEl) {
        profitEl.textContent = moneyText(totalProfit);
        profitEl.className = totalProfit >= 0 ? 'text-success' : 'text-danger';
      }
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
    var totalEl = document.getElementById('tx-total');
    var paidEl = document.getElementById('tx-paid');
    var remainingEl = document.getElementById('tx-remaining');
    var paymentType = document.getElementById('tx-payment-type');
    var total = 0;

    if (usesMultiLines()) {
      lineNodes().forEach(function (lineEl) {
        total = roundMoney(total + updateLineTotals(lineEl));
      });
    } else {
      var qtyEl = document.getElementById('tx-quantity');
      var priceEl = document.getElementById('tx-price');
      var qty = num(qtyEl && qtyEl.value);
      var price = num(priceEl && priceEl.value);
      total = roundMoney(qty * price);
    }

    if (totalEl) {
      totalEl.value = total > 0 || (usesMultiLines() && lineNodes().length) ? String(total) : '';
      if (!usesMultiLines() && !(num((document.getElementById('tx-quantity') || {}).value) > 0)) {
        totalEl.value = '';
      }
    }

    var totalDisplay = document.getElementById('tx-total-display');
    if (totalDisplay) {
      totalDisplay.textContent = moneyText(total);
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

  function applySuggestedPriceForLine(lineEl) {
    if (!lineEl || lineEl.dataset.priceManual === '1') {
      updateLineStockHint(lineEl);
      return;
    }
    var variantId = (lineEl.querySelector('[data-line="variant"]') || {}).value || '';
    var priceEl = lineEl.querySelector('[data-line="price"]');
    if (!variantId || !priceEl) {
      return;
    }
    var last = lastTradePrice(variantId, 'sale');
    if (last != null && last >= 0) {
      priceEl.value = String(last);
      priceEl.dataset.suggested = '1';
    } else {
      priceEl.placeholder = 'Enter selling price';
      if (priceEl.dataset.suggested === '1') {
        priceEl.value = '';
      }
    }
    updateLineTotals(lineEl);
  }

  function applySuggestedPrice() {
    if (usesMultiLines()) {
      lineNodes().forEach(applySuggestedPriceForLine);
      syncTotals({ keepPaid: true });
      return;
    }
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

  function fillLineDependentSelects(lineEl) {
    if (!lineEl) {
      return;
    }
    var category = lockedCategory() || (lineEl.querySelector('[data-line="category"]') || {}).value;
    var productSelect = lineEl.querySelector('[data-line="product"]');
    var variantSelect = lineEl.querySelector('[data-line="variant"]');
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
    refreshAutocomplete(lineEl);
    if (lineEl.dataset.priceManual !== '1') {
      applySuggestedPriceForLine(lineEl);
    }
    updateLineStockHint(lineEl);
  }

  function fillDependentSelects() {
    if (usesMultiLines()) {
      lineNodes().forEach(fillLineDependentSelects);
      syncTotals({ keepPaid: true });
      return;
    }
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

  function renumberLines() {
    lineNodes().forEach(function (lineEl, index) {
      lineEl.dataset.lineIndex = String(index + 1);
      var removeBtn = lineEl.querySelector('[data-line="remove"]');
      if (removeBtn) {
        removeBtn.disabled = lineNodes().length <= 1;
        removeBtn.title = lineNodes().length <= 1 ? 'Clear this product' : 'Remove product';
      }
    });
  }

  function buildLineElement() {
    lineSeq += 1;
    var id = 'line-' + lineSeq;
    var wrap = document.createElement('div');
    wrap.className = 'mbms-sale-line';
    wrap.dataset.lineId = id;
    wrap.innerHTML =
      '<div class="mbms-sale-line-grid">' +
        '<div class="mbms-field">' +
          '<label class="form-label">Category</label>' +
          '<select class="form-select" data-line="category"></select>' +
        '</div>' +
        '<div class="mbms-field">' +
          '<label class="form-label">Product</label>' +
          '<select class="form-select" data-line="product" data-ac="1" data-ac-placeholder="Search product…"></select>' +
        '</div>' +
        '<div class="mbms-field">' +
          '<label class="form-label">Variant</label>' +
          '<select class="form-select" data-line="variant" data-ac="1" data-ac-placeholder="Variant…"></select>' +
        '</div>' +
        '<div class="mbms-field">' +
          '<label class="form-label">Qty</label>' +
          '<input class="form-control" data-line="quantity" inputmode="decimal" min="0.01" step="0.01" placeholder="0">' +
        '</div>' +
        '<div class="mbms-field">' +
          '<label class="form-label">Price</label>' +
          '<input class="form-control" data-line="price" inputmode="decimal" min="0" step="0.01" placeholder="0.00">' +
        '</div>' +
        '<div class="mbms-field">' +
          '<label class="form-label">Total</label>' +
          '<div class="mbms-sale-line-total" data-line="line-total-display">0.00</div>' +
          '<input type="hidden" data-line="line-total" value="">' +
        '</div>' +
        '<div class="mbms-sale-line-actions">' +
          '<button type="button" class="btn btn-outline-danger" data-line="remove" aria-label="Remove product" title="Remove product">' +
            '<i class="bi bi-x-lg" aria-hidden="true"></i>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="mbms-sale-line-meta">' +
        '<span class="mbms-sale-stock" data-line="stock-hint"></span>' +
        '<span class="text-danger small" data-line="stock-error" hidden></span>' +
      '</div>';
    return wrap;
  }

  function fillLineCategory(lineEl) {
    var locked = lockedCategory();
    var categorySelect = lineEl.querySelector('[data-line="category"]');
    global.MBMS_RECORDS.fillSelect(
      categorySelect,
      categories(),
      function (row) { return row.id; },
      function (row) { return row.label; },
      locked || (categorySelect && categorySelect.value) || '',
      'Select category'
    );
    if (locked && categorySelect) {
      categorySelect.value = locked;
      categorySelect.disabled = true;
    }
  }

  function addLine() {
    var container = document.getElementById('tx-lines');
    if (!container) {
      return null;
    }
    var lineEl = buildLineElement();
    container.appendChild(lineEl);
    fillLineCategory(lineEl);
    fillLineDependentSelects(lineEl);
    renumberLines();
    syncTotals({ keepPaid: true });
    return lineEl;
  }

  function resetLines() {
    var container = document.getElementById('tx-lines');
    if (!container) {
      return;
    }
    container.innerHTML = '';
    addLine();
  }

  function removeLine(lineEl) {
    if (!lineEl) {
      return;
    }
    if (lineNodes().length <= 1) {
      lineEl.dataset.priceManual = '';
      ['category', 'product', 'variant', 'quantity', 'price', 'line-total'].forEach(function (key) {
        var el = lineEl.querySelector('[data-line="' + key + '"]');
        if (!el || el.disabled) {
          return;
        }
        el.value = '';
      });
      fillLineCategory(lineEl);
      fillLineDependentSelects(lineEl);
      syncTotals();
      return;
    }
    lineEl.remove();
    renumberLines();
    syncTotals();
  }

  function collectSaleLines() {
    var locationId = workLocationId();
    var seen = {};
    var lines = [];
    var errors = [];

    lineNodes().forEach(function (lineEl, index) {
      var label = 'Product ' + (index + 1);
      var category = lockedCategory() || (lineEl.querySelector('[data-line="category"]') || {}).value || '';
      var productId = (lineEl.querySelector('[data-line="product"]') || {}).value || '';
      var variantId = (lineEl.querySelector('[data-line="variant"]') || {}).value || '';
      var qty = num((lineEl.querySelector('[data-line="quantity"]') || {}).value);
      var price = num((lineEl.querySelector('[data-line="price"]') || {}).value);
      var blank = !category && !productId && !variantId && !(qty > 0) && !(price > 0);

      // Ignore empty extra rows so an unused "Add product" line does not block save.
      if (blank) {
        return;
      }

      var product = global.MBMS_CATALOG.products(category).filter(function (row) {
        return String(row.id) === String(productId);
      })[0];
      var variant = global.MBMS_CATALOG.variants(category, productId).filter(function (row) {
        return String(row.id) === String(variantId);
      })[0];

      if (!category || !productId || !variantId) {
        errors.push(label + ': choose category, product, and variant.');
        return;
      }
      if (!(qty > 0)) {
        errors.push(label + ': quantity must be greater than zero.');
        return;
      }
      if (!(price >= 0) || (lineEl.querySelector('[data-line="price"]') || {}).value === '') {
        errors.push(label + ': enter a selling price.');
        return;
      }
      if (seen[String(variantId)]) {
        errors.push(label + ': this variant is already on another line. Combine quantities instead.');
        return;
      }
      seen[String(variantId)] = true;

      if (global.MBMS_API && typeof global.MBMS_API.stockAtLocation === 'function') {
        var available = stockFor(variantId, locationId);
        if (qty > Number(available.qty || 0)) {
          var unit = available.unit ? (' ' + available.unit) : '';
          var place = available.location || 'this location';
          errors.push(label + ': only ' + available.qty + unit + ' available in ' + place + '.');
          return;
        }
      }

      lines.push({
        category: category,
        product_id: productId,
        product: product ? product.name : productId,
        variant_id: variantId,
        variant: variant ? variant.label : variantId,
        quantity: qty,
        price: price,
        unit_price: price,
        product_variant_id: variantId,
        line_total: roundMoney(qty * price)
      });
    });

    return { lines: lines, errors: errors };
  }

  function filterRows() {
    var search = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var category = lockedCategory() || (document.getElementById('list-category') || {}).value || '';
    var location = (document.getElementById('list-location') || {}).value || '';
    var from = (document.getElementById('date-from') || {}).value || '';
    var to = (document.getElementById('date-to') || {}).value || '';
    return allRows().filter(function (row) {
      var itemText = Array.isArray(row.items)
        ? row.items.map(function (item) {
          return [item.product, item.variant].filter(Boolean).join(' ');
        }).join(' ')
        : '';
      var text = (row.product + ' ' + row.customer + ' ' + row.supplier + ' ' + row.variant + ' ' + itemText + ' ' + (row.payment_type || '')).toLowerCase();
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
    if (!usesMultiLines()) {
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
    }
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
    if (usesMultiLines()) {
      resetLines();
    } else {
      fillDependentSelects();
    }
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

  function bindMultiLineEvents() {
    var lines = document.getElementById('tx-lines');
    var addBtn = document.getElementById('tx-add-line');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        addLine();
      });
    }
    if (!lines) {
      return;
    }
    lines.addEventListener('click', function (event) {
      var removeBtn = event.target.closest('[data-line="remove"]');
      if (removeBtn) {
        removeLine(removeBtn.closest('.mbms-sale-line'));
      }
    });
    lines.addEventListener('change', function (event) {
      var target = event.target;
      var lineEl = target.closest('.mbms-sale-line');
      if (!lineEl) {
        return;
      }
      var role = target.getAttribute('data-line');
      if (role === 'category') {
        var productSelect = lineEl.querySelector('[data-line="product"]');
        var variantSelect = lineEl.querySelector('[data-line="variant"]');
        if (productSelect) {
          productSelect.value = '';
        }
        if (variantSelect) {
          variantSelect.value = '';
        }
        lineEl.dataset.priceManual = '';
        fillLineDependentSelects(lineEl);
        syncTotals();
        return;
      }
      if (role === 'product') {
        var variantOnly = lineEl.querySelector('[data-line="variant"]');
        if (variantOnly) {
          variantOnly.value = '';
        }
        lineEl.dataset.priceManual = '';
        fillLineDependentSelects(lineEl);
        syncTotals();
        return;
      }
      if (role === 'variant') {
        lineEl.dataset.priceManual = '';
        applySuggestedPriceForLine(lineEl);
        syncTotals();
      }
    });
    lines.addEventListener('input', function (event) {
      var target = event.target;
      var lineEl = target.closest('.mbms-sale-line');
      if (!lineEl) {
        return;
      }
      var role = target.getAttribute('data-line');
      if (role === 'price') {
        lineEl.dataset.priceManual = '1';
      }
      if (role === 'quantity' || role === 'price') {
        syncTotals({ fromPaid: false });
      }
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

      if (usesMultiLines()) {
        bindMultiLineEvents();
      } else {
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
        if (variantEl) {
          variantEl.addEventListener('change', function () {
            priceManual = false;
            applySuggestedPrice();
            updateStockHint();
          });
        }
      }

      var locationEl = document.getElementById('tx-location');
      if (locationEl) {
        locationEl.addEventListener('change', function () {
          updateStockHint();
          syncTotals({ keepPaid: true });
        });
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
          var workLoc = workLocationId(values.location);
          if (workLoc) {
            values.location = workLoc;
          }

          if (usesMultiLines()) {
            var collected = collectSaleLines();
            if (collected.errors.length) {
              throw {
                message: collected.errors[0],
                errors: { items: collected.errors }
              };
            }
            if (!collected.lines.length) {
              throw {
                message: 'Add at least one product.',
                errors: { items: ['Add at least one product.'] }
              };
            }

            var multiTotal = roundMoney(collected.lines.reduce(function (sum, line) {
              return sum + line.line_total;
            }, 0));
            var multiPaid = values.paid === '' || values.paid == null ? 0 : num(values.paid);
            if (values.payment_type === 'cash' && multiPaid <= 0) {
              multiPaid = multiTotal;
            }
            if (multiPaid > multiTotal) {
              throw {
                message: 'Paid amount cannot exceed the grand total.',
                errors: { paid: ['Paid amount cannot exceed the grand total.'] }
              };
            }
            var multiRemaining = roundMoney(Math.max(0, multiTotal - multiPaid));
            var first = collected.lines[0];
            var record = {
              id: 'local-' + Date.now(),
              category: first.category,
              product: collected.lines.map(function (line) { return line.product; }).join(', '),
              variant: collected.lines.length > 1
                ? (collected.lines.length + ' items')
                : first.variant,
              variant_id: first.variant_id,
              quantity: collected.lines.length > 1
                ? collected.lines.map(function (line) { return line.quantity; }).join(' + ')
                : first.quantity,
              price: first.price,
              total: multiTotal,
              paid: multiPaid,
              remaining: multiRemaining,
              payment_type: values.payment_type || (multiRemaining > 0 ? 'credit' : 'cash'),
              date: values.date || todayIso(),
              location: values.location,
              location_id: values.location,
              notes: values.notes,
              customer: values.party,
              items: collected.lines.map(function (line) {
                return {
                  product_variant_id: line.product_variant_id,
                  quantity: line.quantity,
                  unit_price: line.unit_price
                };
              })
            };
            return global.MBMS_RECORDS.submitOrMock('post', endpoint(), record, function (body) {
              return global.MBMS_RECORDS.storeSave(storeKey(), body);
            }).then(function (result) {
              var saved = global.MBMS_UTILS.unwrap(result.data) || result.data || {};
              global.MBMS_UI.notify({
                type: result.source === 'api' ? 'success' : 'warning',
                title: result.source === 'api' ? 'Saved' : 'Saved locally',
                message: result.source === 'api'
                  ? 'Sale saved. Opening the invoice for print or WhatsApp.'
                  : 'API not connected. Sample record only. Stock was not changed in the browser.'
              });
              form.reset();
              form.classList.remove('was-validated');
              priceManual = false;
              paidManual = false;
              setupFormLookups();
              bootstrap.Modal.getOrCreateInstance(document.getElementById('txModal')).hide();
              return Promise.all([
                global.MBMS_RECORDS.fetchOrMock('customers', function () { return []; }).catch(function () { return null; }),
                refreshCatalogAfterTrade()
              ]).then(function () {
                return load();
              }).then(function () {
                if (result.source === 'api' && saved.id) {
                  openBill(saved.id);
                }
              });
            });
          }

          var category = lockedCategory() || values.category;
          var product = global.MBMS_CATALOG.products(category).filter(function (row) {
            return String(row.id) === String(values.product);
          })[0];
          var variant = global.MBMS_CATALOG.variants(category, values.product).filter(function (row) {
            return String(row.id) === String(values.variant);
          })[0];

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
