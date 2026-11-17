(function () {
  var t = document.getElementById("menu");
  if (!t) return;
  var nav = document.querySelector("header nav");
  function fechar() { t.checked = false; }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && t.checked) { fechar(); t.focus(); }
  });
  if (nav) nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) fechar();
  });
  t.addEventListener("change", function () {
    if (t.checked && nav) { var a = nav.querySelector("a"); if (a) setTimeout(function () { a.focus(); }, 50); }
  });
})();
