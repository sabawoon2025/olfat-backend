/**
 * Settings page:
 *   • Profile (name, email) + password change (any signed-in user)
 *   • Appearance + API base URL (local to this device)
 *   • Admin-only: Business identity, Invoice defaults, Branch invoice profiles
 */
(function (global) {
  'use strict';

  var DENSITY_KEY = 'MBMS_UI_DENSITY';

  var BUSINESS_KEYS = [
    'business.legal_name',
    'business.tagline',
    'business.logo_url',
    'business.tax_id',
    'business.address_line1',
    'business.address_line2',
    'business.phone',
    'business.whatsapp',
    'business.email',
    'business.website',
    'app.currency_code',
    'app.currency_symbol',
    'app.currency_position'
  ];

  var INVOICE_KEYS = [
    'invoice.prefix',
    'invoice.header_note',
    'invoice.footer_note',
    'invoice.terms',
    'invoice.bank_details',
    'invoice.signature_customer_label',
    'invoice.signature_authorized_label',
    'invoice.show_watermark'
  ];

  var BRANCH_PROFILE_FIELDS = [
    'legal_name',
    'tagline',
    'logo_url',
    'address_line1',
    'address_line2',
    'phone',
    'whatsapp',
    'email',
    'website',
    'tax_id',
    'header_note',
    'footer_note',
    'terms',
    'bank_details',
    'signature_customer_label',
    'signature_authorized_label'
  ];

  var branchLocations = [];

  function mockProfile() {
    return (global.MBMS_MOCK && global.MBMS_MOCK.profile) || { name: 'Signed-in user', email: '', location: '' };
  }

  function applyDensity(value) {
    document.body.classList.toggle('mbms-compact', value === 'compact');
    try {
      global.localStorage.setItem(DENSITY_KEY, value);
    } catch (err) { /* ignore */ }
  }

  function currentDensity() {
    try {
      return global.localStorage.getItem(DENSITY_KEY) || 'comfortable';
    } catch (err) {
      return 'comfortable';
    }
  }

  function loadProfile() {
    return global.MBMS_RECORDS.fetchOrMock('settings/profile', mockProfile)
      .then(function (result) {
        var profile = result.source === 'api' ? (global.MBMS_UTILS.unwrap(result.data) || result.data || mockProfile()) : mockProfile();
        var locationId = profile.location_id || profile.location;
        var match = (global.MBMS_RECORDS.locations() || []).filter(function (row) {
          return row.id === locationId || row.name === locationId;
        })[0];
        global.MBMS_UTILS.fillForm(document.getElementById('profile-form'), Object.assign({}, profile, {
          location: match ? match.id : locationId
        }));
        global.MBMS_RECORDS.showBanner(
          document.getElementById('source-banner'),
          result.source,
          'Showing a sample profile. Official user details come from Laravel.'
        );
      })
      .catch(function (error) {
        global.MBMS_UI.notify({
          type: 'danger',
          title: 'Unable to load profile',
          message: global.MBMS_UTILS.getErrorMessage(error)
        });
      });
  }

  function fetchCurrentUser() {
    if (!global.MBMS_API || typeof global.MBMS_API.get !== 'function') {
      return Promise.resolve(null);
    }
    return global.MBMS_API.get('auth/me').then(function (response) {
      var payload = global.MBMS_UTILS.unwrap(response.data) || response.data || {};
      return payload.user || payload;
    }).catch(function () {
      return null;
    });
  }

  function fetchSettingsMap() {
    if (!global.MBMS_API || typeof global.MBMS_API.get !== 'function') {
      return Promise.resolve({});
    }
    return global.MBMS_API.get('settings').then(function (response) {
      var rows = global.MBMS_UTILS.unwrap(response.data) || response.data || [];
      if (!Array.isArray(rows) && rows && Array.isArray(rows.data)) {
        rows = rows.data;
      }
      if (!Array.isArray(rows)) {
        return {};
      }
      var map = {};
      rows.forEach(function (row) {
        if (row && row.key != null) {
          map[row.key] = row.value;
        }
      });
      return map;
    }).catch(function () {
      return {};
    });
  }

  function hydrateForm(formId, keys, map) {
    var form = document.getElementById(formId);
    if (!form) {
      return;
    }
    keys.forEach(function (key) {
      var field = form.querySelector('[name="' + key + '"]');
      if (!field) {
        return;
      }
      var value = map[key];
      if (field.type === 'checkbox') {
        field.checked = value === true || value === 1 || value === '1' || value === 'true';
      } else {
        field.value = value == null ? '' : String(value);
      }
    });
  }

  function collectSettingsFromForm(form, keys) {
    var payload = {};
    keys.forEach(function (key) {
      var field = form.querySelector('[name="' + key + '"]');
      if (!field) {
        return;
      }
      if (field.type === 'checkbox') {
        payload[key] = field.checked;
      } else {
        payload[key] = field.value == null ? '' : String(field.value);
      }
    });
    return payload;
  }

  function saveSettings(payload) {
    if (!global.MBMS_API || typeof global.MBMS_API.put !== 'function') {
      return Promise.reject({ message: 'API unavailable.' });
    }
    return global.MBMS_API.put('settings', { settings: payload });
  }

  function clearBranchProfileForm() {
    var form = document.getElementById('branch-invoice-form');
    if (!form) {
      return;
    }
    BRANCH_PROFILE_FIELDS.forEach(function (key) {
      var field = form.querySelector('[name="' + key + '"]');
      if (field) {
        field.value = '';
      }
    });
  }

  function fillBranchProfileForm(profile) {
    var form = document.getElementById('branch-invoice-form');
    if (!form) {
      return;
    }
    var data = profile && typeof profile === 'object' ? profile : {};
    BRANCH_PROFILE_FIELDS.forEach(function (key) {
      var field = form.querySelector('[name="' + key + '"]');
      if (field) {
        field.value = data[key] == null ? '' : String(data[key]);
      }
    });
  }

  function collectBranchProfile() {
    var form = document.getElementById('branch-invoice-form');
    var profile = {};
    if (!form) {
      return profile;
    }
    BRANCH_PROFILE_FIELDS.forEach(function (key) {
      var field = form.querySelector('[name="' + key + '"]');
      profile[key] = field && field.value != null ? String(field.value).trim() : '';
    });
    return profile;
  }

  function findBranchById(id) {
    var numeric = Number(id);
    return branchLocations.filter(function (row) {
      return row.id === numeric || String(row.id) === String(id);
    })[0] || null;
  }

  function loadBranchLocations() {
    if (!global.MBMS_API || typeof global.MBMS_API.get !== 'function') {
      return Promise.resolve([]);
    }
    return global.MBMS_API.get('locations').then(function (response) {
      var rows = global.MBMS_UTILS.unwrap(response.data) || response.data || [];
      if (!Array.isArray(rows) && rows && Array.isArray(rows.data)) {
        rows = rows.data;
      }
      branchLocations = Array.isArray(rows) ? rows : [];
      return branchLocations;
    }).catch(function () {
      branchLocations = global.MBMS_RECORDS.locations() || [];
      return branchLocations;
    });
  }

  function populateBranchSelect() {
    var select = document.getElementById('branch-location');
    if (!select) {
      return;
    }
    var previous = select.value;
    select.innerHTML = '<option value="">Select a branch…</option>';
    branchLocations.forEach(function (row) {
      var option = document.createElement('option');
      option.value = String(row.id);
      option.textContent = row.name + (row.code ? (' (' + row.code + ')') : '');
      select.appendChild(option);
    });
    if (previous && findBranchById(previous)) {
      select.value = previous;
      fillBranchProfileForm(findBranchById(previous).invoice_profile || {});
    } else {
      clearBranchProfileForm();
    }
  }

  function bindBranchInvoiceSection() {
    var section = document.getElementById('branch-invoice-section');
    var form = document.getElementById('branch-invoice-form');
    var select = document.getElementById('branch-location');
    if (!section || !form || !select) {
      return;
    }

    section.hidden = false;

    select.addEventListener('change', function () {
      var location = findBranchById(select.value);
      if (!location) {
        clearBranchProfileForm();
        return;
      }
      fillBranchProfileForm(location.invoice_profile || {});
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var locationId = select.value;
      if (!locationId) {
        global.MBMS_UI.notify({ type: 'warning', message: 'Select a branch before saving its invoice profile.' });
        return;
      }

      var btn = document.getElementById('branch-invoice-save') || form.querySelector('button[type="submit"]');
      global.MBMS_UI.setButtonLoading(btn, true);

      var profile = collectBranchProfile();
      global.MBMS_API.put('locations/' + locationId, { invoice_profile: profile })
        .then(function (response) {
          var updated = global.MBMS_UTILS.unwrap(response.data) || response.data || {};
          branchLocations = branchLocations.map(function (row) {
            if (String(row.id) === String(locationId)) {
              return Object.assign({}, row, {
                invoice_profile: updated.invoice_profile || profile
              });
            }
            return row;
          });
          global.MBMS_UI.notify({
            type: 'success',
            message: 'Branch invoice profile saved. New sales invoices for this location will use these details.'
          });
        })
        .catch(function (error) {
          global.MBMS_UI.notify({
            type: 'danger',
            title: 'Could not save branch invoice profile',
            message: global.MBMS_UTILS.getErrorMessage(error, 'Location could not be updated.')
          });
        })
        .finally(function () {
          global.MBMS_UI.setButtonLoading(btn, false);
        });
    });

    return loadBranchLocations().then(populateBranchSelect);
  }

  function revealAdminSections(user, settingsMap) {
    var isAdmin = user && user.role && String(user.role).toLowerCase() === 'admin';
    if (!isAdmin) {
      return Promise.resolve();
    }

    var bizSection = document.getElementById('business-section');
    var invSection = document.getElementById('invoice-section');
    if (bizSection) bizSection.hidden = false;
    if (invSection) invSection.hidden = false;

    hydrateForm('business-form', BUSINESS_KEYS, settingsMap);
    hydrateForm('invoice-form', INVOICE_KEYS, settingsMap);

    var businessForm = document.getElementById('business-form');
    if (businessForm) {
      businessForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var btn = businessForm.querySelector('button[type="submit"]');
        global.MBMS_UI.setButtonLoading(btn, true);
        var payload = collectSettingsFromForm(businessForm, BUSINESS_KEYS);
        saveSettings(payload).then(function () {
          global.MBMS_UI.notify({ type: 'success', message: 'Business identity saved. New invoices will use these details.' });
        }).catch(function (error) {
          global.MBMS_UI.notify({
            type: 'danger',
            title: 'Could not save business identity',
            message: global.MBMS_UTILS.getErrorMessage(error, 'Settings could not be saved.')
          });
        }).finally(function () {
          global.MBMS_UI.setButtonLoading(btn, false);
        });
      });
    }

    var invoiceForm = document.getElementById('invoice-form');
    if (invoiceForm) {
      invoiceForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var btn = invoiceForm.querySelector('button[type="submit"]');
        global.MBMS_UI.setButtonLoading(btn, true);
        var payload = collectSettingsFromForm(invoiceForm, INVOICE_KEYS);
        saveSettings(payload).then(function () {
          global.MBMS_UI.notify({ type: 'success', message: 'Invoice settings saved. Reload an open bill to see changes.' });
        }).catch(function (error) {
          global.MBMS_UI.notify({
            type: 'danger',
            title: 'Could not save invoice settings',
            message: global.MBMS_UTILS.getErrorMessage(error, 'Settings could not be saved.')
          });
        }).finally(function () {
          global.MBMS_UI.setButtonLoading(btn, false);
        });
      });
    }

    return bindBranchInvoiceSection();
  }

  global.MBMS_PAGE = {
    active: 'settings',
    title: 'Settings',
    onReady: function () {
      applyDensity(currentDensity());

      document.querySelectorAll('[name="density"]').forEach(function (input) {
        input.checked = input.value === currentDensity();
        input.addEventListener('change', function () {
          applyDensity(input.value);
          global.MBMS_UI.notify({ type: 'success', message: 'Display density saved on this device only.' });
        });
      });

      document.querySelectorAll('[name="language"]').forEach(function (input) {
        input.checked = input.value === (global.MBMS_I18N ? global.MBMS_I18N.lang() : 'en');
        input.addEventListener('change', function () {
          if (global.MBMS_I18N) {
            global.MBMS_I18N.set(input.value);
          }
        });
      });

      document.getElementById('api-base').value = global.MBMS_CONFIG.apiBaseUrl;
      global.MBMS_RECORDS.fillSelect(
        document.getElementById('profile-location'),
        global.MBMS_RECORDS.locations(),
        function (row) { return row.id; },
        function (row) { return row.name; }
      );

      global.MBMS_UI.bindForm(document.getElementById('profile-form'), {
        onSubmit: function (values) {
          var body = { name: values.name, email: values.email };
          return global.MBMS_RECORDS.submitOrMock('put', 'settings/profile', body, function () {
            return body;
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Profile saved.' : 'API not connected. Profile was not stored on the server.'
            });
            return loadProfile();
          });
        }
      });

      global.MBMS_UI.bindForm(document.getElementById('password-form'), {
        onSubmit: function (values) {
          if (values.password !== values.password_confirmation) {
            throw { message: 'The new password and confirmation do not match.', errors: { password_confirmation: ['Must match'] } };
          }
          return global.MBMS_RECORDS.submitOrMock('put', 'settings/password', values, function () {
            throw { message: 'Password changes require the Laravel API. Nothing was saved locally.', isNetworkError: false };
          }).then(function (result) {
            global.MBMS_UI.notify({
              type: result.source === 'api' ? 'success' : 'warning',
              message: result.source === 'api' ? 'Password updated.' : 'API not connected. Password was not changed.'
            });
            document.getElementById('password-form').reset();
          });
        }
      });

      global.MBMS_UI.bindForm(document.getElementById('app-form'), {
        onSubmit: function (values) {
          global.MBMS_CONFIG.setApiBaseUrl(values.api_base_url);
          global.MBMS_UI.notify({
            type: 'success',
            message: 'API base URL saved on this device. No production URL is hard-coded in page scripts.'
          });
        }
      });

      document.getElementById('reset-api').addEventListener('click', function () {
        global.MBMS_CONFIG.resetApiBaseUrl();
        document.getElementById('api-base').value = global.MBMS_CONFIG.apiBaseUrl;
        global.MBMS_UI.notify({ type: 'success', message: 'API base URL reset to the local default.' });
      });

      loadProfile();

      Promise.all([fetchCurrentUser(), fetchSettingsMap()]).then(function (results) {
        return revealAdminSections(results[0], results[1]);
      });
    }
  };
})(window);
