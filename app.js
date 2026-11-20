/* 本草衡鉴 · 在线版 · 多学科 */
(function () {
  'use strict'

  var CONFIG = {
    SECRET: 'BHJ-2026-h5-v1',
    CONTACT: '微信：a-Medical-l',
    BUY_URL: '',
    TOTAL_Q: 1354,
    TOTAL_C: 953,
    FREE_UNITS: { yaoli: ['U01', 'U02'], paozhi: ['P01', 'P02'], jianding: ['U01', 'U02'] },
    FREE_CHAPTERS: 2,
    BUILD: '2026-11-20t'
  }

  var LS = { auth: 'bhj_auth', wrong: 'bhj_wrong', stat: 'bhj_stat', open: 'bhj_open', subj: 'bhj_subj', mode: 'bhj_mode', shuffle: 'bhj_shuffle' }
  var S = {
    data: null, full: null, auth: null, tab: 'kb', subj: '',
    group: '', kw: '', openChap: {}, openCard: {}, deckPos: {},
    unit: null, queue: [], qi: 0, picked: null, answered: false,
    qmode: 'quiz', ansHidden: false, shuffle: false
  }

  function $(id) { return document.getElementById(id) }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    })
  }
  function ls(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch (e) { return d }
  }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }

  /* ---------- 学科 ---------- */
  function subjectList() {
    var l = (S.full && S.full.subjects) || (S.data && S.data.subjects) || []
    return l
  }
  function subj() {
    var l = subjectList()
    if (!l.length) return null
    for (var i = 0; i < l.length; i++) if (l[i].id === S.subj) return l[i]
    return l[0]
  }
  function subjId() { var s = subj(); return s ? s.id : '' }
  function freeUnits() {
    var id = subjId()
    return (CONFIG.FREE_UNITS[id] || [])
  }
  function bank() { var s = subj(); return s && s.tiku ? s.tiku : null }
  function kb() { var s = subj(); return s && s.kb ? s.kb : null }
  function varCards() { var s = subj(); return (s && s.varCards) || {} }
  function totalQ() { var b = bank(); return (b && b.meta && b.meta.total) || CONFIG.TOTAL_Q }
  function totalC() { var d = kb(); return (d && d.meta && d.meta.stats && d.meta.stats.cards) || CONFIG.TOTAL_C }

  function normalize(d) {
    if (!d) return d
    if (!d.subjects && (d.tiku || d.kb)) {
      d.subjects = [{ id: 'yaoli', name: '中药药理学', short: '药理', tiku: d.tiku || null, kb: d.kb || null }]
      d.default = 'yaoli'
    }
    if (!d.default && d.subjects && d.subjects.length) d.default = d.subjects[0].id
    return d
  }
  function pickSubject(id) {
    if (!id) return
    S.subj = id
    S.group = ''; S.kw = ''; S.openChap = {}; S.deckPos = {}; S.autoOpenDone = false
    lsSet(LS.subj, id)
    renderSubjChips(); refreshAll()
    window.scrollTo(0, 0)
  }
  function renderSubjChips() {
    var box = $('subjChips'); if (!box) return
    var l = subjectList()
    box.innerHTML = l.map(function (s) {
      var locked = isActive() && !subjectActive(s.id)
      return '<button class="chip subj' + (s.id === subjId() ? ' on' : '') + (locked ? ' lock' : '') + '" data-subj="' + esc(s.id) + '">' +
        esc(s.name || s.id) + (locked ? ' 🔒' : '') + '</button>'
    }).join('')
  }

  /* ---------- 授权 ---------- */
  function sha256hex(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2)
      }).join('')
    })
  }
  function parseCode(raw) {
    var s = String(raw || '').trim().toUpperCase().replace(/\s/g, '')
    var m = s.match(/^ZY-(\d{8})-(\d{2})(?:-([YPJA]{1,2}))?-([0-9A-F]{4})$/)
    if (!m) return null
    var mo = +m[1].slice(4, 6), d = +m[1].slice(6, 8)
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    var sfx = m[3] || ''
    if (sfx && !/^(Y|P|J|A|YP|YJ|PJ|YPJ)$/.test(sfx)) return null
    return { code: s, body: 'ZY-' + m[1] + '-' + m[2] + (sfx ? '-' + sfx : ''), sig: m[4], expire: m[1], sfx: sfx }
  }
  function planFromSuffix(sfx) {
    if (!sfx) return 'all'
    if (sfx === 'A') return 'all'
    var mp = { Y: 'yaoli', P: 'paozhi', J: 'jianding' }
    var arr = sfx.split('').map(function (c) { return mp[c] }).filter(Boolean)
    return arr.length ? arr : 'all'
  }
  function planOf(auth) {
    var all = ['yaoli', 'paozhi', 'jianding']
    if (!auth) return []
    if (auth.plan === 'all' || !auth.plan) return all.slice()
    return Array.isArray(auth.plan) ? auth.plan.slice() : all.slice()
  }
  function subjectActive(id) {
    return isActive() && planOf(S.auth).indexOf(id) >= 0
  }
  function planText(plan) {
    var all = ['yaoli', 'paozhi', 'jianding']
    var nm = { yaoli: '中药药理学', paozhi: '中药炮制学', jianding: '中药鉴定学' }
    if (plan === 'all' || (Array.isArray(plan) && all.every(function (x) { return plan.indexOf(x) >= 0 }))) return '全科'
    return (Array.isArray(plan) ? plan : all).map(function (x) { return nm[x] || x }).join('、')
  }
  function verifyCode(raw) {
    var c = parseCode(raw)
    if (!c) return Promise.resolve({ ok: false, msg: '格式不对，应为 ZY-20271231-01-XXXX' })
    return sha256hex(CONFIG.SECRET + c.body + '|h5').then(function (h) {
      if (h.slice(0, 4).toUpperCase() !== c.sig) return { ok: false, msg: '开通码无效，请核对后重试' }
      var exp = c.expire.slice(0, 4) + '-' + c.expire.slice(4, 6) + '-' + c.expire.slice(6, 8)
      if (exp < today()) return { ok: false, msg: '该码已于 ' + exp + ' 到期，请换新码' }
      return { ok: true, auth: { code: c.code, expire: exp, plan: planFromSuffix(c.sfx) } }
    })
  }
  function today() {
    var d = new Date()
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }
  function pad(n) { return (n < 10 ? '0' : '') + n }
  function isActive() {
    return !!(S.auth && S.auth.expire >= today())
  }
  function daysLeft() {
    if (!S.auth) return 0
    return Math.round((new Date(S.auth.expire + 'T23:59:59') - new Date()) / 86400000)
  }

  /* ---------- 全量解密 ---------- */
  function readFull() {
    if (window.__BHJ_EMBED && window.__BHJ_EMBED.full) return Promise.resolve(window.__BHJ_EMBED.full)
    return fetch('full.enc?v=' + CONFIG.BUILD).then(function (r) { return r.text() })
  }

  function decryptFull() {
    if (S.full) return Promise.resolve(true)
    if (S.fullLoading) return S.fullLoading
    S.fullLoading = readFull().then(function (txt) {
      var parts = txt.trim().split('.')
      var iv = b64(parts[0]), ct = b64(parts[1])
      return sha256hex(CONFIG.SECRET).then(function (hex) {
        var keyBytes = hex2buf(hex)
        return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']).then(function (key) {
          return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, key, ct)
        })
      }).then(function (buf) {
        var obj = JSON.parse(new TextDecoder().decode(buf))
        S.full = normalize(obj)
        return true
      })
    }).catch(function () { return false })
    S.fullLoading.then(function (ok) { if (!ok) S.fullLoading = null })
    return S.fullLoading
  }
  function b64(s) {
    var bin = atob(s), arr = new Uint8Array(bin.length)
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return arr
  }
  function hex2buf(hex) {
    var arr = new Uint8Array(hex.length / 2)
    for (var i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16)
    return arr
  }

  /* ---------- 渲染：知识点 ---------- */
  function renderGroups() {
    var g = (kb() && kb().groups) || []
    var cur = S.group
    $('groups').innerHTML = ['全部'].concat(g).map(function (x) {
      var v = x === '全部' ? '' : x
      return '<button class="chip' + ((v === cur) ? ' on' : '') + '" data-g="' + esc(v) + '">' + esc(x) + '</button>'
    }).join('')
  }
  function matchCard(c, kw) {
    if (!kw) return true
    var hay = (c.title + ' ' + (c.summary || '') + ' ' + (c.tags || []).join(' ') + ' ' +
      (c.sections || []).map(function (s) { return s.label + s.items.join(' ') }).join(' ')).toLowerCase()
    return hay.indexOf(kw) >= 0
  }
  function cardHtml(x) {
    var body = (x.sections || []).map(function (s) {
      return '<div class="sect"><div class="lb">' + esc(s.label) + '</div><ul>' +
        s.items.map(function (it) { return '<li>' + esc(it) + '</li>' }).join('') + '</ul></div>'
    }).join('')
    var vn = varCards()[x.id] || 0
    if ((vn || isActive()) && subjectActive(subjId())) body += '<button class="ghost wide vbtn" data-vcard="' + esc(x.id) + '">举一反三 · 用这个知识点出' + (vn ? ' ' + Math.min(6, vn) + ' 道新题' : '新题') + '</button>'
    if (x.tags && x.tags.length) body += '<div class="tags">' + x.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>' }).join('') + '</div>'
    return '<div class="deck-card" data-card="' + esc(x.id) + '">' +
      '<div class="ctitle"><span class="kind">' + esc(x.kindLabel || '') + '</span><span>' + esc(x.title) + '</span></div>' +
      '<p class="csum">' + esc(x.summary || '') + '</p>' + body + '</div>'
  }
  function renderKb() {
    var d = kb()
    if (!d) { $('chapList').innerHTML = '<div class="mock">资料加载失败，请刷新页面试试</div>'; return }
    var kw = S.kw.trim().toLowerCase()
    var chaps = (d.chapters || []).filter(function (c) { return !S.group || c.group === S.group })
    if (!subjectActive(subjId())) chaps = chaps.slice(0, CONFIG.FREE_CHAPTERS)
    if (!kw && !S.autoOpenDone && chaps.length) { S.openChap[chaps[0].id] = true; S.autoOpenDone = true }
    var html = '', hit = 0
    chaps.forEach(function (c) {
      var cards = c.cards.filter(function (x) { return matchCard(x, kw) })
      if (!cards.length) return
      hit += cards.length
      var open = !!S.openChap[c.id] || !!kw
      html += '<div class="chap"><div class="chap-head" data-chap="' + esc(c.id) + '">' +
        '<span class="chap-name">' + esc(c.name) + '</span>' +
        '<span class="chap-meta">' + cards.length + ' 张 ' + (open ? '▾' : '›') + '</span></div>'
      if (open) {
        html += '<div class="deck" data-deck="' + esc(c.id) + '">' +
          '<div class="deck-bar">' +
          '<button class="dnav" data-deck-go="' + esc(c.id) + '" data-dir="-1" aria-label="上一张">‹</button>' +
          '<span class="deck-pos" id="pos-' + esc(c.id) + '">1 / ' + cards.length + '</span>' +
          '<button class="dnav" data-deck-go="' + esc(c.id) + '" data-dir="1" aria-label="下一张">›</button>' +
          '<span class="deck-tip">左右滑动切换</span></div>' +
          '<div class="deck-track" data-track="' + esc(c.id) + '">' + cards.map(cardHtml).join('') + '</div></div>'
      }
      html += '</div>'
    })
    $('chapList').innerHTML = html || '<div class="mock">没有匹配的卡片，换个词试试' + (isActive() ? '' : '，或<a data-goto="me">开通全部</a>') + '</div>'
    var shown = (d.chapters || []).reduce(function (s, c) { return s + c.cards.length }, 0)
    $('kbOpen').textContent = shown
    $('kbLock').textContent = Math.max(0, totalC() - shown)
    $('kbGate').hidden = isActive()
    $('cTotal').textContent = totalQ()
    $('cCards').textContent = totalC()
    restoreDecks()
  }

  /* ---------- 卡片左右滑动 ---------- */
  function trackOf(cid) {
    return $('chapList').querySelector('[data-track="' + cid + '"]')
  }
  function deckIdx(track) {
    if (!track.clientWidth) return 0
    return Math.round(track.scrollLeft / track.clientWidth)
  }
  function syncDeck(track) {
    var cid = track.dataset.track
    var pos = document.getElementById('pos-' + cid)
    if (pos) pos.textContent = (Math.min(deckIdx(track), track.children.length - 1) + 1) + ' / ' + track.children.length
    S.deckPos[cid] = deckIdx(track)
    scheduleFit(track)
  }
  var deckTimers = {}
  function fitDeck(t) {
    if (!t || !t.clientWidth) return
    t.style.height = 'auto'
    var card = t.children[deckIdx(t)]
    var natural = card ? card.getBoundingClientRect().height : 300
    var maxH = Math.round(Math.min(window.innerHeight * 0.7, 620))
    var h = Math.max(150, Math.min(Math.round(natural), maxH))
    t.style.height = h + 'px'
  }
  function fitAll() {
    ;[].forEach.call($('chapList').querySelectorAll('.deck-track'), fitDeck)
  }
  function scheduleFit(t) {
    var id = t.dataset.track
    clearTimeout(deckTimers[id])
    deckTimers[id] = setTimeout(function () { fitDeck(t) }, 130)
  }
  function restoreDecks() {
    ;[].forEach.call($('chapList').querySelectorAll('.deck-track'), function (t) {
      var i = S.deckPos[t.dataset.track] || 0
      if (i) t.scrollLeft = i * t.clientWidth
      fitDeck(t)
    })
  }
  function deckGo(cid, dir) {
    var t = trackOf(cid)
    if (!t) return
    t.scrollBy({ left: dir * t.clientWidth, behavior: 'smooth' })
  }

  /* ---------- 渲染：刷题 ---------- */
  function unitItems(u) {
    var b = bank(), arr = []
    if (!b) return arr
    ;['single', 'fill', 'short', 'essay', 'term'].forEach(function (k) {
      if (b[k]) arr = arr.concat(b[k].filter(function (i) { return i.u === u }))
    })
    return arr
  }
  function objItems(u) {
    var b = bank()
    return (b && b.single) ? b.single.filter(function (i) { return i.u === u }) : []
  }
  function wrongIds() { return ls(LS.wrong, []) }
  function renderUnits() {
    var b = bank()
    if (!b) return
    var wr = wrongIds()
    var allQ = 0
    ;['single', 'fill', 'short', 'essay', 'term'].forEach(function (k) { if (b[k]) allQ += b[k].length })
    var done = ls(LS.stat, {}), todayDone = done.date === today() ? done.done : 0
    $('cDone').textContent = todayDone
    $('unitHint').textContent = '共 ' + b.units.length + ' 个单元 · ' + allQ + ' 题' + (isActive() && !S.full ? ' · 题库加载中…' : '')
    $('unitList').innerHTML = b.units.map(function (u) {
      var n = objItems(u.id).length || (b.meta.uc && b.meta.uc[u.id]) || 0
      var lock = !subjectActive(subjId()) && freeUnits().indexOf(u.id) < 0
      var pct = n ? Math.min(100, Math.round(wr.filter(function (id) { return id.indexOf(u.id) >= 0 }).length / n * 100)) : 0
      return '<div class="unit' + (lock ? ' lock' : '') + '" data-unit="' + esc(u.id) + '">' +
        '<span class="uname">' + esc(u.n) + '</span>' +
        '<span class="ucount">' + esc(u.a || '') + ' · ' + n + ' 题</span>' +
        '<div class="ubar"><i style="width:' + pct + '%"></i></div></div>'
    }).join('')
    var openUnits = b.units.filter(function (u) { return freeUnits().indexOf(u.id) >= 0 })
    var openCnt = 0
    openUnits.forEach(function (u) { openCnt += unitItems(u.id).length })
    $('quizOpen').textContent = openUnits.length
    $('quizCnt').textContent = openCnt
    $('quizGate').hidden = isActive()
    $('fanGate').textContent = totalQ()
    $('cTotal').textContent = totalQ()
    syncModeUI()
    renderWrong()
  }
  function syncModeUI() {
    if (!$('modeBar')) return
    ;[].forEach.call($('modeBar').children, function (b) {
      b.classList.toggle('on', (b.dataset.mode || 'quiz') === S.qmode)
    })
    $('orderBar').hidden = S.qmode !== 'recite'
    ;[].forEach.call($('orderBar').querySelectorAll('.orderbtn'), function (b) {
      b.classList.toggle('on', (b.dataset.order === 'rand') === !!S.shuffle)
    })
    $('modeHint').textContent = S.qmode === 'recite'
      ? '背题模式：进入单元后答案直接显示，勾对正确选项并给出解析，只看不判对错、不记错题。'
      : '做题模式：选单元直接作答，提交后判对错，错题自动进错题本。'
  }
  function renderWrong() {
    var wr = wrongIds()
    $('wrongCount').textContent = wr.length + ' 题'
    if (!wr.length) {
      $('wrongBox').innerHTML = '<span class="empty">还没有错题。做错的客观题会自动收进来，可随时重做。</span>'
      return
    }
    var b = bank()
    var list = []
    ;['single', 'fill', 'short', 'essay', 'term'].forEach(function (k) {
      (b[k] || []).forEach(function (i) { if (wr.indexOf(i.id) >= 0) list.push(i) })
    })
    if (S.full && S.full.varData) {
      Object.keys(S.full.varData).forEach(function (cid) {
        S.full.varData[cid].forEach(function (i) { if (wr.indexOf(i.id) >= 0) list.push(i) })
      })
    }
    $('wrongBox').innerHTML = list.slice(0, 40).map(function (i) {
      return '<div style="padding:7px 0;border-bottom:1px dotted #e6ddca"><span class="tag">' + esc(i.id) + '</span> ' + esc(i.s.slice(0, 46)) + (i.s.length > 46 ? '…' : '') + '</div>'
    }).join('') + '<div style="margin-top:10px"><button class="ghost" id="redoWrong">重做这 ' + list.length + ' 题</button></div>'
    var redo = $('redoWrong')
    if (redo) redo.onclick = function () { openQueue(list, '错题重做', 'quiz') }
  }

  /* ---------- 举一反三 ---------- */
  function findCard(cid) {
    var d = kb(), hit = null
    ;(d && d.chapters || []).forEach(function (c) { (c.cards || []).forEach(function (x) { if (x.id === cid) hit = x }) })
    return hit
  }
  function decryptOne(sid) {
    return fetch('variants_' + sid + '.enc?v=' + CONFIG.BUILD).then(function (r) { return r.text() }).then(function (txt) {
      var parts = txt.trim().split('.'), iv = b64(parts[0]), ct = b64(parts[1])
      return sha256hex(CONFIG.SECRET).then(function (hex) {
        return crypto.subtle.importKey('raw', hex2buf(hex), { name: 'AES-GCM' }, false, ['decrypt']).then(function (key) {
          return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, key, ct)
        })
      }).then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)) })
    })
  }
  function decryptVariants(cid) {
    var sid = (subj() && subj().id) || 'yaoli'
    if (S.varReady && S.varSubj === sid && (!cid || (S.full.varData || {})[cid])) return Promise.resolve(true)
    if (window.__BHJ_EMBED && window.__BHJ_EMBED.variants) {
      S.full.varData = window.__BHJ_EMBED.variants.byCard || {}
      S.varSubj = sid; S.varReady = true
      return Promise.resolve(true)
    }
    var order = [sid, 'yaoli', 'paozhi', 'jianding'].filter(function (x, i, a) { return a.indexOf(x) === i })
    function step(i) {
      if (i >= order.length) return false
      return decryptOne(order[i]).then(function (obj) {
        var bc = obj.byCard || {}
        if (cid && !bc[cid] && i < order.length - 1) return step(i + 1)
        S.full.varData = bc; S.varSubj = order[i]; S.varReady = true
        return true
      }).catch(function () { return step(i + 1) })
    }
    return Promise.resolve(step(0))
  }


  function openVariants(cid) {
    if (!subjectActive(subjId())) { go('me'); toast('举一反三需开通本科（可单科开通）'); return }
    if (!S.varReady) {
      toast('正在加载变式题…')
      decryptVariants(cid).then(function (ok) {
        if (!ok) { toast('变式题加载失败，请稍后重试'); return }
        openVariants(cid)
      })
      return
    }
    var v = (S.full.varData || {})[cid]
    if (!v || !v.length) { toast('这个知识点暂时没有变式题'); return }
    var singles = v.filter(function (q) { return q.o }).sort(function () { return Math.random() - 0.5 })
    var shorts = v.filter(function (q) { return !q.o }).sort(function () { return Math.random() - 0.5 })
    var pick = singles.slice(0, 4).concat(shorts.slice(0, 2))
    if (pick.length < 6) pick = pick.concat(v.filter(function (q) { return pick.indexOf(q) < 0 }).slice(0, 6 - pick.length))
    var c = findCard(cid)
    go('quiz')
    openQueue(pick, '举一反三 · ' + (c ? c.title : cid), 'quiz')
    window.scrollTo(0, 0)
  }

  /* ---------- 做题 ---------- */
  function openQueue(items, label, mode) {
    if (!items.length) { toast('这个范围暂时没有题目'); return }
    S.queue = items.slice(); S.qi = 0; S.label = label
    if (mode) S.qmode = mode
    if (S.qmode === 'recite') {
      $('qShuffle').hidden = false
      if ($('orderBar')) $('orderBar').hidden = false
      if (S.shuffle) S.queue = shuffleArr(S.queue)
    } else {
      $('qShuffle').hidden = true
      if ($('orderBar')) $('orderBar').hidden = true
    }
    syncModeUI()
    $('unitView').hidden = true
    $('quizView').hidden = false
    renderQ()
  }
  function shuffleArr(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1))
      var t = a[i]; a[i] = a[j]; a[j] = t
    }
    return a
  }
  function isMulti(q) { return String(q.a == null ? '' : q.a).replace(/[^A-Za-z]/g, '').length > 1 }
  function renderQ() {
    var q = S.queue[S.qi]
    var recite = S.qmode === 'recite'
    S.picked = ''; S.answered = false; S.ansHidden = false
    $('qProg').textContent = (S.qi + 1) + ' / ' + S.queue.length
    $('qTag').textContent = (S.label || '') + ' · ' + (q.tg && q.tg.length ? q.tg.join(' / ') : q.id) + (recite ? ' · 背题' : '')
    $('qStem').textContent = q.s
    var opts = $('qOpts'), sub = $('qSubjective'), fb = $('qFb'), submit = $('qSubmit'), next = $('qNext'), hide = $('qHide')
    fb.hidden = true; fb.className = 'fb'
    $('qAns').hidden = true
    if (q.o) {
      sub.hidden = true; opts.hidden = false
      opts.innerHTML = Object.keys(q.o).map(function (k) {
        return '<button class="opt" data-opt="' + k + '"><span class="k">' + k + '</span><span>' + esc(q.o[k]) + '</span></button>'
      }).join('')
      if (recite) {
        var right = String(q.a).toUpperCase().split('').sort().join('')
        Array.prototype.forEach.call(opts.children, function (btn) {
          btn.disabled = true
          if (right.indexOf(btn.dataset.opt) >= 0) btn.classList.add('right')
        })
        fb.hidden = false
        fb.className = 'fb ok'
        fb.innerHTML = '<b>正确答案：' + esc(String(q.a)) + '</b>' + (q.e ? '<br>解析：' + esc(q.e) : '')
        submit.hidden = true
        hide.hidden = false; hide.textContent = '遮住答案'
        next.hidden = false; next.textContent = S.qi + 1 >= S.queue.length ? '完成' : '下一题'
        next.classList.add('next-main')
      } else {
        submit.hidden = false; submit.disabled = true
        submit.textContent = isMulti(q) ? '提交（多选）' : '提交'
        hide.hidden = true
        next.hidden = true; next.classList.remove('next-main')
      }
    } else {
      opts.hidden = true; sub.hidden = false
      submit.hidden = true; next.hidden = false
      hide.hidden = true
      $('qAns').textContent = fmtAns(q.a)
      $('qAns').dataset.ans = fmtAns(q.a)
      if (recite) {
        $('qAns').hidden = false
        $('showAns').hidden = true
        hide.hidden = false; hide.textContent = '遮住答案'
        next.classList.add('next-main')
      } else {
        $('showAns').hidden = false
        next.classList.remove('next-main')
      }
      next.textContent = S.qi + 1 >= S.queue.length ? '完成' : '下一题'
    }
  }
  function fmtAns(a) {
    if (Array.isArray(a)) return a.join('；')
    return a || '（暂无参考答案）'
  }
  function answerObjective() {
    var q = S.queue[S.qi]
    if (!S.picked) return
    S.answered = true
    var right = String(q.a).toUpperCase().split('').sort().join('')
    var pick = String(S.picked).toUpperCase().split('').sort().join('')
    var ok = right === pick
    Array.prototype.forEach.call($('qOpts').children, function (btn) {
      var k = btn.dataset.opt
      btn.disabled = true
      if (right.indexOf(k) >= 0) btn.classList.add('right')
      if (!ok && pick.indexOf(k) >= 0) btn.classList.add('wrong')
    })
    var fb = $('qFb'); fb.hidden = false
    fb.className = 'fb ' + (ok ? 'ok' : 'bad')
    fb.innerHTML = '<b>' + (ok ? '答对' : '答错') + '</b>　正确答案：' + esc(String(q.a)) +
      (q.e ? '<br>解析：' + esc(q.e) : '')
    if (!ok) markWrong(q.id, true); else markWrong(q.id, false)
    stat(ok)
    $('qSubmit').hidden = true
    $('qNext').hidden = false
    $('qNext').textContent = S.qi + 1 >= S.queue.length ? '完成' : '下一题'
  }
  function markWrong(id, wrong) {
    var wr = wrongIds(), i = wr.indexOf(id)
    if (wrong && i < 0) wr.push(id)
    if (!wrong && i >= 0) wr.splice(i, 1)
    lsSet(LS.wrong, wr)
  }
  function stat(ok) {
    var st = ls(LS.stat, { date: today(), done: 0, right: 0 })
    if (st.date !== today()) st = { date: today(), done: 0, right: 0 }
    st.done++; if (ok) st.right++
    lsSet(LS.stat, st)
    $('cDone').textContent = st.done
  }
  function toast(msg) {
    var el = $('topBanner')
    el.hidden = false; el.textContent = msg
    setTimeout(function () { el.hidden = true }, 2600)
  }

  /* ---------- 我的 ---------- */
  function renderMe() {
    var b = bank(), s = subj()
    $('meSubj').textContent = s ? s.name : '—'
    $('meStatus').textContent = isActive() ? (daysLeft() <= 7 ? '已开通 · 即将到期' : '已开通') : '试看中'
    $('meExpire').textContent = S.auth ? S.auth.expire + '（' + planText(S.auth.plan) + '，剩 ' + Math.max(0, daysLeft()) + ' 天）' : '—'
    $('meVer').textContent = (b && b.meta && b.meta.version) || '—'
    $('contactLine').textContent = CONFIG.CONTACT + '（三档可选：中药药理学单科 / 中药炮制学单科 / 中药鉴定学单科 / 全科；老码仍为全科）'
    $('logoutBtn').hidden = !isActive()
    if (CONFIG.BUY_URL) { $('buyLink').hidden = false; $('buyLink').href = CONFIG.BUY_URL }
    $('cTotal').textContent = totalQ()
    $('cCards').textContent = totalC()
    if (isActive() && daysLeft() <= 7 && daysLeft() >= 0) {
      $('topBanner').hidden = false
      $('topBanner').textContent = '授权将于 ' + S.auth.expire + ' 到期（剩 ' + daysLeft() + ' 天），联系客服换新码可继续使用。'
    }
  }

  /* ---------- 事件 ---------- */
  function bind() {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.onclick = function () { go(t.dataset.tab) }
    })
    document.querySelectorAll('[data-goto="me"]').forEach(function (a) {
      a.onclick = function (e) { e.preventDefault(); go('me'); window.scrollTo(0, 0) }
    })
    if ($('subjChips')) {
      $('subjChips').onclick = function (e) {
        var c = e.target.closest('[data-subj]'); if (!c) return
        if (c.dataset.subj === subjId()) return
        pickSubject(c.dataset.subj)
      }
    }
    $('groups').onclick = function (e) {
      var c = e.target.closest('.chip'); if (!c) return
      S.group = c.dataset.g; renderGroups(); renderKb()
    }
    $('q').oninput = function () {
      S.kw = this.value; renderKb()
    }
    $('chapList').onclick = function (e) {
      var vb = e.target.closest('[data-vcard]')
      if (vb) { e.stopPropagation(); openVariants(vb.dataset.vcard); return }
      var nav = e.target.closest('[data-deck-go]')
      if (nav) { e.stopPropagation(); deckGo(nav.dataset.deckGo, Number(nav.dataset.dir)); return }
      var head = e.target.closest('.chap-head')
      if (head) { var cid = head.dataset.chap; S.openChap[cid] = !S.openChap[cid]; renderKb() }
    }
    $('chapList').addEventListener('scroll', function (e) {
      var t = e.target
      if (t && t.classList && t.classList.contains('deck-track')) syncDeck(t)
    }, true)
    $('chapList').addEventListener('wheel', function (e) {
      var t = e.target.closest ? e.target.closest('.deck-track') : null
      if (!t) return
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); t.scrollLeft += e.deltaX }
    }, { passive: false })
    window.addEventListener('resize', function () { fitAll() })
    document.addEventListener('keydown', function (e) {
      if (S.tab !== 'kb' || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return
      var vis = [].filter.call($('chapList').querySelectorAll('.deck-track'), function (t) {
        var r = t.getBoundingClientRect()
        return r.bottom > 70 && r.top < window.innerHeight - 40
      })
      if (!vis.length) return
      e.preventDefault()
      deckGo(vis[0].dataset.track, e.key === 'ArrowRight' ? 1 : -1)
    })
    if ($('modeBar')) {
      $('modeBar').onclick = function (e) {
        var b = e.target.closest('.mode'); if (!b) return
        S.qmode = b.dataset.mode === 'recite' ? 'recite' : 'quiz'
        lsSet(LS.mode, S.qmode)
        syncModeUI()
      }
    }
    $('unitList').onclick = function (e) {
      var u = e.target.closest('.unit'); if (!u) return
      var id = u.dataset.unit
      if (!subjectActive(subjId()) && freeUnits().indexOf(id) < 0) { go('me'); toast('这一科还没开通，下方可选单科或全科'); return }
      var items = S.qmode === 'recite' ? unitItems(id) : objItems(id)
      if (!items.length && isActive() && !S.full) {
        toast('资料加载中，马上进入…')
        decryptFull().then(function (ok) {
          refreshAll()
          var again = S.qmode === 'recite' ? unitItems(id) : objItems(id)
          if (ok && again.length) openQueue(again, unitName(id), S.qmode)
          else toast('资料加载失败，请刷新页面重试')
        })
        return
      }
      openQueue(items, unitName(id), S.qmode)
    }
    $('qOpts').onclick = function (e) {
      var o = e.target.closest('.opt'); if (!o || S.answered) return
      var q = S.queue[S.qi]
      var k = o.dataset.opt
      if (isMulti(q)) {
        var set = String(S.picked || '').split('').filter(function (c) { return c && c !== k })
        if (String(S.picked || '').indexOf(k) < 0) set.push(k)
        S.picked = set.sort().join('')
        Array.prototype.forEach.call($('qOpts').children, function (b) {
          b.classList.toggle('on', S.picked.indexOf(b.dataset.opt) >= 0)
        })
      } else {
        S.picked = k
        Array.prototype.forEach.call($('qOpts').children, function (b) { b.classList.toggle('on', b === o) })
      }
      $('qSubmit').disabled = !S.picked
    }
    if ($('orderBar')) {
      $('orderBar').onclick = function (e) {
        var b = e.target.closest('.orderbtn'); if (!b) return
        S.shuffle = b.dataset.order === 'rand'
        lsSet(LS.shuffle, S.shuffle)
        syncModeUI()
        toast(S.shuffle ? '背题顺序：随机（进单元时打乱）' : '背题顺序：顺序')
      }
    }
    $('qShuffle').onclick = function () {
      S.queue = shuffleArr(S.queue); S.qi = 0; renderQ()
      toast('已打乱，从头再背一遍')
    }
    $('qSubmit').onclick = answerObjective
    $('showAns').onclick = function () { $('qAns').hidden = !$('qAns').hidden }
    $('qHide').onclick = function () {
      var q = S.queue[S.qi]
      S.ansHidden = !S.ansHidden
      this.textContent = S.ansHidden ? '显示答案' : '遮住答案'
      if (q.o) {
        Array.prototype.forEach.call($('qOpts').children, function (b) { b.classList.toggle('right', !S.ansHidden && String(q.a).toUpperCase().indexOf(b.dataset.opt) >= 0) })
        $('qFb').hidden = S.ansHidden
      } else {
        $('qAns').hidden = S.ansHidden
      }
    }
    $('qNext').onclick = function () {
      if (S.qi + 1 >= S.queue.length) { toast(S.qmode === 'recite' ? '本组背完了' : '本组已完成'); backToUnits(); return }
      S.qi++; renderQ()
    }
    $('qBack').onclick = backToUnits
    $('codeBtn').onclick = function () {
      var raw = $('codeInput').value
      verifyCode(raw).then(function (r) {
        if (!r.ok) { toast(r.msg); return }
        var oldPlan = isActive() ? planOf(S.auth) : []
        var newPlan = planOf(r.auth)
        var merged = 'all'
        var allIds = ['yaoli', 'paozhi', 'jianding']
        var both = oldPlan.concat(newPlan)
        if (!(r.auth.plan === 'all' || (S.auth && S.auth.plan === 'all') || allIds.every(function (x) { return both.indexOf(x) >= 0 }))) {
          merged = allIds.filter(function (x) { return both.indexOf(x) >= 0 })
        }
        var exp = (S.auth && S.auth.expire > r.auth.expire) ? S.auth.expire : r.auth.expire
        S.auth = { code: r.auth.code, expire: exp, plan: merged }
        lsSet(LS.auth, S.auth)
        if (merged !== 'all' && merged.indexOf(subjId()) < 0) pickSubject(merged[0])
        toast('已开通：' + planText(merged) + '，正在加载资料…')
        renderSubjChips(); refreshAll()
        decryptFull().then(function (ok) {
          if (!ok) toast('资料解密失败，请刷新页面重试')
          else toast('已解锁' + planText(merged) + '：' + totalQ() + ' 题、' + totalC() + ' 张卡')
          renderSubjChips(); refreshAll()
        })
      })
    }
    $('logoutBtn').onclick = function () {
      if (!confirm('清除本机授权？清除后回到试看版，需要重新输入开通码。')) return
      S.auth = null; localStorage.removeItem(LS.auth); S.full = null
      refreshAll(); toast('已回到试看版')
    }
    $('copyWechat').onclick = function () {
      var wx = CONFIG.CONTACT.replace(/^微信[:：]\s*/, '')
      if (navigator.clipboard) navigator.clipboard.writeText(wx).then(function () { toast('已复制：' + wx) })
      else toast(wx)
    }
  }
  function unitName(id) {
    var u = bank().units.filter(function (x) { return x.id === id })[0]
    return u ? u.n : id
  }
  function backToUnits() {
    $('quizView').hidden = true
    $('unitView').hidden = false
    renderUnits()
  }
  function go(tab) {
    S.tab = tab
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('on', t.dataset.tab === tab) })
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('on', v.id === 'view-' + tab) })
    if (tab === 'me') renderMe()
    if (tab === 'quiz') { $('quizView').hidden = true; $('unitView').hidden = false; renderUnits() }
    if (tab === 'kb') renderKb()
  }
  function refreshAll() {
    renderGroups(); renderKb(); renderUnits(); renderMe()
  }

  /* ---------- 启动 ---------- */
  function loadTrial() {
    if (window.__BHJ_EMBED && window.__BHJ_EMBED.trial) return Promise.resolve(window.__BHJ_EMBED.trial)
    return fetch('trial.json?v=' + CONFIG.BUILD).then(function (r) { return r.json() })
  }

  function boot() {
    $('ver').textContent = window.__BHJ_EMBED ? '1.0·离线版' : '1.0'
    loadTrial().then(function (d) {
      S.data = normalize(d)
      S.subj = ls(LS.subj, S.data.default || '') || ''
      if (!subj()) S.subj = S.data.default || ''
      $('upd').textContent = (kb() && kb().meta && kb().meta.updatedAt) ? '资料更新 ' + kb().meta.updatedAt : ''
      S.auth = ls(LS.auth, null)
      S.qmode = ls(LS.mode, 'quiz') === 'recite' ? 'recite' : 'quiz'
      S.shuffle = !!ls(LS.shuffle, false)
      bind()
      renderSubjChips()
      refreshAll()
      if (isActive()) {
        decryptFull().then(function () { refreshAll() })
      }
    }).catch(function () {
      $('chapList').innerHTML = '<div class="mock">资料加载失败，请刷新页面试试</div>'
    })
  }

  document.addEventListener('DOMContentLoaded', boot)
})()
