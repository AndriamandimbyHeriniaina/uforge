import type { AppSpec } from './types';

/**
 * Builds a null-origin guest document. Spec is JSON data; the player is a Runtime external.
 *
 * @example
 * iframe.srcdoc = buildGuestDocument(spec);
 */
export function buildGuestDocument(spec: AppSpec | null): string {
  const safe = JSON.stringify(spec ?? { pages: [], capabilities: [] }).replace(
    /</g,
    '\\u003c',
  );
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; }
    body {
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #f4efe8;
      color: #1c1814;
      display: flex;
      flex-direction: column;
    }
    #root { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    header.hero { padding: 1.4rem 1.2rem 0.8rem; }
    header.hero h1 { margin: 0; font-size: 1.7rem; font-weight: 600; }
    header.hero p { margin: 0.4rem 0 0; color: #5c564e; line-height: 1.45; }
    main { flex: 1; overflow: auto; padding: 0 1.2rem 6rem; }
    .card {
      background: #fffdf9;
      border: 1px solid #e4dcd0;
      border-radius: 16px;
      padding: 0.9rem 1rem;
      margin: 0 0 0.7rem;
    }
    .row { display: flex; gap: 0.5rem; align-items: center; }
    .grow { flex: 1; min-width: 0; }
    input, textarea {
      width: 100%;
      border: 1px solid #e4dcd0;
      border-radius: 12px;
      padding: 0.7rem 0.8rem;
      font: inherit;
      background: #fff;
      margin: 0 0 0.5rem;
    }
    button.act {
      border: 0;
      border-radius: 12px;
      padding: 0.7rem 0.9rem;
      font: inherit;
      font-weight: 600;
      background: var(--accent, #d4894a);
      color: #1a120c;
      cursor: pointer;
    }
    button.ghost {
      border: 1px solid #e4dcd0;
      background: transparent;
      color: #1c1814;
      border-radius: 12px;
      padding: 0.45rem 0.7rem;
      cursor: pointer;
    }
    nav.tabs {
      display: flex;
      border-top: 1px solid #e4dcd0;
      background: #fffdf9;
    }
    nav.tabs button {
      flex: 1;
      border: 0;
      background: transparent;
      padding: 0.85rem 0.3rem;
      font-size: 0.78rem;
      color: #8a8278;
      cursor: pointer;
    }
    nav.tabs button.on { color: #1c1814; font-weight: 600; }
    canvas { width: 100%; height: 220px; display: block; background: #1c1814; border-radius: 16px; }
    .muted { color: #5c564e; }
    img.shot { width: 100%; border-radius: 12px; margin-top: 0.6rem; }
    .score { font-size: 2.4rem; font-weight: 700; margin: 0.4rem 0; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.__HAPP_SPEC__ = ${safe};
    ${guestPlayerSource()}
  </script>
</body>
</html>`;
}

function guestPlayerSource(): string {
  return `(function () {
  var spec = window.__HAPP_SPEC__ || {};
  var caps = spec.capabilities || [];
  var pages = spec.pages && spec.pages.length ? spec.pages : [{ name: 'Accueil', type: 'home' }];
  var appName = (spec.app && spec.app.name) || 'Mon application';
  var current = 0;
  var root = document.getElementById('root');

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

  function collectionName(page) {
    var type = page.type || '';
    if (type === 'crud') return (page.name || 'items').toLowerCase().replace(/\\s+/g, '-');
    if (page.name === 'Scores') return 'scores';
    return 'items';
  }

  async function render() {
    var page = pages[current] || pages[0];
    root.textContent = '';
    var hero = el('header', { class: 'hero' }, [
      el('h1', { text: page.name }),
      el('p', { text: emptyCopy(page) })
    ]);
    var main = el('main', {});
    var nav = el('nav', { class: 'tabs' });
    if (pages.length > 1) {
      pages.forEach(function (item, index) {
        nav.appendChild(el('button', {
          class: index === current ? 'on' : '',
          text: item.name,
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
      else if (page.name === 'Jouer' || page.type === 'game') await renderGame(main);
      else if (page.name === 'Photos' || page.name === 'Photo') await renderPhotos(main);
      else renderVitrine(main, page);
    } catch (err) {
      main.appendChild(el('p', { class: 'muted', text: String(err.message || err) }));
    }
  }

  function emptyCopy(page) {
    if (!spec.pages || !spec.pages.length) {
      return 'Ton application est encore vide. Décris-la avec le bouton Uforge.';
    }
    if (page.type === 'crud') return 'Tes listes, à ajouter et modifier ici.';
    if (page.type === 'dashboard') return 'Un aperçu de ce qui compte.';
    if (page.name === 'Jouer') return 'Touche pour marquer des points.';
    return appName;
  }

  async function renderCrud(main, page) {
    var col = collectionName(page);
    var rows = [];
    try { rows = await window.runtime.db.query(col); } catch (e) { rows = []; }
    var input = el('input', { placeholder: 'Ajouter…' });
    var add = el('button', {
      class: 'act',
      text: 'Ajouter',
      onClick: async function () {
        var title = input.value.trim();
        if (!title) return;
        await window.runtime.db.upsert(col, { title: title, at: Date.now() });
        input.value = '';
        render();
      }
    });
    main.appendChild(el('div', { class: 'card' }, [input, add]));
    if (!rows.length) {
      main.appendChild(el('p', { class: 'muted', text: 'Rien pour l’instant.' }));
      return;
    }
    rows.slice().reverse().forEach(function (row) {
      var title = String(row.title || row.name || row.id);
      main.appendChild(el('div', { class: 'card row' }, [
        el('div', { class: 'grow', text: title }),
        el('button', {
          class: 'ghost',
          text: 'Retirer',
          onClick: async function () {
            await window.runtime.db.remove(col, row.id);
            render();
          }
        })
      ]));
    });
  }

  async function renderDash(main) {
    var keys = Object.create(null);
    pages.forEach(function (page) {
      if (page.type === 'crud') keys[collectionName(page)] = page.name;
    });
    var names = Object.keys(keys);
    if (!names.length) names = ['items'];
    for (var i = 0; i < names.length; i++) {
      var col = names[i];
      var rows = [];
      try { rows = await window.runtime.db.query(col); } catch (e) { rows = []; }
      main.appendChild(el('div', { class: 'card' }, [
        el('p', { class: 'muted', text: keys[col] || col }),
        el('p', { class: 'score', text: String(rows.length) })
      ]));
    }
  }

  async function renderGame(main) {
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
    var bestEl = el('p', { class: 'muted', text: 'Meilleur : ' + best });
    var canvas = el('canvas', {});
    var ctx = canvas.getContext('2d');
    function paint() {
      canvas.width = canvas.clientWidth * 2;
      canvas.height = 440;
      ctx.fillStyle = '#1c1814';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'hsl(' + hue(appName) + ' 48% 52%)';
      var r = 36 + (score % 12);
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, r * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    canvas.addEventListener('pointerdown', async function () {
      score += 1;
      label.textContent = String(score);
      paint();
      if (score > best) {
        best = score;
        bestEl.textContent = 'Meilleur : ' + best;
        try {
          await window.runtime.db.upsert('scores', { id: 'best', score: best });
        } catch (e) {}
      }
    });
    main.appendChild(label);
    main.appendChild(bestEl);
    main.appendChild(canvas);
    requestAnimationFrame(paint);
  }

  async function renderPhotos(main) {
    var shot = el('div', {});
    var btn = el('button', {
      class: 'act',
      text: 'Prendre une photo',
      onClick: async function () {
        var res = await window.runtime.camera.capture();
        shot.textContent = '';
        if (res && res.dataUrl) {
          var img = el('img', { class: 'shot' });
          img.src = res.dataUrl;
          shot.appendChild(img);
        }
      }
    });
    main.appendChild(el('div', { class: 'card' }, [btn, shot]));
  }

  function renderVitrine(main, page) {
    main.appendChild(el('div', { class: 'card' }, [
      el('p', { text: page.name }),
      el('p', { class: 'muted', text: 'L’écran ' + page.name + ' de ' + appName + '.' })
    ]));
  }

  render();
})();`;
}
