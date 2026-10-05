// JSON fallback for browsers without native JSON, such as Mobile Safari on
// iOS 3.0 and 3.1. Loaded before dashboard.js and classic.js. It only fills
// in what is missing, so modern browsers keep their native JSON.
// ES3 only: no Array.isArray, no Object.keys, no function declarations in blocks.
(function (global) {
  if (typeof global.JSON !== 'object' || global.JSON === null) {
    global.JSON = {};
  }
  var J = global.JSON;

  if (typeof J.parse !== 'function') {
    // Only used for responses from this server, so eval is acceptable here.
    J.parse = function (text) {
      return eval('(' + text + ')');
    };
  }

  if (typeof J.stringify !== 'function') {
    var escapes = {
      '"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f',
      '\n': '\\n', '\r': '\\r', '\t': '\\t'
    };

    var quote = function (s) {
      return '"' + s.replace(/["\\\u0000-\u001f]/g, function (c) {
        return escapes[c] || '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
      }) + '"';
    };

    var skip = function (v) {
      return v === undefined || typeof v === 'function';
    };

    var str = function (v) {
      var type = typeof v, out = [], i;
      if (v === null) { return 'null'; }
      if (type === 'string') { return quote(v); }
      if (type === 'number') { return isFinite(v) ? String(v) : 'null'; }
      if (type === 'boolean') { return String(v); }
      if (type !== 'object') { return undefined; }
      if (Object.prototype.toString.call(v) === '[object Array]') {
        for (i = 0; i < v.length; i++) {
          out.push(skip(v[i]) ? 'null' : str(v[i]));
        }
        return '[' + out.join(',') + ']';
      }
      for (i in v) {
        if (Object.prototype.hasOwnProperty.call(v, i) && !skip(v[i])) {
          out.push(quote(i) + ':' + str(v[i]));
        }
      }
      return '{' + out.join(',') + '}';
    };

    J.stringify = function (value) {
      return str(value);
    };
  }
})(this);
