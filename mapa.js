(function () {
  var fonte = document.getElementById("mapa-arvore");
  var palco = document.getElementById("mapa-palco");
  if (!fonte || !palco || !window.requestAnimationFrame) return;
  var NS = "http://www.w3.org/2000/svg";
  var reduz = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 1300, H = 820, CX = W / 2, CY = H / 2, KX = 1.12, KY = 0.74, R = [0, 225, 355, 480, 585];
  var CORES = ["#D4A017", "#00AB4E", "#EE302F", "#5BC0EB", "#FFCB05", "#9d7bff", "#ff8a3d", "#4fd1a5", "#ff6fa8", "#7fb3ff"];
  var nos = [];

  var ctx = document.createElement("canvas").getContext("2d");
  ctx.font = "600 15px system-ui, sans-serif";
  function larg(t, ramo) { return Math.ceil(ctx.measureText(t).width) + 34 + (ramo ? 20 : 0); }

  function ler(ul, prof, pai, cor) {
    var lista = [];
    Array.prototype.forEach.call(ul.children, function (li, i) {
      var a = li.querySelector(":scope > a"), sub = li.querySelector(":scope > ul");
      var c = prof === 1 ? CORES[i % CORES.length] : cor;
      var n = { label: li.getAttribute("data-curto") || a.textContent.trim(), full: a.textContent.trim(), href: a.getAttribute("href"), prof: prof, pai: pai, open: false, kids: [], cor: c, x: CX, y: CY, tx: CX, ty: CY, o: 0, to: 0, show: false };
      if (sub) {
        n.kids = ler(sub, prof + 1, n, c);
        var ab = { label: "Abrir página", full: "Abrir " + n.full, href: n.href, prof: prof + 1, pai: n, open: false, kids: [], cor: c, abrir: true, x: CX, y: CY, tx: CX, ty: CY, o: 0, to: 0, show: false };
        n.kids.unshift(ab); nos.push(ab);
      }
      lista.push(n); nos.push(n);
    });
    return lista;
  }
  var raiz = { label: "Tropilha", prof: 0, kids: [], open: true, cor: "#D4A017", x: CX, y: CY, tx: CX, ty: CY, o: 1, to: 1, show: true };
  raiz.kids = ler(fonte, 1, raiz);
  nos.forEach(function (n) { n.w = larg(n.label, n.kids.length && !n.abrir); });

  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "Mapa visual do site. Use Tab e Enter para abrir e fechar os ramos.");
  var gAneis = document.createElementNS(NS, "g"), gLinhas = document.createElementNS(NS, "g"), gNos = document.createElementNS(NS, "g");
  R.slice(1).forEach(function (r) {
    var e = document.createElementNS(NS, "ellipse");
    e.setAttribute("cx", CX); e.setAttribute("cy", CY); e.setAttribute("rx", r * KX); e.setAttribute("ry", r * KY); e.setAttribute("class", "m-anel");
    gAneis.appendChild(e);
  });
  svg.appendChild(gAneis); svg.appendChild(gLinhas); svg.appendChild(gNos);
  palco.appendChild(svg);

  function peso(n) { if (!n.open || !n.kids.length) return 1; if (n.prof === 0) return 0; return Math.max(1, 0.8 * n.kids.length + 0.45 * n.kids.reduce(function (s, k) { return s + (k.open ? peso(k) - 1 : 0); }, 0)); }
  function distribuir(n, a0, a1) {
    var tot = 0; n.kids.forEach(function (k) { tot += peso(k); });
    var a = a0;
    n.kids.forEach(function (k) {
      var span = (a1 - a0) * peso(k) / tot, mid = a + span / 2, r = R[k.prof];
      k.tx = CX + r * KX * Math.cos(mid); k.ty = CY + r * KY * Math.sin(mid); k.to = 1; k.show = true;
      if (k.open && k.kids.length) distribuir(k, mid - span / 2, mid + span / 2);
      a += span;
    });
  }
  function relaxar() {
    var v = nos.filter(function (n) { return n.to === 1; });
    for (var it = 0; it < 60; it++) {
      var mexeu = false;
      for (var i = 0; i < v.length; i++) {
        var a = v[i];
        var dx0 = Math.abs(a.tx - CX), dy0 = Math.abs(a.ty - CY), px0 = 84 + a.w / 2 - dx0, py0 = 70 + 17 - dy0;
        if (px0 > 0 && py0 > 0) { if (px0 < py0) a.tx += (a.tx >= CX ? 1 : -1) * px0; else a.ty += (a.ty >= CY ? 1 : -1) * py0; mexeu = true; }
        for (var j = i + 1; j < v.length; j++) {
          var b = v[j], dx = Math.abs(a.tx - b.tx), dy = Math.abs(a.ty - b.ty), wx = (a.w + b.w) / 2 + 10, wy = 38;
          if (dx < wx && dy < wy) {
            var pxs = wx - dx, pys = wy - dy;
            if (pxs < pys) { var d = pxs / 2 + 0.5; if (a.tx <= b.tx) { a.tx -= d; b.tx += d; } else { a.tx += d; b.tx -= d; } }
            else { var e = pys / 2 + 0.5; if (a.ty <= b.ty) { a.ty -= e; b.ty += e; } else { a.ty += e; b.ty -= e; } }
            mexeu = true;
          }
        }
        a.tx = Math.max(a.w / 2 + 12, Math.min(W - a.w / 2 - 12, a.tx)); a.ty = Math.max(26, Math.min(H - 26, a.ty));
      }
      if (!mexeu) break;
    }
  }
  function recolher(n) { n.kids.forEach(function (k) { k.to = 0; k.tx = n.tx; k.ty = n.ty; recolher(k); }); }
  function layout() {
    nos.forEach(function (n) { n.to = 0; });
    distribuir(raiz, -Math.PI / 2, 1.5 * Math.PI);
    relaxar();
    nos.forEach(function (n) {
      if (n.to === 0) { var p = n.pai; while (p && p.to === 0 && p.pai) p = p.pai; n.tx = p ? p.tx : CX; n.ty = p ? p.ty : CY; }
      else if (!n.show) { n.x = n.pai.x; n.y = n.pai.y; n.show = true; }
    });
    criar(); anim();
  }

  function criar() {
    nos.forEach(function (n) {
      if (n.el || (n.to === 0 && !n.show)) return;
      var w = n.w;
      n.w = w;
      var linha = document.createElementNS(NS, "path");
      linha.setAttribute("class", "m-linha"); linha.setAttribute("stroke", n.cor);
      linha.setAttribute("stroke-width", n.prof === 1 ? 3 : n.prof === 2 ? 2.2 : 1.6);
      gLinhas.appendChild(linha); n.linha = linha;
      var temKids = n.kids.length && !n.abrir;
      var g = document.createElementNS(NS, temKids ? "g" : "a");
      if (!temKids) g.setAttribute("href", n.href);
      else { g.setAttribute("role", "button"); g.setAttribute("tabindex", "0"); g.setAttribute("aria-expanded", "false"); }
      g.setAttribute("class", "m-no m-p" + n.prof + (n.abrir ? " m-abrir" : "") + (temKids ? " m-ramo" : " m-folha"));
      g.style.setProperty("--c", n.cor);
      var t = document.createElementNS(NS, "title"); t.textContent = n.full; g.appendChild(t);
      var r = document.createElementNS(NS, "rect");
      r.setAttribute("x", -w / 2); r.setAttribute("y", -17); r.setAttribute("width", w); r.setAttribute("height", 34); r.setAttribute("rx", 17);
      var tx = document.createElementNS(NS, "text"); tx.setAttribute("text-anchor", "middle"); tx.setAttribute("y", 5); if (temKids) tx.setAttribute("x", -9); tx.textContent = n.label + (temKids ? "" : n.abrir ? " ↗" : "");
      g.appendChild(r); g.appendChild(tx);
      if (temKids) { var b = document.createElementNS(NS, "text"); b.setAttribute("class", "m-sinal"); b.setAttribute("x", w / 2 - 14); b.setAttribute("y", 5); b.setAttribute("text-anchor", "middle"); b.textContent = "+"; g.appendChild(b); n.sinal = b; g.addEventListener("click", function () { alternar(n); }); g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alternar(n); } }); }
      g.addEventListener("mouseenter", function () { realcar(n, true); }); g.addEventListener("mouseleave", function () { realcar(n, false); });
      g.addEventListener("focus", function () { realcar(n, true); }); g.addEventListener("blur", function () { realcar(n, false); });
      gNos.appendChild(g); n.el = g;
    });
  }
  function realcar(n, on) { for (var p = n; p && p.pai; p = p.pai) { if (p.linha) p.linha.classList.toggle("m-hl", on); if (p.el) p.el.classList.toggle("m-hl", on); } }
  function alternar(n) {
    n.open = !n.open;
    if (n.open && n.prof === 1) raiz.kids.forEach(function (o) { if (o !== n && o.open && !n._multi) { /* mantém vários abertos */ } });
    if (!n.open) recolherAbertos(n);
    n.el.setAttribute("aria-expanded", n.open ? "true" : "false");
    layout();
  }
  function recolherAbertos(n) { n.kids.forEach(function (k) { k.open = false; if (k.el && k.sinal) k.el.setAttribute("aria-expanded", "false"); recolherAbertos(k); }); }

  var raf = null, inicio = 0, dur = reduz ? 1 : 650;
  function anim() {
    nos.forEach(function (n) { n.x0 = n.x; n.y0 = n.y; n.o0 = n.o; });
    inicio = 0; if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(passo);
  }
  function suave(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function passo(ts) {
    if (!inicio) inicio = ts;
    var t = Math.min(1, (ts - inicio) / dur), e = suave(t);
    nos.forEach(function (n) {
      if (!n.el) return;
      n.x = n.x0 + (n.tx - n.x0) * e; n.y = n.y0 + (n.ty - n.y0) * e; n.o = n.o0 + (n.to - n.o0) * e;
      n.el.setAttribute("transform", "translate(" + n.x.toFixed(1) + "," + n.y.toFixed(1) + ")");
      var vis = n.o > 0.02;
      n.el.style.opacity = n.o.toFixed(2); n.el.style.pointerEvents = n.to ? "auto" : "none";
      n.el.style.visibility = vis ? "visible" : "hidden";
      if (n.el.tagName === "a" || n.el.tagName === "g") n.el.setAttribute("tabindex", n.to ? "0" : "-1");
      var p = n.pai, px = p.x, py = p.y, mx = (px + n.x) / 2, my = (py + n.y) / 2, dx = n.x - px, dy = n.y - py;
      n.linha.setAttribute("d", "M" + px.toFixed(1) + " " + py.toFixed(1) + " Q" + (mx - dy * 0.12).toFixed(1) + " " + (my + dx * 0.12).toFixed(1) + " " + n.x.toFixed(1) + " " + n.y.toFixed(1));
      n.linha.style.opacity = (n.o * 0.85).toFixed(2); n.linha.style.visibility = vis ? "visible" : "hidden";
      if (n.sinal) n.sinal.textContent = n.open ? "–" : "+";
    });
    if (t < 1) raf = requestAnimationFrame(passo); else raf = null;
  }

  // Centro
  var gc = document.createElementNS(NS, "g");
  gc.setAttribute("class", "m-centro"); gc.setAttribute("role", "button"); gc.setAttribute("tabindex", "0"); gc.setAttribute("transform", "translate(" + CX + "," + CY + ")");
  gc.innerHTML = '<title>Recolher todos os ramos</title><circle class="m-halo" r="74"/><circle class="m-halo m-halo2" r="74"/><circle r="62" class="m-miolo"/><text y="-2" text-anchor="middle" class="m-ct">Tropilha</text><text y="22" text-anchor="middle" class="m-cs">Mapa do site</text>';
  gc.addEventListener("click", function () { tudo(false); }); gc.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tudo(false); } });
  svg.appendChild(gc);

  function tudo(abrir) {
    (function f(n) { n.kids.forEach(function (k) { if (k.kids.length && !k.abrir) { k.open = abrir; if (k.el) k.el.setAttribute("aria-expanded", abrir ? "true" : "false"); } f(k); }); })(raiz);
    layout();
  }
  document.getElementById("mapa-expandir").addEventListener("click", function () { tudo(true); });
  document.getElementById("mapa-recolher").addEventListener("click", function () { tudo(false); });
  var wrap = document.getElementById("mapa-wrap"), bt = document.getElementById("mapa-modo");
  function modo(lista) { wrap.classList.toggle("so-lista", lista); bt.setAttribute("aria-pressed", lista ? "true" : "false"); bt.textContent = lista ? "Ver mapa visual" : "Ver como lista"; }
  bt.addEventListener("click", function () { modo(!wrap.classList.contains("so-lista")); });
  wrap.classList.add("js");
  if (window.innerWidth < 900) modo(true);

  layout();
  var dep = raiz.kids.filter(function (k) { return k.label === "Departamentos"; })[0];
  if (dep && !reduz) setTimeout(function () { if (!dep.open) alternar(dep); }, 900);
  else if (dep) alternar(dep);
})();
