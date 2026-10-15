/**
 * Dashboard UI. Loads the Laravel dashboard API and fills widgets.
 * Does not calculate sales, stock, profit, or debts.
 */
(function (global) {
  'use strict';

  function mockPayload() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.dashboard) || { widgets: {}, recentTransactions: [], stockWarnings: [] };
  }

  function widgetMap(data) {
    if (data.widgets) {
      return data.widgets;
    }
    return {
      todaySales: {
        display: data.today_sales || data.todaySales || '—',
        breakdown: data.today_sales_by_location || []
      },
      todayPurchases: {
        display: data.today_purchases || data.todayPurchases || '—',
        breakdown: data.today_purchases_by_location || []
      },
      currentStock: {
        display: data.current_stock || data.currentStock || '—',
        breakdown: data.current_stock_by_location || []
      },
      customerReceivables: {
        display: data.customer_receivables || data.customerReceivables || '—',
        breakdown: []
      },
      supplierPayables: {
        display: data.supplier_payables || data.supplierPayables || '—',
        breakdown: []
      },
      profitLoss: {
        display: data.profit_loss || data.profitLoss || '—',
        breakdown: []
      },
      workerPayments: {
        display: data.worker_payments || data.workerPayments || '—',
        breakdown: data.worker_payments_by_location || []
      }
    };
  }

  function renderBreakdown(el, rows) {
    if (!el) {
      return;
    }
    if (!rows || !rows.length) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = rows.map(function (row) {
      return (
        '<span class="mbms-stat-province">' +
        '<span class="mbms-stat-province-name">' + global.MBMS_UTILS.escapeHtml(row.name || '') + '</span>' +
        '<span class="mbms-stat-province-value">' + global.MBMS_UTILS.escapeHtml(row.value == null ? '' : String(row.value)) + '</span>' +
        '</span>'
      );
    }).join('');
  }

  function fillWidgets(widgets, isMock) {
    Object.keys(widgets || {}).forEach(function (key) {
      var card = document.querySelector('[data-widget="' + key + '"]');
      if (!card) {
        return;
      }
      var value = card.querySelector('[data-value]');
      var badge = card.querySelector('[data-source-badge]');
      var breakdown = card.querySelector('[data-breakdown]');
      if (value) {
        value.textContent = widgets[key].display != null ? widgets[key].display : '—';
      }
      renderBreakdown(breakdown, widgets[key].breakdown || []);
      if (badge) {
        badge.hidden = !isMock;
      }
    });
  }

  function fillTable(bodyId, rows, columns) {
    var body = document.getElementById(bodyId);
    if (!body) {
      return;
    }
    if (!rows || !rows.length) {
      body.innerHTML = '<tr><td colspan="' + columns + '" class="text-secondary">None right now.</td></tr>';
      return;
    }
    body.innerHTML = rows
      .map(function (row) {
        return (
          '<tr>' +
          columns
            .map(function (key) {
              return '<td>' + global.MBMS_UTILS.escapeHtml(row[key] == null ? '' : row[key]) + '</td>';
            })
            .join('') +
          '</tr>'
        );
      })
      .join('');
  }

  function renderCritical(data, source) {
    var isMock = source === 'mock';
    var banner = document.getElementById('dashboard-source');
    if (banner) {
      if (source === 'error') {
        banner.hidden = false;
        banner.textContent = data.notice
          || 'Unable to load live dashboard data. Check your connection and try again.';
      } else {
        banner.hidden = !isMock;
        if (isMock) {
          banner.textContent = data.notice || 'Showing sample placeholders. Official values will come from Laravel.';
        }
      }
    }
    fillWidgets(widgetMap(data), isMock);
  }

  function renderSecondary(data) {
    fillTable('recent-transactions-body', data.recentTransactions || data.recent_transactions || [], ['when', 'type', 'detail', 'amount']);
    fillTable('stock-warnings-body', data.stockWarnings || data.stock_warnings || [], ['item', 'message']);
  }

  function render(data, source) {
    renderCritical(data, source);
    renderSecondary(data);
  }

  function loadDashboard() {
    var secondary = document.getElementById('dashboard-secondary');

    if (secondary) {
      fillTable('recent-transactions-body', [], 4);
      fillTable('stock-warnings-body', [], 2);
    }

    return global.MBMS_API.get('dashboard')
      .then(function (response) {
        var payload = global.MBMS_UTILS.unwrap(response.data) || response.data || {};
        render(payload, 'api');
      })
      .catch(function (error) {
        var detail = global.MBMS_UTILS && typeof global.MBMS_UTILS.getErrorMessage === 'function'
          ? global.MBMS_UTILS.getErrorMessage(error, '')
          : '';
        render({
          widgets: {},
          recentTransactions: [],
          stockWarnings: [],
          notice: detail
            ? ('Unable to load live dashboard data. ' + detail)
            : 'Unable to load live dashboard data. Check your connection and try again.'
        }, 'error');
      });
  }

  global.MBMS_PAGE = {
    active: 'dashboard',
    title: 'Dashboard',
    prefetchLocations: false,
    onReady: function () {
      var retry = document.getElementById('reload-dashboard');
      if (retry) {
        retry.addEventListener('click', loadDashboard);
      }
      loadDashboard();
    }
  };
})(window);
