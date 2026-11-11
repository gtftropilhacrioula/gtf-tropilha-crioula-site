(function () {
  var anos = Array.prototype.slice.call(document.querySelectorAll(".tl-ano"));
  var chipsAno = document.getElementById("f-ano");
  var chipsDep = document.getElementById("f-dep");
  var fim = document.getElementById("tl-fim");
  var ordem = anos.map(function (a) { return a.getAttribute("data-ano"); }); // DOM já está do mais novo ao mais antigo, "0" por último
  ordem = ordem.filter(function (x) { return x !== "0"; }).concat(ordem.indexOf("0") >= 0 ? ["0"] : []);
  var ano = "todos", dep = "todos", mostrar = {};

  function secao(a) { return document.querySelector('.tl-ano[data-ano="' + a + '"]'); }
  function temItem(a) {
    var s = secao(a);
    return !!s && (dep === "todos" ? s.querySelector(".tl-item") : s.querySelector('.tl-item[data-dep="' + dep + '"]'));
  }
  function maisAntigo() {
    var idx = -1;
    ordem.forEach(function (a, i) { if (mostrar[a]) idx = Math.max(idx, i); });
    return idx;
  }
  function carregaProximo() {
    for (var i = maisAntigo() + 1; i < ordem.length; i++) {
      if (temItem(ordem[i])) { mostrar[ordem[i]] = true; return true; }
      mostrar[ordem[i]] = true; // ano sem itens neste filtro: conta como visto
    }
    return false;
  }
  function marca(grupo, valor, attr) {
    grupo.querySelectorAll(".chip").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute(attr) === valor ? "true" : "false");
    });
  }
  function aplica() {
    var visiveis = 0;
    anos.forEach(function (a) {
      var okAno = ano === "todos" || mostrar[a.getAttribute("data-ano")];
      var algum = false;
      a.querySelectorAll(".tl-mes").forEach(function (m) {
        var mAlgum = false;
        m.querySelectorAll(".tl-item").forEach(function (li) {
          var ok = okAno && (dep === "todos" || li.getAttribute("data-dep") === dep);
          li.hidden = !ok;
          if (ok) { mAlgum = true; visiveis++; }
        });
        m.hidden = !mAlgum;
        if (mAlgum) algum = true;
      });
      a.hidden = !algum;
    });
    if (visiveis === 0 && ano !== "todos" && carregaProximo()) { aplica(); return; }
    var acabou = ano === "todos" || maisAntigo() >= ordem.length - 1;
    document.getElementById("tl-vazio").hidden = visiveis > 0;
    document.getElementById("tl-acabou").hidden = !(acabou && visiveis > 0 && ano !== "todos");
    marca(chipsAno, ano, "data-ano");
    marca(chipsDep, dep, "data-dep");
  }
  function escolheAno(v) {
    ano = v; mostrar = {};
    if (v !== "todos") mostrar[v] = true;
    aplica();
    verificaFim();
  }
  function noFim() {
    var r = fim.getBoundingClientRect();
    return r.top < (window.innerHeight || document.documentElement.clientHeight) + 200;
  }
  function verificaFim() {
    var guarda = 0;
    while (ano !== "todos" && noFim() && guarda++ < 30) {
      if (!carregaProximo()) break;
      aplica();
    }
  }

  chipsAno.addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (b) escolheAno(b.getAttribute("data-ano"));
  });
  chipsDep.addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b) return;
    dep = b.getAttribute("data-dep"); aplica(); verificaFim();
  });
  window.addEventListener("scroll", verificaFim, { passive: true });
  window.addEventListener("resize", verificaFim);
  escolheAno(ordem[0] || "todos");
})();
