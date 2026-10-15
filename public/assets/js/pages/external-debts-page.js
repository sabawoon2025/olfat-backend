/**
 * External debtors/creditors. Separate from customers and suppliers.
 * Directions are never mixed: business owes vs person owes the business.
 */
(function (global) {
  'use strict';

  var DIRECTIONS = {
    business_owes: {
      id: 'business_owes',
      label: 'Business owes this person',
      short: 'Business owes',
      cls: 'mbms-dir mbms-dir-out',
      banner: 'is-out',
      paymentLabel: 'Amount paid to this person'
    },
    person_owes: {
      id: 'person_owes',
      label: 'This person owes the business',
      short: 'Person owes business',
      cls: 'mbms-dir mbms-dir-in',
      banner: 'is-in',
      paymentLabel: 'Amount received from this person'
    }
  };

  function seed() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.externalDebts) || [];
  }

  function records() {
    return global.MBMS_RECORDS.mergeList('externalDebts', seed());
  }

  function findRecord(id) {
    return records().filter(function (row) { return row.id === id; })[0] || null;
  }

  function paymentsFor(id) {
    var seedPays = ((global.MBMS_MOCK && global.MBMS_MOCK.externalDebtPayments) || []).filter(function (row) {
      return row.debt_id === id;
    });
    return global.MBMS_RECORDS.storeList('externalDebtPayments').filter(function (row) {
      return row.debt_id === id;
    }).concat(seedPays);
  }

  function directionInfo(value) {
    return DIRECTIONS[value] || DIRECTIONS.business_owes;
  }

  function currentFilter() {
    return global.MBMS_RECORDS.queryParam('direction') || '';
  }

  function setMode(detail) {
    document.getElementById('list-view').hidden = !!detail;
    document.getElementById('detail-view').hidden = !detail;
  }

  function renderList(source) {
    var query = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var direction = currentFilter();
    var rows = records().filter(function (row) {
      return (!query || String(row.person + ' ' + row.reason).toLowerCase().indexOf(query) !== -1)
        && (!direction || row.direction === direction);
    });
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    document.querySelectorAll('[data-debt-tab]').forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('data-debt-tab') === (direction || 'all'));
    });
    if (!rows.length) {
      document.getElementById('debt-table-wrap').hidden = true;
      document.getElementById('debt-empty').hidden = false;
      global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), []);
      global.MBMS_UI.renderEmpty(document.getElementById('debt-empty'), {
        title: 'No external debt records',
        message: 'Add a debtor or creditor to get started.'
      });
      return;
    }
    document.getElementById('debt-empty').hidden = true;
    document.getElementById('debt-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      { icon: 'bi-bank', label: 'Records', value: rows.length }
    ]);
    global.MBMS_RECORDS.renderTable(document.getElementById('debt-list-body'), rows, [
      { key: 'person' },
      {
        render: function (row) {
          var info = directionInfo(row.direction);
          return '<span class="' + info.cls + '">' + global.MBMS_UTILS.escapeHtml(info.short) + '</span>';
        }
      },
      { key: 'reason' },
      { key: 'original_amount' },
      { key: 'paid_received' },
      { key: 'remaining_display' },
      { key: 'date' },
      {
        render: function (row) {
          return global.MBMS_RECORDS.actionButton('?id=' + encodeURIComponent(row.id), 'Open', 'bi-box-arrow-up-right');
        }
      }
    ]);
  }

  function renderDetail(record, source) {
    var info = directionInfo(record.direction);
    global.MBMS_UTILS.setIconHeading(document.getElementById('detail-title'), null, record.person);
    document.getElementById('detail-reason').textContent = record.reason || '';
    document.getElementById('detail-original').textContent = record.original_amount || '—';
    document.getElementById('detail-paid').textContent = record.paid_received || '—';
    document.getElementById('detail-remaining').textContent = record.remaining_display || '—';
    document.getElementById('detail-date').textContent = record.date || '—';
    document.getElementById('detail-user').textContent = record.user || '—';
    document.getElementById('detail-location').textContent = record.location || '—';
    var banner = document.getElementById('direction-banner');
    banner.className = 'mbms-direction-banner ' + info.banner;
    document.getElementById('direction-label').textContent = info.label;
    document.getElementById('pay-amount-label').textContent = info.paymentLabel;
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);

    var pays = paymentsFor(record.id);
    if (!pays.length) {
      document.getElementById('hist-table-wrap').hidden = true;
      document.getElementById('hist-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('hist-empty'), {
        title: 'No payment history',
        message: 'Payments on this debt will show up here.'
      });
    } else {
      document.getElementById('hist-empty').hidden = true;
      document.getElementById('hist-table-wrap').hidden = false;
      global.MBMS_RECORDS.renderTable(document.getElementById('hist-body'), pays, [
        { key: 'date' }, { key: 'amount' }, { key: 'description' }, { key: 'user' }, { key: 'location' }
      ]);
    }
  }

  function load() {
    var root = document.getElementById('debts-root');
    var id = global.MBMS_RECORDS.queryParam('id');
    setMode(!!id);
    if (!id) {
      renderList();
    }
    return global.MBMS_RECORDS.fetchOrMock('external-debts', seed)
      .then(function (result) {
        if (id) {
          var record = findRecord(id);
          if (!record) {
            setMode(false);
            global.MBMS_UI.notify({ type: 'danger', message: 'That record is not available.' });
            renderList(result.source);
            return;
          }
          renderDetail(record, result.source);
        } else {
          renderList(result.source);
        }
      })
      ;
  }

  global.MBMS_PAGE = {
    active: 'external-debts',
    title: 'External Debts',
    onReady: function () {
      global.MBMS_RECORDS.fillWorkLocation(document.getElementById('debt-location'));
      global.MBMS_RECORDS.fillWorkLocation(document.getElementById('pay-location'));

      var search = document.getElementById('module-search');
      if (search) {
        search.addEventListener('input', global.MBMS_UTILS.debounce(load, 250));
      }

      global.MBMS_UI.bindReset(document.getElementById('debt-form'), document.getElementById('debt-reset'));
      global.MBMS_UI.bindReset(document.getElementById('pay-form'), document.getElementById('pay-reset'));

      global.MBMS_UI.bindForm(document.getElementById('debt-form'), {
        onSubmit: function (values) {
          var info = directionInfo(values.direction);
          var record = {
            id: 'local-' + Date.now(),
            person: values.person,
            direction: values.direction,
            reason: values.reason,
            original_amount: values.original_amount,
            paid_received: values.paid_received || '',
            remaining_display: values.remaining || '—',
            date: values.date,
            user: 'Signed-in user',
            location: values.location
          };
          return global.MBMS_RECORDS.submitOrMock('post', 'external-debts', record, function (body) {
            return global.MBMS_RECORDS.storeSave('externalDebts', body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              title: info.short,
              message: result.source === 'api'
                ? 'Saved. Official remaining balance stays on Laravel.'
                : 'API not connected. Sample record only. No local balance was calculated. Opening balances are still an open question.'
            });
            document.getElementById('debt-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('debtModal')).hide();
            global.location.search = '?id=' + encodeURIComponent((result.data && result.data.id) || record.id);
          });
        }
      });

      global.MBMS_UI.bindForm(document.getElementById('pay-form'), {
        onSubmit: function (values) {
          var debt = findRecord(global.MBMS_RECORDS.queryParam('id')) || {};
          var record = {
            id: 'local-' + Date.now(),
            debt_id: debt.id,
            amount: values.amount,
            date: values.date,
            description: values.description,
            user: values.user || 'Signed-in user',
            location: values.location
          };
          return global.MBMS_RECORDS.submitOrMock('post', 'external-debts/' + debt.id + '/payments', record, function (body) {
            return global.MBMS_RECORDS.storeSave('externalDebtPayments', body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? 'Payment sent. Official remaining balance stays on Laravel.'
                : 'API not connected. Sample payment only. Remaining balance was not calculated here.'
            });
            document.getElementById('pay-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('payModal')).hide();
            load();
          });
        }
      });

      load();
    }
  };
})(window);
