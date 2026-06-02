(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────
  var script = document.currentScript ||
    document.querySelector('script[data-monitorx-key]');

  if (!script) return;

  var SITE_KEY = script.getAttribute('data-monitorx-key');
  var HOST = script.src.replace('/monitorx.js', '');
  var API_URL = HOST + '/api/events';
  var MAX_BREADCRUMBS = 100;
  var MAX_RETRIES = 5;
  var RETRY_KEY = 'mx_retry_queue';

  if (!SITE_KEY) {
    console.warn('[MonitorX] No data-monitorx-key provided.');
    return;
  }

  // ─── Breadcrumb Buffer ────────────────────────────────────────────────────
  var breadcrumbs = [];

  function addBreadcrumb(crumb) {
    breadcrumbs.push({
      timestamp: new Date().toISOString(),
      type: crumb.type,
      category: crumb.category,
      message: crumb.message,
      data: crumb.data || {},
      level: crumb.level || 'info',
    });
    if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
  }

  // ─── Sanitize ─────────────────────────────────────────────────────────────
  var SENSITIVE_KEYS = [
    'password', 'token', 'authorization', 'cookie', 'secret',
    'credit_card', 'card_number', 'cvv', 'ssn', 'api_key',
  ];

  function sanitizeHeaders(headers) {
    if (!headers) return {};
    var clean = {};
    Object.keys(headers).forEach(function (k) {
      if (SENSITIVE_KEYS.some(function (s) { return k.toLowerCase().includes(s); })) {
        clean[k] = '[REDACTED]';
      } else {
        clean[k] = headers[k];
      }
    });
    return clean;
  }

  // ─── Generate ID ──────────────────────────────────────────────────────────
  function generateId() {
    return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, function () {
      return Math.floor(Math.random() * 16).toString(16);
    });
  }

  // ─── Send Event ───────────────────────────────────────────────────────────
  function sendEvent(payload) {
    payload.event_id = payload.event_id || generateId();
    payload.timestamp = payload.timestamp || new Date().toISOString();
    payload.url = payload.url || window.location.href;
    payload.user_agent = navigator.userAgent;
    payload.breadcrumbs = breadcrumbs.slice();

    var body = JSON.stringify(payload);

    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MonitorX-Key': SITE_KEY,
      },
      body: body,
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
    }).catch(function () {
      queueForRetry(payload);
    });
  }

  // ─── Retry Queue ──────────────────────────────────────────────────────────
  function queueForRetry(payload) {
    try {
      var queue = JSON.parse(localStorage.getItem(RETRY_KEY) || '[]');
      payload._retries = (payload._retries || 0) + 1;
      if (payload._retries <= MAX_RETRIES) {
        queue.push(payload);
        if (queue.length > 50) queue = queue.slice(-50);
        localStorage.setItem(RETRY_KEY, JSON.stringify(queue));
      }
    } catch (e) {}
  }

  function flushRetryQueue() {
    try {
      var queue = JSON.parse(localStorage.getItem(RETRY_KEY) || '[]');
      if (!queue.length) return;
      localStorage.removeItem(RETRY_KEY);
      queue.forEach(function (payload) { sendEvent(payload); });
    } catch (e) {}
  }

  // Flush on load
  flushRetryQueue();

  // ─── Parse Stack Trace ────────────────────────────────────────────────────
  function parseStack(stack) {
    if (!stack) return [];
    return stack.split('\n').slice(1).map(function (line) {
      line = line.trim();
      var match = line.match(/at (.+?) \((.+?):(\d+):(\d+)\)/) ||
        line.match(/at ()(.+?):(\d+):(\d+)/);
      if (match) {
        return {
          function: match[1] || '<anonymous>',
          filename: match[2],
          lineno: parseInt(match[3], 10),
          colno: parseInt(match[4], 10),
          in_app: !match[2].includes('node_modules') &&
            !match[2].includes('monitorx.js'),
        };
      }
      return { filename: line, in_app: false };
    }).filter(function (f) { return f.filename; });
  }

  // ─── 1. JavaScript Error Monitoring ───────────────────────────────────────
  window.onerror = function (message, source, lineno, colno, error) {
    var frames = error ? parseStack(error.stack) : [{
      filename: source,
      lineno: lineno,
      colno: colno,
      in_app: true,
    }];

    addBreadcrumb({
      type: 'error',
      category: 'exception',
      message: String(message),
      level: 'error',
    });

    sendEvent({
      event_type: 'error',
      level: 'error',
      message: String(message),
      platform: 'javascript',
      stacktrace: { frames: frames.reverse() },
      contexts: {
        browser: { name: navigator.userAgent },
        url: { url: source },
      },
    });

    return false;
  };

  // ─── 2. Unhandled Promise Rejections ──────────────────────────────────────
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var message = reason instanceof Error
      ? reason.message
      : String(reason);
    var frames = reason instanceof Error
      ? parseStack(reason.stack)
      : [];

    addBreadcrumb({
      type: 'error',
      category: 'unhandledrejection',
      message: message,
      level: 'error',
    });

    sendEvent({
      event_type: 'error',
      level: 'error',
      message: 'UnhandledRejection: ' + message,
      platform: 'javascript',
      stacktrace: frames.length ? { frames: frames.reverse() } : undefined,
    });
  });

  // ─── 3. Console Log Monitoring ────────────────────────────────────────────
  var CONSOLE_LEVELS = ['log', 'info', 'warn', 'error'];
  var originalConsole = {};

  CONSOLE_LEVELS.forEach(function (level) {
    originalConsole[level] = console[level].bind(console);
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      var message = args.map(function (a) {
        try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
        catch (e) { return String(a); }
      }).join(' ');

      // Always add to breadcrumbs
      addBreadcrumb({
        type: 'console',
        category: 'console.' + level,
        message: message,
        level: level === 'warn' ? 'warning' : level,
      });

      // Send console.error and console.warn as events
      if (level === 'error' || level === 'warn') {
        sendEvent({
          event_type: 'console',
          level: level === 'warn' ? 'warning' : 'error',
          message: '[console.' + level + '] ' + message,
          platform: 'javascript',
        });
      }

      originalConsole[level].apply(console, args);
    };
  });

  // ─── 4. Network Monitoring (fetch) ────────────────────────────────────────
  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    var method = (init && init.method) || 'GET';
    var startTime = Date.now();

    // Skip MonitorX own requests
    if (url.includes('/api/events') && url.includes(HOST)) {
      return originalFetch.apply(this, arguments);
    }

    return originalFetch.apply(this, arguments).then(function (response) {
      var duration = Date.now() - startTime;
      var status = response.status;

      addBreadcrumb({
        type: 'http',
        category: 'fetch',
        message: method + ' ' + url,
        data: { url: url, method: method, status: status, duration: duration },
        level: status >= 400 ? 'error' : 'info',
      });

      // API failure tracking (5xx errors)
      if (status >= 500) {
        sendEvent({
          event_type: 'api_error',
          level: 'error',
          message: 'API Error: ' + method + ' ' + url + ' returned ' + status,
          platform: 'javascript',
          extra: { url: url, method: method, status: status, duration: duration },
        });
      }

      return response;
    }).catch(function (error) {
      var duration = Date.now() - startTime;

      addBreadcrumb({
        type: 'http',
        category: 'fetch',
        message: method + ' ' + url + ' failed',
        data: { url: url, method: method, error: error.message, duration: duration },
        level: 'error',
      });

      sendEvent({
        event_type: 'network',
        level: 'error',
        message: 'Network Error: ' + method + ' ' + url + ' — ' + error.message,
        platform: 'javascript',
        extra: { url: url, method: method, duration: duration },
      });

      throw error;
    });
  };

  // ─── 5. XHR Monitoring ────────────────────────────────────────────────────
  var OriginalXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    var xhr = new OriginalXHR();
    var method, url, startTime;

    var originalOpen = xhr.open.bind(xhr);
    xhr.open = function (m, u) {
      method = m;
      url = u;
      return originalOpen.apply(xhr, arguments);
    };

    var originalSend = xhr.send.bind(xhr);
    xhr.send = function () {
      startTime = Date.now();
      xhr.addEventListener('loadend', function () {
        var duration = Date.now() - startTime;
        var status = xhr.status;

        if (url && url.includes('/api/events')) {
          return;
        }

        addBreadcrumb({
          type: 'http',
          category: 'xhr',
          message: method + ' ' + url,
          data: { url: url, method: method, status: status, duration: duration },
          level: status >= 400 ? 'error' : 'info',
        });

        if (status >= 500) {
          sendEvent({
            event_type: 'api_error',
            level: 'error',
            message: 'API Error: ' + method + ' ' + url + ' returned ' + status,
            platform: 'javascript',
            extra: { url: url, method: method, status: status, duration: duration },
          });
        }
      });
      return originalSend.apply(xhr, arguments);
    };

    return xhr;
  }
  PatchedXHR.prototype = OriginalXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  // ─── 6. Click Breadcrumbs ─────────────────────────────────────────────────
  document.addEventListener('click', function (event) {
    var target = event.target;
    var tag = target.tagName ? target.tagName.toLowerCase() : 'unknown';
    var text = (target.innerText || target.value || target.getAttribute('aria-label') || '')
      .slice(0, 60);
    var id = target.id ? '#' + target.id : '';
    var cls = target.className && typeof target.className === 'string'
      ? '.' + target.className.split(' ')[0] : '';

    addBreadcrumb({
      type: 'ui',
      category: 'click',
      message: 'Click on ' + tag + id + cls + (text ? ' "' + text + '"' : ''),
      level: 'info',
    });
  }, true);

  // ─── 7. Navigation Breadcrumbs ────────────────────────────────────────────
  var lastUrl = window.location.href;
  var originalPushState = history.pushState;
  var originalReplaceState = history.replaceState;

  function onNavigate(to) {
    addBreadcrumb({
      type: 'navigation',
      category: 'navigation',
      message: 'Navigated from ' + lastUrl + ' to ' + to,
      data: { from: lastUrl, to: to },
      level: 'info',
    });
    lastUrl = to;
  }

  history.pushState = function () {
    originalPushState.apply(history, arguments);
    onNavigate(window.location.href);
  };

  history.replaceState = function () {
    originalReplaceState.apply(history, arguments);
    onNavigate(window.location.href);
  };

  window.addEventListener('popstate', function () {
    onNavigate(window.location.href);
  });

  // ─── Done ─────────────────────────────────────────────────────────────────
  console.log('[MonitorX] Initialized with key:', SITE_KEY);

})();