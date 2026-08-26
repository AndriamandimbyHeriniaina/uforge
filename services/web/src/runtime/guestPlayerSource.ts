/**
 * Guest player IIFE injected into the sandboxed srcdoc. Keep this as a string:
 * the iframe has no bundler.
 *
 * @example
 * iframe.srcdoc includes guestPlayerSource();
 */
export function guestPlayerSource(): string {
  return `(function () {
  var spec = window.__HAPP_SPEC__ || {};
  var caps = spec.capabilities || [];
  var pages = spec.pages && spec.pages.length ? spec.pages : [{ name: 'Accueil', type: 'custom' }];
  var appName = (spec.app && spec.app.name) || 'Mon application';
  var current = 0;
  var gameGen = 0;
  var root = document.getElementById('root');
  function pickStart() {
    var gi = -1;
    var ci = -1;
    pages.forEach(function (page, index) {
      if (page.type === 'game' && gi < 0) gi = index;
      if (page.type === 'crud' && ci < 0) ci = index;
    });
    if (gi >= 0) current = gi;
    else if (ci >= 0) current = ci;
  }
  pickStart();

  function hue(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return h % 360;
  }
  document.documentElement.style.setProperty('--accent', 'hsl(' + hue(appName) + ' 48% 52%)');

  function call(method, params) {
    return new Promise(function (resolve, reject) {
      var id = Math.random().toString(36).slice(2);
      function onMsg(event) {
        var data = event.data;
        if (!data || data.type !== 'runtime-result' || data.id !== id) return;
        window.removeEventListener('message', onMsg);
        if (data.error) reject(new Error(data.error));
        else resolve(data.result);
      }
      window.addEventListener('message', onMsg);
      parent.postMessage({ type: 'runtime', id: id, method: method, params: params || {} }, '*');
    });
  }

  window.runtime = {
    capabilities: {
      has: function (name) { return Promise.resolve(caps.indexOf(name) !== -1); }
    },
    storage: {
      get: function (key) { return call('storage.get', { key: key }); },
      set: function (key, value) { return call('storage.set', { key: key, value: value }); },
      list: function () { return call('storage.list', {}); }
    },
    db: {
      query: function (collection) { return call('db.query', { collection: collection || 'items' }); },
      upsert: function (collection, record) {
        return call('db.upsert', { collection: collection || 'items', record: record });
      },
      remove: function (collection, id) {
        return call('db.remove', { collection: collection || 'items', id: id });
      }
    },
    camera: { capture: function () { return call('camera.capture', {}); } },
    files: { pick: function () { return call('files.pick', {}); } },
    share: { send: function (text) { return call('share.send', { text: text }); } }
  };

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  function pointFrom(event) {
    var t = (event.changedTouches && event.changedTouches[0])
      || (event.touches && event.touches[0])
      || event;
    return { x: Number(t.clientX || 0), y: Number(t.clientY || 0) };
  }

  function bindTap(node, handler) {
    var last = 0;
    function wrap(event) {
      if (event.cancelable) event.preventDefault();
      var now = Date.now();
      if (event.type === 'click' && now - last < 400) return;
      if (event.type !== 'click') last = now;
      handler(event);
    }
    node.addEventListener('pointerdown', wrap);
    node.addEventListener('touchstart', wrap, { passive: false });
    node.addEventListener('click', wrap);
  }

  function collectionName(page) {
    if (page.collection) return String(page.collection);
    if (page.type === 'crud') return String(page.name || 'items').toLowerCase().replace(/\\s+/g, '-');
    if (page.type === 'game') return 'scores';
    return 'items';
  }

  function defaultFields(page) {
    if (page.fields && page.fields.length) return page.fields;
    return [{ key: 'title', label: 'Ajouter…', kind: 'text' }];
  }

  function rowTitle(row, fields) {
    var first = fields && fields[0] && fields[0].key;
    return String(row[first] || row.title || row.name || row.id || '');
  }

  async function render() {
    gameGen += 1;
    var page = pages[current] || pages[0];
    root.textContent = '';
    var hero = el('header', { class: 'hero' }, [
      el('h1', { text: page.name }),
      el('p', { text: emptyCopy(page) })
    ]);
    var main = el('main', {});
    if (page.type === 'game') main.className = 'play';
    var nav = el('nav', { class: 'tabs' });
    if (pages.length > 1) {
      pages.forEach(function (item, index) {
        nav.appendChild(el('button', {
          class: index === current ? 'on' : '',
          text: item.name,
          type: 'button',
          onClick: function () { current = index; render(); }
        }));
      });
    }
    root.appendChild(hero);
    root.appendChild(main);
    if (pages.length > 1) root.appendChild(nav);

    try {
      if (!spec.pages || !spec.pages.length) return;
      if (page.type === 'crud') await renderCrud(main, page);
      else if (page.type === 'dashboard') await renderDash(main);
      else if (page.type === 'game') await renderGame(main, page);
      else await renderCustom(main, page);
    } catch (err) {
      main.appendChild(el('p', { class: 'muted', text: String(err.message || err) }));
    }
  }

  function emptyCopy(page) {
    if (!spec.pages || !spec.pages.length) {
      return 'Ton application est encore vide. Décris-la avec le bouton Uforge.';
    }
    if (page.description) return page.description;
    if (page.type === 'crud') return 'Tes listes, à ajouter et modifier ici.';
    if (page.type === 'dashboard') return 'Un aperçu de ce qui compte.';
    if (page.type === 'game') return (page.game && page.game.goal) || 'Touche le point pour marquer.';
    return appName;
  }

  async function renderCrud(main, page) {
    var col = collectionName(page);
    var fields = defaultFields(page);
    var rows = [];
    try { rows = await window.runtime.db.query(col); } catch (e) { rows = []; }
    var drafts = Object.create(null);
    var formKids = [];
    fields.forEach(function (field) {
      var kind = field.kind || 'text';
      formKids.push(el('p', { class: 'lbl', text: field.label || field.key }));
      if (kind === 'note') {
        var area = el('textarea', { placeholder: field.label || '' });
        drafts[field.key] = area;
        formKids.push(area);
      } else if (kind === 'photo') {
        var box = el('div', {});
        var btn = el('button', {
          class: 'ghost',
          type: 'button',
          text: 'Photo',
          onClick: async function () {
            var res = await window.runtime.camera.capture();
            if (!res || !res.dataUrl) return;
            drafts[field.key] = res.dataUrl;
            box.textContent = '';
            var img = el('img', { class: 'shot' });
            img.src = res.dataUrl;
            box.appendChild(img);
          }
        });
        drafts[field.key] = '';
        formKids.push(btn);
        formKids.push(box);
      } else {
        var input = el('input', {
          placeholder: field.label || '',
          type: kind === 'number' ? 'number' : 'text'
        });
        drafts[field.key] = input;
        formKids.push(input);
      }
    });
    formKids.push(el('button', {
      class: 'act',
      type: 'button',
      text: 'Ajouter',
      onClick: async function () {
        var record = { at: Date.now() };
        var ok = false;
        fields.forEach(function (field) {
          var kind = field.kind || 'text';
          var value;
          if (kind === 'photo') value = drafts[field.key];
          else value = String((drafts[field.key] && drafts[field.key].value) || '').trim();
          record[field.key] = kind === 'number' && value !== '' ? Number(value) : value;
          if (kind !== 'photo' && value) ok = true;
          if (kind === 'photo' && value) ok = true;
        });
        if (!ok) return;
        await window.runtime.db.upsert(col, record);
        render();
      }
    }));
    main.appendChild(el('div', { class: 'card stack' }, formKids));
    if (!rows.length) {
      main.appendChild(el('p', { class: 'muted', text: 'Rien pour l’instant.' }));
      return;
    }
    rows.slice().reverse().forEach(function (row) {
      var body = [el('div', { class: 'grow', text: rowTitle(row, fields) })];
      fields.forEach(function (field) {
        if (field.kind === 'photo' && row[field.key]) {
          var img = el('img', { class: 'thumb' });
          img.src = String(row[field.key]);
          body.unshift(img);
        } else if (field.kind !== 'text' && row[field.key] && field.key !== fields[0].key) {
          body.push(el('p', { class: 'muted', text: String(row[field.key]) }));
        }
      });
      body.push(el('button', {
        class: 'ghost',
        type: 'button',
        text: 'Retirer',
        onClick: async function () {
          await window.runtime.db.remove(col, row.id);
          render();
        }
      }));
      main.appendChild(el('div', { class: 'card row wrap' }, body));
    });
  }

  async function renderDash(main) {
    var keys = Object.create(null);
    pages.forEach(function (page) {
      if (page.type === 'crud') keys[collectionName(page)] = page.name;
    });
    if (pages.some(function (page) { return page.type === 'game'; })) {
      keys.scores = 'Scores';
    }
    var names = Object.keys(keys);
    if (!names.length) names = ['items'];
    for (var i = 0; i < names.length; i++) {
      var col = names[i];
      var rows = [];
      try { rows = await window.runtime.db.query(col); } catch (e) { rows = []; }
      var recent = rows.slice(-3).reverse().map(function (row) {
        return el('p', { text: String(row.title || row.name || row.score || row.id) });
      });
      main.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'muted', text: keys[col] || col }),
        el('p', { class: 'score', text: String(rows.length) })
      ].concat(recent)));
    }
  }

  function unwrapGameSource(source) {
    var body = String(source || '').trim();
    if (!body) return '';
    if (body.indexOf('function') === 0 || /^\\([^)]*\\)\\s*=>/.test(body)) {
      return body;
    }
    return body;
  }

  function runScriptGame(main, page, source, token) {
    var goal = (page.game && page.game.goal) || page.description || '';
    if (goal) main.appendChild(el('p', { class: 'muted', text: goal }));
    var canvas = el('canvas', {});
    main.appendChild(canvas);
    function size() {
      if (token !== gameGen) return;
      var w = Math.max(canvas.clientWidth, 240);
      var h = Math.max(canvas.clientHeight, 160);
      canvas.width = Math.floor(w * 2);
      canvas.height = Math.floor(h * 2);
    }
    size();
    var ctx = canvas.getContext('2d');
    window.addEventListener('resize', size);
    var body = unwrapGameSource(source);
    try {
      if (body.indexOf('function') === 0 || /^\\([^)]*\\)\\s*=>/.test(body)) {
        var factory = new Function('return (' + body + ')');
        var run = factory();
        if (typeof run === 'function') {
          run(canvas, ctx, window.runtime, page, spec, size);
          return;
        }
      }
      var fn = new Function('canvas', 'ctx', 'runtime', 'page', 'spec', 'resize', body);
      fn(canvas, ctx, window.runtime, page, spec, size);
    } catch (err) {
      main.appendChild(el('p', {
        class: 'muted',
        text: String((err && err.message) || err)
      }));
    }
  }

  async function renderGame(main, page) {
    var token = gameGen;
    var game = page.game || {};
    var source = game.source || game.code || game.js || '';
    if (source) {
      runScriptGame(main, page, String(source), token);
      return;
    }
    var kind = game.kind;
    if (kind !== 'catch' && kind !== 'tap') {
      main.appendChild(el('p', {
        class: 'muted',
        text: page.description || 'Dis-moi les règles du jeu pour le créer ici.'
      }));
      return;
    }
    var best = 0;
    try {
      var scores = await window.runtime.db.query('scores');
      scores.forEach(function (row) {
        var n = Number(row.score || 0);
        if (n > best) best = n;
      });
    } catch (e) {}
    var score = 0;
    var label = el('p', { class: 'score', text: '0' });
    var hint = el('p', {
      class: 'muted',
      text: ((page.game && page.game.goal) || 'Touche le point.') + ' Meilleur : ' + best
    });
    var canvas = el('canvas', {});
    var ctx = canvas.getContext('2d');
    var target = { x: 0.5, y: 0.5, vx: 0.004, vy: -0.003 };
    function size() {
      var w = Math.max(canvas.clientWidth, 240);
      var h = Math.max(canvas.clientHeight, 160);
      canvas.width = Math.floor(w * 2);
      canvas.height = Math.floor(h * 2);
    }
    function scramble() {
      target.x = 0.18 + Math.random() * 0.64;
      target.y = 0.18 + Math.random() * 0.64;
      var speed = 0.003 + Math.random() * 0.006;
      var angle = Math.random() * Math.PI * 2;
      target.vx = Math.cos(angle) * speed;
      target.vy = Math.sin(angle) * speed;
    }
    function paint() {
      if (!ctx) return;
      var w = canvas.width;
      var h = canvas.height;
      ctx.fillStyle = '#1c1814';
      ctx.fillRect(0, 0, w, h);
      var px = kind === 'tap' ? w / 2 : target.x * w;
      var py = kind === 'tap' ? h / 2 : target.y * h;
      var r = Math.max(28, w * 0.045);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(' + hue(appName) + ' 62% 58%)';
      ctx.fill();
    }
    function step() {
      if (token !== gameGen) return;
      if (kind === 'catch') {
        target.x += target.vx;
        target.y += target.vy;
        if (target.x < 0.12 || target.x > 0.88) target.vx *= -1;
        if (target.y < 0.12 || target.y > 0.88) target.vy *= -1;
        target.x = Math.min(0.88, Math.max(0.12, target.x));
        target.y = Math.min(0.88, Math.max(0.12, target.y));
      }
      paint();
      requestAnimationFrame(step);
    }
    async function onTap(event) {
      var p = pointFrom(event);
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = (p.x - rect.left) / rect.width;
      var y = (p.y - rect.top) / rect.height;
      if (kind === 'catch') {
        var dx = x - target.x;
        var dy = y - target.y;
        if (dx * dx + dy * dy > 0.16) return;
        scramble();
      }
      score += 1;
      label.textContent = String(score);
      paint();
      if (score > best) {
        best = score;
        hint.textContent = ((page.game && page.game.goal) || 'Touche le point.') + ' Meilleur : ' + best;
        try {
          await window.runtime.db.upsert('scores', { id: 'best', score: best });
        } catch (e) {}
      }
    }
    canvas.setAttribute('role', 'button');
    bindTap(canvas, onTap);
    main.appendChild(label);
    main.appendChild(hint);
    main.appendChild(canvas);
    function fit() {
      if (token !== gameGen) return;
      size();
      paint();
    }
    window.addEventListener('resize', fit);
    requestAnimationFrame(function () {
      scramble();
      fit();
      requestAnimationFrame(step);
    });
  }

  async function renderCustom(main, page) {
    var kids = [];
    if (page.description) {
      kids.push(el('p', { text: page.description }));
    } else {
      kids.push(el('p', { class: 'muted', text: 'L’écran ' + page.name + ' de ' + appName + '.' }));
    }
    (page.items || []).forEach(function (item) {
      kids.push(el('p', { text: '• ' + item }));
    });
    var shot = el('div', {});
    (page.actions || []).forEach(function (action) {
      kids.push(el('button', {
        class: 'act',
        type: 'button',
        text: action.label || action.run,
        onClick: async function () {
          if (action.run === 'goto') {
            var idx = pages.findIndex(function (p) { return p.name === action.page; });
            if (idx >= 0) { current = idx; render(); }
            return;
          }
          if (action.run === 'share') {
            await window.runtime.share.send(action.text || appName);
            return;
          }
          if (action.run === 'files') {
            var file = await window.runtime.files.pick();
            if (file && file.name) {
              shot.textContent = '';
              shot.appendChild(el('p', { class: 'muted', text: file.name }));
            }
            return;
          }
          var res = await window.runtime.camera.capture();
          shot.textContent = '';
          if (res && res.dataUrl) {
            var img = el('img', { class: 'shot' });
            img.src = res.dataUrl;
            shot.appendChild(img);
          }
        }
      }));
    });
    if (!page.actions || !page.actions.length) {
      var gameIndex = pages.findIndex(function (item) { return item.type === 'game'; });
      if (gameIndex >= 0) {
        kids.push(el('button', {
          class: 'act',
          type: 'button',
          text: 'Jouer',
          onClick: function () { current = gameIndex; render(); }
        }));
      }
    }
    kids.push(shot);
    main.appendChild(el('div', { class: 'card stack' }, kids));
  }

  render();
})();`;
}
