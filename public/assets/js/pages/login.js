/**
 * Login: pick province + user email, then password.
 * First successful login claims the province for that user only.
 */
(function (global) {
  'use strict';

  var loginOptionsData = { locations: [], users: [] };

  function showServerError(message) {
    var box = document.getElementById('login-server-error');
    var text = document.getElementById('login-server-error-text');
    if (!box) {
      return;
    }
    if (text) {
      text.textContent = message || '';
    } else {
      box.textContent = message;
    }
    box.hidden = !message;
  }

  function goToDashboard() {
    global.location.href = (global.MBMS_NAV && global.MBMS_NAV.asset)
      ? global.MBMS_NAV.asset('index.html')
      : '../index.html';
  }

  function selectedUser() {
    var emailSelect = document.getElementById('email');
    var email = emailSelect ? emailSelect.value : '';
    if (!email) {
      return null;
    }
    return (loginOptionsData.users || []).filter(function (row) {
      return row.email === email;
    })[0] || null;
  }

  function fillLocations() {
    var select = document.getElementById('location_id');
    if (!select) {
      return;
    }
    var previous = select.value;
    var user = selectedUser();
    select.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select province';
    select.appendChild(placeholder);

    (loginOptionsData.locations || []).forEach(function (row) {
      var option = document.createElement('option');
      option.value = String(row.id);
      var claimedEmail = row.claimed_by && row.claimed_by.email;
      var ownedBySelected = !!(user && claimedEmail && claimedEmail === user.email);
      var availableForSelected = !!row.available || ownedBySelected;

      if (availableForSelected) {
        option.textContent = ownedBySelected ? (row.name + ' (your province)') : row.name;
      } else {
        var claimed = row.claimed_by && (row.claimed_by.name || row.claimed_by.email);
        option.textContent = row.name + ' (taken' + (claimed ? ': ' + claimed : '') + ')';
        option.disabled = true;
      }
      select.appendChild(option);
    });

    if (user && user.location_id) {
      select.value = String(user.location_id);
    } else if (previous) {
      select.value = previous;
      if (select.value !== previous) {
        select.value = '';
      }
    }
  }

  function fillEmails(users) {
    var select = document.getElementById('email');
    if (!select) {
      return;
    }
    select.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select email';
    select.appendChild(placeholder);

    (users || []).forEach(function (row) {
      var option = document.createElement('option');
      option.value = row.email;
      option.textContent = row.name ? (row.name + ' — ' + row.email) : row.email;
      select.appendChild(option);
    });
  }

  function loadOptions() {
    var locationSelect = document.getElementById('location_id');
    var emailSelect = document.getElementById('email');
    if (!locationSelect || !emailSelect || !global.MBMS_AUTH || !global.MBMS_AUTH.loginOptions) {
      return Promise.resolve();
    }

    return global.MBMS_AUTH.loginOptions().then(function (data) {
      loginOptionsData = {
        locations: data.locations || [],
        users: data.users || []
      };
      fillEmails(loginOptionsData.users);
      fillLocations();
    }).catch(function (error) {
      loginOptionsData = { locations: [], users: [] };
      fillEmails([]);
      fillLocations();
      showServerError(
        global.MBMS_UTILS.getErrorMessage(error, 'Unable to load login options from the server.')
      );
    });
  }

  global.MBMS_PAGE = {
    title: 'Sign in',
    onReady: function () {
      var form = document.getElementById('login-form');
      var toggle = document.getElementById('toggle-password');
      var password = document.getElementById('password');
      var emailSelect = document.getElementById('email');

      loadOptions();

      if (emailSelect) {
        emailSelect.addEventListener('change', function () {
          fillLocations();
        });
      }

      if (toggle && password) {
        var toggleIcon = document.getElementById('toggle-password-icon');
        toggle.addEventListener('click', function () {
          var hidden = password.type === 'password';
          password.type = hidden ? 'text' : 'password';
          if (toggleIcon) {
            toggleIcon.className = hidden ? 'bi bi-eye-slash' : 'bi bi-eye';
          }
          toggle.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
        });
      }

      if (!form) {
        return;
      }

      global.MBMS_UI.bindForm(form, {
        silentErrors: true,
        onSubmit: function (values) {
          showServerError('');
          return global.MBMS_AUTH.login({
            email: values.email,
            password: values.password,
            location_id: values.location_id
          }).then(function (result) {
            if (!result.token) {
              showServerError('The server responded, but no token field was found. Confirm the Laravel login response shape.');
              return;
            }
            goToDashboard();
          });
        },
        onError: function (error) {
          var message = global.MBMS_UTILS.getErrorMessage(
            error,
            'Unable to sign in. The authentication API is not connected yet.'
          );
          showServerError(message);
          loadOptions();
        }
      });
    }
  };
})(window);
