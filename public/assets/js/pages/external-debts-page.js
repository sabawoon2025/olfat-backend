/**
 * External debtors/creditors. Separate from customers and suppliers.
 * Directions are never mixed: business owes vs person owes the business.
 */
(function (global) {
  'use strict';

  var DIRECTIONS = {
    business_owes: {
      id: 'business_owes',
      label: 'We owe this person',
      short: 'We owe',
      cls: 'mbms-dir mbms-dir-out',
      banner: 'is-out',
      paymentLabel: 'Amount paid',
      tone: 'danger'
    },
    person_owes: {
      id: 'person_owes',
      label: 'This person owes us',
      short: 'They owe us',
      cls: 'mbms-dir mbms-dir-in',
      banner: 'is-in',
      paymentLabel: 'Amount received',
      tone: 'success'
    }
  };

  function num(value) {
    var n = Number(String(value == null ? '' : value).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }

  function roundMoney(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function moneyText(n) {
    return roundMoney(n).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function seed() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.externalDebts) || [];
  }

  function records() {
    return seed();
  }

  function findRecord(id) {
    return records().filter(function (row) {
      return String(row.id) === String(id);
    })[0] || null;
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

  function updateDebtRemaining() {
    var original = num((document.getElementById('debt-original') || {}).value);
    var paid = num((document.getElementById('debt-paid') || {}).value);
    var remainingEl = document.getElementById('debt-remaining');
    var error = document.getElementById('debt-amount-error');
    var remaining = roundMoney(Math.max(0, original - paid));
    var invalid = paid < 0 || (original > 0 && paid > original + 0.00001);

    if (remainingEl) {
      remainingEl.value = moneyText(remaining);
    }
    if (error) {
      error.hidden = !invalid;
      error.textContent = invalid
        ? 'Paid / received cannot exceed the original amount.'
        : '';
    }
    return !invalid;
  }

  function syncTabs() {
    var direction = currentFilter();
    document.querySelectorAll('[data-debt-tab]').forEach(function (link) {
      var key = link.getAttribute('data-debt-tab');
      var active = key === (direction || 'all');
      link.classList.toggle('active', active);
      link.classList.toggle('is-active', active);
    });
  }

  function renderList(source) {
    var query = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var direction = currentFilter();
    var rows = records().filter(function (row) {
      var text = [row.person, row.reason, row.reference_no].join(' ').toLowerCase();
      return (!query || text.indexOf(query) !== -1)
        && (!direction || row.direction === direction);
    });

    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    syncTabs();

    var weOwe = 0;
    var theyOwe = 0;
    rows.forEach(function (row) {
      var rem = row.remaining_raw != null ? num(row.remaining_raw) : num(row.remaining_display);
      if (row.direction === 'business_owes') {
        weOwe += rem;
      } else if (row.direction === 'person_owes') {
        theyOwe += rem;
      }
    });

    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      { icon: 'bi-bank', label: 'Records', value: rows.length, tone: 'primary' },
      { icon: 'bi-arrow-up-right', label: 'We owe', value: moneyText(weOwe), tone: 'danger' },
      { icon: 'bi-arrow-down-left', label: 'They owe us', value: moneyText(theyOwe), tone: 'success' }
    ]);

    if (!rows.length) {
      document.getElementById('debt-table-wrap').hidden = true;
      document.getElementById('debt-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('debt-empty'), {
        title: 'No external debt records',
        message: 'Add a record for money owed outside customers and suppliers.'
      });
      return;
    }

    document.getElementById('debt-empty').hidden = true;
    document.getElementById('debt-table-wrap').hidden = false;
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
      {
        render: function (row) {
          var rem = row.remaining_display || moneyText(row.remaining_raw);
          var closed = (row.remaining_raw != null ? num(row.remaining_raw) : num(rem)) <= 0;
          return '<span class="mbms-stock-pill ' + (closed ? 'is-success' : 'is-warning') + '">' +
            global.MBMS_UTILS.escapeHtml(rem) +
            '</span>';
        }
      },
      { key: 'date' },
      {
        render: function (row) {
          return global.MBMS_RECORDS.actionButton('?id=' + encodeURIComponent(row.id), 'Open', 'bi-box-arrow-up-right');
        }
      }
    ]);
  }

  function paymentsFor(record) {
    if (record && Array.isArray(record.payments) && record.payments.length) {
      return record.payments;
    }
    var id = record && record.id;
    return ((global.MBMS_MOCK && global.MBMS_MOCK.externalDebtPayments) || []).filter(function (row) {
      return String(row.debt_id) === String(id);
    });
  }

  function updatePayPreview(record) {
    var remaining = record
      ? (record.remaining_raw != null ? num(record.remaining_raw) : num(record.remaining_display))
      : 0;
    var amount = num((document.getElementById('pay-amount') || {}).value);
    var hint = document.getElementById('pay-remaining-hint');
    var error = document.getElementById('pay-amount-error');
    var preview = document.getElementById('pay-preview');
    var amountInput = document.getElementById('pay-amount');
    var over = amount > 0 && amount > remaining + 0.00001;

    if (hint) {
      hint.textContent = 'Remaining: ' + moneyText(remaining);
    }
    if (error) {
      error.hidden = !over;
      error.textContent = over
        ? ('Cannot exceed remaining (' + moneyText(remaining) + ').')
        : '';
    }
    if (amountInput) {
      amountInput.max = remaining > 0 ? String(remaining) : '';
      amountInput.classList.toggle('is-invalid', over);
    }
    if (preview) {
      preview.hidden = !record;
      document.getElementById('pay-preview-before').textContent = moneyText(remaining);
      document.getElementById('pay-preview-amount').textContent = moneyText(amount);
      document.getElementById('pay-preview-after').textContent = moneyText(Math.max(0, remaining - amount));
    }
  }

  function renderDetail(record, source) {
    var info = directionInfo(record.direction);
    global.MBMS_UTILS.setIconHeading(document.getElementById('detail-title'), null, record.person);
    document.getElementById('detail-reason').textContent = record.reason || '';
    var banner = document.getElementById('direction-banner');
    banner.className = 'mbms-direction-banner ' + info.banner;
    document.getElementById('direction-label').textContent = info.label;
    document.getElementById('pay-amount-label').textContent = info.paymentLabel;
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);

    global.MBMS_RECORDS.renderSummary(document.getElementById('detail-summary'), [
      { icon: 'bi-cash-stack', label: 'Original', value: record.original_amount || '—', tone: 'primary' },
      { icon: 'bi-cash-coin', label: 'Paid / received', value: record.paid_received || '—', tone: 'info' },
      {
        icon: 'bi-wallet2',
        label: 'Remaining',
        value: record.remaining_display || '—',
        tone: num(record.remaining_raw) <= 0 ? 'success' : 'warning'
      },
      {
        icon: 'bi-calendar3',
        label: 'Opened',
        value: (record.date || '—') + (record.location ? ' · ' + record.location : ''),
        tone: ''
      }
    ]);

    var pays = paymentsFor(record);
    if (!pays.length) {
      document.getElementById('hist-table-wrap').hidden = true;
      document.getElementById('hist-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('hist-empty'), {
        title: 'No payments yet',
        message: 'Payments on this record will show here.'
      });
    } else {
      document.getElementById('hist-empty').hidden = true;
      document.getElementById('hist-table-wrap').hidden = false;
      global.MBMS_RECORDS.renderTable(document.getElementById('hist-body'), pays, [
        { key: 'date' },
        { key: 'amount' },
        {
          render: function (row) {
            return global.MBMS_UTILS.escapeHtml(row.remaining_after || '—');
          }
        },
        {
          render: function (row) {
            return global.MBMS_UTILS.escapeHtml(row.description || '—');
          }
        },
        { key: 'location' },
        { key: 'user' }
      ]);
    }

    updatePayPreview(record);

    var payBtn = document.getElementById('open-pay-modal');
    if (payBtn) {
      payBtn.disabled = num(record.remaining_raw) <= 0;
    }
  }

  function upsertRecord(record) {
    if (!record || !record.id) {
      return;
    }
    global.MBMS_MOCK = global.MBMS_MOCK || {};
    var list = Array.isArray(global.MBMS_MOCK.externalDebts) ? global.MBMS_MOCK.externalDebts.slice() : [];
    var found = false;
    list = list.map(function (row) {
      if (String(row.id) === String(record.id)) {
        found = true;
        return Object.assign({}, row, record);
      }
      return row;
    });
    if (!found) {
      list.unshift(record);
    }
    global.MBMS_MOCK.externalDebts = list;
  }

  function loadDetail(id, source) {
    return global.MBMS_API.get('external-debts/' + id)
      .then(function (response) {
        var record = global.MBMS_UTILS.unwrap(response.data) || response.data;
        if (record && record.id) {
          upsertRecord(record);
          if (Array.isArray(record.payments)) {
            global.MBMS_MOCK.externalDebtPayments = (global.MBMS_MOCK.externalDebtPayments || [])
              .filter(function (row) { return String(row.debt_id) !== String(record.id); })
              .concat(record.payments);
          }
          renderDetail(record, source || 'api');
          return record;
        }
        throw new Error('Record missing');
      })
      .catch(function () {
        var record = findRecord(id);
        if (record) {
          renderDetail(record, source || 'error');
          return record;
        }
        setMode(false);
        global.MBMS_UI.notify({ type: 'danger', message: 'That record is not available.' });
        renderList(source || 'error');
        return null;
      });
  }

  function load() {
    var id = global.MBMS_RECORDS.queryParam('id');
    setMode(!!id);
    if (!id) {
      renderList();
    }
    return global.MBMS_RECORDS.fetchOrMock('external-debts', seed)
      .then(function (result) {
        if (id) {
          var local = findRecord(id);
          if (local) {
            renderDetail(local, result.source);
          }
          return loadDetail(id, result.source);
        }
        renderList(result.source);
      })
      .catch(function () {
        if (!id) {
          renderList('error');
        }
      });
  }

  function resetDebtForm() {
    var form = document.getElementById('debt-form');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('debt-paid').value = '0';
    document.getElementById('debt-date').value = todayIso();
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('debt-location'));
    updateDebtRemaining();
  }

  function resetPayForm() {
    var form = document.getElementById('pay-form');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('pay-date').value = todayIso();
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('pay-location'));
    updatePayPreview(findRecord(global.MBMS_RECORDS.queryParam('id')));
  }

  global.MBMS_PAGE = {
    active: 'external-debts',
    title: 'External Debts',
    onReady: function () {
      global.MBMS_RECORDS.fillWorkLocation(document.getElementById('debt-location'));
      global.MBMS_RECORDS.fillWorkLocation(document.getElementById('pay-location'));

      var search = document.getElementById('module-search');
      if (search) {
        search.addEventListener('input', global.MBMS_UTILS.debounce(function () {
          if (!global.MBMS_RECORDS.queryParam('id')) {
            renderList();
          }
        }, 250));
      }

      ['debt-original', 'debt-paid'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', updateDebtRemaining);
          el.addEventListener('change', updateDebtRemaining);
        }
      });

      document.getElementById('pay-amount').addEventListener('input', function () {
        updatePayPreview(findRecord(global.MBMS_RECORDS.queryParam('id')));
      });

      document.getElementById('debtModal').addEventListener('show.bs.modal', function () {
        if (!(document.getElementById('debt-date') || {}).value) {
          document.getElementById('debt-date').value = todayIso();
        }
        global.MBMS_RECORDS.fillWorkLocation(document.getElementById('debt-location'));
        updateDebtRemaining();
      });

      document.getElementById('payModal').addEventListener('show.bs.modal', function () {
        if (!(document.getElementById('pay-date') || {}).value) {
          document.getElementById('pay-date').value = todayIso();
        }
        global.MBMS_RECORDS.fillWorkLocation(document.getElementById('pay-location'));
        var record = findRecord(global.MBMS_RECORDS.queryParam('id'));
        var amountEl = document.getElementById('pay-amount');
        if (record && amountEl && !amountEl.value) {
          var rem = record.remaining_raw != null ? num(record.remaining_raw) : num(record.remaining_display);
          if (rem > 0) {
            amountEl.value = String(rem);
          }
        }
        updatePayPreview(record);
      });

      global.MBMS_UI.bindReset(document.getElementById('debt-form'), document.getElementById('debt-reset'), resetDebtForm);
      global.MBMS_UI.bindReset(document.getElementById('pay-form'), document.getElementById('pay-reset'), resetPayForm);

      global.MBMS_UI.bindForm(document.getElementById('debt-form'), {
        onSubmit: function (values) {
          if (!updateDebtRemaining()) {
            throw {
              message: 'Paid / received cannot exceed the original amount.',
              errors: { paid_received: ['Too high'] }
            };
          }
          var original = roundMoney(num(values.original_amount));
          var paid = roundMoney(num(values.paid_received || 0));
          if (!(original > 0)) {
            throw {
              message: 'Enter an original amount greater than zero.',
              errors: { original_amount: ['Required'] }
            };
          }
          if (!values.direction) {
            throw {
              message: 'Select a direction.',
              errors: { direction: ['Required'] }
            };
          }

          var record = {
            person: String(values.person || '').trim(),
            direction: values.direction,
            reason: values.reason,
            original_amount: original,
            paid_received: paid,
            date: values.date || todayIso(),
            location: values.location,
            location_id: values.location
          };

          return global.MBMS_RECORDS.submitOrMock('post', 'external-debts', record).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Record saved.' : 'API not connected. Sample record only.'
            });
            document.getElementById('debt-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('debtModal')).hide();
            if (global.MBMS_API.invalidateCaches) {
              global.MBMS_API.invalidateCaches(['externalDebts', 'parties', 'externalDebtPayments']);
            }
            var savedId = (result.data && result.data.id) || record.id;
            global.location.search = '?id=' + encodeURIComponent(savedId);
          });
        }
      });

      global.MBMS_UI.bindForm(document.getElementById('pay-form'), {
        onSubmit: function (values) {
          var debt = findRecord(global.MBMS_RECORDS.queryParam('id'));
          if (!debt || !debt.id) {
            throw { message: 'Open a debt record before recording a payment.' };
          }
          var remaining = debt.remaining_raw != null ? num(debt.remaining_raw) : num(debt.remaining_display);
          var amount = roundMoney(num(values.amount));
          if (!(amount > 0)) {
            throw {
              message: 'Enter an amount greater than zero.',
              errors: { amount: ['Required'] }
            };
          }
          if (amount > remaining + 0.00001) {
            updatePayPreview(debt);
            throw {
              message: 'Amount cannot exceed remaining (' + moneyText(remaining) + ').',
              errors: { amount: ['Too high'] }
            };
          }

          var record = {
            debt_id: debt.id,
            amount: amount,
            date: values.date || todayIso(),
            description: values.description || null,
            location: values.location,
            location_id: values.location
          };

          return global.MBMS_RECORDS.submitOrMock('post', 'external-debts/' + debt.id + '/payments', record).then(function (result) {
            var after = result.data && result.data.remaining_after
              ? result.data.remaining_after
              : moneyText(Math.max(0, remaining - amount));
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? ('Payment saved. Remaining: ' + after)
                : 'API not connected. Sample payment only.'
            });
            document.getElementById('pay-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('payModal')).hide();
            if (global.MBMS_API.invalidateCaches) {
              global.MBMS_API.invalidateCaches(['externalDebts', 'externalDebtPayments']);
            }
            return load();
          });
        }
      });

      if (!(document.getElementById('debt-date') || {}).value) {
        document.getElementById('debt-date').value = todayIso();
      }
      updateDebtRemaining();
      load();
    }
  };
})(window);
