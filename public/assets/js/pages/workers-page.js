/**
 * Workers UI: list, profile, payments, monthly report display.
 * Tracks money received. Not a payroll system.
 */
(function (global) {
  'use strict';

  function num(value) {
    var n = Number(String(value == null ? '' : value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }

  function moneyText(n) {
    return num(n).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function currentMonth() {
    return todayIso().slice(0, 7);
  }

  function seedWorkers() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.workers) || [];
  }

  function seedPayments() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.workerPayments) || [];
  }

  function seedMonthly() {
    if (global.MBMS_MOCK && Array.isArray(global.MBMS_MOCK.workerMonthlyReports)) {
      return global.MBMS_MOCK.workerMonthlyReports;
    }
    return buildMonthly(seedPayments());
  }

  function buildMonthly(payments) {
    if (global.MBMS_API && typeof global.MBMS_API.monthlyFromPayments === 'function') {
      return global.MBMS_API.monthlyFromPayments(payments);
    }
    var groups = {};
    (payments || []).forEach(function (row) {
      var workerId = String(row.worker_id || '');
      var month = row.month || String(row.date || '').slice(0, 7);
      if (!workerId || !month) {
        return;
      }
      var key = workerId + '|' + month;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          worker_id: workerId,
          worker: row.worker || '',
          month: month,
          dates: [],
          amounts: [],
          total: 0
        };
      }
      if (row.date) {
        groups[key].dates.push(row.date);
      }
      groups[key].amounts.push(row.amount != null ? String(row.amount) : moneyText(row.amount_raw));
      groups[key].total += row.amount_raw != null ? num(row.amount_raw) : num(row.amount);
    });
    return Object.keys(groups).map(function (key) {
      var group = groups[key];
      return {
        id: group.id,
        worker_id: group.worker_id,
        worker: group.worker,
        month: group.month,
        dates: group.dates.join(', '),
        amounts: group.amounts.join(', '),
        monthly_total_display: moneyText(group.total),
        monthly_total_raw: group.total
      };
    }).sort(function (a, b) {
      if (a.month === b.month) {
        return String(a.worker).localeCompare(String(b.worker));
      }
      return String(b.month).localeCompare(String(a.month));
    });
  }

  function workers() {
    return seedWorkers();
  }

  function payments() {
    return seedPayments();
  }

  function monthlyRows() {
    var rows = seedMonthly();
    if ((!rows || !rows.length) && payments().length) {
      rows = buildMonthly(payments());
      global.MBMS_MOCK = global.MBMS_MOCK || {};
      global.MBMS_MOCK.workerMonthlyReports = rows;
    }
    return rows || [];
  }

  function findWorker(id) {
    return workers().filter(function (row) {
      return String(row.id) === String(id);
    })[0] || null;
  }

  function paymentsFor(workerId) {
    return payments().filter(function (row) {
      return String(row.worker_id) === String(workerId);
    });
  }

  function paidTotalFor(workerId) {
    return paymentsFor(workerId).reduce(function (sum, row) {
      return sum + (row.amount_raw != null ? num(row.amount_raw) : num(row.amount));
    }, 0);
  }

  function setMode(detail) {
    document.getElementById('list-view').hidden = !!detail;
    document.getElementById('detail-view').hidden = !detail;
  }

  function filteredWorkers() {
    var query = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    return workers().filter(function (row) {
      if (!query) {
        return true;
      }
      var text = [row.name, row.phone, row.notes].join(' ').toLowerCase();
      return text.indexOf(query) !== -1;
    });
  }

  function renderList(source) {
    var rows = filteredWorkers();
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);

    var allPaid = 0;
    rows.forEach(function (row) {
      allPaid += paidTotalFor(row.id);
    });

    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      { icon: 'bi-person-badge', label: 'Workers', value: rows.length, tone: 'primary' },
      { icon: 'bi-cash-coin', label: 'Paid (listed)', value: moneyText(allPaid), tone: 'success' },
      { icon: 'bi-calendar3', label: 'Payment rows', value: payments().length, tone: 'info' }
    ]);

    if (!rows.length) {
      document.getElementById('worker-table-wrap').hidden = true;
      document.getElementById('worker-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('worker-empty'), {
        title: 'No workers yet',
        message: 'Add a worker, then record payments from their profile.'
      });
    } else {
      document.getElementById('worker-empty').hidden = true;
      document.getElementById('worker-table-wrap').hidden = false;
      global.MBMS_RECORDS.renderTable(document.getElementById('worker-list-body'), rows, [
        { key: 'name' },
        {
          render: function (row) {
            return global.MBMS_UTILS.escapeHtml(row.phone || '—');
          }
        },
        {
          render: function (row) {
            return global.MBMS_UTILS.escapeHtml(row.notes || '—');
          }
        },
        {
          render: function (row) {
            return global.MBMS_UTILS.escapeHtml(moneyText(paidTotalFor(row.id)));
          }
        },
        {
          render: function (row) {
            return global.MBMS_RECORDS.actionButton('?id=' + encodeURIComponent(row.id), 'Open', 'bi-box-arrow-up-right');
          }
        }
      ]);
    }
    renderMonthly();
  }

  function renderMonthly() {
    var month = (document.getElementById('report-month') || {}).value || '';
    var rows = monthlyRows().filter(function (row) {
      return !month || String(row.month) === String(month);
    });

    var total = 0;
    rows.forEach(function (row) {
      total += row.monthly_total_raw != null ? num(row.monthly_total_raw) : num(row.monthly_total_display);
    });

    global.MBMS_RECORDS.renderSummary(document.getElementById('monthly-summary'), [
      {
        icon: 'bi-calendar3',
        label: month || 'All months',
        value: rows.length + ' worker' + (rows.length === 1 ? '' : 's'),
        tone: 'primary'
      },
      {
        icon: 'bi-cash-stack',
        label: 'Month total',
        value: moneyText(total),
        tone: 'success'
      }
    ]);

    if (!rows.length) {
      document.getElementById('monthly-table-wrap').hidden = true;
      document.getElementById('monthly-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('monthly-empty'), {
        title: 'No monthly report rows',
        message: month
          ? 'No payments recorded for ' + month + '.'
          : 'Record worker payments to build the monthly report.'
      });
      return;
    }
    document.getElementById('monthly-empty').hidden = true;
    document.getElementById('monthly-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderTable(document.getElementById('monthly-body'), rows, [
      { key: 'worker' },
      { key: 'month' },
      { key: 'dates' },
      { key: 'amounts' },
      { key: 'monthly_total_display' }
    ]);
  }

  function renderDetail(worker, source) {
    global.MBMS_UTILS.setIconHeading(document.getElementById('detail-title'), null, worker.name);
    document.getElementById('detail-phone').textContent = worker.phone || 'No phone';
    document.getElementById('detail-notes').textContent = worker.notes || '';
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);

    var rows = paymentsFor(worker.id);
    var total = paidTotalFor(worker.id);
    global.MBMS_RECORDS.renderSummary(document.getElementById('detail-summary'), [
      { icon: 'bi-receipt', label: 'Payments', value: rows.length, tone: 'info' },
      { icon: 'bi-cash-coin', label: 'Total paid', value: moneyText(total), tone: 'success' }
    ]);

    if (!rows.length) {
      document.getElementById('pay-table-wrap').hidden = true;
      document.getElementById('pay-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('pay-empty'), {
        title: 'No payments yet',
        message: 'Use Record payment to log money paid to this worker.'
      });
    } else {
      document.getElementById('pay-empty').hidden = true;
      document.getElementById('pay-table-wrap').hidden = false;
      global.MBMS_RECORDS.renderTable(document.getElementById('pay-body'), rows, [
        { key: 'date' }, { key: 'amount' }, { key: 'description' }, { key: 'user' }, { key: 'location' }
      ]);
    }

    var personal = monthlyRows().filter(function (row) {
      return String(row.worker_id) === String(worker.id);
    });
    global.MBMS_RECORDS.renderTable(document.getElementById('detail-monthly-body'), personal, [
      { key: 'month' }, { key: 'dates' }, { key: 'amounts' }, { key: 'monthly_total_display' }
    ], 'No monthly totals yet.');
  }

  function fillLocationSelects() {
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('pay-location'));
  }

  function paymentRowsFrom(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }
    var data = global.MBMS_UTILS ? global.MBMS_UTILS.unwrap(payload) : payload;
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  }

  function loadWorkerPayments(force) {
    if (
      !force &&
      global.MBMS_MOCK &&
      Object.prototype.hasOwnProperty.call(global.MBMS_MOCK, 'workerPayments') &&
      Array.isArray(global.MBMS_MOCK.workerPayments) &&
      Array.isArray(global.MBMS_MOCK.workerMonthlyReports) &&
      global.MBMS_MOCK.workerMonthlyReports.length
    ) {
      return Promise.resolve(global.MBMS_MOCK.workerPayments);
    }
    if (
      !force &&
      global.MBMS_MOCK &&
      Array.isArray(global.MBMS_MOCK.workerPayments) &&
      global.MBMS_MOCK.workerPayments.length
    ) {
      global.MBMS_MOCK.workerMonthlyReports = buildMonthly(global.MBMS_MOCK.workerPayments);
      return Promise.resolve(global.MBMS_MOCK.workerPayments);
    }

    return global.MBMS_API.get('worker-payments', { params: { per_page: 200 } })
      .then(function (response) {
        var rows = paymentRowsFrom(response.data);
        if (global.MBMS_API.rememberWorkerPayments) {
          global.MBMS_API.rememberWorkerPayments(rows);
        } else {
          global.MBMS_MOCK = global.MBMS_MOCK || {};
          global.MBMS_MOCK.workerPayments = rows;
          global.MBMS_MOCK.workerMonthlyReports = buildMonthly(rows);
        }
        if (!global.MBMS_MOCK.workerMonthlyReports || !global.MBMS_MOCK.workerMonthlyReports.length) {
          global.MBMS_MOCK.workerMonthlyReports = buildMonthly(global.MBMS_MOCK.workerPayments || rows);
        }
        return (global.MBMS_MOCK && global.MBMS_MOCK.workerPayments) || rows;
      })
      .catch(function () {
        global.MBMS_MOCK = global.MBMS_MOCK || {};
        global.MBMS_MOCK.workerPayments = global.MBMS_MOCK.workerPayments || [];
        global.MBMS_MOCK.workerMonthlyReports = buildMonthly(global.MBMS_MOCK.workerPayments);
        return global.MBMS_MOCK.workerPayments;
      });
  }

  function load() {
    var id = global.MBMS_RECORDS.queryParam('id');
    setMode(!!id);
    if (!id) {
      renderList();
    }
    return global.MBMS_RECORDS.fetchOrMock('workers', seedWorkers)
      .then(function (result) {
        if (id) {
          var worker = findWorker(id);
          if (!worker) {
            setMode(false);
            global.MBMS_UI.notify({ type: 'danger', message: 'That worker is not available.' });
            renderList(result.source);
            return loadWorkerPayments(false).then(function () {
              renderMonthly();
            });
          }
          renderDetail(worker, result.source);
          return loadWorkerPayments(true).then(function () {
            renderDetail(worker, result.source);
            if (global.MBMS_API && typeof global.MBMS_API.ensureLocations === 'function') {
              return global.MBMS_API.ensureLocations().then(fillLocationSelects).catch(function () {});
            }
          });
        }
        renderList(result.source);
        return loadWorkerPayments(false).then(function () {
          renderList(result.source);
          if (global.MBMS_API && typeof global.MBMS_API.ensureLocations === 'function') {
            return global.MBMS_API.ensureLocations().then(fillLocationSelects).catch(function () {});
          }
        });
      })
      .catch(function () {
        if (!id) {
          renderList('error');
        }
      });
  }

  global.MBMS_PAGE = {
    active: 'workers',
    title: 'Workers',
    prefetchLocations: false,
    onReady: function () {
      fillLocationSelects();

      var monthEl = document.getElementById('report-month');
      if (monthEl && !monthEl.value) {
        monthEl.value = currentMonth();
      }

      var search = document.getElementById('module-search');
      if (search) {
        search.addEventListener('input', global.MBMS_UTILS.debounce(function () {
          if (!global.MBMS_RECORDS.queryParam('id')) {
            renderList();
          }
        }, 250));
      }

      if (monthEl) {
        monthEl.addEventListener('change', renderMonthly);
        monthEl.addEventListener('input', renderMonthly);
      }
      var clearMonth = document.getElementById('report-month-clear');
      if (clearMonth) {
        clearMonth.addEventListener('click', function () {
          if (monthEl) {
            monthEl.value = '';
          }
          renderMonthly();
        });
      }

      document.getElementById('workerModal').addEventListener('show.bs.modal', function () {
        document.getElementById('worker-form').classList.remove('was-validated');
      });

      document.getElementById('payModal').addEventListener('show.bs.modal', function () {
        var date = document.getElementById('pay-date');
        if (date && !date.value) {
          date.value = todayIso();
        }
        fillLocationSelects();
      });

      global.MBMS_UI.bindReset(document.getElementById('worker-form'), document.getElementById('worker-reset'));
      global.MBMS_UI.bindReset(document.getElementById('pay-form'), document.getElementById('pay-reset'), function () {
        var date = document.getElementById('pay-date');
        if (date) {
          date.value = todayIso();
        }
        fillLocationSelects();
      });

      global.MBMS_UI.bindForm(document.getElementById('worker-form'), {
        onSubmit: function (values) {
          var payload = {
            name: values.name,
            phone: values.phone || null,
            notes: values.notes || null
          };
          return global.MBMS_RECORDS.submitOrMock('post', 'workers', payload).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Worker saved.' : 'API not connected. Sample worker only.'
            });
            document.getElementById('worker-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('workerModal')).hide();
            var savedId = (result.data && result.data.id) || payload.id;
            global.location.search = '?id=' + encodeURIComponent(savedId);
          });
        }
      });

      global.MBMS_UI.bindForm(document.getElementById('pay-form'), {
        onSubmit: function (values) {
          var worker = findWorker(global.MBMS_RECORDS.queryParam('id')) || {};
          if (!worker.id) {
            throw { message: 'Open a worker profile before recording a payment.' };
          }
          var amount = num(values.amount);
          if (!(amount > 0)) {
            throw {
              message: 'Enter an amount greater than zero.',
              errors: { amount: ['Amount must be greater than zero'] }
            };
          }
          var record = {
            worker_id: worker.id,
            worker: worker.name,
            amount: amount,
            date: values.date || todayIso(),
            description: values.description || null,
            location: values.location,
            location_id: values.location
          };
          return global.MBMS_RECORDS.submitOrMock('post', 'workers/' + worker.id + '/payments', record).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? 'Payment saved. Monthly report updated.'
                : 'API not connected. Sample payment only.'
            });
            document.getElementById('pay-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('payModal')).hide();
            if (global.MBMS_API.invalidateCaches) {
              global.MBMS_API.invalidateCaches(['workers', 'workerPayments']);
            }
            delete (global.MBMS_MOCK || {}).workerPayments;
            delete (global.MBMS_MOCK || {}).workerMonthlyReports;
            load();
          });
        }
      });

      load();
    }
  };
})(window);
