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

  function seedList() {
    return (global.MBMS_MOCK && global.MBMS_MOCK[kind()]) || [];
  }

  function allRecords() {
    return seedList();
  }

  function findRecord(id) {
    return allRecords().filter(function (row) { return String(row.id) === String(id); })[0] || null;
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
        global.MBMS_RECORDS.fetchOrMock('sales', function () { return []; }),
        global.MBMS_RECORDS.fetchOrMock('payments/customers', function () { return []; })
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
        }));
        renderHistory({ sales: sales, purchases: [], payments: payments, transactions: transactions });
      }).catch(function () {
        renderHistory(emptyHistory());
      });
    }

    return Promise.all([
      global.MBMS_RECORDS.fetchOrMock('purchases', function () { return []; }),
      global.MBMS_RECORDS.fetchOrMock('payments/suppliers', function () { return []; })
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
      }));
      renderHistory({ sales: [], purchases: purchases, payments: payments, transactions: transactions });
    }).catch(function () {
      renderHistory(emptyHistory());
    });
  }

  function renderList(source) {
    var query = String((document.getElementById('module-search') || {}).value || '').toLowerCase().trim();
    var location = (document.getElementById('module-filter') || {}).value || '';
    var rows = allRecords().filter(function (row) {
      var matchName = !query || String(row.name || '').toLowerCase().indexOf(query) !== -1;
      var matchLocation = !location || row.location === location;
      return matchName && matchLocation;
    });
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);
    global.MBMS_RECORDS.fillSelect(
      document.getElementById('module-filter'),
      global.MBMS_RECORDS.locations(),
      function (row) { return row.name; },
      function (row) { return row.name; },
      location,
      'All locations'
    );
    global.MBMS_RECORDS.renderSummary(document.getElementById('list-summary'), [
      { icon: isCustomer() ? 'bi-people' : 'bi-truck', label: isCustomer() ? 'Customers' : 'Suppliers', value: rows.length },
      { icon: 'bi-geo-alt', label: 'Locations', value: Object.keys(rows.reduce(function (acc, row) {
        if (row.location) { acc[row.location] = true; }
        return acc;
      }, {})).length }
    ]);
    global.MBMS_RECORDS.renderTable(document.getElementById('contact-list-body'), rows, [
      { key: 'name' },
      { key: 'phone' },
      { key: 'location' },
      { key: 'balance_display' },
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
    document.getElementById('detail-location').textContent = record.location || '—';
    document.getElementById('detail-balance').textContent = record.balance_display || '—';
    document.getElementById('detail-balance-note').textContent = record.notes || '';
    global.MBMS_RECORDS.showBanner(document.getElementById('source-banner'), source);

    loadHistory(record.id);

    global.MBMS_UTILS.fillForm(document.getElementById('contact-form'), record);
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
    var root = document.getElementById('contacts-root');
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
    document.getElementById('contact-id').value = '';
    global.MBMS_UTILS.setIconHeading(
      document.getElementById('contact-form-title'),
      'bi-person-plus',
      'Add ' + (isCustomer() ? 'customer' : 'supplier')
    );
  }

  global.MBMS_PAGE = {
    active: document.body.getAttribute('data-page'),
    title: isCustomer() ? 'Customers' : 'Suppliers',
    onReady: function () {
      global.MBMS_RECORDS.fillSelect(
        document.getElementById('contact-location'),
        global.MBMS_RECORDS.locations(),
        function (row) { return row.name; },
        function (row) { return row.name; }
      );

      var search = document.getElementById('module-search');
      var filter = document.getElementById('module-filter');
      if (search) {
        search.addEventListener('input', global.MBMS_UTILS.debounce(load, 250));
      }
      if (filter) {
        filter.addEventListener('change', load);
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
          if (!id) {
            values.id = 'local-' + Date.now();
            values.balance_display = '—';
            values.notes = 'New contact. Balance updates after sales, purchases, and payments.';
          }
          return global.MBMS_RECORDS.submitOrMock(method, path, values, function (body) {
            if (id) {
              return global.MBMS_RECORDS.storeUpdate(kind(), id, body) || global.MBMS_RECORDS.storeSave(kind(), body);
            }
            return global.MBMS_RECORDS.storeSave(kind(), body);
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Saved to the API.' : 'API not connected. Saved as a local sample record only.'
            });
            bootstrap.Modal.getOrCreateInstance(document.getElementById('contactModal')).hide();
            if (!id) {
              global.location.search = '?id=' + encodeURIComponent((result.data && result.data.id) || values.id);
              return;
            }
            load();
          });
        }
      });

      load();
    }
  };
})(window);
