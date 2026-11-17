/**
 * PALMLOCK — In-Memory HTTP Dispatcher for Sandboxed Test Environments
 * Dispatches HTTP requests directly into Express via in-memory Duplex streams,
 * avoiding loopback TCP network restrictions (EACCES) in sandbox environments.
 */

const http = require('http');
const { Duplex } = require('stream');

function createMockSocket() {
  const socket = new Duplex({
    read() {},
    write(chunk, enc, cb) {
      if (this.onChunk) this.onChunk(chunk);
      cb();
    }
  });
  socket.remoteAddress = '127.0.0.1';
  socket.remotePort = 50000;
  socket.encrypted = false;
  return socket;
}

class TestRequest {
  constructor(app, method, url) {
    this.app = app;
    this.method = method.toUpperCase();
    this.url = url;
    this.reqHeaders = {};
    this.reqBody = null;
  }

  set(header, value) {
    if (typeof header === 'object') {
      for (const [k, v] of Object.entries(header)) {
        this.reqHeaders[k.toLowerCase()] = v;
      }
    } else {
      this.reqHeaders[header.toLowerCase()] = value;
    }
    return this;
  }

  send(data) {
    this.reqBody = data;
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  execute() {
    return new Promise((resolve, reject) => {
      const socket = createMockSocket();
      const req = new http.IncomingMessage(socket);
      req.method = this.method;
      req.url = this.url;

      const payload = this.reqBody !== null && this.reqBody !== undefined
        ? (typeof this.reqBody === 'string' ? this.reqBody : JSON.stringify(this.reqBody))
        : '';

      req.headers = {
        host: 'localhost',
        'user-agent': 'palmlock-test-runner',
        accept: 'application/json, text/plain, */*',
        ...this.reqHeaders
      };

      if (payload) {
        if (!req.headers['content-type']) {
          req.headers['content-type'] = 'application/json';
        }
        req.headers['content-length'] = String(Buffer.byteLength(payload));
      }

      const res = new http.ServerResponse(req);
      res.assignSocket(socket);

      let rawResponse = '';
      socket.onChunk = (chunk) => {
        rawResponse += chunk.toString();
      };

      res.on('finish', () => {
        setImmediate(() => {
          const splitIdx = rawResponse.indexOf('\r\n\r\n');
          let bodyPart = '';

          if (splitIdx !== -1) {
            bodyPart = rawResponse.substring(splitIdx + 4);
          } else {
            bodyPart = rawResponse;
          }

          let parsedBody = bodyPart;
          try {
            parsedBody = JSON.parse(bodyPart);
          } catch (e) {
            // Keep as string if not JSON
          }

          resolve({
            status: res.statusCode,
            statusCode: res.statusCode,
            headers: res.getHeaders(),
            body: parsedBody,
            text: bodyPart
          });
        });
      });

      res.on('error', reject);
      socket.on('error', reject);

      this.app(req, res);

      // Deliver payload on the next tick so Express body-parser has registered its event listeners
      setImmediate(() => {
        if (payload) {
          req.emit('data', Buffer.from(payload));
        }
        req.emit('end');
      });
    });
  }
}

function request(app) {
  return {
    get: (url) => new TestRequest(app, 'GET', url),
    post: (url) => new TestRequest(app, 'POST', url),
    put: (url) => new TestRequest(app, 'PUT', url),
    patch: (url) => new TestRequest(app, 'PATCH', url),
    delete: (url) => new TestRequest(app, 'DELETE', url)
  };
}

module.exports = request;
