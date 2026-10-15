/**
 * Shared UI for Customers and Suppliers.
 * Balances and ledger tabs are loaded from live sale/purchase/payment APIs.
 */
(function (global) {
  'use strict';

  function kind() {
    return document.body.getAttribute('data-contact') || 'customers';
  }

  function isCustomer() {
    return kind() === 'customers';
  }

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

  function seedList() {
    return (global.MBMS_MOCK && global.MBMS_MOCK[kind()]) || [];
  }

  function allRecords() {
    return seedList();
  }

  function findRecord(id) {
    return allRecords().filter(function (row) {
      return String(row.id) === String(id);
    })[0] || null;
  }

  function emptyHistory() {
    return { sales: [], purchases: [], payments: [], transactions: [] };
  }

  function renderHistory(history) {
    if (isCustomer()) {
      global.MBMS_RECORDS.renderTable(document.getElementById('sales-history-body'), history.sales, [
        { key: 'date' }, { key: 'detail' }, { key: 'amount' }, { key: 'status' }
      ], 'No sales yet.');
    } else {
      global.MBMS_RECORDS.renderTable(document.getElementById('purchase-history-body'), history.purchases, [
        { key: 'date' }, { key: 'detail' }, { key: 'amount' }
      ], 'No purchases yet.');
    }
    global.MBMS_RECORDS.renderTable(document.getElementById('payment-history-body'), history.payments, [
      { key: 'date' }, { key: 'amount' }, { key: 'method' }, { key: 'location' }
    ], 'No payments yet.');
    global.MBMS_RECORDS.renderTable(document.getElementById('transaction-history-body'), history.transactions, [
      { key: 'date' }, { key: 'type' }, { key: 'detail' }, { key: 'amount' }
    ], 'No ledger rows yet.');
  }

  function loadHistory(recordId) {
    renderHistory(emptyHistory());
    if (!recordId) {
      return Promise.resolve();
    }

    if (isCustomer()) {
      return Promise.all([
        global.MBMS_RECORDS.fetchOrMock('sales', function () { return []; }, { customer_id: recordId, per_page: 100 }),
        global.MBMS_RECORDS.fetchOrMock('payments/customers', function () { return []; }, { customer_id: recordId, per_page: 100 })
      ]).then(function (results) {
        var sales = ((results[0] && results[0].data) || []).filter(function (row) {
          return String(row.customer_id) === String(recordId);
        }).map(function (row) {
          return {
            date: row.date,
            detail: [row.product, row.variant].filter(Boolean).join(' · ') || row.reference_no || row.id,
            amount: row.total,
            status: row.payment_type || (row.remaining_raw > 0 ? 'credit' : 'paid')
          };
        });
        var payments = ((results[1] && results[1].data) || []).filter(function (row) {
          return !row.customer_id || String(row.customer_id) === String(recordId) || String(row.person_id) === String(recordId);
        }).map(function (row) {
          return {
            date: row.date,
            amount: row.amount,
            method: row.description || 'Payment',
            location: row.location || '—'
          };
        });
        var transactions = sales.map(function (row) {
          return { date: row.date, type: 'Sale', detail: row.detail, amount: row.amount };
        }).concat(payments.map(function (row) {
          return { date: row.date, type: 'Payment', detail: row.method, amount: row.amount };
        })).sort(function (a, b) {
          return String(b.date).localeCompare(String(a.date));
        });
        renderHistory({ sales: sales, purchases: [], payments: payments, transactions: transactions });
      }).catch(function () {
        renderHistory(emptyHistory());
      });
    }

    return Promise.all([
      global.MBMS_RECORDS.fetchOrMock('purchases', function () { return []; }, { supplier_id: recordId, per_page: 100 }),
      global.MBMS_RECORDS.fetchOrMock('payments/suppliers', function () { return []; }, { supplier_id: recordId, per_page: 100 })
    ]).then(function (results) {
      var purchases = ((results[0] && results[0].data) || []).filter(function (row) {
        return String(row.supplier_id) === String(recordId);
      }).map(function (row) {
        return {
          date: row.date,
          detail: [row.product, row.variant].filter(Boolean).join(' · ') || row.reference_no || row.id,
          amount: row.total
        };
      });
      var payments = ((results[1] && results[1].data) || []).filter(function (row) {
        return !row.supplier_id || String(row.supplier_id) === String(recordId) || String(row.person_id) === String(recordId);
      }).map(function (row) {
        return {
          date: row.date,
          amount: row.amount,
          method: row.description || 'Payment',
          location: row.location || '—'
        };
      });
      var transactions = purchases.map(function (row) {
        return { date: row.date, type: 'Purchase', detail: row.detail, amount: row.amount };
      }).concat(payments.map(function (row) {
        return { date: row.date, type: 'Payment', detail: row.method, amount: row.amount };
      })).sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date));
      });
      renderHistory({ sales: [], purchases: purchases, payments: payments, transactions: transactions });
    }).catch(function () {
      renderHistory(emptyHistory());
    });
  }

  function filteredRows() {
    var query = String((document.getElementById('module-search') || {}).value || '').toLowerCase().trim();
    return allRecords().filter(function (row) {
      if (!query) {
        return true;
      }
      var text = [row.name, row.phone, row.address, row.notes].join(' ').toLowerCase();
      return text.indexOf(query) !== -1;
    });
  }

  function balanceTone(value) {
    var n = num(value);
    if (n > 0) {
      return isCustomer() ? 'warning' : 'danger';
    }
    if (n < 0) {
      return 'info';
    }
    return 'success';
  }

  function renderList(source) {
    var rows = filteredRows();
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);

    var totalBalance = 0;
    var withBalance = 0;
    rows.forEach(function (row) {
      var bal = row.balance_raw != null ? num(row.balance_raw) : num(row.balance_display);
      totalBalance += bal;
      if (Math.abs(bal) > 0.00001) {
        withBalance += 1;
      }
    });

    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      {
        icon: isCustomer() ? 'bi-people' : 'bi-truck',
        label: isCustomer() ? 'Customers' : 'Suppliers',
        value: rows.length,
        tone: 'primary'
      },
      {
        icon: 'bi-wallet2',
        label: isCustomer() ? 'With balance' : 'With payable',
        value: withBalance,
        tone: withBalance ? 'warning' : 'success'
      },
      {
        icon: 'bi-cash-coin',
        label: isCustomer() ? 'Receivable' : 'Payable',
        value: moneyText(totalBalance),
        tone: balanceTone(totalBalance)
      }
    ]);

    var emptyEl = document.getElementById('contact-empty');
    var tableWrap = document.getElementById('contact-table-wrap');
    if (!rows.length) {
      if (tableWrap) {
        tableWrap.hidden = true;
      }
      if (emptyEl) {
        emptyEl.hidden = false;
        global.MBMS_UI.renderEmpty(emptyEl, {
          title: isCustomer() ? 'No customers yet' : 'No suppliers yet',
          message: isCustomer()
            ? 'Add a customer before recording sales on credit.'
            : 'Add a supplier before recording purchases.'
        });
      }
      return;
    }
    if (emptyEl) {
      emptyEl.hidden = true;
    }
    if (tableWrap) {
      tableWrap.hidden = false;
    }

    global.MBMS_RECORDS.renderTable(document.getElementById('contact-list-body'), rows, [
      { key: 'name' },
      {
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(row.phone || '—');
        }
      },
      {
        render: function (row) {
          return global.MBMS_UTILS.escapeHtml(row.address || '—');
        }
      },
      {
        render: function (row) {
          var bal = row.balance_display || moneyText(row.balance_raw);
          var tone = balanceTone(row.balance_raw != null ? row.balance_raw : row.balance_display);
          return '<span class="mbms-stock-pill is-' + tone + '">' +
            global.MBMS_UTILS.escapeHtml(bal) +
            '</span>';
        }
      },
      {
        render: function (row) {
          return global.MBMS_RECORDS.actionButton('?id=' + encodeURIComponent(row.id), 'Open', 'bi-box-arrow-up-right');
        }
      }
    ], 'No records match.');
  }

  function renderDetail(record, source) {
    global.MBMS_UTILS.setIconHeading(document.getElementById('detail-title'), null, record.name);
    document.getElementById('detail-phone').textContent = record.phone || '—';
    document.getElementById('detail-address').textContent = record.address || '—';
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);

    global.MBMS_RECORDS.renderSummary(document.getElementById('detail-summary'), [
      {
        icon: 'bi-cash-coin',
        label: isCustomer() ? 'Balance due' : 'Payable',
        value: record.balance_display || moneyText(record.balance_raw),
        tone: balanceTone(record.balance_raw != null ? record.balance_raw : record.balance_display)
      },
      {
        icon: 'bi-journal-text',
        label: 'Notes',
        value: record.notes ? String(record.notes).slice(0, 40) : '—',
        tone: 'info'
      }
    ]);

    var saleLink = document.getElementById('detail-new-sale');
    if (saleLink) {
      saleLink.href = 'sales.html?customer_id=' + encodeURIComponent(record.id) + '&open=1';
    }
    var purchaseLink = document.getElementById('detail-new-purchase');
    if (purchaseLink) {
      purchaseLink.href = 'purchases.html?supplier_id=' + encodeURIComponent(record.id) + '&open=1';
    }

    loadHistory(record.id);

    global.MBMS_UTILS.fillForm(document.getElementById('contact-form'), {
      id: record.id,
      name: record.name,
      phone: record.phone,
      address: record.address,
      notes: record.notes
    });
    global.MBMS_UTILS.setIconHeading(
      document.getElementById('contact-form-title'),
      'bi-pencil',
      'Edit ' + (isCustomer() ? 'customer' : 'supplier')
    );
  }

  function setMode(detail) {
    document.getElementById('list-view').hidden = !!detail;
    document.getElementById('detail-view').hidden = !detail;
  }

  function load() {
    var id = global.MBMS_RECORDS.queryParam('id');
    setMode(!!id);
    if (!id) {
      renderList();
    }
    return global.MBMS_RECORDS.fetchOrMock(kind(), seedList)
      .then(function (result) {
        if (id) {
          var record = findRecord(id);
          if (!record && result.source === 'api' && result.data) {
            var list = Array.isArray(result.data) ? result.data : result.data.data || [];
            record = list.filter(function (row) { return String(row.id) === String(id); })[0] || null;
          }
          if (!record) {
            setMode(false);
            global.MBMS_UI.notify({ type: 'danger', message: 'That record is not available.' });
            renderList(result.source);
            return;
          }
          setMode(true);
          renderDetail(record, result.source);
        } else {
          setMode(false);
          renderList(result.source);
        }
      });
  }

  function openCreate() {
    var form = document.getElementById('contact-form');
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('contact-id').value = '';
    global.MBMS_UTILS.setIconHeading(
      document.getElementById('contact-form-title'),
      'bi-person-plus',
      'Add ' + (isCustomer() ? 'customer' : 'supplier')
    );
  }

  function safeReturnUrl(raw) {
    var value = String(raw || '').trim();
    if (!value || value.indexOf('://') !== -1 || value.charAt(0) === '/') {
      return '';
    }
    if (!/^[A-Za-z0-9._-]+\.html(?:\?[#A-Za-z0-9_&=%-]*)?(?:#[A-Za-z0-9_-]*)?$/.test(value) &&
        !/^[A-Za-z0-9._-]+\.html$/.test(value.split('?')[0])) {
      return '';
    }
    return value.split('#')[0];
  }

  function returnAfterCreate(savedId) {
    var returnTo = safeReturnUrl(global.MBMS_RECORDS.queryParam('return'));
    if (!returnTo) {
      return false;
    }
    var join = returnTo.indexOf('?') === -1 ? '?' : '&';
    var partyKey = isCustomer() ? 'customer_id' : 'supplier_id';
    global.location.href = returnTo + join + partyKey + '=' + encodeURIComponent(savedId) + '&open=1';
    return true;
  }

  global.MBMS_PAGE = {
    active: document.body.getAttribute('data-page'),
    title: isCustomer() ? 'Customers' : 'Suppliers',
    onReady: function () {
      var search = document.getElementById('module-search');
      if (search) {
        search.addEventListener('input', global.MBMS_UTILS.debounce(function () {
          if (!global.MBMS_RECORDS.queryParam('id')) {
            renderList();
          }
        }, 250));
      }

      document.getElementById('add-contact').addEventListener('click', openCreate);
      var editBtn = document.getElementById('edit-contact');
      if (editBtn) {
        editBtn.addEventListener('click', function () {
          global.MBMS_UTILS.setIconHeading(
            document.getElementById('contact-form-title'),
            'bi-pencil',
            'Edit ' + (isCustomer() ? 'customer' : 'supplier')
          );
        });
      }

      global.MBMS_UI.bindForm(document.getElementById('contact-form'), {
        onSubmit: function (values) {
          var id = values.id;
          var method = id ? 'put' : 'post';
          var path = kind() + (id ? '/' + id : '');
          var payload = {
            name: values.name,
            phone: values.phone || null,
            address: values.address || null,
            notes: values.notes || null
          };
          if (!id) {
            payload.id = 'local-' + Date.now();
            payload.balance_display = '0.00';
            payload.balance_raw = 0;
          }
          return global.MBMS_RECORDS.submitOrMock(method, path, payload).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api'
                ? (isCustomer() ? 'Customer saved.' : 'Supplier saved.')
                : 'API not connected. Sample record only.'
            });
            bootstrap.Modal.getOrCreateInstance(document.getElementById('contactModal')).hide();
            if (!id) {
              var savedId = (result.data && result.data.id) || payload.id;
              if (returnAfterCreate(savedId)) {
                return;
              }
              global.location.search = '?id=' + encodeURIComponent(savedId);
              return;
            }
            load();
          });
        }
      });

      load();

      if (global.MBMS_RECORDS.queryParam('add') === '1') {
        openCreate();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('contactModal')).show();
      }
    }
  };
})(window);
