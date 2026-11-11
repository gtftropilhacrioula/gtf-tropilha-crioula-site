(function () {
  var ano = "todos", dep = "todos";
  var anos = document.querySelectorAll(".tl-ano");
  var itens = document.querySelectorAll(".tl-item");
  function marca(grupo, valor, attr) {
    grupo.querySelectorAll(".chip").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute(attr) === valor ? "true" : "false");
    });
  }
  function aplica() {
    var visiveis = 0;
    anos.forEach(function (a) {
      var okAno = ano === "todos" || a.getAttribute("data-ano") === ano;
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
    document.getElementById("tl-vazio").hidden = visiveis > 0;
    marca(document.getElementById("f-ano"), ano, "data-ano");
    marca(document.getElementById("f-dep"), dep, "data-dep");
  }
  document.getElementById("f-ano").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b) return;
    ano = b.getAttribute("data-ano"); aplica();
  });
  document.getElementById("f-dep").addEventListener("click", function (e) {
    var b = e.target.closest(".chip"); if (!b) return;
    dep = b.getAttribute("data-dep"); aplica();
  });
  var primeiro = document.querySelector("#f-ano .chip:nth-child(2)");
  ano = primeiro ? primeiro.getAttribute("data-ano") : "todos";
  aplica();
})();
