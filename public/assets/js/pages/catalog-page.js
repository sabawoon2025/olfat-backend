/**
 * Shared catalog UI for Tea, Rice, and Detergents.
 * Supports product + variant create, then purchase/sale against real variants.
 */
(function (global) {
  'use strict';

  var config = {
    tea: {
      title: 'Tea',
      itemLabel: 'Tea type',
      collection: 'types',
      endpoint: 'tea',
      mockKey: 'tea',
      variantLabel: 'Bag size',
      showBags: true,
      showRemaining: true,
      addLabel: 'Add tea type',
      creditNote: 'Tea can be sold for cash or on credit. Official remaining debt comes from Laravel.',
      defaultVariants: [
        { label: '20kg', package_qty: 20, base_unit: 'kg' },
        { label: '30kg', package_qty: 30, base_unit: 'kg' },
        { label: '35kg', package_qty: 35, base_unit: 'kg' },
        { label: '50kg', package_qty: 50, base_unit: 'kg' },
        { label: '68kg', package_qty: 68, base_unit: 'kg' }
      ]
    },
    rice: {
      title: 'Rice',
      itemLabel: 'Rice type',
      collection: 'types',
      endpoint: 'rice',
      mockKey: 'rice',
      variantLabel: 'Bag size',
      showBags: true,
      showRemaining: true,
      addLabel: 'Add rice type',
      creditNote: 'Rice may be sold for cash or credit. Official balances stay on Laravel.',
      defaultVariants: [
        { label: '20kg', package_qty: 20, base_unit: 'kg' },
        { label: '24.5kg', package_qty: 24.5, base_unit: 'kg' },
        { label: '25kg', package_qty: 25, base_unit: 'kg' },
        { label: '40kg', package_qty: 40, base_unit: 'kg' },
        { label: '50kg', package_qty: 50, base_unit: 'kg' }
      ]
    },
    detergents: {
      title: 'Detergents',
      itemLabel: 'Detergent',
      collection: 'products',
      endpoint: 'detergents',
      mockKey: 'detergents',
      variantLabel: 'Unit',
      showBags: false,
      showRemaining: true,
      addLabel: 'Add detergent',
      creditNote: 'Optional customer credit is supported. Official balances stay on Laravel.',
      defaultVariants: [
        { label: '1 unit', package_qty: 1, base_unit: 'piece' },
        { label: '1kg', package_qty: 1, base_unit: 'kg' },
        { label: '500g', package_qty: 500, base_unit: 'g' },
        { label: '1 box', package_qty: 1, base_unit: 'box' }
      ]
    }
  };

  function currentConfig() {
    return config[document.body.getAttribute('data-catalog')] || config.tea;
  }

  function mockRoot() {
    var key = currentConfig().mockKey;
    return (global.MBMS_MOCK && global.MBMS_MOCK[key]) || {};
  }

  function itemsFrom(data) {
    var cfg = currentConfig();
    if (data && data[cfg.collection]) {
      return data[cfg.collection];
    }
    return mockRoot()[cfg.collection] || [];
  }

  function sizesFrom(data) {
    var root = data || mockRoot();
    if (currentConfig().mockKey === 'detergents') {
      return [];
    }
    return root.sizes || [];
  }

  function unitsFor(product) {
    return (product && product.units) || [];
  }

  function variantsFor(itemId, data) {
    var variants = (data && data.variants) || mockRoot().variants || [];
    return variants.filter(function (row) {
      return String(row.type_id) === String(itemId) || String(row.product_id) === String(itemId);
    });
  }

  function variantName(row, data) {
    if (row.label) {
      return row.label;
    }
    if (row.size_id) {
      var size = sizesFrom(data).filter(function (item) { return item.id === row.size_id; })[0];
      return size ? size.label : row.size_id;
    }
    if (row.unit_id) {
      return row.unit_id;
    }
    return row.label || 'Variant';
  }

  function findItem(id, data) {
    return itemsFrom(data).filter(function (item) { return String(item.id) === String(id); })[0] || null;
  }

  function matchSearch(item, query) {
    if (!query) {
      return true;
    }
    return String(item.name || '').toLowerCase().indexOf(query) !== -1;
  }

  function belongsToProduct(row, item) {
    if (!row || !item) {
      return false;
    }
    if (row.product_id && String(row.product_id) === String(item.id)) {
      return true;
    }
    if (row.type_id && String(row.type_id) === String(item.id)) {
      return true;
    }
    if (row.product && item.name && String(row.product) === String(item.name)) {
      return true;
    }
    var variantIds = variantsFor(item.id, mockRoot()).map(function (v) { return String(v.id); });
    if (row.variant_id && variantIds.indexOf(String(row.variant_id)) !== -1) {
      return true;
    }
    return false;
  }

  function renderList(data, source) {
    var cfg = currentConfig();
    var query = (document.getElementById('module-search') || {}).value || '';
    query = query.toLowerCase().trim();
    var filter = (document.getElementById('module-filter') || {}).value || '';
    var status = (document.getElementById('module-status') || {}).value || '';
    var rows = itemsFrom(data).filter(function (item) {
      if (!matchSearch(item, query)) {
        return false;
      }
      if (filter && String(item.id) !== String(filter)) {
        return false;
      }
      if (status === 'active' && !isActiveProduct(item)) {
        return false;
      }
      if (status === 'inactive' && isActiveProduct(item)) {
        return false;
      }
      return true;
    });

    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('module-filter'),
      itemsFrom(data),
      function (item) { return item.id; },
      function (item) { return item.name; },
      filter,
      'All types'
    );

    var activeCount = rows.filter(isActiveProduct).length;
    var variantCount = rows.reduce(function (sum, item) {
      return sum + variantsFor(item.id, data).length;
    }, 0);
    var inStockCount = rows.filter(function (item) {
      return variantsFor(item.id, data).some(variantHasStock);
    }).length;
    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      {
        icon: catalogIcon(cfg),
        label: cfg.title,
        value: rows.length,
        tone: 'primary'
      },
      { icon: 'bi-check-circle', label: 'Active', value: activeCount, tone: 'success' },
      { icon: 'bi-box-seam', label: cfg.showBags ? 'Bag sizes' : 'Variants', value: variantCount, tone: 'accent' },
      { icon: 'bi-layers', label: 'In stock', value: inStockCount, tone: inStockCount ? 'info' : 'warning' }
    ]);

    var body = document.getElementById('catalog-list-body');
    global.MBMS_RECORDS.renderTable(body, rows, [
      {
        render: function (item) {
          var active = isActiveProduct(item);
          var badge = active
            ? '<span class="badge text-bg-success ms-1">Active</span>'
            : '<span class="badge text-bg-secondary ms-1">Inactive</span>';
          return '<strong>' + global.MBMS_UTILS.escapeHtml(item.name || '') + '</strong>' + badge;
        }
      },
      {
        render: function (item) {
          return variantsFor(item.id, data).map(function (row) {
            return '<span class="mbms-chip me-1">' + global.MBMS_UTILS.escapeHtml(variantName(row, data)) + '</span>';
          }).join('') || '<span class="text-secondary">No bag sizes yet</span>';
        }
      },
      {
        render: function (item) {
          var variants = variantsFor(item.id, data);
          if (!variants.length) {
            return '—';
          }
          return variants.map(function (row) {
            var label = variantName(row, data);
            return '<span class="d-inline-flex align-items-center gap-1 me-2 mb-1">' +
              '<span class="text-secondary small">' + global.MBMS_UTILS.escapeHtml(label) + '</span>' +
              stockPill(row.stock_display) +
              '</span>';
          }).join('');
        }
      },
      {
        render: function (item) {
          return global.MBMS_RECORDS.actionButton('?id=' + encodeURIComponent(item.id), 'Open', 'bi-box-arrow-up-right');
        }
      }
    ], 'No ' + cfg.title.toLowerCase() + ' records yet. Add a type to start purchasing stock.');

    if (body) {
      global.MBMS_UTILS.qsa('tr', body).forEach(function (tr, index) {
        var item = rows[index];
        if (!item) {
          return;
        }
        tr.classList.add('mbms-catalog-row');
        tr.addEventListener('click', function (event) {
          if (event.target.closest('a, button')) {
            return;
          }
          global.location.search = '?id=' + encodeURIComponent(item.id);
        });
      });
    }
  }

  function renderHistoryTables(item, purchases, sales) {
    global.MBMS_RECORDS.renderTable(document.getElementById('purchase-history-body'), purchases, [
      { key: 'date' }, { key: 'supplier' }, { key: 'variant' }, { key: 'quantity' }, { key: 'total' }, { key: 'location' }
    ], 'No purchases yet for this product.');
    global.MBMS_RECORDS.renderTable(document.getElementById('sales-history-body'), sales, [
      { key: 'date' }, { key: 'customer' }, { key: 'variant' }, { key: 'quantity' }, { key: 'total' }, { key: 'payment_type' }
    ], 'No sales yet for this product.');

    var history = purchases.map(function (row) {
      return Object.assign({ history_type: 'Purchase', party: row.supplier }, row);
    }).concat(sales.map(function (row) {
      return Object.assign({ history_type: 'Sale', party: row.customer }, row);
    }));
    global.MBMS_RECORDS.renderTable(document.getElementById('all-history-body'), history, [
      { key: 'date' }, { key: 'history_type' }, { key: 'party' }, { key: 'quantity' }, { key: 'total' }
    ], 'No history yet.');
  }

  function loadProductHistory(item) {
    renderHistoryTables(item, [], []);
    var historyParams = { product_id: item.id, per_page: 100 };
    return Promise.all([
      global.MBMS_RECORDS.fetchOrMock('purchases', function () { return []; }, historyParams),
      global.MBMS_RECORDS.fetchOrMock('sales', function () { return []; }, historyParams)
    ]).then(function (results) {
      var purchases = ((results[0] && results[0].data) || []).filter(function (row) {
        return belongsToProduct(row, item);
      });
      var sales = ((results[1] && results[1].data) || []).filter(function (row) {
        return belongsToProduct(row, item);
      });
      renderHistoryTables(item, purchases, sales);
    }).catch(function () {
      renderHistoryTables(item, [], []);
    });
  }

  function warmParties() {
    return Promise.all([
      global.MBMS_RECORDS.fetchOrMock('suppliers', function () { return []; }),
      global.MBMS_RECORDS.fetchOrMock('customers', function () { return []; })
    ]).catch(function () {
      return null;
    });
  }

  function isActiveProduct(item) {
    return item && item.is_active !== false && item.is_active !== 0 && item.is_active !== '0';
  }

  function parseStockQty(display) {
    var match = String(display || '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function variantHasStock(row) {
    return parseStockQty(row && row.stock_display) > 0;
  }

  function formatVariantLabel(qty, unit) {
    var n = Number(qty);
    var u = String(unit || 'kg').trim() || 'kg';
    if (!qty && qty !== 0) {
      return '';
    }
    if (Number.isFinite(n) && Math.abs(n - Math.round(n)) < 0.0001) {
      return String(Math.round(n)) + u;
    }
    return String(qty) + u;
  }

  function stockPill(display) {
    var qty = parseStockQty(display);
    var cls = qty > 0 ? 'is-ok' : 'is-empty';
    var text = display || '0';
    return '<span class="mbms-stock-pill ' + cls + '">' + global.MBMS_UTILS.escapeHtml(text) + '</span>';
  }

  function numInput(value) {
    var n = Number(String(value == null ? '' : value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }

  function roundMoney(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function syncDetailActions(item) {
    var toggle = document.getElementById('toggle-product-active');
    if (toggle) {
      var active = isActiveProduct(item);
      toggle.innerHTML = active
        ? '<i class="bi bi-pause-circle" aria-hidden="true"></i> Deactivate'
        : '<i class="bi bi-play-circle" aria-hidden="true"></i> Activate';
      toggle.className = active ? 'btn btn-outline-danger' : 'btn btn-outline-success';
      toggle.dataset.active = active ? '1' : '0';
    }
    var purchaseBtn = document.querySelector('[data-bs-target="#purchaseModal"]');
    var saleBtn = document.querySelector('[data-bs-target="#saleModal"]');
    if (purchaseBtn) {
      purchaseBtn.disabled = !isActiveProduct(item);
    }
    if (saleBtn) {
      saleBtn.disabled = !isActiveProduct(item);
    }
  }

  function openEditProduct(item, data) {
    var form = document.getElementById('product-form');
    var title = document.getElementById('product-modal-title');
    var variantsWrap = document.getElementById('product-variants-wrap');
    var idInput = document.getElementById('product-id');
    var activeInput = document.getElementById('product-active');
    if (!form) {
      return;
    }
    form.reset();
    form.classList.remove('was-validated');
    if (idInput) {
      idInput.value = item.id;
    }
    document.getElementById('product-name').value = item.name || '';
    document.getElementById('product-notes').value = item.notes || item.description || '';
    if (activeInput) {
      activeInput.checked = isActiveProduct(item);
    }
    if (title) {
      global.MBMS_UTILS.setIconHeading(title, 'bi-pencil', 'Edit ' + (currentConfig().itemLabel || 'product'));
    }
    var saveBtn = document.getElementById('product-save-btn');
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i> Save changes';
    }
    if (variantsWrap) {
      variantsWrap.hidden = true;
      global.MBMS_UTILS.qsa('#product-variants-list input, #product-variants-list select, #product-variants-list button').forEach(function (el) {
        el.disabled = true;
        el.required = false;
      });
    }
    var existing = document.getElementById('product-existing-variants');
    if (existing) {
      var labels = variantsFor(item.id, data).map(function (row) {
        return global.MBMS_UTILS.escapeHtml(variantName(row, data));
      });
      existing.hidden = false;
      var sizeNoun = currentConfig().showBags ? 'bag sizes' : 'units';
      existing.innerHTML = labels.length
        ? '<div class="mbms-form-section-title"><i class="bi bi-box-seam" aria-hidden="true"></i> Current ' + sizeNoun + '</div><div>' +
          labels.map(function (label) { return '<span class="mbms-chip me-1">' + label + '</span>'; }).join('') +
          '</div><p class="mbms-help mb-0 mt-2">' + (currentConfig().showBags ? 'Bag sizes' : 'Units') +
          ' are fixed after create. Use Purchase / Sale against these.</p>'
        : '<p class="mbms-help mb-0">No ' + sizeNoun + ' yet.</p>';
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).show();
  }

  function openCreateProduct() {
    var form = document.getElementById('product-form');
    var title = document.getElementById('product-modal-title');
    var variantsWrap = document.getElementById('product-variants-wrap');
    var idInput = document.getElementById('product-id');
    var activeInput = document.getElementById('product-active');
    var existing = document.getElementById('product-existing-variants');
    if (form) {
      form.reset();
      form.classList.remove('was-validated');
    }
    if (idInput) {
      idInput.value = '';
    }
    if (activeInput) {
      activeInput.checked = true;
    }
    if (title) {
      var createCfg = currentConfig();
      global.MBMS_UTILS.setIconHeading(title, catalogIcon(createCfg), createCfg.addLabel || 'Add product');
    }
    var saveBtn = document.getElementById('product-save-btn');
    if (saveBtn) {
      var saveLabel = currentConfig().mockKey === 'tea'
        ? 'Save tea type'
        : (currentConfig().mockKey === 'rice' ? 'Save rice type' : 'Save detergent');
      saveBtn.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i> ' + saveLabel;
    }
    if (variantsWrap) {
      variantsWrap.hidden = false;
      global.MBMS_UTILS.qsa('#product-variants-list input, #product-variants-list select').forEach(function (el) {
        el.disabled = false;
        if (el.name === 'variant_label' || el.name === 'variant_unit') {
          el.required = true;
        }
      });
      global.MBMS_UTILS.qsa('#product-variants-list button').forEach(function (el) {
        el.disabled = false;
      });
    }
    if (existing) {
      existing.hidden = true;
      existing.innerHTML = '';
    }
    fillDefaultVariants();
  }

  function renderDetail(item, data, source) {
    var cfg = currentConfig();
    global.MBMS_UTILS.setIconHeading(document.getElementById('detail-title'), catalogIcon(cfg), item.name);
    var noteEl = document.getElementById('detail-note');
    if (noteEl) {
      noteEl.textContent = isActiveProduct(item)
        ? (item.example || item.notes || 'Ready for purchase and sale')
        : 'Inactive — hidden from new purchases and sales';
    }
    syncDetailActions(item);
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);

    var variants = variantsFor(item.id, data);
    var inStock = variants.filter(variantHasStock).length;
    global.MBMS_RECORDS.renderSummary(document.getElementById('detail-summary'), [
      { icon: 'bi-box-seam', label: 'Bag sizes', value: variants.length, tone: 'accent' },
      { icon: 'bi-layers', label: 'In stock', value: inStock, tone: inStock ? 'success' : 'warning' },
      {
        icon: isActiveProduct(item) ? 'bi-check-circle' : 'bi-pause-circle',
        label: 'Status',
        value: isActiveProduct(item) ? 'Active' : 'Inactive',
        tone: isActiveProduct(item) ? 'success' : 'muted'
      }
    ]);

    var stockHost = document.getElementById('variant-stock');
    stockHost.innerHTML = variants.length
      ? variants.map(function (row) {
          var tone = variantHasStock(row) ? 'is-sales' : 'is-warning';
          return (
            '<div class="col-6 col-lg-3">' +
            '<article class="mbms-card card mbms-stat-card ' + tone + '"><div class="card-body">' +
            '<div class="mbms-stat-label">' + global.MBMS_UTILS.escapeHtml(variantName(row, data)) + '</div>' +
            '<div class="mbms-stat-value">' + global.MBMS_UTILS.escapeHtml(row.stock_display || '—') + '</div>' +
            '</div></article></div>'
          );
        }).join('')
      : '<div class="col-12"><p class="text-secondary mb-0">No bag sizes yet. Edit this tea type after creating variants, or add stock via Purchase once sizes exist.</p></div>';

    global.MBMS_RECORDS.renderTable(document.getElementById('variants-body'), variants, [
      { render: function (row) { return global.MBMS_UTILS.escapeHtml(variantName(row, data)); } },
      {
        render: function (row) {
          return stockPill(row.stock_display);
        }
      },
      { render: function () { return '<span class="badge text-bg-success">Live</span>'; } }
    ], 'No variants yet.');

    setupForms(item, data);
    warmParties().then(function () {
      setupForms(item, data);
    });
    loadProductHistory(item);
  }

  function setupForms(item, data) {
    var cfg = currentConfig();
    document.getElementById('purchase-item-label').textContent = item.name;
    document.getElementById('sale-item-label').textContent = item.name;
    global.MBMS_UTILS.qsa('[data-bags-field]').forEach(function (el) {
      el.hidden = !cfg.showBags;
    });
    global.MBMS_UTILS.qsa('[data-remaining-field]').forEach(function (el) {
      el.hidden = !cfg.showRemaining;
    });
    document.getElementById('sale-credit-note').textContent = cfg.creditNote;

    var variantLabel = cfg.variantLabel;
    global.MBMS_UTILS.qsa('label[for="purchase-variant"], label[for="sale-variant"]').forEach(function (label) {
      label.textContent = variantLabel;
    });
    var variantOptions = variantsFor(item.id, data).map(function (row) {
      return { id: row.id, label: variantName(row, data) };
    });
    if (!variantOptions.length) {
      variantOptions = unitsFor(item);
    }
    global.MBMS_RECORDS.fillSelect(document.getElementById('purchase-variant'), variantOptions, function (row) { return row.id; }, function (row) { return row.label; });
    global.MBMS_RECORDS.fillSelect(document.getElementById('sale-variant'), variantOptions, function (row) { return row.id; }, function (row) { return row.label; });
    global.MBMS_RECORDS.fillSelect(document.getElementById('purchase-supplier'), global.MBMS_CATALOG.suppliers(), function (row) { return row.id; }, function (row) { return row.name; });
    global.MBMS_RECORDS.fillSelect(document.getElementById('sale-customer'), global.MBMS_CATALOG.customers(), function (row) { return row.id; }, function (row) { return row.name; });
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('purchase-location'));
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('sale-location'));

    var today = new Date();
    var iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    var purchaseDate = document.getElementById('purchase-date');
    var saleDate = document.getElementById('sale-date');
    if (purchaseDate && !purchaseDate.value) {
      purchaseDate.value = iso;
    }
    if (saleDate && !saleDate.value) {
      saleDate.value = iso;
    }
    bindTradeCalculators(data);
  }

  function catalogIcon(cfg) {
    cfg = cfg || currentConfig();
    if (cfg.mockKey === 'tea') {
      return 'bi-cup-hot';
    }
    if (cfg.mockKey === 'rice') {
      return 'bi-basket';
    }
    return 'bi-droplet';
  }

  function variantRowHtml(variant) {
    var cfg = currentConfig();
    var defaultUnit = cfg.mockKey === 'detergents' ? 'piece' : 'kg';
    variant = variant || { label: '', package_qty: '', base_unit: defaultUnit };
    var unit = variant.base_unit || defaultUnit;
    var units = ['kg', 'g', 'piece', 'bag', 'box'];
    if (units.indexOf(unit) === -1) {
      units.push(unit);
    }
    var unitOptions = units.map(function (u) {
      return '<option value="' + global.MBMS_UTILS.escapeHtml(u) + '"' + (u === unit ? ' selected' : '') + '>' +
        global.MBMS_UTILS.escapeHtml(u) + '</option>';
    }).join('');
    var labelTitle = cfg.showBags ? 'Bag size label' : 'Unit label';
    var removeLabel = cfg.showBags ? 'Remove bag size' : 'Remove unit';
    return (
      '<div class="mbms-variant-card product-variant-row" data-preset-key="' +
      global.MBMS_UTILS.escapeHtml(String(variant.package_qty != null ? variant.package_qty : '') + '|' + unit) + '">' +
      '<div class="row g-2 align-items-end">' +
      '<div class="col-12 col-sm-4"><label class="form-label mb-1">' + global.MBMS_UTILS.escapeHtml(labelTitle) + '</label>' +
      '<input class="form-control" name="variant_label" value="' + global.MBMS_UTILS.escapeHtml(variant.label || '') +
      '" required placeholder="' + (cfg.showBags ? 'e.g. 20kg' : 'e.g. 1 unit') + '" autocomplete="off"></div>' +
      '<div class="col-5 col-sm-3"><label class="form-label mb-1">Quantity</label>' +
      '<input class="form-control" name="variant_qty" type="number" step="0.01" min="0.01" inputmode="decimal" value="' +
      global.MBMS_UTILS.escapeHtml(String(variant.package_qty != null ? variant.package_qty : '')) +
      '" placeholder="' + (cfg.showBags ? '20' : '1') + '"></div>' +
      '<div class="col-5 col-sm-3"><label class="form-label mb-1">Unit</label>' +
      '<select class="form-select" name="variant_unit" required>' + unitOptions + '</select></div>' +
      '<div class="col-2 col-sm-2 d-grid">' +
      '<button type="button" class="btn btn-outline-danger product-variant-remove" aria-label="' +
      global.MBMS_UTILS.escapeHtml(removeLabel) + '">' +
      '<i class="bi bi-trash" aria-hidden="true"></i></button></div>' +
      '</div></div>'
    );
  }

  function syncVariantLabel(row) {
    if (!row) {
      return;
    }
    var labelInput = row.querySelector('[name="variant_label"]');
    var qtyInput = row.querySelector('[name="variant_qty"]');
    var unitInput = row.querySelector('[name="variant_unit"]');
    if (!labelInput || !qtyInput || !unitInput) {
      return;
    }
    if (labelInput.dataset.manual === '1') {
      return;
    }
    var next = formatVariantLabel(qtyInput.value, unitInput.value);
    if (next) {
      labelInput.value = next;
    }
    row.dataset.presetKey = String(qtyInput.value || '') + '|' + String(unitInput.value || 'kg');
  }

  function renderPresetChips() {
    var host = document.getElementById('product-variant-presets');
    var cfg = currentConfig();
    if (!host || !cfg.defaultVariants || !cfg.defaultVariants.length) {
      return;
    }
    host.innerHTML = cfg.defaultVariants.map(function (variant) {
      var key = String(variant.package_qty) + '|' + (variant.base_unit || 'kg');
      return '<button type="button" class="mbms-preset-chip" data-preset-key="' +
        global.MBMS_UTILS.escapeHtml(key) + '" data-qty="' +
        global.MBMS_UTILS.escapeHtml(String(variant.package_qty)) + '" data-unit="' +
        global.MBMS_UTILS.escapeHtml(variant.base_unit || 'kg') + '" data-label="' +
        global.MBMS_UTILS.escapeHtml(variant.label || formatVariantLabel(variant.package_qty, variant.base_unit)) +
        '">' + global.MBMS_UTILS.escapeHtml(variant.label || formatVariantLabel(variant.package_qty, variant.base_unit)) +
        '</button>';
    }).join('');
    syncPresetChipState();
  }

  function syncPresetChipState() {
    var host = document.getElementById('product-variant-presets');
    if (!host) {
      return;
    }
    var selected = {};
    global.MBMS_UTILS.qsa('#product-variants-list .product-variant-row').forEach(function (row) {
      var qty = (row.querySelector('[name="variant_qty"]') || {}).value;
      var unit = (row.querySelector('[name="variant_unit"]') || {}).value || 'kg';
      selected[String(qty) + '|' + unit] = true;
    });
    global.MBMS_UTILS.qsa('.mbms-preset-chip', host).forEach(function (chip) {
      chip.classList.toggle('is-active', !!selected[chip.getAttribute('data-preset-key')]);
    });
    var hint = document.getElementById('product-variants-hint');
    if (hint) {
      var count = Object.keys(selected).length;
      var noun = currentConfig().showBags ? 'bag size' : 'unit';
      hint.textContent = count
        ? count + ' ' + noun + (count === 1 ? '' : 's') + ' selected — saved for stock, purchase, and sale.'
        : 'Select at least one ' + noun + ' before saving.';
    }
  }

  function togglePresetVariant(chip) {
    var list = document.getElementById('product-variants-list');
    if (!list || !chip) {
      return;
    }
    var key = chip.getAttribute('data-preset-key');
    var existing = list.querySelector('.product-variant-row[data-preset-key="' + key + '"]');
    if (existing) {
      var rows = list.querySelectorAll('.product-variant-row');
      if (rows.length <= 1) {
        global.MBMS_UI.notify({ type: 'warning', message: 'Keep at least one bag size.' });
        return;
      }
      existing.remove();
      syncPresetChipState();
      return;
    }
    list.insertAdjacentHTML('beforeend', variantRowHtml({
      label: chip.getAttribute('data-label') || '',
      package_qty: chip.getAttribute('data-qty') || '',
      base_unit: chip.getAttribute('data-unit') || 'kg'
    }));
    syncPresetChipState();
  }

  function fillDefaultVariants() {
    var host = document.getElementById('product-variants-list');
    if (!host) {
      return;
    }
    var cfg = currentConfig();
    var defaults = cfg.defaultVariants || [{ label: '1 unit', package_qty: 1, base_unit: 'piece' }];
    // Start with common sizes/units selected; staff can tap chips to remove extras.
    var starter = cfg.mockKey === 'detergents'
      ? [defaults[0]]
      : defaults.slice(0, Math.min(2, defaults.length));
    host.innerHTML = (starter.length ? starter : defaults).map(variantRowHtml).join('');
    renderPresetChips();
  }

  function collectVariants() {
    var rows = [];
    global.MBMS_UTILS.qsa('#product-variants-list .product-variant-row').forEach(function (row) {
      var label = (row.querySelector('[name="variant_label"]') || {}).value || '';
      var qty = (row.querySelector('[name="variant_qty"]') || {}).value || '';
      var unit = (row.querySelector('[name="variant_unit"]') || {}).value || 'kg';
      label = String(label).trim();
      unit = String(unit).trim() || 'kg';
      if (!label && qty !== '') {
        label = formatVariantLabel(qty, unit);
      }
      if (!label) {
        return;
      }
      var packageQty = qty === '' ? 1 : Number(qty);
      rows.push({
        label: label,
        name: label,
        package_qty: Number.isFinite(packageQty) && packageQty > 0 ? packageQty : 1,
        base_unit: unit,
        package_unit: unit
      });
    });
    return rows;
  }

  function packageQtyForVariant(selectEl, data) {
    if (!selectEl || !selectEl.value) {
      return 0;
    }
    var id = global.MBMS_RECORDS.queryParam('id');
    var variants = variantsFor(id, data);
    var match = variants.filter(function (row) {
      return String(row.id) === String(selectEl.value);
    })[0];
    if (!match) {
      return 0;
    }
    var qty = Number(match.package_qty);
    if (Number.isFinite(qty) && qty > 0) {
      return qty;
    }
    var fromLabel = parseStockQty(match.label || match.name);
    return fromLabel > 0 ? fromLabel : 0;
  }

  function bindTradeCalculators(data) {
    var purchaseForm = document.getElementById('purchase-form');
    var saleForm = document.getElementById('sale-form');

    function syncPurchaseTotals() {
      if (!purchaseForm) {
        return;
      }
      var bagsEl = document.getElementById('purchase-bags');
      var qtyEl = document.getElementById('purchase-quantity');
      var priceEl = document.getElementById('purchase-price');
      var totalEl = document.getElementById('purchase-total');
      var paidEl = document.getElementById('purchase-paid');
      var remainingEl = document.getElementById('purchase-remaining');
      var variantEl = document.getElementById('purchase-variant');
      var bags = numInput(bagsEl && bagsEl.value);
      var packageQty = packageQtyForVariant(variantEl, data);
      if (bagsEl && qtyEl && bags > 0 && packageQty > 0 && document.activeElement !== qtyEl) {
        qtyEl.value = String(roundMoney(bags * packageQty));
      }
      var qty = numInput(qtyEl && qtyEl.value);
      var price = numInput(priceEl && priceEl.value);
      if (totalEl && price > 0 && qty > 0 && document.activeElement !== totalEl) {
        totalEl.value = String(roundMoney(qty * price));
      }
      var total = numInput(totalEl && totalEl.value);
      var paid = numInput(paidEl && paidEl.value);
      if (remainingEl) {
        remainingEl.value = String(roundMoney(Math.max(0, total - paid)));
      }
    }

    function syncSaleTotals() {
      if (!saleForm) {
        return;
      }
      var qtyEl = document.getElementById('sale-quantity');
      var priceEl = document.getElementById('sale-price');
      var totalEl = document.getElementById('sale-total');
      var paidEl = document.getElementById('sale-paid');
      var remainingEl = document.getElementById('sale-remaining');
      var paymentType = document.getElementById('sale-payment-type');
      var qty = numInput(qtyEl && qtyEl.value);
      var price = numInput(priceEl && priceEl.value);
      if (totalEl && price > 0 && qty > 0 && document.activeElement !== totalEl) {
        totalEl.value = String(roundMoney(qty * price));
      }
      var total = numInput(totalEl && totalEl.value);
      if (paymentType && paymentType.value === 'cash' && paidEl && document.activeElement !== paidEl) {
        paidEl.value = String(total);
      }
      var paid = numInput(paidEl && paidEl.value);
      if (remainingEl) {
        remainingEl.value = String(roundMoney(Math.max(0, total - paid)));
      }
    }

    if (purchaseForm && purchaseForm.dataset.calcBound !== '1') {
      purchaseForm.dataset.calcBound = '1';
      ['purchase-bags', 'purchase-quantity', 'purchase-price', 'purchase-total', 'purchase-paid', 'purchase-variant']
        .forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) {
            return;
          }
          el.addEventListener('input', syncPurchaseTotals);
          el.addEventListener('change', syncPurchaseTotals);
        });
    }
    if (saleForm && saleForm.dataset.calcBound !== '1') {
      saleForm.dataset.calcBound = '1';
      ['sale-quantity', 'sale-price', 'sale-total', 'sale-paid', 'sale-payment-type']
        .forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) {
            return;
          }
          el.addEventListener('input', syncSaleTotals);
          el.addEventListener('change', syncSaleTotals);
        });
    }
    syncPurchaseTotals();
    syncSaleTotals();
  }

  function bindProductForm() {
    var form = document.getElementById('product-form');
    var addBtn = document.getElementById('product-add-variant');
    var list = document.getElementById('product-variants-list');
    var presets = document.getElementById('product-variant-presets');
    var cfg = currentConfig();
    var title = document.getElementById('product-modal-title');
    if (title) {
      global.MBMS_UTILS.setIconHeading(title, catalogIcon(cfg), cfg.addLabel || 'Add product');
    }
    var addAction = document.getElementById('add-product');
    if (addAction) {
      global.MBMS_UTILS.setIconHeading(addAction, 'bi-plus-lg', cfg.addLabel || 'Add product');
    }

    if (list) {
      list.addEventListener('click', function (event) {
        var btn = event.target.closest('.product-variant-remove');
        if (!btn) {
          return;
        }
        var rows = list.querySelectorAll('.product-variant-row');
        if (rows.length <= 1) {
          global.MBMS_UI.notify({ type: 'warning', message: 'Keep at least one bag size.' });
          return;
        }
        btn.closest('.product-variant-row').remove();
        syncPresetChipState();
      });

      list.addEventListener('input', function (event) {
        var row = event.target.closest('.product-variant-row');
        if (!row) {
          return;
        }
        if (event.target.name === 'variant_label') {
          event.target.dataset.manual = '1';
          return;
        }
        if (event.target.name === 'variant_qty' || event.target.name === 'variant_unit') {
          var labelInput = row.querySelector('[name="variant_label"]');
          if (labelInput) {
            labelInput.dataset.manual = '';
          }
          syncVariantLabel(row);
          syncPresetChipState();
        }
      });

      list.addEventListener('change', function (event) {
        if (event.target.name === 'variant_unit' || event.target.name === 'variant_qty') {
          var row = event.target.closest('.product-variant-row');
          syncVariantLabel(row);
          syncPresetChipState();
        }
      });
    }

    if (presets) {
      presets.addEventListener('click', function (event) {
        var chip = event.target.closest('.mbms-preset-chip');
        if (!chip) {
          return;
        }
        togglePresetVariant(chip);
      });
    }

    if (addBtn && list) {
      addBtn.addEventListener('click', function () {
        list.insertAdjacentHTML('beforeend', variantRowHtml({ label: '', package_qty: '', base_unit: 'kg' }));
        syncPresetChipState();
      });
    }

    var openBtn = document.getElementById('add-product');
    if (openBtn) {
      openBtn.addEventListener('click', openCreateProduct);
    }

    var editBtn = document.getElementById('edit-product');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        var id = global.MBMS_RECORDS.queryParam('id');
        var data = (global.MBMS_API && global.MBMS_API.getCached)
          ? (global.MBMS_API.getCached(cfg.endpoint) || mockRoot())
          : mockRoot();
        var item = findItem(id, data);
        if (!item) {
          global.MBMS_UI.notify({ type: 'danger', message: 'Product not found.' });
          return;
        }
        openEditProduct(item, data);
      });
    }

    var toggleBtn = document.getElementById('toggle-product-active');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var id = global.MBMS_RECORDS.queryParam('id');
        if (!id) {
          return;
        }
        var makeActive = toggleBtn.dataset.active !== '1';
        var label = makeActive ? 'Activate' : 'Deactivate';
        global.MBMS_UI.confirm({
          title: label + ' product',
          message: makeActive
            ? 'Activate this product so it can be purchased and sold again?'
            : 'Deactivate this product? It will stay in history but hide from new sales and purchases.',
          confirmLabel: label
        }).then(function (ok) {
          if (!ok) {
            return;
          }
          return global.MBMS_RECORDS.submitOrMock('put', 'products/' + encodeURIComponent(id), {
            is_active: makeActive
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? (makeActive ? 'Product activated.' : 'Product deactivated.')
                : 'API not connected.'
            });
            load();
          });
        });
      });
    }

    if (!form) {
      return;
    }

    global.MBMS_UI.bindForm(form, {
      onSubmit: function (values) {
        var editingId = values.id || (document.getElementById('product-id') || {}).value;
        if (editingId) {
          return global.MBMS_RECORDS.submitOrMock('put', 'products/' + encodeURIComponent(editingId), {
            name: values.name,
            description: values.notes || null,
            is_active: !!(document.getElementById('product-active') || {}).checked
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Product updated.' : 'API not connected.'
            });
            bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).hide();
            load();
          });
        }

        var units = collectVariants();
        if (!units.length) {
          throw {
            message: 'Add at least one bag size (variant).',
            errors: { variants: ['At least one bag size is required'] }
          };
        }
        var invalid = units.some(function (unit) {
          return !(Number(unit.package_qty) > 0);
        });
        if (invalid) {
          throw {
            message: 'Each bag size needs a quantity greater than zero.',
            errors: { variants: ['Quantity must be greater than zero'] }
          };
        }
        var record = {
          id: 'local-' + Date.now(),
          name: String(values.name || '').trim(),
          notes: values.notes || '',
          is_active: !!(document.getElementById('product-active') || {}).checked,
          units: units
        };
        return global.MBMS_RECORDS.submitOrMock('post', cfg.endpoint, record).then(function (result) {
          global.MBMS_UI.notify({
            type: result.source === 'api' ? 'success' : 'warning',
            message: result.source === 'api'
              ? (cfg.itemLabel || 'Product') + ' saved. Open Purchase to add stock, then Sale to sell.'
              : 'API not connected. Sample product only.'
          });
          form.reset();
          bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal')).hide();
          var saved = global.MBMS_UTILS.unwrap(result.data) || result.data || {};
          global.location.search = '?id=' + encodeURIComponent(saved.id || record.id);
        });
      }
    });
  }

  function bindForms() {
    var cfg = currentConfig();
    var purchaseForm = document.getElementById('purchase-form');
    var saleForm = document.getElementById('sale-form');

    if (purchaseForm) {
      global.MBMS_UI.bindForm(purchaseForm, {
        onSubmit: function (values) {
          values.id = 'local-' + Date.now();
          values.type_id = global.MBMS_RECORDS.queryParam('id');
          values.product_id = values.type_id;
          values.size_id = values.variant;
          values.unit_id = values.variant;
          return global.MBMS_RECORDS.submitOrMock('post', cfg.endpoint + '/purchases', values, function (body) {
            return global.MBMS_RECORDS.storeSave(cfg.endpoint + '-purchases', body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Purchase saved. Stock updated by Laravel.' : 'API not connected. Saved as a local sample record only.'
            });
            bootstrap.Modal.getOrCreateInstance(document.getElementById('purchaseModal')).hide();
            purchaseForm.reset();
            load();
          });
        }
      });
    }

    if (saleForm) {
      global.MBMS_UI.bindForm(saleForm, {
        onSubmit: function (values) {
          values.id = 'local-' + Date.now();
          values.type_id = global.MBMS_RECORDS.queryParam('id');
          values.product_id = values.type_id;
          values.size_id = values.variant;
          values.unit_id = values.variant;
          return global.MBMS_RECORDS.submitOrMock('post', cfg.endpoint + '/sales', values, function (body) {
            return global.MBMS_RECORDS.storeSave(cfg.endpoint + '-sales', body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Sale saved. Stock and customer balance updated by Laravel.' : 'API not connected. Saved as a local sample record only.'
            });
            bootstrap.Modal.getOrCreateInstance(document.getElementById('saleModal')).hide();
            saleForm.reset();
            load();
          });
        }
      });
    }
  }

  function setMode(detail) {
    document.getElementById('list-view').hidden = !!detail;
    document.getElementById('detail-view').hidden = !detail;
  }

  function load() {
    var cfg = currentConfig();
    var root = document.getElementById('catalog-root');
    var id = global.MBMS_RECORDS.queryParam('id');
    setMode(!!id);
    if (!id) {
      var cached = global.MBMS_API && typeof global.MBMS_API.getCached === 'function'
        ? global.MBMS_API.getCached(cfg.endpoint)
        : null;
      renderList(cached || mockRoot(), cached ? 'api' : undefined);
    }
    return global.MBMS_RECORDS.fetchOrMock(cfg.endpoint, function () { return mockRoot(); })
      .then(function (result) {
        var data = result.data || mockRoot();
        if (id) {
          var item = findItem(id, data);
          if (!item) {
            setMode(false);
            global.MBMS_UI.notify({ type: 'danger', message: 'That record is not available.' });
            renderList(data, result.source);
            return;
          }
          setMode(true);
          renderDetail(item, data, result.source);
        } else {
          setMode(false);
          renderList(data, result.source);
        }
      })
      .catch(function (error) {
        global.MBMS_UI.renderError(root, {
          title: 'Unable to load',
          message: global.MBMS_UTILS.getErrorMessage(error),
          actionLabel: 'Try again',
          onAction: load
        });
      });
  }

  global.MBMS_PAGE = {
    active: document.body.getAttribute('data-page'),
    title: (currentConfig() && currentConfig().title) || 'Catalog',
    onReady: function () {
      var search = document.getElementById('module-search');
      var filter = document.getElementById('module-filter');
      var status = document.getElementById('module-status');
      if (search) {
        search.addEventListener('input', global.MBMS_UTILS.debounce(load, 250));
      }
      if (filter) {
        filter.addEventListener('change', load);
      }
      if (status) {
        status.addEventListener('change', load);
      }
      fillDefaultVariants();
      bindProductForm();
      bindForms();
      load();
    }
  };
})(window);
