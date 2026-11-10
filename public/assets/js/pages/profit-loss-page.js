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
    if (productId && global.MBMS_FILTERS && typeof global.MBMS_FILTERS.productLabel === 'function') {
      productLabel = String(global.MBMS_FILTERS.productLabel(productId) || '').toLowerCase();
    } else if (productId && global.MBMS_FILTERS) {
      var match = (global.MBMS_FILTERS.products() || []).filter(function (row) {
        return String(row.id) === productId;
      })[0];
      productLabel = match ? String(match.label || '').toLowerCase() : '';
    }
    return (rows || []).filter(function (row) {
      var rowModule = String(row.module || '').toLowerCase().replace(/_/g, '-');
      var rowProduct = String(row.product || '').toLowerCase();
      var rowProductId = row.product_id != null ? String(row.product_id) : '';
      var productOk = !productId
        || rowProductId === productId
        || (!!productLabel && rowProduct.indexOf(productLabel) !== -1);
      return (!module || rowModule === module || rowModule.indexOf(module) !== -1)
        && productOk;
    });
  }

  function summarizeFilteredRows(rows, baseSummary) {
    var summary = Object.assign({}, baseSummary || {});
    if (!rows || !rows.length) {
      ['gross_sales', 'revenue', 'cost', 'net_profit', 'gross_sales_usd', 'revenue_usd', 'cost_usd', 'net_profit_usd'].forEach(function (key) {
        var item = summary[key];
        if (item && typeof item === 'object') {
          summary[key] = Object.assign({}, item, {
            display: (key.indexOf('usd') !== -1 ? '0.00 USD' : '0.00 AFN'),
            raw: 0
          });
        }
      });
      return summary;
    }
    var afn = { revenue: 0, cost: 0, result: 0 };
    var usd = { revenue: 0, cost: 0, result: 0 };
    rows.forEach(function (row) {
      var bucket = String(row.currency || 'AFN').toUpperCase() === 'USD' ? usd : afn;
      bucket.revenue += num(row.revenue_raw != null ? row.revenue_raw : row.revenue);
      bucket.cost += num(row.cost_raw != null ? row.cost_raw : row.cost);
      bucket.result += num(row.result_raw != null ? row.result_raw : row.result);
    });
    function patch(key, amount, currency) {
      var item = summary[key];
      var display = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
      if (item && typeof item === 'object') {
        summary[key] = Object.assign({}, item, { display: display, raw: amount });
      } else {
        summary[key] = display;
      }
    }
    patch('gross_sales', afn.revenue, 'AFN');
    patch('revenue', afn.revenue, 'AFN');
    patch('cost', afn.cost, 'AFN');
    patch('net_profit', afn.result, 'AFN');
    patch('gross_sales_usd', usd.revenue, 'USD');
    patch('revenue_usd', usd.revenue, 'USD');
    patch('cost_usd', usd.cost, 'USD');
    patch('net_profit_usd', usd.result, 'USD');
    return summary;
  }

  function renderSummary(summary) {
    var net = summaryValue(summary, 'net_profit');
    var netUsd = summaryValue(summary, 'net_profit_usd');
    var netTone = net.raw < 0 ? 'danger' : (net.raw > 0 ? 'success' : 'muted');
    var netUsdTone = netUsd.raw < 0 ? 'danger' : (netUsd.raw > 0 ? 'success' : 'muted');
    var chips = [
      { icon: 'bi-cash-stack', label: 'Gross sales AFN', value: summaryValue(summary, 'gross_sales').display, tone: 'primary' },
      { icon: 'bi-currency-dollar', label: 'Gross sales USD', value: summaryValue(summary, 'gross_sales_usd').display, tone: 'primary' },
      { icon: 'bi-receipt', label: 'Net revenue AFN', value: summaryValue(summary, 'revenue').display, tone: 'info' },
      { icon: 'bi-receipt', label: 'Net revenue USD', value: summaryValue(summary, 'revenue_usd').display, tone: 'info' },
      { icon: 'bi-box-seam', label: 'COGS AFN', value: summaryValue(summary, 'cost').display, tone: 'muted' },
      { icon: 'bi-box-seam', label: 'COGS USD', value: summaryValue(summary, 'cost_usd').display, tone: 'muted' },
      { icon: 'bi-graph-up-arrow', label: 'Net P/L AFN', value: net.display, tone: netTone },
      { icon: 'bi-graph-up-arrow', label: 'Net P/L USD', value: netUsd.display, tone: netUsdTone }
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
      {
        key: 'currency',
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(String(row.currency || 'AFN').toUpperCase());
        }
      },
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
    var filteredRows = applyLocalFilters(data.rows || [], params);
    var summary = data.summary || {};
    if (params.module || params.product_id) {
      summary = summarizeFilteredRows(filteredRows, summary);
    }
    renderSummary(summary);
    renderRows(filteredRows);
  }

  function load() {
    var params = filters();
    var query = {
      date_from: params.date_from || '',
      date_to: params.date_to || '',
      location_id: params.location_id || '',
      product_id: params.product_id || '',
      module: params.module || ''
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
      var ready = global.MBMS_FILTERS
        ? global.MBMS_FILTERS.bind(document.getElementById('pl-filters'), load)
        : Promise.resolve();
      Promise.resolve(ready).then(load);
    }
  };
})(window);
