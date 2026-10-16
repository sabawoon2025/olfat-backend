/**
 * Forgot password: request email code, then set a new password.
 */
(function (global) {
  'use strict';

  function showBox(id, textId, message) {
    var box = document.getElementById(id);
    var text = document.getElementById(textId);
    if (!box) {
      return;
    }
    if (text) {
      text.textContent = message || '';
    }
    box.hidden = !message;
  }

  function clearMessages() {
    showBox('reset-error', 'reset-error-text', '');
    showBox('reset-success', 'reset-success-text', '');
  }

  function showStep(step) {
    var forgot = document.getElementById('forgot-form');
    var reset = document.getElementById('reset-form');
    var sub = document.getElementById('reset-sub');
    if (forgot) {
      forgot.hidden = step !== 'request';
    }
    if (reset) {
      reset.hidden = step !== 'reset';
    }
    if (sub) {
      sub.textContent = step === 'reset'
        ? 'Enter the code from your email and choose a new password.'
        : 'Enter your account email. We will send a 6-digit confirmation code.';
    }
  }

  var bound = false;

  function bind() {
    if (bound) {
      return;
    }
    bound = true;
    showStep('request');

    var forgotForm = document.getElementById('forgot-form');
    var resetForm = document.getElementById('reset-form');

      if (forgotForm) {
        global.MBMS_UI.bindForm(forgotForm, {
          silentErrors: true,
          onSubmit: function (values) {
            clearMessages();
            return global.MBMS_API.post('auth/forgot-password', {
              email: values.email
            }).then(function (response) {
              var payload = global.MBMS_UTILS.unwrap(response.data) || response.data || {};
              var message = (response.data && response.data.message)
                || payload.message
                || 'If that email is registered, a confirmation code has been sent.';
              var code = payload.code || (response.data && response.data.data && response.data.data.code) || '';
              showBox('reset-success', 'reset-success-text', message);
              document.getElementById('reset-email').value = values.email;
              showStep('reset');
              if (code) {
                var codeInput = document.getElementById('reset-code');
                if (codeInput) {
                  codeInput.value = String(code);
                }
              }
            });
          },
          onError: function (error) {
            showBox(
              'reset-error',
              'reset-error-text',
              global.MBMS_UTILS.getErrorMessage(error, 'Unable to send the confirmation code.')
            );
          }
        });
      }

      if (resetForm) {
        global.MBMS_UI.bindForm(resetForm, {
          silentErrors: true,
          onSubmit: function (values) {
            clearMessages();
            if (values.password !== values.password_confirmation) {
              throw {
                message: 'The new password and confirmation do not match.',
                errors: { password_confirmation: ['Must match'] }
              };
            }
            return global.MBMS_API.post('auth/reset-password', {
              email: values.email,
              code: String(values.code || '').trim(),
              password: values.password,
              password_confirmation: values.password_confirmation
            }).then(function () {
              showBox('reset-success', 'reset-success-text', 'Password updated. Redirecting to sign in…');
              global.setTimeout(function () {
                global.location.href = (global.MBMS_NAV && global.MBMS_NAV.asset)
                  ? global.MBMS_NAV.asset('pages/login.html')
                  : 'login.html';
              }, 900);
            });
          },
          onError: function (error) {
            showBox(
              'reset-error',
              'reset-error-text',
              global.MBMS_UTILS.getErrorMessage(error, 'Unable to reset the password.')
            );
          }
        });
      }
  }

  global.MBMS_PASSWORD_RESET = { bind: bind };

  if (!document.getElementById('login-form')) {
    global.MBMS_PAGE = {
      title: 'Reset password',
      onReady: bind
    };
  }
})(window);
