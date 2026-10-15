/**
 * Stock display and movement history.
 * Frontend only shows backend/mock values. It does not change stock.
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

  function currentRows() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.stock) || [];
  }

  function movementRows() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.stockMovements) || [];
  }

  function applyFilters(rows, extra) {
    extra = extra || {};
    var search = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var category = (document.getElementById('list-category') || {}).value || '';
    var location = (document.getElementById('list-location') || {}).value || '';
    var type = (document.getElementById('movement-type') || {}).value || '';
    var from = (document.getElementById('date-from') || {}).value || '';
    var to = (document.getElementById('date-to') || {}).value || '';
    return rows.filter(function (row) {
      var text = [
        row.product,
        row.variant,
        row.reference,
        row.type,
        row.category,
        row.location
      ].join(' ').toLowerCase();
      var rowCategory = row.category_id || row.category || '';
      var rowLocation = row.location_id || row.location || '';
      var rowType = row.type_key || String(row.type || '').toLowerCase().replace(/\s+/g, '_');
      return (!search || text.indexOf(search) !== -1)
        && (!category || String(rowCategory) === String(category))
        && (!location || String(rowLocation) === String(location) || String(row.location) === String(location))
        && (!extra.useType || !type || String(rowType) === String(type))
        && (!from || !row.date || row.date >= from)
        && (!to || !row.date || row.date <= to);
    });
  }

  function stockPill(row) {
    var qty = row.quantity_raw != null ? num(row.quantity_raw) : num(row.quantity);
    var unit = row.unit ? ' ' + row.unit : '';
    var tone = qty > 0 ? 'is-ok' : 'is-empty';
    return '<span class="mbms-stock-pill ' + tone + '">' +
      global.MBMS_UTILS.escapeHtml(formatQty(qty) + unit) +
      '</span>';
  }

  function moveQty(row) {
    var qty = row.quantity_raw != null ? num(row.quantity_raw) : num(row.quantity);
    var cls = qty >= 0 ? 'mbms-dir-in' : 'mbms-dir-out';
    var label = row.quantity != null ? String(row.quantity) : ((qty > 0 ? '+' : '') + formatQty(qty));
    return '<span class="mbms-stock-pill ' + cls + '">' +
      global.MBMS_UTILS.escapeHtml(label) +
      '</span>';
  }

  function summarize(stock, moves) {
    var withStock = stock.filter(function (row) {
      return (row.quantity_raw != null ? num(row.quantity_raw) : num(row.quantity)) > 0;
    }).length;
    var empty = stock.length - withStock;
    var inbound = 0;
    var outbound = 0;
    moves.forEach(function (row) {
      var qty = row.quantity_raw != null ? num(row.quantity_raw) : num(row.quantity);
      if (qty >= 0) {
        inbound += qty;
      } else {
        outbound += Math.abs(qty);
      }
    });
    return [
      { icon: 'bi-boxes', label: 'Stock rows', value: stock.length, tone: 'primary' },
      { icon: 'bi-check-circle', label: 'In stock', value: withStock, tone: 'success' },
      { icon: 'bi-exclamation-circle', label: 'Empty', value: empty, tone: empty ? 'warning' : '' },
      { icon: 'bi-arrow-down-circle', label: 'Moved in', value: formatQty(inbound), tone: 'success' },
      { icon: 'bi-arrow-up-circle', label: 'Moved out', value: formatQty(outbound), tone: 'danger' },
      { icon: 'bi-arrow-left-right', label: 'Movements', value: moves.length, tone: 'info' }
    ];
  }

  function render(source) {
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    var stock = applyFilters(currentRows());
    var moves = applyFilters(movementRows(), { useType: true });

    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), summarize(stock, moves));

    if (!stock.length) {
      document.getElementById('stock-table-wrap').hidden = true;
      document.getElementById('stock-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('stock-empty'), {
        title: 'No stock rows',
        message: 'Stock appears after purchases, sales returns, and adjustments.'
      });
    } else {
      document.getElementById('stock-empty').hidden = true;
      document.getElementById('stock-table-wrap').hidden = false;
      global.MBMS_RECORDS.renderTable(document.getElementById('stock-body'), stock, [
        { key: 'category' },
        { key: 'product' },
        { key: 'variant' },
        { render: stockPill },
        { key: 'location' },
        {
          render: function (row) {
            return global.MBMS_UTILS.escapeHtml(row.total_display || row.stock_display || '—');
          }
        }
      ]);
    }

    if (!moves.length) {
      document.getElementById('move-table-wrap').hidden = true;
      document.getElementById('move-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('move-empty'), {
        title: 'No movements',
        message: 'No movements match these filters.'
      });
    } else {
      document.getElementById('move-empty').hidden = true;
      document.getElementById('move-table-wrap').hidden = false;
      global.MBMS_RECORDS.renderTable(document.getElementById('move-body'), moves, [
        { key: 'date' },
        { key: 'type' },
        { key: 'product' },
        { key: 'variant' },
        { render: moveQty },
        { key: 'location' },
        { key: 'reference' }
      ]);
    }
  }

  function load() {
    render();
    return Promise.all([
      global.MBMS_RECORDS.fetchOrMock('stock', currentRows),
      global.MBMS_RECORDS.fetchOrMock('stock/movements', movementRows)
    ]).then(function (results) {
      render(results[0].source);
    }).catch(function () {
      render('error');
    });
  }

  global.MBMS_PAGE = {
    active: 'stock',
    title: 'Stock',
    onReady: function () {
      function fillFilters() {
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

      fillFilters();
      if (global.MBMS_API && typeof global.MBMS_API.ensureLocations === 'function') {
        global.MBMS_API.ensureLocations().then(fillFilters).catch(function () {});
      }

      ['module-search', 'list-category', 'list-location', 'movement-type', 'date-from', 'date-to'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', load);
          el.addEventListener('change', load);
        }
      });
      load();
    }
  };
})(window);
