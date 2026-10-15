/**
 * Shared Raw Materials and Factory Materials catalog.
 * Purchases are submitted to Laravel. Production/stock rules are not invented.
 */
(function (global) {
  'use strict';

  function kind() {
    return document.body.getAttribute('data-material') === 'factory' ? 'factory' : 'raw';
  }

  function isRaw() {
    return kind() === 'raw';
  }

  function storeKey() {
    return isRaw() ? 'rawMaterials' : 'factoryMaterials';
  }

  function purchaseStore() {
    return isRaw() ? 'rawMaterialPurchases' : 'factoryMaterialPurchases';
  }

  function endpoint() {
    return isRaw() ? 'raw-materials' : 'factory-materials';
  }

  function seedItems() {
    return isRaw()
      ? ((global.MBMS_MOCK && global.MBMS_MOCK.rawMaterials) || [])
      : ((global.MBMS_MOCK && global.MBMS_MOCK.factoryMaterials) || []);
  }

  function items() {
    return global.MBMS_RECORDS.mergeList(storeKey(), seedItems());
  }

  function findItem(id) {
    return items().filter(function (row) { return row.id === id; })[0] || null;
  }

  function bagSizes() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.rawBagSizes) || [];
  }

  function unitsFor(item) {
    return (item && item.units) || (isRaw() ? bagSizes() : []);
  }

  function purchasesFor(item) {
    var name = item.name;
    var fromTx = ((global.MBMS_MOCK && global.MBMS_MOCK.purchases) || [])
      .concat(global.MBMS_RECORDS.storeList('purchases'))
      .filter(function (row) {
        return row.product === name || row.material_id === item.id || row.raw_material_id === item.id;
      });
    var local = global.MBMS_RECORDS.storeList(purchaseStore()).filter(function (row) {
      return row.material_id === item.id || row.raw_material_id === item.id || row.product === name;
    });
    return local.concat(fromTx);
  }

  function setMode(detail) {
    document.getElementById('list-view').hidden = !!detail;
    document.getElementById('detail-view').hidden = !detail;
  }

  function renderList(source) {
    var query = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var rows = items().filter(function (row) {
      return !query || String(row.name).toLowerCase().indexOf(query) !== -1;
    });
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    if (!rows.length) {
      document.getElementById('mat-table-wrap').hidden = true;
      document.getElementById('mat-empty').hidden = false;
      global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), []);
      global.MBMS_UI.renderEmpty(document.getElementById('mat-empty'), {
        title: isRaw() ? 'No raw materials yet' : 'No factory materials yet',
        message: 'Materials you add will show up here.'
      });
      return;
    }
    document.getElementById('mat-empty').hidden = true;
    document.getElementById('mat-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderTable(document.getElementById('mat-list-body'), rows, [
      { key: 'name' },
      {
        render: function (row) {
          return (row.units || []).map(function (unit) {
            return '<span class="mbms-chip me-1">' + global.MBMS_UTILS.escapeHtml(unit.label) + '</span>';
          }).join('') || '—';
        }
      },
      {
        render: function (row) {
          if (isRaw()) {
            return global.MBMS_UTILS.escapeHtml(row.stock_display || '—');
          }
          return row.stock_display
            ? global.MBMS_UTILS.escapeHtml(row.stock_display)
            : '<span class="text-secondary">Stock tracking not finalized</span>';
        }
      },
      {
        render: function (row) {
          return global.MBMS_RECORDS.actionButton('?id=' + encodeURIComponent(row.id), 'Open', 'bi-box-arrow-up-right');
        }
      }
    ]);
    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      { icon: isRaw() ? 'bi-layers' : 'bi-gear-wide-connected', label: 'Items', value: (rows || items()).length }
    ]);
  }

  function renderDetail(item, source) {
    global.MBMS_UTILS.setIconHeading(document.getElementById('detail-title'), null, item.name);
    document.getElementById('detail-note').textContent = item.notes || '';
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    document.getElementById('purchase-item-label').textContent = item.name;

    var stockHost = document.getElementById('stock-display');
    if (stockHost) {
      if (isRaw()) {
        stockHost.innerHTML =
          '<article class="mbms-card card mbms-stat-card"><div class="card-body">' +
          '<div class="mbms-stat-label">Stock</div>' +
          '<div class="mbms-stat-value">' + global.MBMS_UTILS.escapeHtml(item.stock_display || '—') + '</div>' +
          '</div></article>';
      } else if (item.stock_display) {
        stockHost.innerHTML =
          '<article class="mbms-card card mbms-stat-card"><div class="card-body">' +
          '<div class="mbms-stat-label">Stock</div>' +
          '<div class="mbms-stat-value">' + global.MBMS_UTILS.escapeHtml(item.stock_display) + '</div>' +
          '</div></article>';
      } else {
        stockHost.innerHTML = '<div class="text-secondary">No stock display for this item.</div>';
      }
    }

    var purchases = purchasesFor(item);
    global.MBMS_RECORDS.renderTable(document.getElementById('purchase-body'), purchases, [
      { key: 'date' },
      { key: 'supplier' },
      { render: function (row) { return global.MBMS_UTILS.escapeHtml(row.variant || row.unit || row.bag_size || ''); } },
      { key: 'quantity' },
      { key: 'total' },
      { key: 'paid' },
      { key: 'remaining' },
      { key: 'location' }
    ], 'No purchases yet.');

    global.MBMS_RECORDS.renderTable(document.getElementById('supplier-body'), purchases, [
      { key: 'date' }, { key: 'supplier' }, { key: 'total' }, { key: 'paid' }, { key: 'remaining' }
    ], 'No supplier rows yet.');

    global.MBMS_RECORDS.renderTable(document.getElementById('payment-body'), purchases, [
      { key: 'date' }, { key: 'supplier' }, { key: 'paid' }, { key: 'remaining' }, { key: 'location' }
    ], 'No payment information yet. Official payables stay on Laravel.');

    global.MBMS_RECORDS.renderTable(document.getElementById('history-body'), purchases, [
      { key: 'date' }, { key: 'supplier' }, { key: 'quantity' }, { key: 'total' }, { key: 'location' }
    ], 'No history yet.');

    fillPurchaseLookups(item);
  }

  function fillPurchaseLookups(item) {
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('purchase-unit'),
      unitsFor(item),
      function (row) { return row.id; },
      function (row) { return row.label; }
    );
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('purchase-supplier'),
      global.MBMS_CATALOG.suppliers(),
      function (row) { return row.name; },
      function (row) { return row.name; }
    );
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('purchase-location'));
  }

  function load() {
    var root = document.getElementById('materials-root');
    var id = global.MBMS_RECORDS.queryParam('id');
    setMode(!!id);
    if (!id) {
      renderList();
    }
    return global.MBMS_RECORDS.fetchOrMock(endpoint(), seedItems)
      .then(function (result) {
        if (id) {
          var item = findItem(id);
          if (!item) {
            setMode(false);
            global.MBMS_UI.notify({ type: 'danger', message: 'That material is not available.' });
            renderList(result.source);
            return;
          }
          renderDetail(item, result.source);
        } else {
          renderList(result.source);
        }
      })
      ;
  }

  global.MBMS_PAGE = {
    active: document.body.getAttribute('data-page'),
    title: isRaw() ? 'Raw Materials' : 'Factory Materials',
    onReady: function () {
      var search = document.getElementById('module-search');
      if (search) {
        search.addEventListener('input', global.MBMS_UTILS.debounce(load, 250));
      }

      global.MBMS_UI.bindReset(document.getElementById('material-form'), document.getElementById('material-reset'));
      global.MBMS_UI.bindReset(document.getElementById('purchase-form'), document.getElementById('purchase-reset'), function () {
        var item = findItem(global.MBMS_RECORDS.queryParam('id'));
        if (item) {
          fillPurchaseLookups(item);
        }
      });

      global.MBMS_UI.bindForm(document.getElementById('material-form'), {
        onSubmit: function (values) {
          var record = {
            id: 'local-' + Date.now(),
            name: values.name,
            units: isRaw()
              ? [{ id: '170kg', label: '170kg bag' }, { id: '220kg', label: '220kg bag' }]
              : [{ id: values.unit || 'piece', label: values.unit_label || values.unit || 'Piece' }],
            stock_display: isRaw() ? '—' : '',
            notes: isRaw()
              ? 'Raw-material stock. Separate from finished detergent stock.'
              : 'Factory-use material. Stock tracking is an open question.'
          };
          return global.MBMS_RECORDS.submitOrMock('post', endpoint(), record, function (body) {
            return global.MBMS_RECORDS.storeSave(storeKey(), body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Material saved.' : 'API not connected. Sample material only.'
            });
            document.getElementById('material-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('materialModal')).hide();
            global.location.search = '?id=' + encodeURIComponent((result.data && result.data.id) || record.id);
          });
        }
      });

      global.MBMS_UI.bindForm(document.getElementById('purchase-form'), {
        onSubmit: function (values) {
          var item = findItem(global.MBMS_RECORDS.queryParam('id')) || {};
          var supplier = values.person || values.supplier;
          if (!isRaw() && !supplier) {
            var missing = { message: 'Choose a supplier or enter a person.', errors: { supplier: ['Required'], person: ['Required'] } };
            throw missing;
          }
          var record = {
            id: 'local-' + Date.now(),
            category: isRaw() ? 'raw-materials' : 'factory-materials',
            material_id: item.id,
            raw_material_id: isRaw() ? item.id : '',
            product: item.name,
            supplier: supplier,
            variant: values.unit,
            unit: values.unit,
            bag_size: values.unit,
            bags: values.bags,
            kg_per_bag: values.kg_per_bag,
            total_kg: values.total_kg,
            quantity: values.quantity || values.bags || values.total_kg,
            price: values.price,
            total: values.total,
            paid: values.paid,
            remaining: values.remaining,
            payment_type: values.payment_type,
            date: values.date,
            location: values.location
          };
          return global.MBMS_RECORDS.submitOrMock('post', endpoint() + '/purchases', record, function (body) {
            global.MBMS_RECORDS.storeSave('purchases', body);
            return global.MBMS_RECORDS.storeSave(purchaseStore(), body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? 'Purchase sent. Official stock and payables stay on Laravel.'
                : 'API not connected. Sample purchase only. Browser stock was not changed.'
            });
            document.getElementById('purchase-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('purchaseModal')).hide();
            load();
          });
        }
      });

      load();
    }
  };
})(window);
