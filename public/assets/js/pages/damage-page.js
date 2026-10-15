/**
 * Damaged stock UI. Backend removes stock. Frontend only submits the request.
 */
(function (global) {
  'use strict';

  function num(value) {
    var n = Number(String(value == null ? '' : value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
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

  function mockList() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.damages) || [];
  }

  function refreshAutocomplete() {
    if (!global.MBMS_AUTOCOMPLETE) {
      return;
    }
    global.MBMS_AUTOCOMPLETE.refresh(document.getElementById('dmg-product'));
  }

  function availableStock() {
    var variantId = (document.getElementById('dmg-variant') || {}).value || '';
    var locationId = (document.getElementById('dmg-location') || {}).value || '';
    if (!variantId || !locationId || !global.MBMS_API || typeof global.MBMS_API.stockAtLocation !== 'function') {
      return { qty: null, unit: '', location: '' };
    }
    return global.MBMS_API.stockAtLocation(variantId, locationId);
  }

  function selectedVariant() {
    var category = (document.getElementById('dmg-category') || {}).value || '';
    var productId = (document.getElementById('dmg-product') || {}).value || '';
    var variantId = (document.getElementById('dmg-variant') || {}).value || '';
    return global.MBMS_CATALOG.variants(category, productId).filter(function (row) {
      return String(row.id) === String(variantId);
    })[0] || null;
  }

  function updateUnitAndStock() {
    var variant = selectedVariant();
    var unitEl = document.getElementById('dmg-unit');
    if (unitEl) {
      unitEl.value = (variant && variant.base_unit) || '';
    }

    var hint = document.getElementById('dmg-stock-hint');
    var error = document.getElementById('dmg-stock-error');
    var qtyInput = document.getElementById('dmg-quantity');
    var preview = document.getElementById('dmg-preview');
    var locationSelect = document.getElementById('dmg-location');
    var locationName = '';
    if (locationSelect && locationSelect.selectedIndex >= 0) {
      locationName = locationSelect.options[locationSelect.selectedIndex].textContent || '';
    }

    var variantId = (document.getElementById('dmg-variant') || {}).value || '';
    var locationId = (locationSelect || {}).value || '';
    var wanted = num(qtyInput && qtyInput.value);

    if (!variantId || !locationId) {
      if (hint) {
        hint.textContent = 'Choose product, variant, and location to see available stock.';
        hint.classList.remove('text-danger', 'text-success');
      }
      if (error) {
        error.hidden = true;
        error.textContent = '';
      }
      if (qtyInput) {
        qtyInput.classList.remove('is-invalid');
        qtyInput.removeAttribute('max');
      }
      if (preview) {
        preview.hidden = true;
      }
      return;
    }

    var stock = availableStock();
    var available = stock.qty != null ? num(stock.qty) : 0;
    var unit = (unitEl && unitEl.value) || stock.unit || '';
    var unitLabel = unit ? (' ' + unit) : '';
    var place = stock.location || locationName || 'this location';

    if (hint) {
      hint.textContent = 'Available in ' + place + ': ' + formatQty(available) + unitLabel + '. Damage cannot exceed this.';
      hint.classList.toggle('text-success', available > 0);
      hint.classList.toggle('text-danger', available <= 0);
    }

    if (qtyInput) {
      qtyInput.max = available > 0 ? String(available) : '';
    }

    var over = wanted > 0 && wanted > available + 0.00001;
    if (error) {
      error.hidden = !over;
      error.textContent = over
        ? ('Only ' + formatQty(available) + unitLabel + ' available in ' + place + '.')
        : '';
    }
    if (qtyInput) {
      qtyInput.classList.toggle('is-invalid', over);
    }

    if (preview) {
      preview.hidden = false;
      document.getElementById('dmg-preview-available').textContent = formatQty(available) + unitLabel;
      document.getElementById('dmg-preview-qty').textContent = formatQty(wanted) + unitLabel;
      document.getElementById('dmg-preview-remaining').textContent =
        formatQty(Math.max(0, available - wanted)) + unitLabel;
      document.getElementById('dmg-preview-location').textContent = place;
    }
  }

  function fillProducts() {
    var category = document.getElementById('dmg-category').value;
    var productSelect = document.getElementById('dmg-product');
    var current = productSelect ? productSelect.value : '';
    global.MBMS_RECORDS.fillSelect(
      productSelect,
      global.MBMS_CATALOG.products(category),
      function (row) { return row.id; },
      function (row) { return row.name; },
      current,
      'Select product'
    );
    refreshAutocomplete();
    fillVariants();
  }

  function fillVariants() {
    var category = document.getElementById('dmg-category').value;
    var productId = document.getElementById('dmg-product').value;
    var variantSelect = document.getElementById('dmg-variant');
    var current = variantSelect ? variantSelect.value : '';
    global.MBMS_RECORDS.fillSelect(
      variantSelect,
      global.MBMS_CATALOG.variants(category, productId),
      function (row) { return row.id; },
      function (row) {
        return row.label + (row.base_unit ? ' (' + row.base_unit + ')' : '');
      },
      current,
      productId ? 'Select variant' : 'Select product first'
    );
    updateUnitAndStock();
  }

  function applyFilters(rows) {
    var search = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var category = (document.getElementById('list-category') || {}).value || '';
    var location = (document.getElementById('list-location') || {}).value || '';
    var from = (document.getElementById('date-from') || {}).value || '';
    var to = (document.getElementById('date-to') || {}).value || '';
    return rows.filter(function (row) {
      var text = [
        row.product,
        row.variant,
        row.reason,
        row.notes,
        row.reference_no,
        row.user,
        row.location
      ].join(' ').toLowerCase();
      return (!search || text.indexOf(search) !== -1)
        && (!category || String(row.category_id) === String(category) || String(row.category) === String(category))
        && (!location || String(row.location_id) === String(location) || String(row.location) === String(location))
        && (!from || !row.date || row.date >= from)
        && (!to || !row.date || row.date <= to);
    });
  }

  function summarize(rows) {
    var qty = 0;
    rows.forEach(function (row) {
      qty += row.quantity_raw != null ? num(row.quantity_raw) : num(row.quantity);
    });
    return [
      { icon: 'bi-exclamation-octagon', label: 'Damage records', value: rows.length, tone: 'danger' },
      { icon: 'bi-box-seam', label: 'Qty damaged', value: formatQty(qty), tone: 'warning' }
    ];
  }

  function render(source) {
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    var rows = applyFilters(mockList());
    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), summarize(rows));

    if (!rows.length) {
      document.getElementById('dmg-table-wrap').hidden = true;
      document.getElementById('dmg-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('dmg-empty'), {
        title: 'No damage records',
        message: 'Use Record damage when stock is broken, spoiled, or otherwise unusable.'
      });
      return;
    }
    document.getElementById('dmg-empty').hidden = true;
    document.getElementById('dmg-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderTable(document.getElementById('dmg-body'), rows, [
      { key: 'date' },
      {
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(row.reference_no || row.id || '');
        }
      },
      { key: 'category' },
      { key: 'product' },
      { key: 'variant' },
      {
        render: function (row) {
          return '<span class="mbms-stock-pill is-empty">' +
            global.MBMS_UTILS.escapeHtml(row.quantity || formatQty(row.quantity_raw)) +
            '</span>';
        }
      },
      { key: 'reason' },
      { key: 'location' },
      { key: 'user' }
    ]);
  }

  function load() {
    render();
    return global.MBMS_RECORDS.fetchOrMock('damaged-stock', mockList)
      .then(function (result) {
        render(result.source);
      })
      .catch(function () {
        render('error');
      });
  }

  function ensureStockIndex() {
    if (!global.MBMS_API || typeof global.MBMS_API.get !== 'function') {
      return Promise.resolve();
    }
    return global.MBMS_API.get('stock', { params: { per_page: 500 } }).then(function () {
      updateUnitAndStock();
    }).catch(function () {
      updateUnitAndStock();
    });
  }

  function warmCatalog() {
    var emptyCatalog = function () {
      return { types: [], products: [], variants: [], sizes: [] };
    };
    var paths = ['tea', 'rice', 'detergents', 'raw-materials', 'factory-materials'];
    return Promise.all(paths.map(function (path) {
      return global.MBMS_RECORDS.fetchOrMock(path, emptyCatalog).catch(function () {
        return null;
      });
    })).then(function () {
      fillProducts();
      return ensureStockIndex();
    });
  }

  function fillListFilters() {
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('list-category'),
      global.MBMS_CATALOG.purchaseCategories(),
      function (row) { return row.id; },
      function (row) { return row.label; },
      '',
      'All categories'
    );
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('list-location'),
      global.MBMS_RECORDS.locations(),
      function (row) { return row.id; },
      function (row) { return row.name; },
      '',
      'All locations'
    );
  }

  function resetFormExtras() {
    var date = document.getElementById('dmg-date');
    if (date) {
      date.value = todayIso();
    }
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('dmg-location'));
    fillProducts();
    updateUnitAndStock();
  }

  global.MBMS_PAGE = {
    active: 'damaged-stock',
    title: 'Damaged Stock',
    onReady: function () {
      global.MBMS_RECORDS.fillSelect(
        document.getElementById('dmg-category'),
        global.MBMS_CATALOG.purchaseCategories(),
        function (row) { return row.id; },
        function (row) { return row.label; }
      );
      fillListFilters();
      global.MBMS_RECORDS.fillWorkLocation(document.getElementById('dmg-location'));
      fillProducts();

      if (global.MBMS_API && typeof global.MBMS_API.ensureLocations === 'function') {
        global.MBMS_API.ensureLocations().then(function () {
          fillListFilters();
          global.MBMS_RECORDS.fillWorkLocation(document.getElementById('dmg-location'));
          updateUnitAndStock();
        }).catch(function () {});
      }

      warmCatalog();

      document.getElementById('dmg-category').addEventListener('change', fillProducts);
      document.getElementById('dmg-product').addEventListener('change', fillVariants);
      document.getElementById('dmg-variant').addEventListener('change', updateUnitAndStock);
      document.getElementById('dmg-location').addEventListener('change', updateUnitAndStock);
      document.getElementById('dmg-quantity').addEventListener('input', updateUnitAndStock);
      document.getElementById('dmg-quantity').addEventListener('change', updateUnitAndStock);

      ['module-search', 'list-category', 'list-location', 'date-from', 'date-to'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', load);
          el.addEventListener('change', load);
        }
      });

      document.getElementById('dmgModal').addEventListener('show.bs.modal', function () {
        if (!(document.getElementById('dmg-date') || {}).value) {
          document.getElementById('dmg-date').value = todayIso();
        }
        ensureStockIndex();
        updateUnitAndStock();
      });

      global.MBMS_UI.bindReset(document.getElementById('dmg-form'), document.getElementById('dmg-reset'), function () {
        resetFormExtras();
      });

      var form = document.getElementById('dmg-form');
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (form.dataset.submitting === '1') {
          return;
        }
        updateUnitAndStock();
        if (!form.checkValidity()) {
          form.classList.add('was-validated');
          return;
        }

        var values = global.MBMS_UTILS.formToObject(form);
        var qty = num(values.quantity);
        var stock = availableStock();
        var available = stock.qty != null ? num(stock.qty) : null;

        if (!(qty > 0)) {
          global.MBMS_UI.notify({ type: 'danger', message: 'Enter a quantity greater than zero.' });
          return;
        }
        if (available != null && qty > available + 0.00001) {
          var unit = values.unit ? (' ' + values.unit) : '';
          global.MBMS_UI.notify({
            type: 'danger',
            message: 'Only ' + formatQty(available) + unit + ' available at this location.'
          });
          return;
        }

        global.MBMS_UI.confirm({
          title: 'Record damage',
          message: 'This permanently writes off stock at this location if Laravel accepts the request.',
          confirmLabel: 'Submit damage'
        }).then(function (ok) {
          if (!ok) {
            return;
          }
          form.dataset.submitting = '1';
          var submitter = form.querySelector('[type="submit"]');
          global.MBMS_UI.setButtonLoading(submitter, true);

          var product = global.MBMS_CATALOG.products(values.category).filter(function (row) {
            return String(row.id) === String(values.product);
          })[0];
          var variant = global.MBMS_CATALOG.variants(values.category, values.product).filter(function (row) {
            return String(row.id) === String(values.variant);
          })[0];

          var record = {
            product: product ? product.name : values.product,
            variant: variant ? variant.label : values.variant,
            variant_id: values.variant,
            quantity: values.quantity,
            unit: values.unit || (variant && variant.base_unit) || '',
            reason: values.reason,
            notes: values.notes || null,
            date: values.date,
            location: values.location,
            location_id: values.location
          };

          global.MBMS_RECORDS.submitOrMock('post', 'damaged-stock', record).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? 'Damage recorded. Stock reduced by Laravel.'
                : 'API not connected. Sample damage only.'
            });
            form.reset();
            form.classList.remove('was-validated');
            resetFormExtras();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('dmgModal')).hide();
            return ensureStockIndex().then(load);
          }).catch(function (error) {
            global.MBMS_UI.notify({
              type: 'danger',
              title: 'Damage not saved',
              message: global.MBMS_UTILS.getErrorMessage(error)
            });
          }).finally(function () {
            form.dataset.submitting = '';
            global.MBMS_UI.setButtonLoading(submitter, false);
          });
        });
      });

      var dateEl = document.getElementById('dmg-date');
      if (dateEl && !dateEl.value) {
        dateEl.value = todayIso();
      }

      load();
    }
  };
})(window);
