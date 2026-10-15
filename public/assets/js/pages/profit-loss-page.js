/**
 * Profit & Loss. Displays Laravel weighted-average figures (net of sales returns).
 */
(function (global) {
  'use strict';

  function num(value) {
    var n = Number(String(value == null ? '' : value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }

  function isoDate(date) {
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
  }

  function mockData() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.profitLoss) || { summary: {}, rows: [] };
  }

  function filters() {
    return global.MBMS_FILTERS ? global.MBMS_FILTERS.params(document.getElementById('pl-filters')) : {};
  }

  function setRange(kind) {
    var root = document.getElementById('pl-filters');
    if (!root) {
      return;
    }
    var fromEl = root.querySelector('[name="date_from"]');
    var toEl = root.querySelector('[name="date_to"]');
    if (!fromEl || !toEl) {
      return;
    }
    var now = new Date();
    var to = isoDate(now);
    var from = to;
    if (kind === 'month') {
      from = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    } else if (kind === 'year') {
      from = now.getFullYear() + '-01-01';
    } else {
      var past = new Date(now);
      past.setDate(past.getDate() - 89);
      from = isoDate(past);
    }
    fromEl.value = from;
    toEl.value = to;
    document.querySelectorAll('[data-pl-range]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-pl-range') === kind);
    });
  }

  function summaryValue(summary, key) {
    var item = summary[key];
    if (item && typeof item === 'object') {
      return {
        display: item.display != null ? item.display : '—',
        raw: item.raw != null ? num(item.raw) : num(item.display),
        label: item.label || key
      };
    }
    return { display: item != null && item !== '' ? item : '—', raw: num(item), label: key };
  }

  function applyLocalFilters(rows, params) {
    var module = String(params.module || '').toLowerCase();
    var productId = String(params.product_id || '');
    var productLabel = '';
    if (productId && global.MBMS_FILTERS) {
      var match = (global.MBMS_FILTERS.products() || []).filter(function (row) {
        return String(row.id) === productId;
      })[0];
      productLabel = match ? String(match.label || '').toLowerCase() : '';
    }
    return (rows || []).filter(function (row) {
      var rowModule = String(row.module || '').toLowerCase().replace(/_/g, '-');
      var rowProduct = String(row.product || '').toLowerCase();
      return (!module || rowModule === module || rowModule.indexOf(module) !== -1)
        && (!productLabel || rowProduct.indexOf(productLabel) !== -1);
    });
  }

  function renderSummary(summary) {
    var net = summaryValue(summary, 'net_profit');
    var netTone = net.raw < 0 ? 'danger' : (net.raw > 0 ? 'success' : 'muted');
    var chips = [
      { icon: 'bi-cash-stack', label: 'Gross sales', value: summaryValue(summary, 'gross_sales').display, tone: 'primary' },
      { icon: 'bi-arrow-return-left', label: 'Sales returns', value: summaryValue(summary, 'returns_amount').display, tone: 'warning' },
      { icon: 'bi-receipt', label: 'Net revenue', value: summaryValue(summary, 'revenue').display, tone: 'info' },
      { icon: 'bi-box-seam', label: 'Cost of goods', value: summaryValue(summary, 'cost').display, tone: 'muted' },
      { icon: 'bi-graph-up-arrow', label: 'Net profit / loss', value: net.display, tone: netTone }
    ];
    global.MBMS_RECORDS.renderSummary(document.getElementById('pl-summary'), chips);

    var note = document.getElementById('pl-note');
    var text = summary.note || '';
    if (note) {
      note.hidden = !text;
      note.textContent = text;
    }
  }

  function renderRows(rows) {
    var body = document.getElementById('pl-body');
    if (!rows.length) {
      document.getElementById('pl-table-wrap').hidden = true;
      document.getElementById('pl-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('pl-empty'), {
        title: 'No profit/loss rows',
        message: 'No sales in this period after returns. Adjust the date range or location.'
      });
      return;
    }
    document.getElementById('pl-empty').hidden = true;
    document.getElementById('pl-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderTable(body, rows, [
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
          var raw = row.result_raw != null ? num(row.result_raw) : num(row.result);
          var tone = raw < 0 ? 'text-danger' : (raw > 0 ? 'text-success' : 'text-secondary');
          return '<span class="fw-semibold ' + tone + '">' + global.MBMS_UTILS.escapeHtml(row.result || '0.00') + '</span>';
        }
      }
    ]);
  }

  function render(result) {
    var params = filters();
    var data = result.data || mockData();
    if (result.source !== 'api') {
      data = mockData();
    }
    if (!data.summary) {
      data = Object.assign({ summary: {}, rows: [] }, data);
    }
    global.MBMS_RECORDS.showBanner(
      document.getElementById('source-banner'),
      result.source,
      'Showing sample P&L figures. Official calculations stay on Laravel.'
    );
    renderSummary(data.summary || {});
    renderRows(applyLocalFilters(data.rows || [], params));
  }

  function load() {
    var params = filters();
    var query = {
      date_from: params.date_from || '',
      date_to: params.date_to || '',
      location_id: params.location_id || ''
    };
    return global.MBMS_RECORDS.fetchOrMock('reports/profit-loss', mockData, query)
      .then(render)
      .catch(function (error) {
        document.getElementById('pl-table-wrap').hidden = true;
        document.getElementById('pl-empty').hidden = false;
        global.MBMS_UI.renderError(document.getElementById('pl-empty'), {
          title: 'Unable to load profit/loss',
          message: global.MBMS_UTILS.getErrorMessage(error),
          actionLabel: 'Try again',
          onAction: load
        });
      });
  }

  global.MBMS_PAGE = {
    active: 'profit-loss',
    title: 'Profit & Loss',
    onReady: function () {
      if (global.MBMS_FILTERS) {
        global.MBMS_FILTERS.bind(document.getElementById('pl-filters'), load);
      }
      setRange('90');
      var presets = document.getElementById('pl-presets');
      if (presets) {
        presets.addEventListener('click', function (event) {
          var btn = event.target.closest('[data-pl-range]');
          if (!btn) {
            return;
          }
          setRange(btn.getAttribute('data-pl-range'));
          load();
        });
      }
      load();
    }
  };
})(window);
