/**
 * Workers UI: list, profile, payments, monthly report display.
 * Tracks money received. Not a payroll system.
 */
(function (global) {
  'use strict';

  function seedWorkers() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.workers) || [];
  }

  function seedPayments() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.workerPayments) || [];
  }

  function seedMonthly() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.workerMonthlyReports) || [];
  }

  function workers() {
    return seedWorkers();
  }

  function payments() {
    return seedPayments();
  }

  function monthlyRows() {
    return seedMonthly();
  }

  function findWorker(id) {
    return workers().filter(function (row) { return row.id === id; })[0] || null;
  }

  function paymentsFor(workerId) {
    return payments().filter(function (row) { return row.worker_id === workerId; });
  }

  function setMode(detail) {
    document.getElementById('list-view').hidden = !!detail;
    document.getElementById('detail-view').hidden = !detail;
  }

  function renderList(source) {
    var query = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var location = (document.getElementById('list-location') || {}).value || '';
    var rows = workers().filter(function (row) {
      return (!query || String(row.name).toLowerCase().indexOf(query) !== -1)
        && (!location || row.location === location);
    });
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    if (!rows.length) {
      document.getElementById('worker-table-wrap').hidden = true;
      document.getElementById('worker-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('worker-empty'), {
        title: 'No workers yet',
        message: 'Workers you add will show up here.'
      });
    } else {
      document.getElementById('worker-empty').hidden = true;
      document.getElementById('worker-table-wrap').hidden = false;
      global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
        { icon: 'bi-person-badge', label: 'Workers', value: rows.length }
      ]);
      global.MBMS_RECORDS.renderTable(document.getElementById('worker-list-body'), rows, [
        { key: 'name' },
        { key: 'location' },
        { key: 'notes' },
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
      return !month || row.month === month;
    });
    if (!rows.length) {
      document.getElementById('monthly-table-wrap').hidden = true;
      document.getElementById('monthly-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('monthly-empty'), {
        title: 'No monthly report rows',
        message: 'No totals for this month yet.'
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
    document.getElementById('detail-location').textContent = worker.location || '—';
    document.getElementById('detail-notes').textContent = worker.notes || '';
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    var rows = paymentsFor(worker.id);
    if (!rows.length) {
      document.getElementById('pay-table-wrap').hidden = true;
      document.getElementById('pay-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('pay-empty'), {
        title: 'No payments yet',
        message: 'Worker payments you record will show up here.'
      });
    } else {
      document.getElementById('pay-empty').hidden = true;
      document.getElementById('pay-table-wrap').hidden = false;
      global.MBMS_RECORDS.renderTable(document.getElementById('pay-body'), rows, [
        { key: 'date' }, { key: 'amount' }, { key: 'description' }, { key: 'user' }, { key: 'location' }
      ]);
    }
    var personal = monthlyRows().filter(function (row) { return row.worker_id === worker.id; });
    global.MBMS_RECORDS.renderTable(document.getElementById('detail-monthly-body'), personal, [
      { key: 'month' }, { key: 'dates' }, { key: 'amounts' }, { key: 'monthly_total_display' }
    ], 'No monthly report yet. Official totals stay on Laravel.');
  }

  function fillLocationSelects() {
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('list-location'),
      global.MBMS_RECORDS.locations(),
      function (row) { return row.name; },
      function (row) { return row.name; },
      (document.getElementById('list-location') || {}).value || '',
      'All locations'
    );
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('worker-location'));
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

  /**
   * Payments are loaded separately from the workers list request.
   * Used for monthly summary and worker detail history.
   */
  function loadWorkerPayments(force) {
    if (
      !force &&
      global.MBMS_MOCK &&
      Object.prototype.hasOwnProperty.call(global.MBMS_MOCK, 'workerPayments') &&
      Array.isArray(global.MBMS_MOCK.workerPayments) &&
      Array.isArray(global.MBMS_MOCK.workerMonthlyReports)
    ) {
      return Promise.resolve(global.MBMS_MOCK.workerPayments);
    }
    return global.MBMS_API.get('worker-payments', { params: { per_page: 200 } })
      .then(function (response) {
        var rows = paymentRowsFrom(response.data);
        if (global.MBMS_API.rememberWorkerPayments) {
          global.MBMS_API.rememberWorkerPayments(rows);
        }
        return (global.MBMS_MOCK && global.MBMS_MOCK.workerPayments) || rows;
      })
      .catch(function () {
        global.MBMS_MOCK = global.MBMS_MOCK || {};
        global.MBMS_MOCK.workerPayments = global.MBMS_MOCK.workerPayments || [];
        global.MBMS_MOCK.workerMonthlyReports = global.MBMS_MOCK.workerMonthlyReports || [];
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
          renderMonthly();
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
    // Locations fill after workers + payments (see load()) — do not race the list API.
    prefetchLocations: false,
    onReady: function () {
      fillLocationSelects();

      ['module-search', 'list-location', 'report-month'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', load);
          el.addEventListener('change', load);
        }
      });

      global.MBMS_UI.bindReset(document.getElementById('worker-form'), document.getElementById('worker-reset'));
      global.MBMS_UI.bindReset(document.getElementById('pay-form'), document.getElementById('pay-reset'));

      global.MBMS_UI.bindForm(document.getElementById('worker-form'), {
        onSubmit: function (values) {
          values.id = 'local-' + Date.now();
          values.notes = values.notes || 'Tracks money received. Not a payroll record.';
          return global.MBMS_RECORDS.submitOrMock('post', 'workers', values, function (body) {
            return global.MBMS_RECORDS.storeSave('workers', body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Worker saved.' : 'API not connected. Sample worker only.'
            });
            document.getElementById('worker-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('workerModal')).hide();
            global.location.search = '?id=' + encodeURIComponent((result.data && result.data.id) || values.id);
          });
        }
      });

      global.MBMS_UI.bindForm(document.getElementById('pay-form'), {
        onSubmit: function (values) {
          var worker = findWorker(global.MBMS_RECORDS.queryParam('id')) || {};
          var record = {
            id: 'local-' + Date.now(),
            worker_id: worker.id,
            worker: worker.name,
            amount: values.amount,
            date: values.date,
            description: values.description,
            user: values.user || 'Signed-in user',
            location: values.location,
            location_id: values.location
          };
          return global.MBMS_RECORDS.submitOrMock('post', 'workers/' + worker.id + '/payments', record, function (body) {
            return global.MBMS_RECORDS.storeSave('workerPayments', body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? 'Payment sent. Official monthly totals stay on Laravel.'
                : 'API not connected. Sample payment only. No payroll total was calculated.'
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
