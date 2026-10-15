/**
 * Reports UI. Displays backend/mock report rows. Does not calculate official totals.
 */
(function (global) {
  'use strict';

  var GROUPS = {
    sales: {
      label: 'Sales',
      kinds: [
        { id: 'daily', label: 'Daily' },
        { id: 'weekly', label: 'Weekly' },
        { id: 'monthly', label: 'Monthly' },
        { id: 'yearly', label: 'Yearly' }
      ],
      columns: [
        { key: 'date' }, { key: 'period' }, { key: 'product' }, { key: 'customer' }, { key: 'amount' }, { key: 'location' }
      ]
    },
    purchases: {
      label: 'Purchases',
      kinds: [
        { id: 'daily', label: 'Daily' },
        { id: 'weekly', label: 'Weekly' },
        { id: 'monthly', label: 'Monthly' },
        { id: 'yearly', label: 'Yearly' }
      ],
      columns: [
        { key: 'date' }, { key: 'period' }, { key: 'product' }, { key: 'supplier' }, { key: 'amount' }, { key: 'location' }
      ]
    },
    stock: {
      label: 'Stock',
      kinds: [
        { id: 'current', label: 'Current stock' },
        { id: 'movements', label: 'Stock movements' },
        { id: 'damaged', label: 'Damaged stock' },
        { id: 'returned', label: 'Returned stock' }
      ],
      columns: [
        { key: 'date' }, { key: 'category' }, { key: 'product' }, { key: 'variant' }, { key: 'type' }, { key: 'quantity' }, { key: 'stock_display' }, { key: 'location' }
      ]
    },
    financial: {
      label: 'Financial',
      kinds: [
        { id: 'profit-loss', label: 'Profit/Loss' },
        { id: 'customer-debts', label: 'Customer debts' },
        { id: 'supplier-debts', label: 'Supplier debts' },
        { id: 'external-debts', label: 'External debts' },
        { id: 'payments', label: 'Payments' }
      ],
      columns: [
        { key: 'date' }, { key: 'person' }, { key: 'direction' }, { key: 'amount' }, { key: 'remaining_display' }, { key: 'location' }
      ]
    },
    workers: {
      label: 'Workers',
      kinds: [
        { id: 'payments', label: 'Worker payments' },
        { id: 'monthly', label: 'Monthly totals' }
      ],
      columns: [
        { key: 'date' }, { key: 'month' }, { key: 'worker' }, { key: 'amount' }, { key: 'monthly_total_display' }, { key: 'location' }
      ]
    },
    factory: {
      label: 'Factory',
      kinds: [
        { id: 'raw-materials', label: 'Raw materials' },
        { id: 'factory-materials', label: 'Factory materials' }
      ],
      columns: [
        { key: 'product' }, { key: 'stock_display' }, { key: 'note' }, { key: 'location' }
      ]
    },
    location: {
      label: 'Location',
      kinds: [
        { id: 'kabul', label: 'Kabul' },
        { id: 'maidan-wardak', label: 'Maidan/Wardak' },
        { id: 'ghazni', label: 'Ghazni' }
      ],
      columns: [
        { key: 'date' }, { key: 'type' }, { key: 'product' }, { key: 'amount' }, { key: 'location' }
      ]
    }
  };

  var FILTERS_BY_GROUP = {
    sales: ['search', 'date_from', 'date_to', 'category', 'product', 'customer', 'location'],
    purchases: ['search', 'date_from', 'date_to', 'category', 'product', 'supplier', 'location'],
    stock: ['search', 'date_from', 'date_to', 'category', 'product', 'location', 'transaction_type'],
    financial: ['search', 'date_from', 'date_to', 'location'],
    workers: ['search', 'date_from', 'date_to', 'location'],
    factory: ['search', 'location'],
    location: ['search', 'date_from', 'date_to', 'category', 'product']
  };

  function groupId() {
    return global.MBMS_RECORDS.queryParam('group') || 'sales';
  }

  function kindId() {
    var group = GROUPS[groupId()] || GROUPS.sales;
    return global.MBMS_RECORDS.queryParam('kind') || group.kinds[0].id;
  }

  function pageNumber() {
    return parseInt(global.MBMS_RECORDS.queryParam('page') || '1', 10) || 1;
  }

  function mockRows() {
    var all = (global.MBMS_MOCK && global.MBMS_MOCK.reports) || {};
    var group = all[groupId()] || {};
    return group[kindId()] || [];
  }

  function endpoint() {
    return 'reports/' + groupId() + '/' + kindId();
  }

  function applyClientFilters(rows, params) {
    var filters = global.MBMS_FILTERS;
    var locationName = filters && params.location_id ? filters.locationLabel(params.location_id) : '';
    var customerName = filters && params.customer_id ? filters.personLabel('customer', params.customer_id) : '';
    var supplierName = filters && params.supplier_id ? filters.personLabel('supplier', params.supplier_id) : '';
    return (rows || []).filter(function (row) {
      var search = String(params.search || '').toLowerCase();
      var text = [row.product, row.person, row.customer, row.supplier, row.worker, row.detail].join(' ').toLowerCase();
      return (!search || text.indexOf(search) !== -1)
        && (!locationName || row.location === locationName || row.location === 'All')
        && (!params.category || row.category === params.category)
        && (!params.product_id || row.product_id === params.product_id || row.product === params.product_id)
        && (!customerName || row.customer === customerName || row.person === customerName)
        && (!supplierName || row.supplier === supplierName || row.person === supplierName)
        && (!params.transaction_type || row.type === params.transaction_type);
    });
  }

  function setNav() {
    var group = groupId();
    var kind = kindId();
    document.querySelectorAll('[data-report-group]').forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('data-report-group') === group);
    });
    var kinds = (GROUPS[group] || GROUPS.sales).kinds;
    document.getElementById('report-kinds').innerHTML = kinds.map(function (item) {
      var href = 'reports.html?group=' + encodeURIComponent(group) + '&kind=' + encodeURIComponent(item.id);
      var active = item.id === kind ? ' is-active' : '';
      return '<a class="btn btn-outline-primary btn-sm' + active + '" href="' + href + '"><i class="bi bi-file-earmark-bar-graph" aria-hidden="true"></i> ' + global.MBMS_UTILS.escapeHtml(item.label) + '</a>';
    }).join('');
    global.MBMS_UTILS.setIconHeading(
      document.getElementById('report-title'),
      'bi-bar-chart-line',
      (GROUPS[group] || GROUPS.sales).label + ' reports'
    );
    var plLink = document.getElementById('pl-link');
    if (plLink) {
      plLink.hidden = !(group === 'financial' && kind === 'profit-loss');
    }
    if (global.MBMS_FILTERS) {
      global.MBMS_FILTERS.show(document.getElementById('report-filters'), FILTERS_BY_GROUP[group] || FILTERS_BY_GROUP.sales);
    }
  }

  function renderPager(meta) {
    var page = meta.current_page || pageNumber();
    var last = meta.last_page || 1;
    document.getElementById('pager-status').textContent = 'Page ' + page + ' of ' + last;
    document.getElementById('pager-prev').disabled = page <= 1;
    document.getElementById('pager-next').disabled = page >= last;
  }

  function goPage(delta) {
    var next = Math.max(1, pageNumber() + delta);
    var url = new URL(global.location.href);
    url.searchParams.set('group', groupId());
    url.searchParams.set('kind', kindId());
    url.searchParams.set('page', String(next));
    global.location.search = url.search;
  }

  function render(result) {
    var params = global.MBMS_FILTERS ? global.MBMS_FILTERS.params(document.getElementById('report-filters')) : {};
    var payload = result.data && !Array.isArray(result.data) ? result.data : { rows: result.data };
    var rows = result.source === 'api'
      ? (payload.rows || payload.data || [])
      : applyClientFilters(mockRows(), params);
    var summary = payload.summary || {};
    global.MBMS_RECORDS.showBanner(
      document.getElementById('source-banner'),
      result.source,
      'Showing sample report rows. Official report totals come from Laravel.'
    );
    document.getElementById('report-summary').innerHTML = [
      ['rows', rows.length, 'Rows shown']
    ].map(function (item) {
      return (
        '<div class="col-6 col-lg-3"><article class="mbms-card card mbms-stat-card"><div class="card-body">' +
        '<div class="mbms-stat-label">' + item[2] + '</div>' +
        '<div class="mbms-stat-value">' + global.MBMS_UTILS.escapeHtml(summary[item[0]] != null ? summary[item[0]] : item[1]) + '</div>' +
        '</div></article></div>'
      );
    }).join('');

    if (groupId() === 'financial' && kindId() === 'profit-loss') {
      document.getElementById('report-table-wrap').hidden = true;
      document.getElementById('report-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('report-empty'), {
        title: 'Open the Profit & Loss screen',
        message: 'The official P&L layout lives on its own page so costing is not invented in reports.',
        actionLabel: 'Open Profit & Loss',
        onAction: function () {
          global.location.href = 'profit-loss.html';
        }
      });
      renderPager(payload.meta || { current_page: 1, last_page: 1 });
      return;
    }

    if (!rows.length) {
      document.getElementById('report-table-wrap').hidden = true;
      document.getElementById('report-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('report-empty'), {
        title: 'No report rows',
        message: 'No rows match these filters yet.'
      });
    } else {
      document.getElementById('report-empty').hidden = true;
      document.getElementById('report-table-wrap').hidden = false;
      var group = GROUPS[groupId()] || GROUPS.sales;
      var labels = {
        date: 'Date', period: 'Period', product: 'Product', customer: 'Customer',
        supplier: 'Supplier', amount: 'Amount', location: 'Location', category: 'Category',
        variant: 'Variant', type: 'Type', quantity: 'Quantity', stock_display: 'Stock display',
        person: 'Person', direction: 'Direction', remaining_display: 'Remaining',
        worker: 'Worker', month: 'Month', monthly_total_display: 'Monthly total', note: 'Note'
      };
      document.getElementById('report-head').innerHTML = '<tr>' + group.columns.map(function (col) {
        return '<th>' + (labels[col.key] || col.key) + '</th>';
      }).join('') + '</tr>';
      global.MBMS_RECORDS.renderTable(document.getElementById('report-body'), rows, group.columns);
    }
    renderPager(payload.meta || { current_page: pageNumber(), last_page: 1 });
  }

  function exportCsv() {
    var wrap = document.getElementById('report-table-wrap');
    var table = wrap ? wrap.querySelector('table') : null;
    if (!wrap || wrap.hidden || !table || !table.querySelector('tbody tr')) {
      if (global.MBMS_UI && global.MBMS_UI.notify) {
        global.MBMS_UI.notify({ message: 'There are no report rows to download.', type: 'warning' });
      }
      return;
    }
    var lines = [];
    table.querySelectorAll('tr').forEach(function (row) {
      var cells = [];
      row.querySelectorAll('th,td').forEach(function (cell) {
        cells.push('"' + String(cell.innerText || '').replace(/"/g, '""') + '"');
      });
      lines.push(cells.join(','));
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = (groupId() || 'report') + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function load() {
    var params = global.MBMS_FILTERS ? global.MBMS_FILTERS.params(document.getElementById('report-filters')) : {};
    params.page = pageNumber();
    if (groupId() === 'location' && !params.location_id) {
      params.location_id = kindId();
    }
    render({ source: 'empty', data: { rows: [], summary: {} } });
    return global.MBMS_RECORDS.fetchOrMock(endpoint(), mockRows, params)
      .then(render)
      .catch(function (error) {
        document.getElementById('report-table-wrap').hidden = true;
        document.getElementById('report-empty').hidden = false;
        global.MBMS_UI.renderError(document.getElementById('report-empty'), {
          title: 'Unable to load report',
          message: global.MBMS_UTILS.getErrorMessage(error),
          actionLabel: 'Try again',
          onAction: load
        });
      });
  }

  global.MBMS_PAGE = {
    active: 'reports',
    title: 'Reports',
    onReady: function () {
      setNav();
      if (global.MBMS_FILTERS) {
        global.MBMS_FILTERS.bind(document.getElementById('report-filters'), load);
      }
      document.getElementById('pager-prev').addEventListener('click', function () { goPage(-1); });
      document.getElementById('pager-next').addEventListener('click', function () { goPage(1); });
      var exportButton = document.getElementById('report-export');
      if (exportButton) {
        exportButton.addEventListener('click', exportCsv);
      }
      load();
    }
  };
})(window);
