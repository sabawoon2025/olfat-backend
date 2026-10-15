/**
 * Stock display and movement history.
 * Frontend only shows backend/mock values. It does not change stock.
 */
(function (global) {
  'use strict';

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
      var text = (row.product + ' ' + row.variant + ' ' + (row.reference || '')).toLowerCase();
      return (!search || text.indexOf(search) !== -1)
        && (!category || row.category === category)
        && (!location || row.location === location)
        && (!extra.useType || !type || row.type === type)
        && (!from || !row.date || row.date >= from)
        && (!to || !row.date || row.date <= to);
    });
  }

  function render(source) {
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    var stock = applyFilters(currentRows());
    var moves = applyFilters(movementRows(), { useType: true });

    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      { icon: 'bi-boxes', label: 'Stock rows', value: stock.length },
      { icon: 'bi-arrow-left-right', label: 'Movements', value: moves.length }
    ]);

    if (!stock.length) {
      document.getElementById('stock-table-wrap').hidden = true;
      document.getElementById('stock-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('stock-empty'), {
        title: 'No stock rows',
        message: 'Stock will appear after purchases.'
      });
    } else {
      document.getElementById('stock-empty').hidden = true;
      document.getElementById('stock-table-wrap').hidden = false;
      global.MBMS_RECORDS.renderTable(document.getElementById('stock-body'), stock, [
        { key: 'category' }, { key: 'product' }, { key: 'variant' }, { key: 'stock_display' }, { key: 'location' }
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
        { key: 'date' }, { key: 'type' }, { key: 'product' }, { key: 'variant' }, { key: 'quantity' }, { key: 'location' }, { key: 'reference' }
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
    });
  }

  global.MBMS_PAGE = {
    active: 'stock',
    title: 'Stock',
    onReady: function () {
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
        function (row) { return row.name; },
        function (row) { return row.name; },
        '',
        'All locations'
      );
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
