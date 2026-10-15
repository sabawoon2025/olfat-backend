/**
 * Shared helpers: formatting, forms, API response shaping, and common DOM work.
 * No business calculations (stock, profit, debt) belong here.
 */
(function (global) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad(num) {
    return String(num).padStart(2, '0');
  }

  function toDate(value) {
    if (!value) {
      return null;
    }
    var date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    var date = toDate(value);
    if (!date) {
      return '';
    }
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function formatDateTime(value) {
    var date = toDate(value);
    if (!date) {
      return '';
    }
    return formatDate(date) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function formatNumber(value, options) {
    options = options || {};
    var number = Number(value);
    if (!isFinite(number)) {
      return '';
    }
    return number.toLocaleString(undefined, {
      minimumFractionDigits: options.minDecimals || 0,
      maximumFractionDigits: options.maxDecimals != null ? options.maxDecimals : 2
    });
  }

  function formatMoney(value, currency) {
    var number = Number(value);
    if (!isFinite(number)) {
      return '';
    }
    try {
      return number.toLocaleString(undefined, {
        style: 'currency',
        currency: currency || 'USD'
      });
    } catch (err) {
      return formatNumber(number, { minDecimals: 2, maxDecimals: 2 }) + (currency ? ' ' + currency : '');
    }
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var context = this;
      var args = arguments;
      global.clearTimeout(timer);
      timer = global.setTimeout(function () {
        fn.apply(context, args);
      }, wait || 250);
    };
  }

  function unwrap(payload) {
    if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
      return payload.data;
    }
    return payload;
  }

  function getErrorMessage(error, fallback) {
    if (!error) {
      return fallback || 'Something went wrong.';
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error.message) {
      return error.message;
    }
    return fallback || 'Something went wrong.';
  }

  function getValidationErrors(error) {
    if (error && error.errors && typeof error.errors === 'object') {
      return error.errors;
    }
    if (error && error.data && error.data.errors && typeof error.data.errors === 'object') {
      return error.data.errors;
    }
    return {};
  }

  function formToObject(form) {
    var data = {};
    var formData = new FormData(form);
    formData.forEach(function (value, key) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (!Array.isArray(data[key])) {
          data[key] = [data[key]];
        }
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });
    return data;
  }

  function fillForm(form, values) {
    values = values || {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || !(el.name in values)) {
        return;
      }
      if (el.type === 'checkbox') {
        el.checked = !!values[el.name];
        return;
      }
      if (el.type === 'radio') {
        el.checked = el.value === String(values[el.name]);
        return;
      }
      el.value = values[el.name] == null ? '' : values[el.name];
    });
  }

  function clearFormErrors(form) {
    Array.prototype.forEach.call(form.querySelectorAll('.is-invalid'), function (el) {
      el.classList.remove('is-invalid');
    });
    Array.prototype.forEach.call(form.querySelectorAll('[data-error-for]'), function (el) {
      el.textContent = '';
    });
  }

  function setFormErrors(form, errors) {
    clearFormErrors(form);
    Object.keys(errors || {}).forEach(function (name) {
      var field = form.elements[name];
      var message = Array.isArray(errors[name]) ? errors[name][0] : errors[name];
      if (field) {
        field.classList.add('is-invalid');
      }
      var holder = form.querySelector('[data-error-for="' + name + '"]');
      if (holder) {
        holder.textContent = message || '';
      }
    });
  }

  function requiredFields(form) {
    var missing = [];
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (el) {
      if (!String(el.value || '').trim()) {
        missing.push(el.name || el.id || 'field');
      }
    });
    return missing;
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function setIconHeading(el, iconClass, text) {
    if (!el) {
      return;
    }
    var icon = iconClass;
    if (!icon) {
      var existing = el.querySelector('.bi');
      if (existing) {
        icon = Array.prototype.filter.call(existing.classList, function (cls) {
          return cls !== 'bi';
        })[0];
      }
    }
    icon = icon || el.getAttribute('data-icon') || 'bi-circle';
    el.setAttribute('data-icon', icon);
    el.innerHTML = '<i class="bi ' + escapeHtml(icon) + '" aria-hidden="true"></i> ' + escapeHtml(text == null ? '' : text);
  }

  global.MBMS_UTILS = {
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    formatNumber: formatNumber,
    formatMoney: formatMoney,
    debounce: debounce,
    unwrap: unwrap,
    getErrorMessage: getErrorMessage,
    getValidationErrors: getValidationErrors,
    formToObject: formToObject,
    fillForm: fillForm,
    clearFormErrors: clearFormErrors,
    setFormErrors: setFormErrors,
    requiredFields: requiredFields,
    qs: qs,
    qsa: qsa,
    setIconHeading: setIconHeading
  };
})(window);
