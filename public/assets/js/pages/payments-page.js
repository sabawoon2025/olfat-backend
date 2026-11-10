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

  function workLocationId() {
    if (global.MBMS_CONFIG && typeof global.MBMS_CONFIG.getLocationId === 'function') {
      return String(global.MBMS_CONFIG.getLocationId() || '');
    }
    return '';
  }

  function tradeDocs() {
    if (isCustomer()) {
      return (global.MBMS_MOCK && global.MBMS_MOCK.sales) || [];
    }
    return (global.MBMS_MOCK && global.MBMS_MOCK.purchases) || [];
  }

  function docPartyId(doc) {
    return isCustomer() ? doc.customer_id : doc.supplier_id;
  }

  function docCurrency(doc) {
    return String(doc.currency || 'AFN').toUpperCase() === 'USD' ? 'USD' : 'AFN';
  }

  function openBillsForParty(partyId, currency) {
    var loc = workLocationId();
    var code = currency || selectedCurrency();
    if (!partyId) {
      return [];
    }
    return tradeDocs().filter(function (doc) {
      if (String(docPartyId(doc) || '') !== String(partyId)) {
        return false;
      }
      if (loc && String(doc.location_id || '') !== loc) {
        return false;
      }
      if (docCurrency(doc) !== code) {
        return false;
      }
      var remaining = doc.remaining_raw != null ? num(doc.remaining_raw) : num(doc.remaining);
      return remaining > 0.00001;
    }).slice().sort(function (a, b) {
      return String(a.date || '').localeCompare(String(b.date || '')) || (num(a.id) - num(b.id));
    });
  }

  function provinceOutstanding(partyId, currency) {
    return roundMoney(openBillsForParty(partyId, currency).reduce(function (sum, doc) {
      var remaining = doc.remaining_raw != null ? num(doc.remaining_raw) : num(doc.remaining);
      return sum + Math.max(0, remaining);
    }, 0));
  }

  function billRemaining(doc) {
    if (!doc) {
      return 0;
    }
    return roundMoney(doc.remaining_raw != null ? num(doc.remaining_raw) : num(doc.remaining));
  }

  function billLabel(doc) {
    if (!doc) {
      return '';
    }
    var ref = doc.reference_no || ('#' + doc.id);
    var date = doc.date || '';
    return ref + (date ? (' · ' + date) : '') + ' · unpaid ' + moneyText(billRemaining(doc));
  }

  function selectedBill() {
    var id = (document.getElementById('pay-bill') || {}).value || '';
    if (!id) {
      return null;
    }
    return openBillsForParty((selectedParty() || {}).id, selectedCurrency()).filter(function (doc) {
      return String(doc.id) === String(id);
    })[0] || tradeDocs().filter(function (doc) {
      return String(doc.id) === String(id);
    })[0] || null;
  }

  function fillBillSelect(selectedId) {
    var party = selectedParty();
    var bills = party ? openBillsForParty(party.id, selectedCurrency()) : [];
    var keep = selectedId || ((document.getElementById('pay-bill') || {}).value || '');
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('pay-bill'),
      bills,
      function (row) { return row.id; },
      billLabel,
      keep,
      bills.length
        ? ('Select unpaid ' + (isCustomer() ? 'sale' : 'purchase') + ' bill')
        : (party
          ? ('No unpaid ' + (isCustomer() ? 'sale' : 'purchase') + ' bills for this party')
          : 'Select a party first')
    );
    if (bills.length === 1) {
      var billEl = document.getElementById('pay-bill');
      if (billEl) {
        billEl.value = String(bills[0].id);
      }
    }
  }

  function partyRows() {
    var all = isCustomer() ? global.MBMS_CATALOG.customers() : global.MBMS_CATALOG.suppliers();
    var loc = workLocationId();
    if (!loc) {
      return all;
    }
    return (all || []).filter(function (row) {
      return provinceOutstanding(row.id, 'AFN') > 0 || provinceOutstanding(row.id, 'USD') > 0;
    });
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

  function selectedCurrency() {
    var el = document.getElementById('pay-currency');
    return el && String(el.value || '').toUpperCase() === 'USD' ? 'USD' : 'AFN';
  }

  function partyBalance(party, currency) {
    if (!party) {
      return 0;
    }
    var code = currency || selectedCurrency();
    var provinceBal = provinceOutstanding(party.id, code);
    if (workLocationId()) {
      return provinceBal;
    }
    if (code === 'USD') {
      if (party.balance_usd_raw != null) {
        return roundMoney(num(party.balance_usd_raw));
      }
      return roundMoney(num(party.balance_usd_display));
    }
    if (party.balance_raw != null) {
      return roundMoney(num(party.balance_raw));
    }
    return roundMoney(num(party.balance_display));
  }

  function syncCurrencyOptions(party) {
    var select = document.getElementById('pay-currency');
    if (!select) {
      return;
    }
    var afn = party ? partyBalance(party, 'AFN') : 0;
    var usd = party ? partyBalance(party, 'USD') : 0;
    var current = selectedCurrency();
    if (!party) {
      select.value = 'AFN';
      return;
    }
    if (current === 'USD' && usd <= 0 && afn > 0) {
      select.value = 'AFN';
    } else if (current === 'AFN' && afn <= 0 && usd > 0) {
      select.value = 'USD';
    } else if (afn <= 0 && usd > 0) {
      select.value = 'USD';
    } else if (usd <= 0 && afn > 0) {
      select.value = 'AFN';
    }
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
    var billLabelEl = document.getElementById('pay-bill-label');
    if (billLabelEl) {
      billLabelEl.textContent = isCustomer() ? 'Unpaid sale bill' : 'Unpaid purchase bill';
    }

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
        var afn = partyBalance(row, 'AFN');
        var usd = partyBalance(row, 'USD');
        var parts = [];
        if (afn > 0) {
          parts.push(moneyText(afn) + ' AFN');
        }
        if (usd > 0) {
          parts.push(moneyText(usd) + ' USD');
        }
        return row.name + (parts.length ? ' · ' + parts.join(' · ') : '');
      },
      selectedId || '',
      rows.length
        ? ('Select ' + (isCustomer() ? 'customer' : 'supplier'))
        : (workLocationId()
          ? ('No ' + (isCustomer() ? 'customers' : 'suppliers') + ' with balance in your province')
          : ('No ' + (isCustomer() ? 'customers' : 'suppliers')))
    );
    refreshAutocomplete();
    fillBillSelect();
    updateBalancePreview();
  }

  function updateBalancePreview() {
    var party = selectedParty();
    var bill = selectedBill();
    var amount = num((document.getElementById('pay-amount') || {}).value);
    var hint = document.getElementById('pay-balance-hint');
    var error = document.getElementById('pay-balance-error');
    var preview = document.getElementById('pay-preview');
    var amountInput = document.getElementById('pay-amount');

    if (!party) {
      if (hint) {
        hint.textContent = 'Select a ' + (isCustomer() ? 'customer' : 'supplier') + ' and unpaid bill.';
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

    var currency = selectedCurrency();
    var partyBefore = partyBalance(party, currency);
    var before = bill ? billRemaining(bill) : 0;
    var after = roundMoney(Math.max(0, before - amount));
    var over = amount > 0 && amount > before + 0.00001;
    var afn = partyBalance(party, 'AFN');
    var usd = partyBalance(party, 'USD');

    if (hint) {
      var provinceNote = workLocationId() ? ' in your province' : '';
      if (bill) {
        hint.textContent = 'Bill unpaid' + provinceNote + ' (' + currency + '): ' + moneyText(before) +
          ' · party total AFN ' + moneyText(afn) + ' · USD ' + moneyText(usd);
      } else if (partyBefore > 0) {
        hint.textContent = 'Select the unpaid bill to pay' + provinceNote +
          ' (party ' + currency + ' ' + moneyText(partyBefore) + ').';
      } else {
        hint.textContent = 'No unpaid ' + (isCustomer() ? 'sale' : 'purchase') +
          ' bills' + provinceNote + ' for this ' + (isCustomer() ? 'customer' : 'supplier') + '.';
      }
    }
    if (error) {
      error.hidden = !over;
      error.textContent = over
        ? ('Amount cannot exceed this bill unpaid balance (' + moneyText(before) + ').')
        : '';
    }
    if (amountInput) {
      amountInput.max = before > 0 ? String(before) : '';
      amountInput.classList.toggle('is-invalid', over || ((!bill || before <= 0) && amount > 0));
    }
    if (preview) {
      preview.hidden = !bill;
      if (bill) {
        document.getElementById('pay-preview-before').textContent = moneyText(before);
        document.getElementById('pay-preview-amount').textContent = moneyText(amount);
        document.getElementById('pay-preview-after').textContent = moneyText(after);
      }
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
    var totalAfn = 0;
    var totalUsd = 0;
    rows.forEach(function (row) {
      var amount = row.amount_raw != null ? num(row.amount_raw) : num(row.amount);
      if (String(row.currency || 'AFN').toUpperCase() === 'USD') {
        totalUsd += amount;
      } else {
        totalAfn += amount;
      }
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
        label: isCustomer() ? 'Received AFN' : 'Paid AFN',
        value: moneyText(totalAfn) + ' AFN',
        tone: isCustomer() ? 'success' : 'warning'
      },
      {
        icon: 'bi-currency-dollar',
        label: isCustomer() ? 'Received USD' : 'Paid USD',
        value: moneyText(totalUsd) + ' USD',
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
          return global.MBMS_UTILS.escapeHtml(row.bill_ref || row.sale_id || row.purchase_id || '—');
        }
      },
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
    var tradePath = isCustomer() ? 'sales' : 'purchases';
    return Promise.all([
      global.MBMS_RECORDS.fetchOrMock(partyPath(), function () { return []; }),
      global.MBMS_RECORDS.fetchOrMock(tradePath, function () { return []; })
    ])
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
    fillBillSelect();
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
        syncCurrencyOptions(party);
        fillBillSelect();
        var amountEl = document.getElementById('pay-amount');
        var bill = selectedBill();
        var bal = billRemaining(bill);
        if (party && amountEl && (!amountEl.value || num(amountEl.value) <= 0) && bal > 0) {
          amountEl.value = String(bal);
        }
        updateBalancePreview();
      });
      var currencyEl = document.getElementById('pay-currency');
      if (currencyEl) {
        currencyEl.addEventListener('change', function () {
          fillBillSelect();
          var amountEl = document.getElementById('pay-amount');
          var bal = billRemaining(selectedBill());
          if (amountEl && bal > 0) {
            amountEl.value = String(bal);
          }
          updateBalancePreview();
        });
      }
      var billEl = document.getElementById('pay-bill');
      if (billEl) {
        billEl.addEventListener('change', function () {
          var amountEl = document.getElementById('pay-amount');
          var bal = billRemaining(selectedBill());
          if (amountEl && bal > 0) {
            amountEl.value = String(bal);
          }
          updateBalancePreview();
        });
      }
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
          var bill = selectedBill();
          var currency = values.currency === 'USD' ? 'USD' : 'AFN';
          var amount = roundMoney(num(values.amount));
          var balance = billRemaining(bill);

          if (!party) {
            throw {
              message: 'Select a ' + (isCustomer() ? 'customer' : 'supplier') + '.',
              errors: { person: ['Required'] }
            };
          }
          if (!bill) {
            throw {
              message: 'Select the unpaid ' + (isCustomer() ? 'sale' : 'purchase') + ' bill to pay.',
              errors: { bill: ['Required'] }
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
              message: 'This bill has no unpaid balance left.',
              errors: { bill: ['No unpaid balance on this bill'] }
            };
          }
          if (amount > balance + 0.00001) {
            updateBalancePreview();
            throw {
              message: 'Amount cannot exceed this bill unpaid balance (' + moneyText(balance) + ').',
              errors: { amount: ['Max ' + moneyText(balance)] }
            };
          }

          var record = {
            person: party.id,
            person_id: party.id,
            amount: amount,
            currency: currency,
            date: values.date || todayIso(),
            description: values.description || null,
            location: values.location,
            location_id: values.location,
            bill: bill.id,
            bill_id: bill.id,
            sale_id: isCustomer() ? bill.id : null,
            purchase_id: isCustomer() ? null : bill.id
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
