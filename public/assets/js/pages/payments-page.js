/**
 * Customer and supplier payment UI.
 * Outstanding balances come from Laravel; the form only validates against them.
 */
(function (global) {
  'use strict';

  function partyType() {
    return global.MBMS_RECORDS.queryParam('type') === 'supplier' ? 'supplier' : 'customer';
  }

  function isCustomer() {
    return partyType() === 'customer';
  }

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

  function mockList() {
    return isCustomer()
      ? ((global.MBMS_MOCK && global.MBMS_MOCK.customerPayments) || [])
      : ((global.MBMS_MOCK && global.MBMS_MOCK.supplierPayments) || []);
  }

  function endpoint() {
    return isCustomer() ? 'payments/customers' : 'payments/suppliers';
  }

  function partyPath() {
    return isCustomer() ? 'customers' : 'suppliers';
  }

  function partyRows() {
    return isCustomer() ? global.MBMS_CATALOG.customers() : global.MBMS_CATALOG.suppliers();
  }

  function refreshAutocomplete() {
    if (global.MBMS_AUTOCOMPLETE) {
      global.MBMS_AUTOCOMPLETE.refresh(document.getElementById('pay-person'));
    }
  }

  function selectedParty() {
    var id = (document.getElementById('pay-person') || {}).value || '';
    return partyRows().filter(function (row) {
      return String(row.id) === String(id);
    })[0] || null;
  }

  function partyBalance(party) {
    if (!party) {
      return 0;
    }
    if (party.balance_raw != null) {
      return roundMoney(num(party.balance_raw));
    }
    return roundMoney(num(party.balance_display));
  }

  function syncChrome() {
    var type = partyType();
    document.querySelectorAll('[data-pay-tab]').forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('data-pay-tab') === type);
      link.classList.toggle('is-active', link.getAttribute('data-pay-tab') === type);
    });

    global.MBMS_UTILS.setIconHeading(
      document.getElementById('pay-title'),
      'bi-cash-coin',
      isCustomer() ? 'Customer payments' : 'Supplier payments'
    );
    global.MBMS_UTILS.setIconHeading(
      document.getElementById('pay-modal-title'),
      'bi-cash-coin',
      isCustomer() ? 'Customer payment' : 'Supplier payment'
    );

    var label = isCustomer() ? 'Customer' : 'Supplier';
    document.getElementById('party-label').textContent = label;
    document.getElementById('party-section-label').textContent = label;
    document.getElementById('pay-person-col').textContent = label;

    var partyLink = document.getElementById('pay-party-link');
    if (partyLink) {
      partyLink.href = isCustomer() ? 'customers.html' : 'suppliers.html';
      partyLink.innerHTML = isCustomer()
        ? '<i class="bi bi-people" aria-hidden="true"></i> Customers'
        : '<i class="bi bi-truck" aria-hidden="true"></i> Suppliers';
    }

    var addParty = document.getElementById('pay-add-party');
    if (addParty) {
      var returnTo = isCustomer() ? 'payments.html' : 'payments.html?type=supplier';
      addParty.href = (isCustomer() ? 'customers.html' : 'suppliers.html') +
        '?add=1&return=' + encodeURIComponent(returnTo);
    }
  }

  function fillPartySelect(selectedId) {
    var rows = partyRows().slice().sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('pay-person'),
      rows,
      function (row) { return row.id; },
      function (row) {
        var bal = partyBalance(row);
        return row.name + (bal > 0 ? ' · ' + moneyText(bal) : '');
      },
      selectedId || '',
      rows.length ? ('Select ' + (isCustomer() ? 'customer' : 'supplier')) : ('No ' + (isCustomer() ? 'customers' : 'suppliers'))
    );
    refreshAutocomplete();
    updateBalancePreview();
  }

  function updateBalancePreview() {
    var party = selectedParty();
    var amount = num((document.getElementById('pay-amount') || {}).value);
    var hint = document.getElementById('pay-balance-hint');
    var error = document.getElementById('pay-balance-error');
    var preview = document.getElementById('pay-preview');
    var amountInput = document.getElementById('pay-amount');

    if (!party) {
      if (hint) {
        hint.textContent = 'Select a ' + (isCustomer() ? 'customer' : 'supplier') + ' to see outstanding balance.';
      }
      if (error) {
        error.hidden = true;
        error.textContent = '';
      }
      if (preview) {
        preview.hidden = true;
      }
      if (amountInput) {
        amountInput.classList.remove('is-invalid');
        amountInput.removeAttribute('max');
      }
      return;
    }

    var before = partyBalance(party);
    var after = roundMoney(Math.max(0, before - amount));
    var over = amount > 0 && amount > before + 0.00001;

    if (hint) {
      hint.textContent = before > 0
        ? ('Outstanding: ' + moneyText(before))
        : ('No outstanding balance for this ' + (isCustomer() ? 'customer' : 'supplier') + '.');
    }
    if (error) {
      error.hidden = !over;
      error.textContent = over
        ? ('Amount cannot exceed outstanding balance (' + moneyText(before) + ').')
        : '';
    }
    if (amountInput) {
      amountInput.max = before > 0 ? String(before) : '';
      amountInput.classList.toggle('is-invalid', over || (before <= 0 && amount > 0));
    }
    if (preview) {
      preview.hidden = false;
      document.getElementById('pay-preview-before').textContent = moneyText(before);
      document.getElementById('pay-preview-amount').textContent = moneyText(amount);
      document.getElementById('pay-preview-after').textContent = moneyText(after);
    }
  }

  function filteredRows() {
    var search = String((document.getElementById('module-search') || {}).value || '').toLowerCase();
    var from = (document.getElementById('date-from') || {}).value || '';
    var to = (document.getElementById('date-to') || {}).value || '';
    return mockList().filter(function (row) {
      var text = [row.person, row.description, row.reference_no, row.user, row.location].join(' ').toLowerCase();
      return (!search || text.indexOf(search) !== -1)
        && (!from || !row.date || row.date >= from)
        && (!to || !row.date || row.date <= to);
    });
  }

  function render(source) {
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    var rows = filteredRows();
    var total = 0;
    rows.forEach(function (row) {
      total += row.amount_raw != null ? num(row.amount_raw) : num(row.amount);
    });

    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      {
        icon: 'bi-cash-coin',
        label: 'Payments',
        value: rows.length,
        tone: 'primary'
      },
      {
        icon: 'bi-wallet2',
        label: isCustomer() ? 'Received' : 'Paid out',
        value: moneyText(total),
        tone: isCustomer() ? 'success' : 'warning'
      }
    ]);

    if (!rows.length) {
      document.getElementById('pay-table-wrap').hidden = true;
      document.getElementById('pay-empty').hidden = false;
      global.MBMS_UI.renderEmpty(document.getElementById('pay-empty'), {
        title: 'No payments yet',
        message: isCustomer()
          ? 'Record money received from customers with outstanding balances.'
          : 'Record money paid to suppliers with outstanding balances.'
      });
      return;
    }

    document.getElementById('pay-empty').hidden = true;
    document.getElementById('pay-table-wrap').hidden = false;
    global.MBMS_RECORDS.renderTable(document.getElementById('pay-list-body'), rows, [
      { key: 'date' },
      {
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(row.reference_no || row.id || '');
        }
      },
      { key: 'person' },
      {
        render: function (row) {
          return '<span class="mbms-stock-pill is-success">' +
            global.MBMS_UTILS.escapeHtml(row.amount || moneyText(row.amount_raw)) +
            '</span>';
        }
      },
      {
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(row.balance_after || '—');
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

  function load() {
    render();
    return global.MBMS_RECORDS.fetchOrMock(endpoint(), mockList)
      .then(function (result) {
        render(result.source);
      })
      .catch(function () {
        render('error');
      });
  }

  function warmParties() {
    return global.MBMS_RECORDS.fetchOrMock(partyPath(), function () { return []; })
      .then(function () {
        fillPartySelect((document.getElementById('pay-person') || {}).value || '');
      })
      .catch(function () {
        fillPartySelect();
      });
  }

  function resetForm() {
    var form = document.getElementById('pay-form');
    form.reset();
    form.classList.remove('was-validated');
    var date = document.getElementById('pay-date');
    if (date) {
      date.value = todayIso();
    }
    global.MBMS_RECORDS.fillWorkLocation(document.getElementById('pay-location'));
    fillPartySelect();
    updateBalancePreview();
  }

  global.MBMS_PAGE = {
    active: 'payments',
    title: 'Payments',
    onReady: function () {
      syncChrome();
      global.MBMS_RECORDS.fillWorkLocation(document.getElementById('pay-location'));
      fillPartySelect();
      warmParties();

      var date = document.getElementById('pay-date');
      if (date && !date.value) {
        date.value = todayIso();
      }

      document.getElementById('module-search').addEventListener('input', global.MBMS_UTILS.debounce(load, 250));
      ['date-from', 'date-to'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
          el.addEventListener('change', load);
        }
      });

      document.getElementById('pay-person').addEventListener('change', function () {
        var party = selectedParty();
        var amountEl = document.getElementById('pay-amount');
        var bal = partyBalance(party);
        if (party && amountEl && (!amountEl.value || num(amountEl.value) <= 0) && bal > 0) {
          amountEl.value = String(bal);
        }
        updateBalancePreview();
      });
      document.getElementById('pay-amount').addEventListener('input', updateBalancePreview);
      document.getElementById('pay-amount').addEventListener('change', updateBalancePreview);

      document.getElementById('payModal').addEventListener('show.bs.modal', function () {
        warmParties();
        if (!(document.getElementById('pay-date') || {}).value) {
          document.getElementById('pay-date').value = todayIso();
        }
        global.MBMS_RECORDS.fillWorkLocation(document.getElementById('pay-location'));
        updateBalancePreview();
      });

      global.MBMS_UI.bindReset(document.getElementById('pay-form'), document.getElementById('pay-reset'), resetForm);

      global.MBMS_UI.bindForm(document.getElementById('pay-form'), {
        onSubmit: function (values) {
          var party = selectedParty();
          var amount = roundMoney(num(values.amount));
          var balance = partyBalance(party);

          if (!party) {
            throw {
              message: 'Select a ' + (isCustomer() ? 'customer' : 'supplier') + '.',
              errors: { person: ['Required'] }
            };
          }
          if (!(amount > 0)) {
            throw {
              message: 'Enter an amount greater than zero.',
              errors: { amount: ['Amount must be greater than zero'] }
            };
          }
          if (balance <= 0) {
            throw {
              message: 'This ' + (isCustomer() ? 'customer' : 'supplier') + ' has no outstanding balance.',
              errors: { person: ['No outstanding balance'] }
            };
          }
          if (amount > balance + 0.00001) {
            updateBalancePreview();
            throw {
              message: 'Amount cannot exceed outstanding balance (' + moneyText(balance) + ').',
              errors: { amount: ['Max ' + moneyText(balance)] }
            };
          }

          var record = {
            person: party.id,
            person_id: party.id,
            amount: amount,
            date: values.date || todayIso(),
            description: values.description || null,
            location: values.location,
            location_id: values.location
          };

          return global.MBMS_RECORDS.submitOrMock('post', endpoint(), record).then(function (result) {
            var after = result.data && result.data.balance_after
              ? result.data.balance_after
              : moneyText(roundMoney(balance - amount));
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? ('Payment saved. Balance after: ' + after)
                : 'API not connected. Sample payment only.'
            });
            document.getElementById('pay-form').reset();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('payModal')).hide();

            if (global.MBMS_API && global.MBMS_API.invalidateCaches) {
              global.MBMS_API.invalidateCaches(
                isCustomer()
                  ? ['customers', 'sales', 'customerPayments']
                  : ['suppliers', 'purchases', 'supplierPayments']
              );
            }

            return warmParties().then(load);
          });
        }
      });

      // Prefill party when returning from add-customer / add-supplier.
      var prefillKey = isCustomer() ? 'customer_id' : 'supplier_id';
      var prefillId = global.MBMS_RECORDS.queryParam(prefillKey);
      if (prefillId || global.MBMS_RECORDS.queryParam('open') === '1') {
        warmParties().then(function () {
          if (prefillId) {
            fillPartySelect(prefillId);
          }
          if (global.MBMS_RECORDS.queryParam('open') === '1') {
            bootstrap.Modal.getOrCreateInstance(document.getElementById('payModal')).show();
          }
        });
      }

      load();
    }
  };
})(window);
