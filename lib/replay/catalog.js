// Generated by CoffeeScript 1.6.3
var Catalog, File, Matcher, Path, assert, exists, existsSync, jsStringEscape, match, mkdir, parseHeaders, readAndInitialParseFile, writeHeaders,
  __slice = [].slice;

assert = require("assert");

File = require("fs");

Path = require("path");

Matcher = require("./matcher");

jsStringEscape = require("js-string-escape");

exists = File.exists || Path.exists;

existsSync = File.existsSync || Path.existsSync;

existsSync = File.existsSync || Path.existsSync;

mkdir = function(pathname, callback) {
  return exists(pathname, function(found) {
    var parent;
    if (found) {
      callback(null);
      return;
    }
    parent = Path.dirname(pathname);
    return exists(parent, function(found) {
      if (found) {
        return File.mkdir(pathname, callback);
      } else {
        return mkdir(parent, function() {
          return File.mkdir(pathname, callback);
        });
      }
    });
  });
};

Catalog = (function() {
  function Catalog(settings) {
    this.settings = settings;
    this.matchers = {};
    this._basedir = Path.resolve("fixtures");
  }

  Catalog.prototype.getFixturesDir = function() {
    return this._basedir;
  };

  Catalog.prototype.setFixturesDir = function(dir) {
    this._basedir = Path.resolve(dir);
    this.matchers = {};
  };

  Catalog.prototype.find = function(host) {
    var file, files, mapping, matchers, pathname, stat, _base, _base1, _i, _len;
    matchers = this.matchers[host];
    if (matchers) {
      return matchers;
    }
    pathname = "" + (this.getFixturesDir()) + "/" + (host.replace(":", "-"));
    if (!existsSync(pathname)) {
      pathname = "" + (this.getFixturesDir()) + "/" + host;
    }
    if (!existsSync(pathname)) {
      return;
    }
    stat = File.statSync(pathname);
    if (stat.isDirectory()) {
      files = File.readdirSync(pathname);
      for (_i = 0, _len = files.length; _i < _len; _i++) {
        file = files[_i];
        matchers = (_base = this.matchers)[host] || (_base[host] = []);
        mapping = this._read("" + pathname + "/" + file);
        matchers.push(Matcher.fromMapping(host, mapping));
      }
    } else {
      matchers = (_base1 = this.matchers)[host] || (_base1[host] = []);
      mapping = this._read(pathname);
      matchers.push(Matcher.fromMapping(host, mapping));
    }
    return matchers;
  };

  Catalog.prototype.save = function(host, request, response, callback) {
    var logger, matcher, matchers, pathname, request_headers, tmpfile, uid, _base;
    matcher = Matcher.fromMapping(host, {
      request: request,
      response: response
    });
    matchers = (_base = this.matchers)[host] || (_base[host] = []);
    matchers.push(matcher);
    request_headers = this.settings.headers;
    uid = +(new Date) + "" + Math.floor(Math.random() * 100000);
    tmpfile = "" + (this.getFixturesDir()) + "/node-replay." + uid;
    pathname = "" + (this.getFixturesDir()) + "/" + (host.replace(":", "-"));
    logger = request.replay.logger;
    logger.log("Creating " + pathname);
    return mkdir(pathname, function(error) {
      var body, chunks, file, filename, part, _i, _j, _len, _len1, _ref, _ref1;
      if (error) {
        return callback(error);
      }
      filename = "" + pathname + "/" + uid;
      try {
        file = File.createWriteStream(tmpfile, {
          encoding: "utf-8"
        });
        file.write("" + (request.method.toUpperCase()) + " " + (request.url.path || "/") + "\n");
        writeHeaders(file, request.headers, request_headers);
        if (request.body) {
          body = "";
          _ref = request.body;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            chunks = _ref[_i];
            body += chunks[0];
          }
          writeHeaders(file, {
            body: jsStringEscape(body)
          });
        }
        file.write("\n");
        file.write("" + (response.status || 200) + " HTTP/" + (response.version || "1.1") + "\n");
        writeHeaders(file, response.headers);
        file.write("\n");
        _ref1 = response.body;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          part = _ref1[_j];
          file.write(part);
        }
        return file.end(function() {
          return File.rename(tmpfile, filename, callback);
        });
      } catch (_error) {
        error = _error;
        return callback(error);
      }
    });
  };

  Catalog.prototype._read = function(filename) {
    var body, parse_request, parse_response, request, request_headers, response, _ref;
    request_headers = this.settings.headers;
    parse_request = function(request) {
      var body, flags, header_lines, headers, in_regexp, method, method_and_path, path, raw_regexp, regexp, _, _ref, _ref1, _ref2, _ref3;
      assert(request, "" + filename + " missing request section");
      _ref = request.split(/\n/), method_and_path = _ref[0], header_lines = 2 <= _ref.length ? __slice.call(_ref, 1) : [];
      if (/\sREGEXP\s/.test(method_and_path)) {
        _ref1 = method_and_path.split(" REGEXP "), method = _ref1[0], raw_regexp = _ref1[1];
        _ref2 = raw_regexp.match(/^\/(.+)\/(i|m|g)?$/), _ = _ref2[0], in_regexp = _ref2[1], flags = _ref2[2];
        regexp = new RegExp(in_regexp, flags || "");
      } else {
        _ref3 = method_and_path.split(/\s/), method = _ref3[0], path = _ref3[1];
      }
      assert(method && (path || regexp), "" + filename + ": first line must be <method> <path>");
      headers = parseHeaders(filename, header_lines, request_headers);
      body = headers["body"];
      delete headers["body"];
      return {
        url: path || regexp,
        method: method,
        headers: headers,
        body: body
      };
    };
    parse_response = function(response, body) {
      var header_lines, headers, status, status_line, version, _ref;
      if (response) {
        _ref = response.split(/\n/), status_line = _ref[0], header_lines = 2 <= _ref.length ? __slice.call(_ref, 1) : [];
        status = parseInt(status_line.split()[0], 10);
        version = status_line.match(/\d.\d$/);
        headers = parseHeaders(filename, header_lines);
      }
      return {
        status: status,
        version: version,
        headers: headers,
        body: body
      };
    };
    _ref = readAndInitialParseFile(filename), request = _ref[0], response = _ref[1], body = _ref[2];
    return {
      request: parse_request(request),
      response: parse_response(response, body)
    };
  };

  return Catalog;

})();

readAndInitialParseFile = function(filename) {
  var body, buffer, parts;
  buffer = File.readFileSync(filename);
  parts = buffer.toString('utf8').split('\n\n');
  if (parts.length > 2) {
    body = buffer.slice(parts[0].length + parts[1].length + 4);
  }
  return [parts[0], parts[1], body || ''];
};

parseHeaders = function(filename, header_lines, only) {
  var headers, key, line, name, value, _, _i, _len, _ref;
  if (only == null) {
    only = null;
  }
  headers = Object.create(null);
  for (_i = 0, _len = header_lines.length; _i < _len; _i++) {
    line = header_lines[_i];
    if (line === "") {
      continue;
    }
    _ref = line.match(/^(.*?)\:\s+(.*)$/), _ = _ref[0], name = _ref[1], value = _ref[2];
    if (only && !match(name, only)) {
      continue;
    }
    key = (name || "").toLowerCase();
    value = (value || "").trim().replace(/^"(.*)"$/, "$1");
    if (Array.isArray(headers[key])) {
      headers[key].push(value);
    } else if (headers[key]) {
      headers[key] = [headers[key], value];
    } else {
      headers[key] = value;
    }
  }
  return headers;
};

writeHeaders = function(file, headers, only) {
  var item, name, value, _results;
  if (only == null) {
    only = null;
  }
  _results = [];
  for (name in headers) {
    value = headers[name];
    if (only && !match(name, only)) {
      continue;
    }
    if (Array.isArray(value)) {
      _results.push((function() {
        var _i, _len, _results1;
        _results1 = [];
        for (_i = 0, _len = value.length; _i < _len; _i++) {
          item = value[_i];
          _results1.push(file.write("" + name + ": " + item + "\n"));
        }
        return _results1;
      })());
    } else {
      _results.push(file.write("" + name + ": " + value + "\n"));
    }
  }
  return _results;
};

match = function(name, regexps) {
  var regexp, _i, _len;
  for (_i = 0, _len = regexps.length; _i < _len; _i++) {
    regexp = regexps[_i];
    if (regexp.test(name)) {
      return true;
    }
  }
  return false;
};

module.exports = Catalog;
