/**
 * Shared Raw Materials and Factory Materials catalog.
 * Products + purchases go through Laravel; stock and payables stay authoritative there.
 */
(function (global) {
  'use strict';

  var catalogCache = null;

  function isRaw() {
    return document.body.getAttribute('data-material') !== 'factory';
  }

  function endpoint() {
    return isRaw() ? 'raw-materials' : 'factory-materials';
  }

  function pageIcon() {
    return isRaw() ? 'bi-layers' : 'bi-gear-wide-connected';
  }

  function itemLabel() {
    return isRaw() ? 'Raw material' : 'Factory material';
  }

  function unitNoun() {
    return isRaw() ? 'bag sizes' : 'units';
  }

  function defaultPresets() {
    return isRaw()
      ? [
          { label: '170kg', package_qty: 170, base_unit: 'kg' },
          { label: '220kg', package_qty: 220, base_unit: 'kg' }
        ]
      : [
          { label: 'Piece', package_qty: 1, base_unit: 'piece' },
          { label: 'Roll', package_qty: 1, base_unit: 'roll' },
          { label: 'Box', package_qty: 1, base_unit: 'box' },
          { label: 'Carton', package_qty: 1, base_unit: 'carton' }
        ];
  }

  function seedItems() {
    return isRaw()
      ? ((global.MBMS_MOCK && global.MBMS_MOCK.rawMaterials) || [])
      : ((global.MBMS_MOCK && global.MBMS_MOCK.factoryMaterials) || []);
  }

  function num(value) {
    var n = Number(String(value == null ? '' : value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }

  function roundMoney(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function itemsFrom(data) {
    if (Array.isArray(data)) {
      return data;
    }
    return seedItems();
  }

  function findItem(id, data) {
    return itemsFrom(data).filter(function (row) {
      return String(row.id) === String(id);
    })[0] || null;
  }

  function variantsFor(item) {
    if (!item) {
      return [];
    }
    if (Array.isArray(item.variants) && item.variants.length) {
      return item.variants;
    }
    return (item.units || []).map(function (unit) {
      return {
        id: unit.id,
        label: unit.label || unit.name || '',
        name: unit.label || unit.name || '',
        package_qty: unit.package_qty,
        base_unit: unit.base_unit || (isRaw() ? 'kg' : 'piece'),
        stock_display: unit.stock_display || '0'
      };
    });
  }

  function variantLabel(row) {
    return row.label || row.name || 'Unit';
  }

  function isActiveProduct(item) {
    return item && item.is_active !== false && item.is_active !== 0 && item.is_active !== '0';
  }

  function parseStockQty(display) {
    var match = String(display || '').match(/-?\d+(?:\.\d+)?/);
    return match ? num(match[0]) : 0;
  }

  function variantHasStock(row) {
    return parseStockQty(row.stock_display) > 0;
  }

  function stockPill(display) {
    var qty = parseStockQty(display);
    var cls = qty > 0 ? 'text-bg-success' : 'text-bg-secondary';
    return '<span class="badge ' + cls + '">' + global.MBMS_UTILS.escapeHtml(display || '0') + '</span>';
  }

  function setMode(detail) {
    document.getElementById('list-view').hidden = !!detail;
    document.getElementById('detail-view').hidden = !detail;
  }

  function formatVariantLabel(qty, unit) {
    if (qty === '' || qty == null) {
      return unit || '';
    }
    return String(qty) + (unit || '');
  }

  function unitRowHtml(variant) {
    variant = variant || { label: '', package_qty: '', base_unit: isRaw() ? 'kg' : 'piece' };
    var unit = variant.base_unit || (isRaw() ? 'kg' : 'piece');
    var units = isRaw()
      ? ['kg', 'g', 'bag']
      : ['piece', 'roll', 'box', 'carton', 'pack', 'kg'];
    if (units.indexOf(unit) === -1) {
      units.push(unit);
    }
    var unitOptions = units.map(function (u) {
      return '<option value="' + global.MBMS_UTILS.escapeHtml(u) + '"' + (u === unit ? ' selected' : '') + '>' +
        global.MBMS_UTILS.escapeHtml(u) + '</option>';
    }).join('');
    return (
      '<div class="mbms-variant-card product-variant-row" data-preset-key="' +
      global.MBMS_UTILS.escapeHtml(String(variant.package_qty != null ? variant.package_qty : '') + '|' + unit) + '">' +
      '<div class="row g-2 align-items-end">' +
      '<div class="col-12 col-sm-4"><label class="form-label mb-1">' + (isRaw() ? 'Bag size label' : 'Unit label') + '</label>' +
      '<input class="form-control" name="variant_label" value="' + global.MBMS_UTILS.escapeHtml(variant.label || '') +
      '" required placeholder="' + (isRaw() ? 'e.g. 170kg' : 'e.g. Piece') + '" autocomplete="off"></div>' +
      '<div class="col-5 col-sm-3"><label class="form-label mb-1">Quantity</label>' +
      '<input class="form-control" name="variant_qty" type="number" step="0.01" min="0.01" inputmode="decimal" value="' +
      global.MBMS_UTILS.escapeHtml(String(variant.package_qty != null ? variant.package_qty : '')) +
      '" placeholder="' + (isRaw() ? '170' : '1') + '"></div>' +
      '<div class="col-5 col-sm-3"><label class="form-label mb-1">Unit</label>' +
      '<select class="form-select" name="variant_unit" required>' + unitOptions + '</select></div>' +
      '<div class="col-2 col-sm-2 d-grid">' +
      '<button type="button" class="btn btn-outline-danger product-variant-remove" aria-label="Remove">' +
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
    if (!labelInput || !qtyInput || !unitInput || labelInput.dataset.manual === '1') {
      return;
    }
    if (isRaw()) {
      labelInput.value = formatVariantLabel(qtyInput.value, unitInput.value);
    } else if (!labelInput.value) {
      labelInput.value = unitInput.value ? (unitInput.value.charAt(0).toUpperCase() + unitInput.value.slice(1)) : '';
    }
    row.dataset.presetKey = String(qtyInput.value || '') + '|' + String(unitInput.value || '');
  }

  function collectUnits() {
    var rows = [];
    global.MBMS_UTILS.qsa('#material-units-list .product-variant-row').forEach(function (row) {
      var label = String((row.querySelector('[name="variant_label"]') || {}).value || '').trim();
      var qty = (row.querySelector('[name="variant_qty"]') || {}).value || '';
      var unit = String((row.querySelector('[name="variant_unit"]') || {}).value || '').trim() || (isRaw() ? 'kg' : 'piece');
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

  function renderPresetChips() {
    var host = document.getElementById('material-unit-presets');
    if (!host) {
      return;
    }
    host.innerHTML = defaultPresets().map(function (preset) {
      var key = String(preset.package_qty) + '|' + preset.base_unit;
      return '<button type="button" class="mbms-preset-chip" data-preset-key="' +
        global.MBMS_UTILS.escapeHtml(key) + '">' +
        global.MBMS_UTILS.escapeHtml(preset.label) + '</button>';
    }).join('');
    syncPresetChipState();
  }

  function syncPresetChipState() {
    var host = document.getElementById('material-unit-presets');
    var list = document.getElementById('material-units-list');
    if (!host || !list) {
      return;
    }
    var selected = {};
    global.MBMS_UTILS.qsa('.product-variant-row', list).forEach(function (row) {
      selected[row.dataset.presetKey || ''] = true;
    });
    global.MBMS_UTILS.qsa('.mbms-preset-chip', host).forEach(function (chip) {
      chip.classList.toggle('is-active', !!selected[chip.getAttribute('data-preset-key')]);
    });
  }

  function togglePreset(chip) {
    var key = chip.getAttribute('data-preset-key');
    var list = document.getElementById('material-units-list');
    if (!list || !key) {
      return;
    }
    var existing = list.querySelector('.product-variant-row[data-preset-key="' + key + '"]');
    if (existing) {
      if (list.querySelectorAll('.product-variant-row').length <= 1) {
        global.MBMS_UI.notify({ type: 'warning', message: 'Keep at least one ' + (isRaw() ? 'bag size' : 'unit') + '.' });
        return;
      }
      existing.remove();
      syncPresetChipState();
      return;
    }
    var parts = key.split('|');
    var qty = parts[0];
    var unit = parts[1] || (isRaw() ? 'kg' : 'piece');
    var preset = defaultPresets().filter(function (row) {
      return String(row.package_qty) === String(qty) && row.base_unit === unit;
    })[0];
    list.insertAdjacentHTML('beforeend', unitRowHtml(preset || {
      label: isRaw() ? formatVariantLabel(qty, unit) : (unit.charAt(0).toUpperCase() + unit.slice(1)),
      package_qty: qty,
      base_unit: unit
    }));
    syncPresetChipState();
  }

  function fillDefaultUnits() {
    var list = document.getElementById('material-units-list');
    if (!list) {
      return;
    }
    var presets = defaultPresets();
    var starter = isRaw() ? presets.slice(0, 2) : [presets[0]];
    list.innerHTML = starter.map(unitRowHtml).join('');
    renderPresetChips();
  }

  function openCreateMaterial() {
    var form = document.getElementById('material-form');
    var idInput = document.getElementById('material-id');
    var activeInput = document.getElementById('material-active');
    var unitsWrap = document.getElementById('material-units-wrap');
    var existing = document.getElementById('material-existing-units');
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
    global.MBMS_UTILS.setIconHeading(
      document.getElementById('material-modal-title'),
      pageIcon(),
      'Add ' + itemLabel().toLowerCase()
    );
    if (unitsWrap) {
      unitsWrap.hidden = false;
    }
    if (existing) {
      existing.hidden = true;
      existing.innerHTML = '';
    }
    fillDefaultUnits();
  }

  function openEditMaterial(item) {
    var form = document.getElementById('material-form');
    var idInput = document.getElementById('material-id');
    var activeInput = document.getElementById('material-active');
    var unitsWrap = document.getElementById('material-units-wrap');
    var existing = document.getElementById('material-existing-units');
    if (form) {
      form.reset();
      form.classList.remove('was-validated');
    }
    if (idInput) {
      idInput.value = item.id || '';
    }
    document.getElementById('material-name').value = item.name || '';
    document.getElementById('material-notes').value = item.notes || item.description || '';
    if (activeInput) {
      activeInput.checked = isActiveProduct(item);
    }
    global.MBMS_UTILS.setIconHeading(
      document.getElementById('material-modal-title'),
      'bi-pencil',
      'Edit ' + itemLabel().toLowerCase()
    );
    if (unitsWrap) {
      unitsWrap.hidden = true;
    }
    if (existing) {
      var labels = variantsFor(item).map(function (row) {
        return '<span class="mbms-chip me-1">' + global.MBMS_UTILS.escapeHtml(variantLabel(row)) + '</span>';
      });
      existing.hidden = false;
      existing.innerHTML =
        '<div class="mbms-form-section-title"><i class="bi bi-box-seam" aria-hidden="true"></i> Current ' + unitNoun() + '</div>' +
        '<div>' + (labels.join('') || '<span class="text-secondary">None</span>') + '</div>' +
        '<p class="mbms-help mb-0 mt-2">' + (isRaw() ? 'Bag sizes' : 'Units') + ' are fixed after create. Use Purchase against these.</p>';
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('materialModal')).show();
  }

  function renderList(data, source) {
    var query = String((document.getElementById('module-search') || {}).value || '').toLowerCase().trim();
    var status = (document.getElementById('module-status') || {}).value || '';
    var rows = itemsFrom(data).filter(function (row) {
      if (query && String(row.name || '').toLowerCase().indexOf(query) === -1) {
        return false;
      }
      if (status === 'active' && !isActiveProduct(row)) {
        return false;
      }
      if (status === 'inactive' && isActiveProduct(row)) {
        return false;
      }
      return true;
    });

    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);

    var activeCount = rows.filter(isActiveProduct).length;
    var unitCount = rows.reduce(function (sum, item) {
      return sum + variantsFor(item).length;
    }, 0);
    var inStock = rows.filter(function (item) {
      return variantsFor(item).some(variantHasStock);
    }).length;

    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      { icon: pageIcon(), label: isRaw() ? 'Raw materials' : 'Factory materials', value: rows.length, tone: 'primary' },
      { icon: 'bi-check-circle', label: 'Active', value: activeCount, tone: 'success' },
      { icon: 'bi-box-seam', label: isRaw() ? 'Bag sizes' : 'Units', value: unitCount, tone: 'accent' },
      { icon: 'bi-layers', label: 'In stock', value: inStock, tone: inStock ? 'info' : 'warning' }
    ]);

    if (!rows.length) {
      document.getElementById('mat-table-wrap').hidden = true;
      document.getElementById('mat-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('mat-empty'), {
        title: isRaw() ? 'No raw materials yet' : 'No factory materials yet',
        message: 'Add a material, then record a purchase to build stock.'
      });
      return;
    }

    document.getElementById('mat-empty').hidden = true;
    document.getElementById('mat-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderTable(document.getElementById('mat-list-body'), rows, [
      {
        render: function (item) {
          var badge = isActiveProduct(item)
            ? '<span class="badge text-bg-success ms-1">Active</span>'
            : '<span class="badge text-bg-secondary ms-1">Inactive</span>';
          return '<strong>' + global.MBMS_UTILS.escapeHtml(item.name || '') + '</strong>' + badge;
        }
      },
      {
        render: function (item) {
          return variantsFor(item).map(function (row) {
            return '<span class="mbms-chip me-1">' + global.MBMS_UTILS.escapeHtml(variantLabel(row)) + '</span>';
          }).join('') || '<span class="text-secondary">None</span>';
        }
      },
      {
        render: function (item) {
          var variants = variantsFor(item);
          if (!variants.length) {
            return '—';
          }
          return variants.map(function (row) {
            return '<span class="d-inline-flex align-items-center gap-1 me-2 mb-1">' +
              '<span class="text-secondary small">' + global.MBMS_UTILS.escapeHtml(variantLabel(row)) + '</span>' +
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
    ]);

    global.MBMS_UTILS.qsa('#mat-list-body tr').forEach(function (tr, index) {
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

  function aggregateSuppliers(purchases) {
    var map = {};
    (purchases || []).forEach(function (row) {
      var key = row.supplier_id || row.supplier || 'Unknown';
      if (!map[key]) {
        map[key] = {
          supplier: row.supplier || 'Unknown',
          count: 0,
          total: 0,
          paid: 0,
          remaining: 0
        };
      }
      map[key].count += 1;
      map[key].total += row.total_raw != null ? num(row.total_raw) : num(row.total);
      map[key].paid += row.paid_raw != null ? num(row.paid_raw) : num(row.paid);
      map[key].remaining += row.remaining_raw != null ? num(row.remaining_raw) : num(row.remaining);
    });
    return Object.keys(map).map(function (key) {
      var row = map[key];
      return {
        supplier: row.supplier,
        count: row.count,
        total: roundMoney(row.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        paid: roundMoney(row.paid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        remaining: roundMoney(row.remaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      };
    });
  }

  function renderHistory(purchases) {
    global.MBMS_RECORDS.renderTable(document.getElementById('purchase-body'), purchases, [
      { key: 'date' },
      { key: 'supplier' },
      { key: 'variant' },
      { key: 'quantity' },
      { key: 'total' },
      { key: 'paid' },
      { key: 'remaining' },
      { key: 'location' }
    ], 'No purchases yet. Record a purchase to add stock.');

    global.MBMS_RECORDS.renderTable(document.getElementById('supplier-body'), aggregateSuppliers(purchases), [
      { key: 'supplier' },
      { key: 'count' },
      { key: 'total' },
      { key: 'paid' },
      { key: 'remaining' }
    ], 'No supplier activity yet.');

    global.MBMS_RECORDS.renderTable(document.getElementById('payment-body'), purchases, [
      { key: 'date' },
      { key: 'supplier' },
      { key: 'paid' },
      { key: 'remaining' },
      { key: 'location' }
    ], 'No payment rows yet. Remaining balances update with purchases and supplier payments.');

    global.MBMS_RECORDS.renderTable(document.getElementById('history-body'), purchases, [
      { key: 'date' },
      { key: 'supplier' },
      { key: 'quantity' },
      { key: 'total' },
      { key: 'location' }
    ], 'No history yet.');
  }

  function belongsToProduct(row, item) {
    if (!row || !item) {
      return false;
    }
    if (row.product_id && String(row.product_id) === String(item.id)) {
      return true;
    }
    if (row.product && item.name && String(row.product) === String(item.name)) {
      return true;
    }
    var ids = variantsFor(item).map(function (v) { return String(v.id); });
    return !!(row.variant_id && ids.indexOf(String(row.variant_id)) !== -1);
  }

  function loadPurchases(item) {
    renderHistory([]);
    return global.MBMS_RECORDS.fetchOrMock('purchases', function () { return []; }, {
      product_id: item.id,
      per_page: 100
    }).then(function (result) {
      var rows = ((result && result.data) || []).filter(function (row) {
        return belongsToProduct(row, item);
      });
      renderHistory(rows);
      var total = 0;
      var remaining = 0;
      rows.forEach(function (row) {
        total += row.total_raw != null ? num(row.total_raw) : num(row.total);
        remaining += row.remaining_raw != null ? num(row.remaining_raw) : num(row.remaining);
      });
      var variants = variantsFor(item);
      var inStock = variants.filter(variantHasStock).length;
      global.MBMS_RECORDS.renderSummary(document.getElementById('detail-summary'), [
        { icon: 'bi-box-seam', label: isRaw() ? 'Bag sizes' : 'Units', value: variants.length, tone: 'accent' },
        { icon: 'bi-layers', label: 'In stock', value: inStock, tone: inStock ? 'success' : 'warning' },
        { icon: 'bi-receipt', label: 'Purchases', value: rows.length, tone: 'primary' },
        {
          icon: 'bi-cash-stack',
          label: 'Purchase total',
          value: roundMoney(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          tone: 'info'
        },
        {
          icon: 'bi-hourglass-split',
          label: 'Remaining',
          value: roundMoney(remaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          tone: remaining > 0 ? 'warning' : 'muted'
        }
      ]);
    }).catch(function () {
      renderHistory([]);
    });
  }

  function packageQtyForVariant(selectEl, item) {
    if (!selectEl || !selectEl.value) {
      return 0;
    }
    var match = variantsFor(item).filter(function (row) {
      return String(row.id) === String(selectEl.value);
    })[0];
    if (!match) {
      return 0;
    }
    var qty = Number(match.package_qty);
    if (Number.isFinite(qty) && qty > 0) {
      return qty;
    }
    return parseStockQty(match.label || match.name);
  }

  function syncPurchaseTotals(item) {
    var bagsEl = document.getElementById('purchase-bags');
    var qtyEl = document.getElementById('purchase-quantity');
    var priceEl = document.getElementById('purchase-price');
    var totalEl = document.getElementById('purchase-total');
    var paidEl = document.getElementById('purchase-paid');
    var remainingEl = document.getElementById('purchase-remaining');
    var variantEl = document.getElementById('purchase-variant');
    var bags = num(bagsEl && bagsEl.value);
    var packageQty = packageQtyForVariant(variantEl, item);
    if (isRaw() && bagsEl && qtyEl && bags > 0 && packageQty > 0 && document.activeElement !== qtyEl) {
      qtyEl.value = String(roundMoney(bags * packageQty));
    }
    var qty = num(qtyEl && qtyEl.value);
    var price = num(priceEl && priceEl.value);
    if (totalEl && price > 0 && qty > 0 && document.activeElement !== totalEl) {
      totalEl.value = String(roundMoney(qty * price));
    }
    var total = num(totalEl && totalEl.value);
    var paid = num(paidEl && paidEl.value);
    if (remainingEl) {
      remainingEl.value = String(roundMoney(Math.max(0, total - paid)));
    }
  }

  function setupPurchaseForm(item) {
    document.getElementById('purchase-item-label').textContent = item.name || '';
    global.MBMS_UTILS.qsa('[data-bags-field]').forEach(function (el) {
      el.hidden = !isRaw();
    });

    var variantOptions = variantsFor(item).map(function (row) {
      return { id: row.id, label: variantLabel(row) };
    });
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('purchase-variant'),
      variantOptions,
      function (row) { return row.id; },
      function (row) { return row.label; }
    );
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('purchase-supplier'),
      global.MBMS_CATALOG.suppliers(),
      function (row) { return row.id; },
      function (row) { return row.name; }
    );
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('purchase-location'));

    var dateEl = document.getElementById('purchase-date');
    if (dateEl && !dateEl.value) {
      dateEl.value = todayIso();
    }

    var form = document.getElementById('purchase-form');
    if (form && form.dataset.calcBound !== '1') {
      form.dataset.calcBound = '1';
      ['purchase-bags', 'purchase-quantity', 'purchase-price', 'purchase-total', 'purchase-paid', 'purchase-variant']
        .forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) {
            return;
          }
          el.addEventListener('input', function () { syncPurchaseTotals(findItem(global.MBMS_RECORDS.queryParam('id'), catalogCache) || item); });
          el.addEventListener('change', function () { syncPurchaseTotals(findItem(global.MBMS_RECORDS.queryParam('id'), catalogCache) || item); });
        });
    }
    syncPurchaseTotals(item);

    var purchaseBtn = document.querySelector('[data-bs-target="#purchaseModal"]');
    if (purchaseBtn) {
      purchaseBtn.disabled = !isActiveProduct(item) || !variantOptions.length;
    }
  }

  function syncDetailActions(item) {
    var toggle = document.getElementById('toggle-material-active');
    if (!toggle) {
      return;
    }
    var active = isActiveProduct(item);
    toggle.dataset.active = active ? '1' : '0';
    toggle.classList.toggle('btn-outline-danger', active);
    toggle.classList.toggle('btn-outline-success', !active);
    toggle.innerHTML = active
      ? '<i class="bi bi-pause-circle" aria-hidden="true"></i> Deactivate'
      : '<i class="bi bi-play-circle" aria-hidden="true"></i> Activate';
  }

  function renderDetail(item, data, source) {
    global.MBMS_UTILS.setIconHeading(document.getElementById('detail-title'), pageIcon(), item.name);
    document.getElementById('detail-note').textContent = isActiveProduct(item)
      ? (item.notes || (isRaw()
        ? 'Raw-material stock is separate from finished product stock.'
        : 'Factory-use material for packing and production.'))
      : 'Inactive — hidden from new purchases.';
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    syncDetailActions(item);

    var variants = variantsFor(item);
    var stockHost = document.getElementById('variant-stock');
    if (stockHost) {
      stockHost.innerHTML = variants.length
        ? variants.map(function (row) {
            var tone = variantHasStock(row) ? 'is-sales' : 'is-warning';
            return (
              '<div class="col-6 col-lg-3">' +
              '<article class="mbms-card card mbms-stat-card ' + tone + '"><div class="card-body">' +
              '<div class="mbms-stat-label">' + global.MBMS_UTILS.escapeHtml(variantLabel(row)) + '</div>' +
              '<div class="mbms-stat-value">' + global.MBMS_UTILS.escapeHtml(row.stock_display || '0') + '</div>' +
              '</div></article></div>'
            );
          }).join('')
        : '<div class="col-12"><p class="text-secondary mb-0">No ' + unitNoun() + ' yet. Add them when creating the material.</p></div>';
    }

    global.MBMS_RECORDS.renderTable(document.getElementById('variants-body'), variants, [
      { render: function (row) { return global.MBMS_UTILS.escapeHtml(variantLabel(row)); } },
      { render: function (row) { return stockPill(row.stock_display); } }
    ], 'No ' + unitNoun() + ' yet.');

    setupPurchaseForm(item);
    loadPurchases(item);
  }

  function warmDependencies() {
    return Promise.all([
      global.MBMS_RECORDS.fetchOrMock('stock', function () { return []; }, { per_page: 200 }),
      global.MBMS_RECORDS.fetchOrMock('suppliers', function () { return []; }, { per_page: 200 })
    ]).catch(function () {
      return null;
    });
  }

  function load() {
    var id = global.MBMS_RECORDS.queryParam('id');
    setMode(!!id);
    return warmDependencies().then(function () {
      return global.MBMS_RECORDS.fetchOrMock(endpoint(), seedItems);
    }).then(function (result) {
      catalogCache = result.data || seedItems();
      if (id) {
        var item = findItem(id, catalogCache);
        if (!item) {
          setMode(false);
          global.MBMS_UI.notify({ type: 'danger', message: 'That material is not available.' });
          renderList(catalogCache, result.source);
          return;
        }
        setMode(true);
        renderDetail(item, catalogCache, result.source);
      } else {
        setMode(false);
        renderList(catalogCache, result.source);
      }
    }).catch(function (error) {
      document.getElementById('mat-table-wrap').hidden = true;
      document.getElementById('mat-empty').hidden = false;
      global.MBMS_UI.renderError(document.getElementById('mat-empty'), {
        title: 'Unable to load materials',
        message: global.MBMS_UTILS.getErrorMessage(error),
        actionLabel: 'Try again',
        onAction: load
      });
    });
  }

  function bindMaterialForm() {
    var form = document.getElementById('material-form');
    var list = document.getElementById('material-units-list');
    var presets = document.getElementById('material-unit-presets');
    var addBtn = document.getElementById('material-add-unit');

    if (list) {
      list.addEventListener('click', function (event) {
        var btn = event.target.closest('.product-variant-remove');
        if (!btn) {
          return;
        }
        if (list.querySelectorAll('.product-variant-row').length <= 1) {
          global.MBMS_UI.notify({ type: 'warning', message: 'Keep at least one ' + (isRaw() ? 'bag size' : 'unit') + '.' });
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
          syncVariantLabel(event.target.closest('.product-variant-row'));
          syncPresetChipState();
        }
      });
    }

    if (presets) {
      presets.addEventListener('click', function (event) {
        var chip = event.target.closest('.mbms-preset-chip');
        if (chip) {
          togglePreset(chip);
        }
      });
    }

    if (addBtn && list) {
      addBtn.addEventListener('click', function () {
        list.insertAdjacentHTML('beforeend', unitRowHtml({
          label: '',
          package_qty: isRaw() ? '' : '1',
          base_unit: isRaw() ? 'kg' : 'piece'
        }));
        syncPresetChipState();
      });
    }

    var openBtn = document.getElementById('add-material');
    if (openBtn) {
      openBtn.addEventListener('click', openCreateMaterial);
    }

    var editBtn = document.getElementById('edit-material');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        var item = findItem(global.MBMS_RECORDS.queryParam('id'), catalogCache);
        if (!item) {
          global.MBMS_UI.notify({ type: 'danger', message: 'Material not found.' });
          return;
        }
        openEditMaterial(item);
      });
    }

    var toggleBtn = document.getElementById('toggle-material-active');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var id = global.MBMS_RECORDS.queryParam('id');
        if (!id) {
          return;
        }
        var makeActive = toggleBtn.dataset.active !== '1';
        var label = makeActive ? 'Activate' : 'Deactivate';
        global.MBMS_UI.confirm({
          title: label + ' material',
          message: makeActive
            ? 'Activate this material so it can be purchased again?'
            : 'Deactivate this material? It stays in history but hides from new purchases.',
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
                ? (makeActive ? 'Material activated.' : 'Material deactivated.')
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
        var editingId = values.id || (document.getElementById('material-id') || {}).value;
        if (editingId) {
          return global.MBMS_RECORDS.submitOrMock('put', 'products/' + encodeURIComponent(editingId), {
            name: values.name,
            description: values.notes || null,
            is_active: !!(document.getElementById('material-active') || {}).checked
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Material updated.' : 'API not connected.'
            });
            bootstrap.Modal.getOrCreateInstance(document.getElementById('materialModal')).hide();
            load();
          });
        }

        var units = collectUnits();
        if (!units.length) {
          throw {
            message: 'Add at least one ' + (isRaw() ? 'bag size' : 'unit') + '.',
            errors: { variants: ['Required'] }
          };
        }
        if (units.some(function (unit) { return !(Number(unit.package_qty) > 0); })) {
          throw {
            message: 'Each size/unit needs a quantity greater than zero.',
            errors: { variants: ['Quantity must be greater than zero'] }
          };
        }

        return global.MBMS_RECORDS.submitOrMock('post', endpoint(), {
          name: String(values.name || '').trim(),
          notes: values.notes || '',
          is_active: !!(document.getElementById('material-active') || {}).checked,
          units: units
        }).then(function (result) {
          global.MBMS_UI.notify({
            type: result.source === 'api' ? 'success' : 'warning',
            message: result.source === 'api'
              ? itemLabel() + ' saved. Open Purchase to add stock.'
              : 'API not connected. Sample material only.'
          });
          form.reset();
          bootstrap.Modal.getOrCreateInstance(document.getElementById('materialModal')).hide();
          var saved = global.MBMS_UTILS.unwrap(result.data) || result.data || {};
          global.location.search = '?id=' + encodeURIComponent(saved.id || '');
        });
      }
    });
  }

  function bindPurchaseForm() {
    var form = document.getElementById('purchase-form');
    if (!form) {
      return;
    }
    global.MBMS_UI.bindForm(form, {
      onSubmit: function (values) {
        var item = findItem(global.MBMS_RECORDS.queryParam('id'), catalogCache) || {};
        if (!isActiveProduct(item)) {
          throw { message: 'This material is inactive. Activate it before purchasing.' };
        }
        if (!values.variant) {
          throw { message: 'Choose a ' + (isRaw() ? 'bag size' : 'unit') + '.', errors: { variant: ['Required'] } };
        }
        if (!values.supplier) {
          throw { message: 'Choose a supplier.', errors: { supplier: ['Required'] } };
        }
        var qty = num(values.quantity);
        var price = num(values.price);
        if (!(qty > 0) || !(price >= 0)) {
          throw { message: 'Enter quantity and price.', errors: { quantity: ['Required'], price: ['Required'] } };
        }
        syncPurchaseTotals(item);
        values.quantity = document.getElementById('purchase-quantity').value;
        values.total = document.getElementById('purchase-total').value;
        values.paid = document.getElementById('purchase-paid').value;
        values.remaining = document.getElementById('purchase-remaining').value;
        values.product_id = item.id;
        values.type_id = item.id;

        return global.MBMS_RECORDS.submitOrMock('post', endpoint() + '/purchases', values).then(function (result) {
          global.MBMS_UI.notify({
            type: result.source === 'api' ? 'success' : 'warning',
            message: result.source === 'api'
              ? 'Purchase saved. Stock and supplier balance updated by Laravel.'
              : 'API not connected. Sample purchase only.'
          });
          form.reset();
          bootstrap.Modal.getOrCreateInstance(document.getElementById('purchaseModal')).hide();
          if (global.MBMS_API && global.MBMS_API.invalidateCaches) {
            global.MBMS_API.invalidateCaches(['products', 'stock', 'stockBalances', 'purchases', 'suppliers', 'raw-materials', 'factory-materials']);
          }
          load();
        });
      }
    });
  }

  global.MBMS_PAGE = {
    active: document.body.getAttribute('data-page'),
    title: isRaw() ? 'Raw Materials' : 'Factory Materials',
    onReady: function () {
      var search = document.getElementById('module-search');
      var status = document.getElementById('module-status');
      if (search) {
        search.addEventListener('input', global.MBMS_UTILS.debounce(load, 250));
      }
      if (status) {
        status.addEventListener('change', load);
      }
      fillDefaultUnits();
      bindMaterialForm();
      bindPurchaseForm();
      load();
    }
  };
})(window);
