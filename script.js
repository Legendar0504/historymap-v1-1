// Историческая карта - основной скрипт

var karta = L.map('karta', { preferCanvas: true, zoomControl: false, minZoom: 2, worldCopyJump: true })
  .setView([48, 40], 4);
L.control.zoom({ position: 'topright' }).addTo(karta);
karta.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
karta.attributionControl.addAttribution('границы: historical-basemaps');

var god = 1700;          // выбранный год
var kartaGod = null;     // год карты, которая сейчас на экране
var sloi = {};           // уже созданные слои, чтобы не делать заново
var tekSloy = null;
var vydelennye = [];
var taymer = null;       // для кнопки «проиграть»
var tochkaStolicy = null; // точка со столицей нашей страны

var cveta = ['#d9c9a3', '#b9c7a0', '#c7b2c9', '#e0b89a', '#a9c1cf', '#d6d19b', '#c4b8a8', '#b3cdb8', '#a8cfc2', '#cdb58f', '#bfb3d9', '#e3c7a1'];

// ---------- помощники ----------

function naGod(spisok, g) {
  // все записи [с, по, текст], которые подходят под год
  var res = [];
  for (var i = 0; i < spisok.length; i++) {
    if (spisok[i][0] <= g && g <= spisok[i][1]) res.push(spisok[i]);
  }
  return res;
}

function pervyyNaGod(spisok, g) {
  var r = naGod(spisok, g);
  return r.length ? r[r.length - 1][2] : null;
}

// ближайшая карта к выбранному году
function blizhayshayaKarta(g) {
  var luchshiy = godaKart[0];
  for (var i = 1; i < godaKart.length; i++) {
    if (Math.abs(godaKart[i] - g) < Math.abs(luchshiy - g)) luchshiy = godaKart[i];
  }
  return luchshiy;
}

function cvetStrany(name) {
  if (nashaNazvaniya.indexOf(name) != -1) return '#9b2b2b';
  if (russkieKnyazhestva.indexOf(name) != -1) return '#d4776a';
  var s = 0;
  for (var i = 0; i < name.length; i++) s = s + name.charCodeAt(i) * (i + 1);
  return cveta[s % cveta.length];
}

function stil(feature) {
  return {
    fillColor: cvetStrany(feature.properties.NAME),
    fillOpacity: 0.85,
    color: '#6b5d4a',
    weight: 0.7
  };
}

// лежит ли точка внутри страны (метод луча)
function vKontureLi(kontur, x, y) {
  var vnutri = false;
  for (var i = 0, j = kontur.length - 1; i < kontur.length; j = i++) {
    var xi = kontur[i][0], yi = kontur[i][1], xj = kontur[j][0], yj = kontur[j][1];
    if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) vnutri = !vnutri;
  }
  return vnutri;
}

function tochkaVStrane(feature, x, y) {
  var g = feature.geometry;
  var mnogo = g.type == 'Polygon' ? [g.coordinates] : g.coordinates;
  for (var i = 0; i < mnogo.length; i++) {
    if (!vKontureLi(mnogo[i][0], x, y)) continue;
    var vDyrke = false;
    for (var k = 1; k < mnogo[i].length; k++) {
      if (vKontureLi(mnogo[i][k], x, y)) vDyrke = true;
    }
    if (!vDyrke) return true;
  }
  return false;
}

function stolicaNaGod(strana, g) {
  var nazv = pervyyNaGod(strana.stolicy, g);
  return nazv ? { nazv: nazv, xy: goroda[nazv] } : null;
}

// страны из нашего списка, которые есть в этом году
function stranyNaGod(g) {
  var res = [];
  for (var i = 0; i < strany.length; i++) {
    if (pervyyNaGod(strany[i].nazvaniya, g)) res.push(strany[i]);
  }
  return res;
}

// ---------- карта ----------

function zagruzitKartu(k, gotovo) {
  if (karty[k]) { gotovo(); return; }
  document.getElementById('zagruzka').hidden = false;
  var s = document.createElement('script');
  s.src = 'karty/' + k + '.js';
  s.onload = function () {
    document.getElementById('zagruzka').hidden = true;
    gotovo();
  };
  s.onerror = function () {
    document.getElementById('zagruzka').innerHTML = 'не получилось загрузить карту ' + k + ' года';
  };
  document.body.appendChild(s);
}

function sdelatSloy(k) {
  if (sloi[k]) return sloi[k];
  sloi[k] = L.geoJSON(karty[k], {
    style: stil,
    onEachFeature: function (feature, layer) {
      layer.bindTooltip(poRusski(feature.properties.NAME), { sticky: true, className: 'podskazka', direction: 'top', offset: [0, -8] });
      layer.on('click', function () {
        ubratVydelenie();
        vydelit(layer);
        pokazatKlik(feature);
      });
    }
  });
  return sloi[k];
}

function pokazatKartu(k) {
  if (k == kartaGod) return;
  zagruzitKartu(k, function () {
    if (blizhayshayaKarta(god) != k) return; // пока грузилось, год уже поменяли
    ubratVydelenie();
    if (tekSloy) karta.removeLayer(tekSloy);
    tekSloy = sdelatSloy(k).addTo(karta);
    if (tochkaStolicy) tochkaStolicy.bringToFront();
    kartaGod = k;
    document.getElementById('klik-info').hidden = true;
    zaranee(k);
  });
}

// заранее грузим соседние карты, чтобы ползунок не тормозил
function zaranee(k) {
  var n = godaKart.indexOf(k);
  [n - 1, n + 1].forEach(function (i) {
    if (i >= 0 && i < godaKart.length && !karty[godaKart[i]]) {
      var s = document.createElement('script');
      s.src = 'karty/' + godaKart[i] + '.js';
      document.body.appendChild(s);
    }
  });
}

function ubratVydelenie() {
  for (var i = 0; i < vydelennye.length; i++) tekSloy.resetStyle(vydelennye[i]);
  vydelennye = [];
}

function vydelit(layer) {
  layer.setStyle({ color: '#111', weight: 2.5 });
  layer.bringToFront();
  if (tochkaStolicy) tochkaStolicy.bringToFront();
  vydelennye.push(layer);
}

// показать страну по её столице
function pokazatStranu(strana) {
  var st = stolicaNaGod(strana, god);
  if (!st || !tekSloy) return;
  ubratVydelenie();
  var granicy = null;
  tekSloy.eachLayer(function (layer) {
    if (tochkaVStrane(layer.feature, st.xy[0], st.xy[1])) {
      vydelit(layer);
      granicy = layer.getBounds();
    }
  });
  // центр — столица, а масштаб такой, чтобы страна примерно влезла
  var zoom = granicy ? Math.max(3, Math.min(5, karta.getBoundsZoom(granicy) + 1)) : 5;
  karta.flyTo([st.xy[1], st.xy[0]], zoom, { duration: 0.6 });
}

// ---------- столбец справа ----------

function pravitelHtml(strana) {
  var pr = naGod(strana.praviteli, god);
  var html = '';
  for (var i = 0; i < pr.length; i++) {
    html += '<div class="pravitel">' + pr[i][2] + ' <span class="gody">(' + pr[i][0] + (pr[i][1] != pr[i][0] ? '–' + pr[i][1] : '') + ')</span></div>';
  }
  return html;
}

function postavitStolicu(st) {
  if (!st) {
    if (tochkaStolicy) karta.removeLayer(tochkaStolicy);
    tochkaStolicy = null;
    return;
  }
  var ll = [st.xy[1], st.xy[0]];
  if (!tochkaStolicy) {
    tochkaStolicy = L.circleMarker(ll, { radius: 5, color: '#fff', weight: 2, fillColor: '#111', fillOpacity: 1, interactive: false })
      .bindTooltip('', { permanent: true, direction: 'right', className: 'podpis-stolicy', offset: [6, 0] })
      .addTo(karta);
  }
  tochkaStolicy.setLatLng(ll);
  tochkaStolicy.setTooltipContent(st.nazv);
  tochkaStolicy.bringToFront();
}

function pokazatNashu() {
  var blok = document.getElementById('nasha-blok');
  var nasha = strany[0];
  var nazv = pervyyNaGod(nasha.nazvaniya, god);
  postavitStolicu(nazv ? stolicaNaGod(nasha, god) : null);
  if (!nazv) {
    blok.innerHTML = '<div class="metka-malaya">Наша страна</div>' +
      '<div class="nasha-nazv">Государства ещё нет</div>' +
      '<div>На этих землях живут восточные славяне, финно-угорские и балтские племена. Русь появится в 862 году.</div>';
    return;
  }
  var st = stolicaNaGod(nasha, god);
  blok.innerHTML = '<div class="metka-malaya">Наша страна</div>' +
    '<div class="nasha-nazv">' + nazv + '</div>' +
    '<div class="metka-malaya">Правитель</div>' + pravitelHtml(nasha) +
    '<div class="stolica">Столица: ' + st.nazv + ' · <button class="knopka-mal" id="nasha-pokazat">показать на карте</button></div>';
  document.getElementById('nasha-pokazat').onclick = function () { pokazatStranu(nasha); };
}

function pokazatPraviteley() {
  var blok = document.getElementById('praviteli');
  blok.innerHTML = '';
  var spisok = stranyNaGod(god);
  for (var i = 0; i < spisok.length; i++) {
    var s = spisok[i];
    if (s.nasha) continue;
    var st = stolicaNaGod(s, god);
    var div = document.createElement('div');
    div.className = 'strana';
    div.innerHTML = '<div class="strana-verh"><span class="strana-nazv">' + pervyyNaGod(s.nazvaniya, god) + '</span></div>' +
      pravitelHtml(s) +
      '<div class="stolica">Столица: ' + st.nazv + ' · </div>';
    var knopka = document.createElement('button');
    knopka.className = 'knopka-mal';
    knopka.innerHTML = 'показать на карте';
    knopka.onclick = (function (strana) { return function () { pokazatStranu(strana); }; })(s);
    div.querySelector('.stolica').appendChild(knopka);
    blok.appendChild(div);
  }
  if (blok.innerHTML == '') blok.innerHTML = '<p class="pusto">Нет данных.</p>';
}

function pokazatSobytiya() {
  var blok = document.getElementById('sobytiya');
  var html = '';
  var ranshe = [], pozzhe = [];
  for (var i = 0; i < sobytiya.length; i++) {
    var s = sobytiya[i];
    if (s[0] == god) html += '<p class="sobytie"><b>' + s[0] + '.</b> ' + s[1] + '</p>';
    else if (s[0] < god) ranshe.push(s);
    else pozzhe.push(s);
  }
  if (html == '') html = '<p class="pusto">В этом году в моём списке событий нет.</p>';
  var drugie = ranshe.slice(-2).concat(pozzhe.slice(0, 3));
  if (drugie.length) {
    html += '<div class="metka-malaya" style="margin-top:10px">Рядом по времени</div>';
    for (var k = 0; k < drugie.length; k++) {
      html += '<button class="sobytie-drugoe" data-god="' + drugie[k][0] + '"><span class="g">' + drugie[k][0] + '</span>' + drugie[k][1] + '</button>';
    }
  }
  blok.innerHTML = html;
  var knopki = blok.querySelectorAll('.sobytie-drugoe');
  for (var j = 0; j < knopki.length; j++) {
    knopki[j].onclick = function () { ustanovitGod(parseInt(this.getAttribute('data-god'))); };
  }
}

function pokazatKlik(feature) {
  var p = feature.properties;
  var html = '<button class="zakryt" id="klik-zakryt">×</button>';
  html += '<div class="klik-nazv">' + poRusski(p.NAME) + '</div>';
  if (poRusski(p.NAME) != p.NAME) html += '<div class="malo">в исходной карте: ' + p.NAME + '</div>';
  if (p.SUBJECTO && p.SUBJECTO != p.NAME) html += '<div class="malo">подчиняется: ' + poRusski(p.SUBJECTO) + '</div>';

  // ищем, чья столица внутри этой страны
  var nashli = false;
  var spisok = stranyNaGod(god);
  for (var i = 0; i < spisok.length; i++) {
    var st = stolicaNaGod(spisok[i], god);
    if (st && tochkaVStrane(feature, st.xy[0], st.xy[1])) {
      html += '<div style="margin-top:8px"><div class="malo">' + pervyyNaGod(spisok[i].nazvaniya, god) + ', столица ' + st.nazv + '</div>' + pravitelHtml(spisok[i]) + '</div>';
      nashli = true;
    }
  }
  if (!nashli) html += '<div class="malo" style="margin-top:8px">Про правителей этой страны у меня пока нет данных.</div>';

  var blok = document.getElementById('klik-info');
  blok.innerHTML = html;
  blok.hidden = false;
  document.getElementById('klik-zakryt').onclick = function () {
    blok.hidden = true;
    ubratVydelenie();
  };
  document.getElementById('stolbec').scrollTop = 0;
}

// ---------- главная функция ----------

function ustanovitGod(g) {
  if (isNaN(g)) return;
  g = Math.max(1, Math.min(2022, g));
  god = g;
  document.getElementById('polzunok').value = g;
  document.getElementById('vvod-goda').value = g;
  document.getElementById('god').innerHTML = g;

  var k = blizhayshayaKarta(g);
  document.getElementById('karta-god').innerHTML = (k == 1 ? 'начало нашей эры' : k + ' год');

  pokazatNashu();
  pokazatSobytiya();
  pokazatPraviteley();
  pokazatKartu(k);

  if (window.history && history.replaceState) history.replaceState(null, '', '#' + g);
}

// ---------- ползунок и кнопки ----------

function sdelatMetki() {
  var blok = document.getElementById('metki');
  function proc(g) { return ((g - 1) / 2021 * 100) + '%'; }
  for (var i = 0; i < godaKart.length; i++) {
    var m = document.createElement('div');
    m.className = 'metka';
    m.style.left = proc(godaKart[i]);
    m.title = 'карта ' + godaKart[i] + ' года';
    blok.appendChild(m);
  }
  [1, 500, 1000, 1500, 2000].forEach(function (g) {
    var p = document.createElement('div');
    p.className = 'metka-podpis';
    p.style.left = proc(g);
    p.innerHTML = g;
    blok.appendChild(p);
  });
}

function stop() {
  clearInterval(taymer);
  taymer = null;
  document.getElementById('play').innerHTML = '▶';
}

function play() {
  if (taymer) { stop(); return; }
  if (god >= 2022) ustanovitGod(1);
  document.getElementById('play').innerHTML = '❚❚';
  taymer = setInterval(function () {
    if (god >= 2022) { stop(); return; }
    ustanovitGod(god + 1);
  }, 60);
}

document.getElementById('polzunok').oninput = function () {
  ustanovitGod(parseInt(this.value));
};
document.getElementById('vvod-goda').onchange = function () {
  stop();
  ustanovitGod(parseInt(this.value));
};
document.getElementById('minus').onclick = function () { stop(); ustanovitGod(god - 1); };
document.getElementById('plus').onclick = function () { stop(); ustanovitGod(god + 1); };
document.getElementById('play').onclick = play;

document.addEventListener('keydown', function (e) {
  var t = e.target.tagName;
  if (t == 'INPUT' || t == 'TEXTAREA') return;
  if (e.key == 'ArrowLeft') { stop(); ustanovitGod(god - (e.shiftKey ? 10 : 1)); e.preventDefault(); }
  if (e.key == 'ArrowRight') { stop(); ustanovitGod(god + (e.shiftKey ? 10 : 1)); e.preventDefault(); }
  if (e.key == ' ') { play(); e.preventDefault(); }
  if (e.key == 'Escape') document.getElementById('okno').hidden = true;
});

document.getElementById('o-proekte').onclick = function () { document.getElementById('okno').hidden = false; };
document.getElementById('zakryt').onclick = function () { document.getElementById('okno').hidden = true; };
document.getElementById('okno').onclick = function (e) { if (e.target == this) this.hidden = true; };

// ---------- старт ----------

// год можно написать в адресе: index.html#1812
window.onhashchange = function () {
  var g = parseInt(location.hash.replace('#', ''));
  if (g >= 1 && g <= 2022 && g != god) ustanovitGod(g);
};

sdelatMetki();
var izSsylki = parseInt(location.hash.replace('#', ''));
ustanovitGod(izSsylki >= 1 && izSsylki <= 2022 ? izSsylki : 1700);
