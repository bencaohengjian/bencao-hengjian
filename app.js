/* 本草衡鉴 · 在线版 */
(function () {
  'use strict'

  var CONFIG = {
    SECRET: 'BHJ-2026-h5-v1',
    CONTACT: '微信：a-Medical-l',
    BUY_URL: '',
    TOTAL_Q: 478,
    TOTAL_C: 275,
    FREE_UNITS: ['U01', 'U02'],
    FREE_CHAPTERS: 2,
    BUILD: '2026-11-18c'
  }

  var LS = { auth: 'bhj_auth', wrong: 'bhj_wrong', stat: 'bhj_stat', open: 'bhj_open' }
  var S = {
    data: null, full: null, auth: null, tab: 'kb',
    group: '', kw: '', openChap: {}, openCard: {},
    unit: null, queue: [], qi: 0, picked: null, answered: false
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
    var m = s.match(/^ZY-(\d{8})-(\d{2})-([0-9A-F]{4})$/)
    if (!m) return null
    var y = +m[1].slice(0, 4), mo = +m[1].slice(4, 6), d = +m[1].slice(6, 8)
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    return { code: s, body: 'ZY-' + m[1] + '-' + m[2], sig: m[3], expire: m[1] }
  }
  function verifyCode(raw) {
    var c = parseCode(raw)
    if (!c) return Promise.resolve({ ok: false, msg: '格式不对，应为 ZY-20271231-01-XXXX' })
    return sha256hex(CONFIG.SECRET + c.body + '|h5').then(function (h) {
      if (h.slice(0, 4).toUpperCase() !== c.sig) return { ok: false, msg: '开通码无效，请核对后重试' }
      var exp = c.expire.slice(0, 4) + '-' + c.expire.slice(4, 6) + '-' + c.expire.slice(6, 8)
      if (exp < today()) return { ok: false, msg: '该码已于 ' + exp + ' 到期，请换新码' }
      return { ok: true, auth: { code: c.code, expire: exp } }
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
    return readFull().then(function (txt) {
      var parts = txt.trim().split('.')
      var iv = b64(parts[0]), ct = b64(parts[1])
      return sha256hex(CONFIG.SECRET).then(function (hex) {
        var keyBytes = hex2buf(hex)
        return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']).then(function (key) {
          return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, key, ct)
        })
      }).then(function (buf) {
        var obj = JSON.parse(new TextDecoder().decode(buf))
        S.full = obj
        return true
      })
    }).catch(function () { return false })
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
  function bank() { return (S.full && S.full.tiku) || (S.data && S.data.meta) && packTrialBank() }
  function packTrialBank() {
    var d = S.data
    return { meta: d.meta, units: d.units, single: d.single, fill: d.fill, short: d.short, essay: d.essay, term: d.term }
  }
  function kb() { return (S.full && S.full.kb) || (S.data && S.data.kb) }

  /* ---------- 渲染：知识点 ---------- */
  function renderGroups() {
    var g = kb().groups || []
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
  function renderKb() {
    var d = kb(), kw = S.kw.trim().toLowerCase()
    var chaps = d.chapters.filter(function (c) { return !S.group || c.group === S.group })
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
        html += '<div class="chap-body">' + cards.slice(0, 60).map(function (x) {
          var isOpen = !!S.openCard[x.id] || !!kw
          var body = ''
          if (isOpen) {
            body = (x.sections || []).map(function (s) {
              return '<div class="sect"><div class="lb">' + esc(s.label) + '</div><ul>' +
                s.items.map(function (it) { return '<li>' + esc(it) + '</li>' }).join('') + '</ul></div>'
            }).join('')
            var vn = (S.full && S.full.varCards && S.full.varCards[x.id]) || 0
            if (vn) body += '<button class="ghost wide vbtn" data-vcard="' + esc(x.id) + '">举一反三 · 用这个知识点出 ' + Math.min(6, vn) + ' 道新题</button>'
            if (x.tags && x.tags.length) body += '<div class="tags">' + x.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>' }).join('') + '</div>'
          }
          return '<div class="carditem" data-card="' + esc(x.id) + '">' +
            '<div class="ctitle"><span class="kind">' + esc(x.kindLabel || '') + '</span><span>' + esc(x.title) + '</span></div>' +
            '<p class="csum">' + esc(x.summary || '') + '</p>' + body + '</div>'
        }).join('') + '</div>'
      }
      html += '</div>'
    })
    $('chapList').innerHTML = html || '<div class="mock">没有匹配的卡片，换个词试试' + (isActive() ? '' : '，或<a data-goto="me">开通全部</a>') + '</div>'
    var shown = d.chapters.reduce(function (s, c) { return s + c.cards.length }, 0)
    $('kbOpen').textContent = shown
    $('kbLock').textContent = Math.max(0, CONFIG.TOTAL_C - shown)
    $('kbGate').hidden = isActive()
  }

  /* ---------- 渲染：刷题 ---------- */
  function unitItems(u) {
    var b = bank()
    var arr = []
    ;['single', 'fill', 'short', 'essay', 'term'].forEach(function (k) {
      if (b[k]) arr = arr.concat(b[k].filter(function (i) { return i.u === u }))
    })
    return arr
  }
  function objItems(u) {
    return bank().single.filter(function (i) { return i.u === u })
  }
  function wrongIds() { return ls(LS.wrong, []) }
  function renderUnits() {
    var b = bank(), wr = wrongIds()
    var allQ = 0
    ;['single', 'fill', 'short', 'essay', 'term'].forEach(function (k) { if (b[k]) allQ += b[k].length })
    var done = ls(LS.stat, {}), todayDone = done.date === today() ? done.done : 0
    $('cDone').textContent = todayDone
    $('unitHint').textContent = '共 ' + b.units.length + ' 个单元'
    $('unitList').innerHTML = b.units.map(function (u) {
      var n = objItems(u.id).length || (b.meta.uc && b.meta.uc[u.id]) || 0
      var lock = !isActive() && CONFIG.FREE_UNITS.indexOf(u.id) < 0
      var pct = n ? Math.min(100, Math.round(wr.filter(function (id) { return id.indexOf(u.id) >= 0 }).length / n * 100)) : 0
      return '<div class="unit' + (lock ? ' lock' : '') + '" data-unit="' + esc(u.id) + '">' +
        '<span class="uname">' + esc(u.n) + '</span>' +
        '<span class="ucount">' + esc(u.a || '') + ' · ' + n + ' 题</span>' +
        '<div class="ubar"><i style="width:' + pct + '%"></i></div></div>'
    }).join('')
    var openUnits = b.units.filter(function (u) { return CONFIG.FREE_UNITS.indexOf(u.id) >= 0 })
    var openCnt = 0
    openUnits.forEach(function (u) { openCnt += unitItems(u.id).length })
    $('quizOpen').textContent = openUnits.length
    $('quizCnt').textContent = openCnt
    $('quizGate').hidden = isActive()
    renderWrong()
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
    if (redo) redo.onclick = function () { openQueue(list, '错题重做') }
  }

  /* ---------- 举一反三 ---------- */
  function findCard(cid) {
    var d = kb(), hit = null
    ;(d.chapters || []).forEach(function (c) { (c.cards || []).forEach(function (x) { if (x.id === cid) hit = x }) })
    return hit
  }
  function decryptVariants() {
    if (S.varReady) return Promise.resolve(true)
    var p = (window.__BHJ_EMBED && window.__BHJ_EMBED.variants) ? Promise.resolve(window.__BHJ_EMBED.variants)
      : fetch('variants.enc?v=' + CONFIG.BUILD).then(function (r) { return r.text() })
    return p.then(function (txt) {
      var parts = txt.trim().split('.'), iv = b64(parts[0]), ct = b64(parts[1])
      return sha256hex(CONFIG.SECRET).then(function (hex) {
        return crypto.subtle.importKey('raw', hex2buf(hex), { name: 'AES-GCM' }, false, ['decrypt']).then(function (key) {
          return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, key, ct)
        })
      }).then(function (buf) {
        var obj = JSON.parse(new TextDecoder().decode(buf))
        S.full.varData = obj.byCard || {}
        S.varReady = true
        return true
      })
    }).catch(function () { return false })
  }

  function openVariants(cid) {
    if (!isActive()) { go('me'); toast('举一反三需开通后使用'); return }
    if (!S.varReady) {
      toast('正在加载变式题…')
      decryptVariants().then(function (ok) {
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
    openQueue(pick, '举一反三 · ' + (c ? c.title : cid))
    window.scrollTo(0, 0)
  }

  /* ---------- 做题 ---------- */
  function openQueue(items, label) {
    if (!items.length) { toast('这个范围暂时没有题目'); return }
    S.queue = items; S.qi = 0; S.label = label
    $('unitView').hidden = true
    $('quizView').hidden = false
    renderQ()
  }
  function renderQ() {
    var q = S.queue[S.qi]
    S.picked = null; S.answered = false
    $('qProg').textContent = (S.qi + 1) + ' / ' + S.queue.length
    $('qTag').textContent = (S.label || '') + ' · ' + (q.tg && q.tg.length ? q.tg.join(' / ') : q.id)
    $('qStem').textContent = q.s
    var opts = $('qOpts'), sub = $('qSubjective'), fb = $('qFb'), submit = $('qSubmit'), next = $('qNext')
    fb.hidden = true; fb.className = 'fb'
    $('qAns').hidden = true
    if (q.o) {
      sub.hidden = true; opts.hidden = false
      opts.innerHTML = Object.keys(q.o).map(function (k) {
        return '<button class="opt" data-opt="' + k + '"><span class="k">' + k + '</span><span>' + esc(q.o[k]) + '</span></button>'
      }).join('')
      submit.hidden = false; submit.disabled = true
      next.hidden = true
    } else {
      opts.hidden = true; sub.hidden = false
      submit.hidden = true; next.hidden = false
      $('qAns').textContent = fmtAns(q.a)
      $('qAns').dataset.ans = fmtAns(q.a)
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
      if (!ok && k === S.picked) btn.classList.add('wrong')
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
    var b = bank()
    $('meStatus').textContent = isActive() ? (daysLeft() <= 7 ? '已开通 · 即将到期' : '已开通') : '试看中'
    $('meExpire').textContent = S.auth ? S.auth.expire + (daysLeft() > 0 ? '（剩 ' + daysLeft() + ' 天）' : '') : '—'
    $('meVer').textContent = (b.meta && b.meta.version) || '—'
    $('contactLine').textContent = CONFIG.CONTACT + '（发送"本草衡鉴"，说明要哪一档）'
    $('logoutBtn').hidden = !isActive()
    if (CONFIG.BUY_URL) { $('buyLink').hidden = false; $('buyLink').href = CONFIG.BUY_URL }
    $('cTotal').textContent = b.meta.total || CONFIG.TOTAL_Q
    $('cCards').textContent = kb().meta && kb().meta.stats ? kb().meta.stats.cards : CONFIG.TOTAL_C
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
      var card = e.target.closest('.carditem')
      if (card) {
        var id = card.dataset.card
        S.openCard[id] = !S.openCard[id]; renderKb(); return
      }
      var head = e.target.closest('.chap-head')
      if (head) { var cid = head.dataset.chap; S.openChap[cid] = !S.openChap[cid]; renderKb() }
    }
    $('unitList').onclick = function (e) {
      var u = e.target.closest('.unit'); if (!u) return
      var id = u.dataset.unit
      if (!isActive() && CONFIG.FREE_UNITS.indexOf(id) < 0) { go('me'); toast('该单元需开通后使用'); return }
      openQueue(objItems(id), unitName(id))
    }
    $('qOpts').onclick = function (e) {
      var o = e.target.closest('.opt'); if (!o || S.answered) return
      S.picked = o.dataset.opt
      Array.prototype.forEach.call($('qOpts').children, function (b) { b.classList.toggle('on', b === o) })
      $('qSubmit').disabled = false
    }
    $('qSubmit').onclick = answerObjective
    $('showAns').onclick = function () { $('qAns').hidden = !$('qAns').hidden }
    $('qNext').onclick = function () {
      if (S.qi + 1 >= S.queue.length) { toast('本组已完成'); backToUnits(); return }
      S.qi++; renderQ()
    }
    $('qBack').onclick = backToUnits
    $('codeBtn').onclick = function () {
      var raw = $('codeInput').value
      verifyCode(raw).then(function (r) {
        if (!r.ok) { toast(r.msg); return }
        S.auth = r.auth; lsSet(LS.auth, r.auth)
        toast('开通成功，正在加载全部资料…')
        decryptFull().then(function (ok) {
          if (!ok) toast('资料解密失败，请刷新页面重试')
          else toast('已解锁全部 ' + bank().meta.total + ' 题、' + CONFIG.TOTAL_C + ' 张卡')
          refreshAll()
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
      S.data = d
      $('upd').textContent = (d.kb && d.kb.meta && d.kb.meta.updatedAt) ? '资料更新 ' + d.kb.meta.updatedAt : ''
      S.auth = ls(LS.auth, null)
      bind()
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
