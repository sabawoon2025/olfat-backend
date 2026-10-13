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
      itemLabel: 'Type / quality',
      collection: 'types',
      endpoint: 'rice',
      mockKey: 'rice',
      variantLabel: 'Bag size',
      showBags: true,
      showRemaining: false,
      addLabel: 'Add rice type',
      creditNote: 'Rice may be sold for cash or credit. Official balances stay on Laravel.',
      defaultVariants: [
        { label: '20kg', package_qty: 20, base_unit: 'kg' },
        { label: '24.5kg', package_qty: 24.5, base_unit: 'kg' }
      ]
    },
    detergents: {
      title: 'Detergents',
      itemLabel: 'Product',
      collection: 'products',
      endpoint: 'detergents',
      mockKey: 'detergents',
      variantLabel: 'Unit',
      showBags: false,
      showRemaining: false,
      addLabel: 'Add detergent',
      creditNote: 'Optional customer credit is supported. Official balances stay on Laravel.',
      defaultVariants: [
        { label: '1 unit', package_qty: 1, base_unit: 'piece' }
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
    var rows = itemsFrom(data).filter(function (item) {
      return matchSearch(item, query) && (!filter || String(item.id) === String(filter));
    });

    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('module-filter'),
      itemsFrom(data),
      function (item) { return item.id; },
      function (item) { return item.name; },
      filter,
      'All'
    );

    var body = document.getElementById('catalog-list-body');
    global.MBMS_RECORDS.renderTable(body, rows, [
      { key: 'name' },
      {
        render: function (item) {
          return variantsFor(item.id, data).map(function (row) {
            return '<span class="mbms-chip me-1">' + global.MBMS_UTILS.escapeHtml(variantName(row, data)) + '</span>';
          }).join('') || '<span class="text-secondary">No variants yet</span>';
        }
      },
      {
        render: function (item) {
          var stock = variantsFor(item.id, data).map(function (row) { return row.stock_display; }).filter(Boolean);
          return stock.length ? global.MBMS_UTILS.escapeHtml(stock.join(' · ')) : '—';
        }
      },
      {
        render: function (item) {
          return '<a class="btn btn-sm btn-outline-primary" href="?id=' + encodeURIComponent(item.id) + '">Open</a>';
        }
      }
    ], 'No ' + cfg.title.toLowerCase() + ' records yet. Add a product to start purchasing and selling.');
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
    return Promise.all([
      global.MBMS_RECORDS.fetchOrMock('purchases', function () { return []; }),
      global.MBMS_RECORDS.fetchOrMock('sales', function () { return []; })
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

  function renderDetail(item, data, source) {
    var cfg = currentConfig();
    document.getElementById('detail-title').textContent = item.name;
    document.getElementById('detail-note').textContent = item.example || item.notes || cfg.itemLabel;
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);

    var variants = variantsFor(item.id, data);
    var stockHost = document.getElementById('variant-stock');
    stockHost.innerHTML = variants.length
      ? variants.map(function (row) {
          return (
            '<div class="col-6 col-lg-3">' +
            '<article class="mbms-card card mbms-stat-card"><div class="card-body">' +
            '<div class="mbms-stat-label">' + global.MBMS_UTILS.escapeHtml(variantName(row, data)) + '</div>' +
            '<div class="mbms-stat-value">' + global.MBMS_UTILS.escapeHtml(row.stock_display || '—') + '</div>' +
            '<span class="badge text-bg-secondary">Live stock</span>' +
            '</div></article></div>'
          );
        }).join('')
      : '<div class="col-12"><p class="text-secondary mb-0">No variants yet. Add variants when creating the product, then purchase stock.</p></div>';

    global.MBMS_RECORDS.renderTable(document.getElementById('variants-body'), variants, [
      { render: function (row) { return global.MBMS_UTILS.escapeHtml(variantName(row, data)); } },
      { key: 'stock_display' },
      { render: function () { return '<span class="badge text-bg-secondary">API</span>'; } }
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
  }

  function variantRowHtml(variant) {
    variant = variant || { label: '', package_qty: '', base_unit: 'kg' };
    return (
      '<div class="row g-2 mb-2 product-variant-row align-items-end">' +
      '<div class="col-5"><label class="form-label mb-1">Variant</label>' +
      '<input class="form-control" name="variant_label" value="' + global.MBMS_UTILS.escapeHtml(variant.label || '') + '" required placeholder="e.g. 20kg"></div>' +
      '<div class="col-3"><label class="form-label mb-1">Qty</label>' +
      '<input class="form-control" name="variant_qty" type="number" step="0.01" min="0" value="' + global.MBMS_UTILS.escapeHtml(String(variant.package_qty != null ? variant.package_qty : '')) + '" placeholder="20"></div>' +
      '<div class="col-3"><label class="form-label mb-1">Unit</label>' +
      '<input class="form-control" name="variant_unit" value="' + global.MBMS_UTILS.escapeHtml(variant.base_unit || 'kg') + '" required placeholder="kg"></div>' +
      '<div class="col-1"><button type="button" class="btn btn-outline-danger btn-sm product-variant-remove" aria-label="Remove variant"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>' +
      '</div>'
    );
  }

  function fillDefaultVariants() {
    var host = document.getElementById('product-variants-list');
    if (!host) {
      return;
    }
    var defaults = currentConfig().defaultVariants || [{ label: '1 unit', package_qty: 1, base_unit: 'piece' }];
    host.innerHTML = defaults.map(variantRowHtml).join('');
  }

  function collectVariants() {
    var rows = [];
    global.MBMS_UTILS.qsa('#product-variants-list .product-variant-row').forEach(function (row) {
      var label = (row.querySelector('[name="variant_label"]') || {}).value || '';
      var qty = (row.querySelector('[name="variant_qty"]') || {}).value || '';
      var unit = (row.querySelector('[name="variant_unit"]') || {}).value || 'kg';
      label = String(label).trim();
      if (!label) {
        return;
      }
      rows.push({
        label: label,
        name: label,
        package_qty: qty === '' ? 1 : Number(qty),
        base_unit: String(unit).trim() || 'kg',
        package_unit: String(unit).trim() || 'kg'
      });
    });
    return rows;
  }

  function bindProductForm() {
    var form = document.getElementById('product-form');
    var addBtn = document.getElementById('product-add-variant');
    var list = document.getElementById('product-variants-list');
    var cfg = currentConfig();
    var title = document.getElementById('product-modal-title');
    if (title) {
      title.textContent = cfg.addLabel || 'Add product';
    }
    var addAction = document.getElementById('add-product');
    if (addAction) {
      addAction.textContent = cfg.addLabel || 'Add product';
    }

    if (list) {
      list.addEventListener('click', function (event) {
        var btn = event.target.closest('.product-variant-remove');
        if (!btn) {
          return;
        }
        var rows = list.querySelectorAll('.product-variant-row');
        if (rows.length <= 1) {
          global.MBMS_UI.notify({ type: 'warning', message: 'Keep at least one variant.' });
          return;
        }
        btn.closest('.product-variant-row').remove();
      });
    }

    if (addBtn && list) {
      addBtn.addEventListener('click', function () {
        list.insertAdjacentHTML('beforeend', variantRowHtml({ label: '', package_qty: '', base_unit: 'kg' }));
      });
    }

    var openBtn = document.getElementById('add-product');
    if (openBtn) {
      openBtn.addEventListener('click', function () {
        if (form) {
          form.reset();
          form.classList.remove('was-validated');
        }
        fillDefaultVariants();
      });
    }

    if (!form) {
      return;
    }

    global.MBMS_UI.bindForm(form, {
      onSubmit: function (values) {
        var units = collectVariants();
        if (!units.length) {
          throw {
            message: 'Add at least one variant (bag size or unit).',
            errors: { variants: ['At least one variant is required'] }
          };
        }
        var record = {
          id: 'local-' + Date.now(),
          name: values.name,
          notes: values.notes || '',
          units: units
        };
        return global.MBMS_RECORDS.submitOrMock('post', cfg.endpoint, record).then(function (result) {
          global.MBMS_UI.notify({
            type: result.source === 'api' ? 'success' : 'warning',
            message: result.source === 'api'
              ? 'Product saved. You can now purchase stock and sell it.'
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
      if (search) {
        search.addEventListener('input', global.MBMS_UTILS.debounce(load, 250));
      }
      if (filter) {
        filter.addEventListener('change', load);
      }
      fillDefaultVariants();
      bindProductForm();
      bindForms();
      load();
    }
  };
})(window);
