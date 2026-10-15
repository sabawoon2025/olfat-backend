/**
 * Reports UI. Displays Laravel report rows and summaries.
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

  var LABELS = {
    date: 'Date',
    period: 'Period',
    product: 'Product',
    customer: 'Customer',
    supplier: 'Supplier',
    amount: 'Amount',
    location: 'Location',
    category: 'Category',
    variant: 'Variant',
    type: 'Type',
    quantity: 'Quantity',
    stock_display: 'Value / Stock',
    person: 'Person',
    direction: 'Direction',
    remaining_display: 'Remaining / Result',
    worker: 'Worker',
    month: 'Month',
    monthly_total_display: 'Monthly total',
    note: 'Note',
    module: 'Module',
    revenue: 'Net revenue',
    returns: 'Returns',
    cost: 'COGS',
    result: 'Profit / Loss',
    sold_qty: 'Sold',
    returned_qty: 'Returned'
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

  function isProfitLoss() {
    return groupId() === 'financial' && kindId() === 'profit-loss';
  }

  function mockRows() {
    var all = (global.MBMS_MOCK && global.MBMS_MOCK.reports) || {};
    var group = all[groupId()] || {};
    return group[kindId()] || [];
  }

  function endpoint() {
    return 'reports/' + groupId() + '/' + kindId();
  }

  function columnsFor() {
    if (isProfitLoss()) {
      return [
        { key: 'module' },
        { key: 'product' },
        { key: 'location' },
        { key: 'sold_qty' },
        { key: 'returned_qty' },
        { key: 'revenue' },
        { key: 'cost' },
        {
          key: 'result',
          render: function (row) {
            var raw = row.result_raw != null ? Number(row.result_raw) : Number(String(row.result || '').replace(/,/g, ''));
            var tone = raw < 0 ? 'text-danger' : (raw > 0 ? 'text-success' : 'text-secondary');
            return '<span class="fw-semibold ' + tone + '">' + global.MBMS_UTILS.escapeHtml(row.result || '0.00') + '</span>';
          }
        }
      ];
    }
    if (groupId() === 'stock' && kindId() === 'returned') {
      return [
        { key: 'date' }, { key: 'product' }, { key: 'variant' }, { key: 'type' },
        { key: 'quantity' }, { key: 'stock_display' }, { key: 'customer' }, { key: 'location' }
      ];
    }
    return (GROUPS[groupId()] || GROUPS.sales).columns;
  }

  function applyClientFilters(rows, params) {
    var filters = global.MBMS_FILTERS;
    var locationName = filters && params.location_id ? filters.locationLabel(params.location_id) : '';
    var customerName = filters && params.customer_id ? filters.personLabel('customer', params.customer_id) : '';
    var supplierName = filters && params.supplier_id ? filters.personLabel('supplier', params.supplier_id) : '';
    return (rows || []).filter(function (row) {
      var search = String(params.search || '').toLowerCase();
      var text = [row.product, row.person, row.customer, row.supplier, row.worker, row.detail, row.module].join(' ').toLowerCase();
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
      return '<a class="btn btn-outline-primary btn-sm' + active + '" href="' + href + '">' +
        global.MBMS_UTILS.escapeHtml(item.label) + '</a>';
    }).join('');
    global.MBMS_UTILS.setIconHeading(
      document.getElementById('report-title'),
      'bi-bar-chart-line',
      (GROUPS[group] || GROUPS.sales).label + ' reports'
    );
    var plLink = document.getElementById('pl-link');
    if (plLink) {
      plLink.hidden = !isProfitLoss();
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

  function renderSummaryChips(summary, rows) {
    var chips = [];
    if (isProfitLoss()) {
      var netRaw = summary.net_profit_raw != null
        ? Number(summary.net_profit_raw)
        : Number(String(summary.net_profit || summary.remaining || '').replace(/,/g, ''));
      var netTone = netRaw < 0 ? 'danger' : (netRaw > 0 ? 'success' : 'muted');
      chips = [
        { icon: 'bi-cash-stack', label: 'Gross sales', value: summary.gross_sales || '—', tone: 'primary' },
        { icon: 'bi-arrow-return-left', label: 'Returns', value: summary.returns_amount || '—', tone: 'warning' },
        { icon: 'bi-receipt', label: 'Net revenue', value: summary.revenue || summary.total || '—', tone: 'info' },
        { icon: 'bi-box-seam', label: 'COGS', value: summary.cost || summary.paid || '—', tone: 'muted' },
        { icon: 'bi-graph-up-arrow', label: 'Net profit / loss', value: summary.net_profit || summary.remaining || '—', tone: netTone }
      ];
    } else {
      chips.push({ icon: 'bi-list-ul', label: 'Rows shown', value: rows.length, tone: 'primary' });
      if (summary.count != null && summary.count !== '') {
        chips.push({ icon: 'bi-hash', label: 'Records', value: summary.count, tone: 'info' });
      }
      if (summary.total != null && summary.total !== '') {
        chips.push({ icon: 'bi-cash-stack', label: 'Total', value: summary.total, tone: 'success' });
      }
      if (summary.paid != null && summary.paid !== '') {
        chips.push({ icon: 'bi-wallet2', label: 'Paid', value: summary.paid, tone: 'accent' });
      }
      if (summary.remaining != null && summary.remaining !== '') {
        chips.push({ icon: 'bi-hourglass-split', label: 'Remaining', value: summary.remaining, tone: 'warning' });
      }
    }
    global.MBMS_RECORDS.renderSummary(document.getElementById('report-summary'), chips);

    var note = document.getElementById('report-note');
    if (note) {
      var text = summary.note || (isProfitLoss() && summary.method_label ? ('Costing: ' + summary.method_label) : '');
      note.hidden = !text;
      note.textContent = text;
    }
  }

  function render(result) {
    var params = global.MBMS_FILTERS ? global.MBMS_FILTERS.params(document.getElementById('report-filters')) : {};
    var payload = result.data && !Array.isArray(result.data) ? result.data : { rows: result.data };
    var rows = result.source === 'api'
      ? (payload.rows || payload.data || [])
      : applyClientFilters(mockRows(), params);
    var summary = payload.summary || {};

    if (params.search && result.source === 'api') {
      rows = applyClientFilters(rows, { search: params.search });
    }

    global.MBMS_RECORDS.showBanner(
      document.getElementById('source-banner'),
      result.source,
      'Showing sample report rows. Official report totals come from Laravel.'
    );
    renderSummaryChips(summary, rows);

    if (!rows.length) {
      document.getElementById('report-table-wrap').hidden = true;
      document.getElementById('report-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('report-empty'), {
        title: isProfitLoss() ? 'No profit/loss rows' : 'No report rows',
        message: isProfitLoss()
          ? 'No net sales in this period. Try another date range or open the full P&L page.'
          : 'No rows match these filters yet.'
      });
    } else {
      document.getElementById('report-empty').hidden = true;
      document.getElementById('report-table-wrap').hidden = false;
      var cols = columnsFor();
      document.getElementById('report-head').innerHTML = '<tr>' + cols.map(function (col) {
        return '<th>' + (LABELS[col.key] || col.key) + '</th>';
      }).join('') + '</tr>';
      global.MBMS_RECORDS.renderTable(document.getElementById('report-body'), rows, cols);
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
    link.download = (groupId() || 'report') + '-' + (kindId() || 'data') + '.csv';
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
