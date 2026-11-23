/* 本草衡鉴 · 在线版 · 多学科 */
(function () {
  'use strict'

  var CONFIG = {
    CONTACT: '微信：a-Medical-l',
    BUY_URL: 'https://bencaohengjian.github.io/bencao-hengjian/buy.html',
    TOTAL_Q: 9724,
    TOTAL_C: 2746,
    FREE_UNITS: { yaoli: ['U01', 'U02'], paozhi: ['P01', 'P02'], jianding: ['U01', 'U02'], zhiwu: ['Z01', 'Z02'], jiepou: ['U01', 'U02'], zhx: ['U01', 'U03'], ky703_yx: ['U00', 'U01'], ky703_yl: ['U00', 'U01'], ky703_fxhx: ['A01', 'A02'], fangji: ['U00', 'U01'], zys202_jc: ['U01', 'U02'], zys202_xg: ['U01', 'U02'], zys202_zy: ['U01', 'U02'], zys202_sj: ['U01', 'U02'] },
    FREE_CHAPTERS: 2,
    BUILD: '2026-11-22z2m',
    TRIAL_KEY: 'o6pz4TYFTr9eYZqfQoOu_-3fVBKpKWDs-Imoy_lJsmg',
    RAW_BASE: 'https://raw.githubusercontent.com/bencaohengjian/bencao-hengjian/refs/heads/main/',
    NET_TIMEOUT: 15000,
    DIRECTIONS: [
      { id: 'benke', name: '本科课程', short: '本科' },
      { id: 'kaoyan', name: '考研', short: '考研' },
      { id: 'zhicheng', name: '职称中药师', short: '职称' }
    ],
    PROGRAMS: [
      {
        id: 'hnucm-703', group: 'kaoyan', school: '湖南中医药大学', major: '中药学', code: '703',
        name: '湖南中医药大学 · 中药学 · 703', short: '湖南中医药 703',
        subjects: [
          { id: 'ky703_yx', name: '中药学', short: '中药' },
          { id: 'ky703_yl', name: '中药药理学', short: '药理' },
          { id: 'ky703_fxhx', name: '分析化学', short: '分析' }
        ]
      },
      {
        id: 'zyys202', group: 'zhicheng', school: '卫生专业技术资格', major: '中药学（师）', code: '202',
        name: '中药师202 · 初级中药师（202）', short: '中药师202',
        subjects: [
          { id: 'zys202_jc', name: '基础知识', short: '基础' },
          { id: 'zys202_xg', name: '相关专业知识', short: '相关' },
          { id: 'zys202_zy', name: '专业知识', short: '专业' },
          { id: 'zys202_sj', name: '专业实践能力', short: '实践' }
        ]
      }
    ]
  }

  var LS = { auth: 'bhj_auth', wrong: 'bhj_wrong', stat: 'bhj_stat', open: 'bhj_open', subj: 'bhj_subj', mode: 'bhj_mode', shuffle: 'bhj_shuffle', qa: 'bhj_qa', qaDraft: 'bhj_qa_draft' }
  var sheet = { dir: '' }
  var S = {
    data: null, full: null, fullKeys: null, partial: {}, loadingSubj: {}, auth: null, tab: 'kb', subj: '',
    manifest: null, trialLoaded: {}, loadingTrial: {}, loadProgress: {}, subjError: {}, bootError: false, bound: false,
    keyring: null, keyringPromise: null,
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
  function findSubject(id) {
    var l = subjectList()
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]
    return null
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

  /* ---------- 方向 / 院校 / 科目 ---------- */
  function subjectGroup(s) {
    if (!s) return 'benke'
    if (s.group) return s.group
    return 'benke'
  }
  function subjectProgram(s) { return (s && s.program) || '' }
  function programById(id) {
    for (var i = 0; i < CONFIG.PROGRAMS.length; i++) if (CONFIG.PROGRAMS[i].id === id) return CONFIG.PROGRAMS[i]
    return null
  }
  function currentProgram() {
    var s = subj()
    if (!s) return null
    return programById(subjectProgram(s)) || (CONFIG.PROGRAMS[0] || null)
  }
  function dirOfSubject(s) { var g = subjectGroup(s); return g === 'kaoyan' ? 'kaoyan' : (g === 'zhicheng' ? 'zhicheng' : 'benke') }
  function subjectStats(s) {
    if (!s || s.pending) return { q: 0, c: 0 }
    var q = (s.tiku && s.tiku.meta && s.tiku.meta.total) || s.q || 0
    var c = (s.kb && s.kb.meta && s.kb.meta.stats && s.kb.meta.stats.cards) || s.c || 0
    return { q: q, c: c }
  }
  function subjectsOfProgram(p) {
    var declared = (p.subjects || []).slice()
    var out = declared.map(function (x) {
      var real = findSubject(x.id)
      if (real) return Object.assign({}, x, real)
      return { id: x.id, name: x.name, short: x.short, pending: true }
    })
    subjectList().forEach(function (s) {
      if (subjectProgram(s) !== p.id) return
      var has = false
      for (var i = 0; i < out.length; i++) if (out[i].id === s.id) { has = true; break }
      if (!has) out.push(s)
    })
    return out
  }

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
    if (!id || !findSubject(id)) return
    S.subj = id
    S.group = ''; S.kw = ''; S.openChap = {}; S.deckPos = {}; S.autoOpenDone = false
    lsSet(LS.subj, id)
    renderSubjChips(); refreshAll()
    if (subjectActive(id) && !subjReady(id)) {
      loadSubject(id).then(function (ok) {
        refreshAll()
        if (!ok) toast('资料加载失败，请点重试')
      })
    } else if (!subjectActive(id) && !S.trialLoaded[id]) {
      loadTrialSubject(id).then(function (ok) {
        refreshAll()
        if (!ok) toast('试看资料加载失败，请点重试')
      })
    }
    window.scrollTo(0, 0)
  }

  function subjRowHtml(s) {
    var st = subjectStats(s)
    var on = s.id === subjId()
    var pending = !!s.pending
    var lock = isActive() && !pending && !subjectActive(s.id)
    var state = pending ? '待录入' : (lock ? '未开通' : (isActive() ? '已开通' : '试看'))
    var cls = 'ss-row' + (on ? ' on' : '') + (pending ? ' pending' : '') + (lock ? ' lock' : '')
    var tag = pending ? 'div' : 'button'
    return '<' + tag + ' class="' + cls + '" data-subj="' + esc(s.id) + '"' + (pending ? ' aria-disabled="true"' : '') + '>' +
      '<span class="ss-ic">' + esc((s.short || s.name || '?').slice(0, 1)) + '</span>' +
      '<span class="ss-info"><b>' + esc(s.name || s.id) + '</b><i>' + (st.q ? st.q + ' 题 · ' + st.c + ' 卡' : '0 题 · 0 卡') + '</i></span>' +
      '<span class="ss-state">' + state + '</span></' + tag + '>'
  }

  function programHtml(p) {
    var subs = subjectsOfProgram(p)
    var live = 0
    subs.forEach(function (x) { if (!x.pending) live++ })
    return '<div class="prog-head"><div class="prog-code">' + esc(p.code) + '</div>' +
      '<div class="prog-txt"><b>' + esc(p.school) + ' · ' + esc(p.major) + '</b><i>科目代码 ' + esc(p.code) + ' · ' + subs.length + ' 科</i></div>' +
      '<span class="prog-tag">' + (live ? live + '/' + subs.length + ' 已上线' : '资料待录入') + '</span></div>' +
      '<div class="ss-list">' + subs.map(subjRowHtml).join('') + '</div>'
  }

  function renderSubjChips() {
    var s = subj()
    if (!s || !$('ssName')) return
    var p = currentProgram()
    var prefix = subjectGroup(s) === 'kaoyan' && p ? (p.school + ' ' + p.code + ' · ') : ''
    var st = subjectStats(s)
    $('ssDir').textContent = subjectGroup(s) === 'kaoyan' ? '考研' : (subjectGroup(s) === 'zhicheng' ? '职称' : '本科课程')
    $('ssName').textContent = prefix + (s.name || s.id)
    var p = S.loadProgress[s.id]
    if (p) $('ssMeta').textContent = progressText(p)
    else if (S.subjError[s.id]) $('ssMeta').textContent = '加载失败'
    else if (subjectActive(s.id) && !subjReady(s.id)) $('ssMeta').textContent = '资料解密中…'
    else if (!subjectActive(s.id) && !S.trialLoaded[s.id] && st.q) $('ssMeta').textContent = st.q + ' 题 · ' + st.c + ' 卡 · 载入中'
    else $('ssMeta').textContent = st.q ? st.q + ' 题 · ' + st.c + ' 卡' : '待录入'
    if ($('upd')) {
      var up = (kb() && kb().meta && kb().meta.updatedAt) || (s && s.updatedAt) || ''
      $('upd').textContent = up ? '资料更新 ' + up : ''
    }
  }

  function renderSheet() {
    if (!sheet.dir) {
      var s0 = subj()
      sheet.dir = dirOfSubject(s0)
    }
    if ($('ssTabs')) {
      $('ssTabs').innerHTML = CONFIG.DIRECTIONS.map(function (d) {
        return '<button class="dir-tab' + (sheet.dir === d.id ? ' on' : '') + '" data-dir="' + d.id + '">' + esc(d.name) + '</button>'
      }).join('')
    }
    var body = ''
    var note = ''
    if (sheet.dir === 'benke') {
      var list = subjectList().filter(function (s) { return subjectGroup(s) === 'benke' })
      body = '<div class="ss-list">' + list.map(subjRowHtml).join('') + '</div>'
      note = '本科七科共用一套授权：单科码开对应一科，全科码七科全开。'
    } else if (sheet.dir === 'zhicheng') {
      body = CONFIG.PROGRAMS.filter(function (p) { return p.group === 'zhicheng' }).map(programHtml).join('')
      note = '职称中药师（202）：总码 Z202 解锁四科，单科码分别对应基础 / 相关 / 专业 / 实践。'
    } else {
      body = CONFIG.PROGRAMS.map(programHtml).join('')
      note = '考研内容按“院校 + 专业 + 科目代码”独立归档，与本科授权分开；资料录入后自动出现在这里。'
    }
    $('ssBody').innerHTML = body
    $('ssNote').textContent = note
  }

  function openSheet() {
    var s = subj()
    sheet.dir = dirOfSubject(s)
    renderSheet()
    clearTimeout(sheet.timer)
    $('ssMask').hidden = false
    setTimeout(function () { $('ssMask').classList.add('open') }, 20)
    document.body.style.overflow = 'hidden'
  }
  function closeSheet() {
    clearTimeout(sheet.timer)
    $('ssMask').classList.remove('open')
    sheet.timer = setTimeout(function () { $('ssMask').hidden = true }, 180)
    document.body.style.overflow = ''
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
    var m = s.match(/^ZY-(\d{8})-(\d{2})(?:-([A-Z0-9]{1,6}))?-([0-9A-F]{4})$/)
    if (!m) return null
    var mo = +m[1].slice(4, 6), d = +m[1].slice(6, 8)
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
    var sfx = m[3] || ''
    return { code: s, body: 'ZY-' + m[1] + '-' + m[2] + (sfx ? '-' + sfx : ''), sig: m[4], expire: m[1], sfx: sfx }
  }
  function isTrialSfx(sfx) {
    return /^T(?:[01]\d|2[0-3])[0-5]\d$/.test(sfx)
  }
  function trialExpireAt(c) {
    if (!c || !isTrialSfx(c.sfx)) return null
    var y = +c.expire.slice(0, 4), mo = +c.expire.slice(4, 6) - 1, d = +c.expire.slice(6, 8)
    var hh = +c.sfx.slice(1, 3), mm = +c.sfx.slice(3, 5)
    return new Date(y, mo, d, hh, mm, 59, 999)
  }
  function planFromSuffix(sfx) {
    if (isTrialSfx(sfx)) return ['ky703_yx']
    if (!sfx) return 'all'
    if (sfx === 'A') return 'all'
    if (sfx === 'K703Y') return ['ky703_yx']
    if (sfx === 'K703L') return ['ky703_yl']
    if (sfx === 'K703F') return ['ky703_fxhx']
    if (sfx === 'FJ') return ['fangji']
    if (sfx === 'Z202') return ['zys202_jc', 'zys202_xg', 'zys202_zy', 'zys202_sj']
    if (sfx === 'Z202J') return ['zys202_jc']
    if (sfx === 'Z202X') return ['zys202_xg']
    if (sfx === 'Z202Z') return ['zys202_zy']
    if (sfx === 'Z202S') return ['zys202_sj']
    if (sfx === 'K703') return ['ky703_yx', 'ky703_yl', 'ky703_fxhx']
    var mp = { Y: 'yaoli', P: 'paozhi', J: 'jianding', Z: 'zhiwu', X: 'jiepou', H: 'zhx' }
    var arr = sfx.split('').map(function (c) { return mp[c] }).filter(Boolean)
    return arr
  }
  function planOf(auth) {
    var all = ['yaoli', 'paozhi', 'jianding', 'zhiwu', 'jiepou', 'zhx', 'fangji']
    if (!auth) return []
    if (auth.plan === 'all' || !auth.plan) return all.slice()
    return Array.isArray(auth.plan) ? auth.plan.slice() : all.slice()
  }
  function subjectActive(id) {
    return isActive() && planOf(S.auth).indexOf(id) >= 0
  }
  function subjReady(id) {
    if (!subjectActive(id)) return true
    return !!(S.partial && S.partial[id])
  }
  function planIsKy(p) {
    return Array.isArray(p) && p.some(function (id) { return /^ky/.test(id) })
  }
  function kyOnlyPlan() {
    var p = planOf(S.auth)
    if (!p.length) return false
    var ky = false, bk = false
    p.forEach(function (id) { if (/^ky/.test(id)) ky = true; else bk = true })
    return ky && !bk
  }
  function hasKyData() {
    return subjectList().some(function (s) { return subjectGroup(s) === 'kaoyan' })
  }
  function planText(plan) {
    var all = ['yaoli', 'paozhi', 'jianding', 'zhiwu', 'jiepou', 'zhx', 'fangji']
    var nm = { yaoli: '中药药理学', paozhi: '中药炮制学', jianding: '中药鉴定学', zhiwu: '药用植物学', jiepou: '人体解剖生理学', zhx: '中药化学',
      ky703_yx: '中药学', ky703_yl: '中药药理学', ky703_fxhx: '分析化学', fangji: '方剂学',
      zys202_jc: '基础知识', zys202_xg: '相关专业知识', zys202_zy: '专业知识', zys202_sj: '专业实践能力' }
    if (plan === 'all' || (Array.isArray(plan) && all.every(function (x) { return plan.indexOf(x) >= 0 }))) return '全科'
    if (Array.isArray(plan) && plan.length === 3 && plan.indexOf('ky703_yx') >= 0 && plan.indexOf('ky703_yl') >= 0 && plan.indexOf('ky703_fxhx') >= 0) return '考研 703 三科'
    if (Array.isArray(plan) && plan.length === 4 && plan.every(function (x) { return /^zys202_/.test(x) })) return '中药师202 四科'
    return (Array.isArray(plan) ? plan : all).map(function (x) { return nm[x] || x }).join('、')
  }
  function keyringId(code) {
    var c = String(code || '').trim().toUpperCase()
    return crypto.subtle.importKey('raw', new TextEncoder().encode(c), 'PBKDF2', false, ['deriveBits']).then(function (base) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode('bhj-id-v1'), iterations: 600000, hash: 'SHA-256' }, base, 256)
    }).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2) }).join('')
    })
  }
  function verifyCode(raw) {
    var c = parseCode(raw)
    if (!c) return Promise.resolve({ ok: false, msg: '格式不对，应为 ZY-20271231-01-XXXX' })
    var exp = c.expire.slice(0, 4) + '-' + c.expire.slice(4, 6) + '-' + c.expire.slice(6, 8)
    var tea = trialExpireAt(c)
    if (tea) {
      if (tea.getTime() < Date.now()) return Promise.resolve({ ok: false, msg: '该体验码已到期，请用长久开通码继续' })
      return Promise.resolve({ ok: true, auth: { code: c.code, expire: exp, expireAt: tea.toISOString(), plan: ['ky703_yx'], trial: true } })
    }
    if (exp < today()) return Promise.resolve({ ok: false, msg: '该码已于 ' + exp + ' 到期，请换新码' })
    return keyringId(c.code).then(function (id) {
      return readKeyring().then(function (kr) {
        if (!kr || !kr.entries || !kr.entries[id]) return { ok: false, msg: '开通码无效，请核对后重试' }
        return { ok: true, auth: { code: c.code, expire: exp, plan: planFromSuffix(c.sfx) } }
      })
    }).catch(function () { return { ok: false, msg: '网络异常，请重试' } })
  }
  function today() {
    var d = new Date()
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  }
  function pad(n) { return (n < 10 ? '0' : '') + n }
  function isActive() {
    if (!S.auth) return false
    if (S.auth.expireAt) return Date.now() <= Date.parse(S.auth.expireAt)
    return S.auth.expire >= today()
  }
  function daysLeft() {
    if (!S.auth) return 0
    return Math.round((new Date(S.auth.expire + 'T23:59:59') - new Date()) / 86400000)
  }
  function fmtDateTime(iso) {
    var d = new Date(iso)
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  }
  function authLeftText() {
    if (!S.auth) return ''
    if (S.auth.expireAt) {
      var h = Math.max(0, Math.ceil((Date.parse(S.auth.expireAt) - Date.now()) / 3600000))
      return '剩 ' + h + ' 小时'
    }
    return '剩 ' + Math.max(0, daysLeft()) + ' 天'
  }

  /* ---------- 全量解密：卡密 → keyring → 分科密文 ---------- */
  function b64(s) {
    var bin = atob(s), arr = new Uint8Array(bin.length)
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return arr
  }
  function b64any(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/')
    var pad = s.length % 4
    if (pad) s += new Array(5 - pad).join('=')
    return b64(s)
  }
  function importRawKey(bytes) {
    return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['decrypt'])
  }
  function decryptWithCryptoKey(txt, key) {
    var parts = String(txt || '').trim().split('.')
    if (parts.length !== 2) throw new Error('bad payload')
    var iv = b64any(parts[0]), ct = b64any(parts[1])
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, key, ct)
      .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)) })
  }
  function decryptPayload(txt, keyBytes) {
    return importRawKey(keyBytes).then(function (key) { return decryptWithCryptoKey(txt, key) })
  }
  function codeKey(code) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(String(code || '').trim().toUpperCase()), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: new TextEncoder().encode('bhj-keyring-v1'), iterations: 10000, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
      )
    })
  }

  /* ---------- 网络：15 秒超时、重试、进度、本地缓存 ---------- */
  function urlWithBuild(path) {
    return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(CONFIG.BUILD)
  }
  function progressText(p) {
    if (!p) return ''
    if (p.error) return '加载失败'
    var bits = p.label || '资料'
    var pct = p.total ? Math.max(1, Math.min(99, Math.round((p.loaded || 0) / p.total * 100))) : 0
    if (pct) bits += ' ' + pct + '%'
    else if (p.loaded) bits += ' ' + Math.max(1, Math.round(p.loaded / 1024)) + 'KB'
    if (p.attempt > 1) bits += ' · 第 ' + p.attempt + '/' + p.max + ' 次'
    return bits
  }
  function setLoadProgress(key, p) {
    p.stamp = Date.now()
    S.loadProgress[key] = p
    var cur = S.subj ? subjId() : ''
    if (key === 'manifest' || key === cur) paintLoadMeta()
  }
  function clearLoadProgress(key) {
    delete S.loadProgress[key]
    var cur = S.subj ? subjId() : ''
    if (key === 'manifest' || key === cur) paintLoadMeta()
  }
  function paintLoadMeta() {
    if (!$('ssMeta')) return
    var p = (S.subj && S.loadProgress[subjId()]) || S.loadProgress.manifest
    if (p) $('ssMeta').textContent = progressText(p)
    if (S.tab === 'kb' && !kb()) renderKb()
    else if (S.tab === 'quiz' && !bank()) renderUnits()
  }
  var cacheDB = null
  function idbOpen() {
    if (!window.indexedDB) return Promise.resolve(null)
    if (cacheDB) return Promise.resolve(cacheDB)
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.open('bhj_net_v1', 1)
        req.onupgradeneeded = function () {
          var db = req.result
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
        }
        req.onsuccess = function () { cacheDB = req.result; resolve(cacheDB) }
        req.onerror = function () { resolve(null) }
      } catch (e) { resolve(null) }
    })
  }
  function cacheKey(path) { return CONFIG.BUILD + '::' + path }
  function cacheGet(path) {
    return idbOpen().then(function (db) {
      if (!db) return null
      return new Promise(function (resolve) {
        try {
          var req = db.transaction('kv', 'readonly').objectStore('kv').get(cacheKey(path))
          req.onsuccess = function () { resolve(req.result == null ? null : req.result) }
          req.onerror = function () { resolve(null) }
        } catch (e) { resolve(null) }
      })
    })
  }
  function cacheSet(path, text) {
    return idbOpen().then(function (db) {
      if (!db || typeof text !== 'string' || text.length > 5000000) return
      try { db.transaction('kv', 'readwrite').objectStore('kv').put(text, cacheKey(path)) } catch (e) {}
    }).catch(function () {})
  }
  function requestText(path, opt) {
    opt = opt || {}
    var key = opt.key || path
    var label = opt.label || '资料'
    var cacheable = opt.cache !== false
    var urls = [urlWithBuild(path)]
    if (opt.raw !== false) urls.push(urlWithBuild(path), CONFIG.RAW_BASE + urlWithBuild(path))
    else urls.push(urlWithBuild(path))
    return (cacheable ? cacheGet(path) : Promise.resolve(null)).then(function (hit) {
      if (hit != null) { clearLoadProgress(key); return hit }
      return new Promise(function (resolve, reject) {
        var i = 0
        function failNext() {
          if (i >= urls.length) { setLoadProgress(key, { label: label, error: true }); reject(new Error('network ' + path)); return }
          i++
          var attempt = i, max = urls.length, url = urls[i - 1], done = false
          var xhr = new XMLHttpRequest()
          xhr.open('GET', url, true)
          xhr.responseType = 'text'
          xhr.timeout = 0
          var idle = null
          function clearIdle() { if (idle) { clearTimeout(idle); idle = null } }
          function armIdle() {
            clearIdle()
            idle = setTimeout(function () {
              if (done) return
              done = true
              try { xhr.abort() } catch (e) {}
              setLoadProgress(key, { label: label, attempt: attempt + 1, max: max, loaded: 0, total: 0 })
              failNext()
            }, CONFIG.NET_TIMEOUT)
          }
          xhr.onprogress = function (e) {
            if (done) return
            armIdle()
            setLoadProgress(key, { label: label, attempt: attempt, max: max, loaded: e.loaded || 0, total: e.total || 0 })
          }
          xhr.onload = function () {
            if (done) return
            done = true
            clearIdle()
            if (xhr.status >= 200 && xhr.status < 300) {
              clearLoadProgress(key)
              if (cacheable) cacheSet(path, xhr.responseText)
              resolve(xhr.responseText)
              return
            }
            setLoadProgress(key, { label: label, attempt: attempt + 1, max: max, loaded: 0, total: 0 })
            failNext()
          }
          xhr.onerror = xhr.onabort = function () {
            if (done) return
            done = true
            clearIdle()
            setLoadProgress(key, { label: label, attempt: attempt + 1, max: max, loaded: 0, total: 0 })
            failNext()
          }
          setLoadProgress(key, { label: label, attempt: attempt, max: max, loaded: 0, total: 0 })
          armIdle()
          try { xhr.send() } catch (e) { done = true; clearIdle(); failNext() }
        }
        failNext()
      })
    })
  }
  function requestJson(path, opt) {
    return requestText(path, opt).then(function (txt) { return JSON.parse(txt) })
  }

  function readKeyring() {
    if (S.keyring) return Promise.resolve(S.keyring)
    if (S.keyringPromise) return S.keyringPromise
    S.keyringPromise = requestJson('keyring.json', { label: '授权清单', key: 'keyring' }).then(function (kr) {
      S.keyring = kr
      return kr
    }).catch(function (e) {
      S.keyringPromise = null
      throw e
    })
    return S.keyringPromise
  }
  function unwrapSubjectKeys(code) {
    return keyringId(String(code || '').trim().toUpperCase()).then(function (h) {
      return readKeyring().then(function (kr) {
        var w = kr && kr.entries && kr.entries[h]
        if (!w) throw new Error('code not in keyring')
        return codeKey(code).then(function (k) { return decryptWithCryptoKey(w, k) })
      })
    }).then(function (obj) { return obj.keys || {} })
  }
  function decryptSubject(id, keyB64) {
    var subjFile = (id === 'ky703_yl') ? 'ky703_yl_v2.enc' : (id + '.enc')
    return requestText('subj_' + subjFile, { label: '全量包', key: id }).then(function (txt) {
      return decryptPayload(txt, b64any(keyB64))
    })
  }
  function applyManifest(m) {
    if (!m || !Array.isArray(m.subjects) || !m.subjects.length) throw new Error('bad manifest')
    var subs = m.subjects.map(function (x) {
      return {
        id: x.id, name: x.name, short: x.short, group: x.group || '', program: x.program || '',
        q: x.q || 0, c: x.c || 0, updatedAt: x.updatedAt || '', freeUnits: x.freeUnits || [],
        trial: x.trial || ('trial_' + x.id + '.enc'), metaOnly: true
      }
    })
    S.manifest = m
    S.data = normalize({ default: m.default || subs[0].id, subjects: subs })
    CONFIG.TOTAL_Q = m.totalQ || CONFIG.TOTAL_Q
    CONFIG.TOTAL_C = m.totalC || CONFIG.TOTAL_C
    return S.data
  }
  function loadManifest() {
    return requestJson('manifest.json', { label: '科目清单', key: 'manifest' }).then(applyManifest)
  }
  function applyTrialSubject(id, d) {
    var s = d && d.subjects && d.subjects.filter(function (x) { return x.id === id })[0]
    if (!s) throw new Error('trial subject mismatch')
    var arr = (S.data && S.data.subjects) || []
    var hit = false
    arr = arr.map(function (x) { if (x.id === id) { hit = true; return s } return x })
    if (!hit) arr.push(s)
    S.data = normalize({ default: (S.data && S.data.default) || id, subjects: arr })
    if (S.full) {
      var fullArr = (S.full.subjects || []).map(function (x) { return x.id === id ? s : x })
      if (!fullArr.some(function (x) { return x.id === id })) fullArr.push(s)
      S.full.subjects = fullArr
    }
    S.trialLoaded[id] = true
    delete S.subjError[id]
  }
  function loadTrialSubject(id) {
    if (S.trialLoaded[id]) return Promise.resolve(true)
    if (S.loadingTrial[id]) return S.loadingTrial[id]
    var s = findSubject(id)
    if (!s) return Promise.resolve(false)
    var file = s.trial || ('trial_' + id + '.enc')
    var p = requestText(file, { label: '试看包', key: id }).then(function (txt) {
      return decryptPayload(txt, b64any(CONFIG.TRIAL_KEY))
    }).then(function (d) {
      applyTrialSubject(id, d)
      return true
    }).catch(function () {
      S.subjError[id] = true
      return false
    })
    S.loadingTrial[id] = p
    p.then(function () { delete S.loadingTrial[id] }, function () { delete S.loadingTrial[id] })
    return p
  }
  function mergeSubjects(list) {
    var base = (S.data && S.data.subjects) || []
    var byId = {}
    list.forEach(function (s) { if (s && s.id) byId[s.id] = s })
    var out = base.map(function (s) { return byId[s.id] || s })
    list.forEach(function (s) {
      if (!s || !s.id) return
      var has = false
      for (var i = 0; i < out.length; i++) if (out[i].id === s.id) { has = true; break }
      if (!has) out.push(s)
    })
    return out
  }
  function mergeLoadedSubject(s) {
    var base = (S.full && S.full.subjects) || (S.data && S.data.subjects) || []
    var arr = base.map(function (x) { return x.id === s.id ? s : x })
    var has = false
    for (var i = 0; i < arr.length; i++) if (arr[i].id === s.id) { has = true; break }
    if (!has) arr.push(s)
    var varData = (S.full && S.full.varData) || {}
    if (s.varData) Object.assign(varData, s.varData)
    S.full = normalize({ default: (S.data && S.data.default) || 'yaoli', subjects: arr, varData: varData })
    if (!S.partial) S.partial = {}
    S.partial[s.id] = true
    if (Object.keys(varData).length) { S.varReady = true; S.varSubj = subjId() }
  }
  function loadSubject(id) {
    if (S.partial && S.partial[id]) return Promise.resolve(true)
    if (S.loadingSubj && S.loadingSubj[id]) return S.loadingSubj[id]
    if (!S.auth || !S.auth.code) return Promise.resolve(false)
    var p = (S.fullKeys ? Promise.resolve(S.fullKeys) : unwrapSubjectKeys(S.auth.code).then(function (keys) {
      S.fullKeys = keys
      return keys
    })).then(function (keys) {
      var key = keys[id]
      if (!key) return false
      return decryptSubject(id, key).then(function (s) {
        mergeLoadedSubject(s)
        delete S.subjError[id]
        return true
      }).catch(function () { S.subjError[id] = true; return false })
    })
    S.loadingSubj[id] = p
    p.then(function () { delete S.loadingSubj[id] }, function () { delete S.loadingSubj[id] })
    return p
  }
  function decryptFull() {
    if (!S.auth || !S.auth.code) return Promise.resolve(false)
    if (subjReady(subjId())) return Promise.resolve(true)
    if (S.fullLoading) return S.fullLoading
    S.fullLoading = unwrapSubjectKeys(S.auth.code).then(function (keys) {
      S.fullKeys = keys
      var ids = Object.keys(keys)
      var cur = subjId()
      if (ids.indexOf(cur) < 0) cur = ids[0]
      return loadSubject(cur).then(function (ok) {
        if (!ok) throw new Error('no subject decrypted')
        delete S.subjError[cur]
        var rest = ids.filter(function (id) { return id !== cur })
        ;(function next(i) {
          if (i >= rest.length) return
          loadSubject(rest[i]).then(function () { next(i + 1) })
        })(0)
        return true
      })
    }).catch(function () { S.subjError[subjId()] = true; return false })
    S.fullLoading.then(function (ok) { if (!ok) S.fullLoading = null })
    return S.fullLoading
  }

  /* ---------- 渲染：知识点 ---------- */
  function renderGroups() {
    var g = (kb() && kb().groups) || []
    var cur = S.group
    if (!subjReady(subjId()) || !kb()) {
      g = []
    } else if (!subjectActive(subjId())) {
      var chaps = (kb() && kb().chapters) || []
      chaps = chaps.slice(0, CONFIG.FREE_CHAPTERS)
      var avail = {}
      chaps.forEach(function (c) { avail[c.group] = true })
      g = g.filter(function (x) { return avail[x] })
      if (cur && g.indexOf(cur) < 0) { S.group = ''; cur = '' }
    }
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
    if (vn && isActive() && subjectActive(subjId())) body += '<button class="ghost wide vbtn" data-vcard="' + esc(x.id) + '">举一反三 · 用这个知识点出' + (vn ? ' ' + Math.min(6, vn) + ' 道新题' : '新题') + '</button>'
    if (x.tags && x.tags.length) body += '<div class="tags">' + x.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>' }).join('') + '</div>'
    return '<div class="deck-card" data-card="' + esc(x.id) + '">' +
      '<div class="ctitle"><span class="kind">' + esc(x.kindLabel || '') + '</span><span>' + esc(x.title) + '</span></div>' +
      '<p class="csum">' + esc(x.summary || '') + '</p>' + body + '</div>'
  }
  function subjectWaitHtml() {
    var id = subjId()
    if (S.subjError[id]) {
      return '<div class="mock">本科目资料没有加载成功。<br><button class="ghost" data-retry-subj="1" type="button">重试本科目</button>' +
        '<p class="hint">已自动尝试 3 次；可先切换其他科目，或检查网络后再试。</p></div>'
    }
    var p = S.loadProgress[id]
    if (p && !p.error) {
      return '<div class="mock">' + esc(progressText(p)) + '<p class="hint">15 秒无响应会自动重试；不用刷新页面。</p></div>'
    }
    if (subjectActive(id) && !subjReady(id)) {
      return '<div class="mock">资料正在解密，首次打开请稍候；15 秒无响应会自动重试。</div>'
    }
    return '<div class="mock">正在加载本科目资料…<p class="hint">15 秒无响应会自动重试；不用刷新页面。</p></div>'
  }
  function retryCurrentSubject() {
    var id = subjId()
    if (!id) return
    delete S.subjError[id]
    delete S.loadProgress[id]
    refreshAll()
    if (subjectActive(id)) {
      loadSubject(id).then(function (ok) {
        refreshAll()
        if (!ok) toast('资料加载失败，请稍后重试')
      })
    } else {
      loadTrialSubject(id).then(function (ok) {
        refreshAll()
        if (!ok) toast('试看资料加载失败，请稍后重试')
      })
    }
  }
  function renderKb() {
    var d = kb()
    if (!d) {
      $('kbGate').hidden = true
      $('chapList').innerHTML = subjectWaitHtml()
      $('cTotal').textContent = totalQ()
      $('cCards').textContent = totalC()
      return
    }
    if (!subjReady(subjId())) {
      $('chapList').innerHTML = subjectWaitHtml()
      $('kbGate').hidden = true
      return
    }
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
    $('chapList').innerHTML = html || '<div class="mock">没有匹配的卡片，换个词试试' + (subjectActive(subjId()) ? '' : '，或<a data-goto="me">开通全部</a>') + '</div>'
    var shown = (d.chapters || []).reduce(function (s, c) { return s + c.cards.length }, 0)
    $('kbOpen').textContent = shown
    $('kbLock').textContent = Math.max(0, totalC() - shown)
    $('kbGate').hidden = subjectActive(subjId())
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
    ;['single', 'judge', 'fill', 'short', 'essay', 'term'].forEach(function (k) {
      if (b[k]) arr = arr.concat(b[k].filter(function (i) { return i.u === u }))
    })
    return arr
  }
  function objItems(u) {
    var b = bank(), arr = []
    if (!b) return arr
    ;['single', 'judge'].forEach(function (k) { if (b[k]) arr = arr.concat(b[k].filter(function (i) { return i.u === u })) })
    return arr
  }
  function qaItems(u) {
    var b = bank(), arr = []
    if (!b) return arr
    ;['short', 'essay'].forEach(function (k) { if (b[k]) arr = arr.concat(b[k].filter(function (i) { return i.u === u })) })
    return arr
  }
  function qaAllItems() {
    var b = bank(), arr = []
    if (!b) return arr
    ;['short', 'essay'].forEach(function (k) { if (b[k]) arr = arr.concat(b[k] || []) })
    if (!subjectActive(subjId())) {
      var free = freeUnits()
      arr = arr.filter(function (i) { return free.indexOf(i.u) >= 0 })
    }
    return arr
  }
  function modeItems(u) {
    if (S.qmode === 'recite') return unitItems(u)
    if (S.qmode === 'qa') return qaItems(u)
    return objItems(u)
  }
  function wrongIds() { return ls(LS.wrong, []) }
  function renderUnits() {
    if (subjectActive(subjId()) && !subjReady(subjId())) {
      var pa = S.loadProgress[subjId()]
      $('unitHint').textContent = pa && !pa.error ? progressText(pa) : '资料正在解密，请稍候…'
      $('unitList').innerHTML = subjectWaitHtml()
      $('quizGate').hidden = true
      return
    }
    var b = bank()
    if (!b) {
      var p = S.loadProgress[subjId()]
      $('unitHint').textContent = p && !p.error ? progressText(p) : '资料加载中…'
      $('unitList').innerHTML = subjectWaitHtml()
      $('quizGate').hidden = true
      return
    }
    var wr = wrongIds()
    var allQ = (b.meta && b.meta.total) || 0
    if (!allQ) { ;['single', 'judge', 'fill', 'short', 'essay', 'term'].forEach(function (k) { if (b[k]) allQ += b[k].length }) }
    var done = ls(LS.stat, {}), todayDone = done.date === today() ? done.done : 0
    $('cDone').textContent = todayDone
    $('unitHint').textContent = '共 ' + b.units.length + ' 个单元 · ' + allQ + ' 题' + (!subjReady(subjId()) ? ' · 题库加载中…' : '')
    $('unitList').innerHTML = b.units.map(function (u) {
      var n = modeItems(u.id).length
      if (S.qmode !== 'qa' && !n && b.meta.uc) n = b.meta.uc[u.id] || 0
      var lock = !subjectActive(subjId()) && freeUnits().indexOf(u.id) < 0
      var pct = n ? Math.min(100, Math.round(wr.filter(function (id) { return id.indexOf(u.id) >= 0 }).length / n * 100)) : 0
      return '<div class="unit' + (lock ? ' lock' : '') + '" data-unit="' + esc(u.id) + '">' +
        '<span class="uname">' + esc(u.n) + '</span>' +
        '<span class="ucount">' + esc(u.a || '') + ' · ' + n + ' 题</span>' +
        '<div class="ubar"><i style="width:' + pct + '%"></i></div></div>'
    }).join('')
    if ($('qaAllBtn')) {
      $('qaAllBtn').hidden = S.qmode !== 'qa'
      $('qaAllCnt').textContent = qaAllItems().length
    }
    var openUnits = b.units.filter(function (u) { return freeUnits().indexOf(u.id) >= 0 })
    var openCnt = 0
    openUnits.forEach(function (u) { openCnt += unitItems(u.id).length })
    $('quizOpen').textContent = openUnits.length
    $('quizCnt').textContent = openCnt
    $('quizGate').hidden = subjectActive(subjId())
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
    if ($('qaAllBtn')) $('qaAllBtn').hidden = S.qmode !== 'qa'
    $('modeHint').textContent = S.qmode === 'recite'
      ? '背题模式：进入单元后答案直接显示，勾对正确选项并给出解析，只看不判对错、不记错题。'
      : S.qmode === 'qa'
        ? '简答/论述：先自己作答（要点仅存本机），查看参考答案后自评；自评不进错题本，也不计今日已做。'
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
    ;['single', 'judge', 'fill', 'short', 'essay', 'term'].forEach(function (k) {
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
  function decryptVariants(cid) {
    if (S.full && S.full.varData && Object.keys(S.full.varData).length) {
      S.varReady = true
      S.varSubj = subjId()
      if (!cid || S.full.varData[cid]) return Promise.resolve(true)
    }
    if (!S.full) {
      return decryptFull().then(function (ok) {
        if (!ok || !S.full || !S.full.varData) return false
        S.varReady = true
        return !cid || !!S.full.varData[cid]
      })
    }
    return Promise.resolve(false)
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
    var qa = S.qmode === 'qa'
    S.picked = ''; S.answered = false; S.ansHidden = false
    $('qProg').textContent = (S.qi + 1) + ' / ' + S.queue.length
    var tagBits = []
    if (S.label) tagBits.push(S.label)
    ;(q.tg && q.tg.length ? q.tg : [q.id]).forEach(function (x) { if (tagBits.indexOf(x) < 0) tagBits.push(x) })
    var qaSuffix = qa ? (q.t === 'essay' ? '论述' : '简答') : ''
    if (qaSuffix && tagBits.indexOf(qaSuffix) < 0) tagBits.push(qaSuffix)
    $('qTag').textContent = tagBits.join(' · ') + (recite ? ' · 背题' : '')
    $('qStem').textContent = q.s
    var opts = $('qOpts'), sub = $('qSubjective'), fb = $('qFb'), submit = $('qSubmit'), next = $('qNext'), hide = $('qHide')
    fb.hidden = true; fb.className = 'fb'
    $('qAns').hidden = true
    if (q.o) {
      sub.hidden = true; opts.hidden = false
      $('qaDraft').hidden = true; $('qaEval').hidden = true
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
        fb.innerHTML = '<b>正确答案：' + esc(q.t === 'judge' ? (String(q.a) === 'A' ? '正确（A）' : '错误（B）') : String(q.a)) + '</b>' + (q.e ? '<br>解析：' + esc(q.e) : '')
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
      var draft = $('qaDraft'), evalBox = $('qaEval')
      if (qa) {
        draft.hidden = false
        draft.value = draftOf(q.id)
        evalBox.hidden = true
        paintEval(evalState(q.id))
        $('showAns').hidden = false
        $('showAns').textContent = '查看参考答案'
        next.classList.remove('next-main')
      } else {
        draft.hidden = true
        evalBox.hidden = true
        if (recite) {
          $('qAns').hidden = false
          $('showAns').hidden = true
          hide.hidden = false; hide.textContent = '遮住答案'
          next.classList.add('next-main')
        } else {
          $('showAns').hidden = false
          next.classList.remove('next-main')
        }
      }
      next.textContent = S.qi + 1 >= S.queue.length ? '完成' : '下一题'
    }
  }
  function fmtAns(a) {
    if (Array.isArray(a)) return a.join('；')
    return a || '（暂无参考答案）'
  }
  function evalMap() { return ls(LS.qa, {}) }
  function draftMap() { return ls(LS.qaDraft, {}) }
  function evalState(qid) { var m = evalMap()[subjId()]; return m ? m[qid] : '' }
  function draftOf(qid) { var m = draftMap()[subjId()]; return m ? m[qid] || '' : '' }
  function paintEval(state) {
    if (!$('qaEval')) return
    ;[].forEach.call($('qaEval').querySelectorAll('[data-eval]'), function (b) {
      b.classList.toggle('on', b.dataset.eval === state)
    })
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
    var ansText = q.t === 'judge' ? (String(q.a) === 'A' ? '正确（A）' : '错误（B）') : String(q.a)
    fb.innerHTML = '<b>' + (ok ? '答对' : '答错') + '</b>　正确答案：' + esc(ansText) +
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
    var mp = currentProgram()
    var on = s ? subjectActive(s.id) : false
    var ky = kyOnlyPlan()
    $('meSubj').textContent = s ? ((subjectGroup(s) === 'kaoyan' && mp ? mp.school + ' ' + mp.code + ' · ' : '') + s.name) : '—'
    $('meStatus').textContent = on ? (S.auth && S.auth.expireAt ? '体验中' : (daysLeft() <= 7 ? '已开通 · 即将到期' : '已开通')) : (S.auth ? '当前科目未开通' : '试看中')
    $('meExpire').textContent = S.auth ? (S.auth.expireAt ? fmtDateTime(S.auth.expireAt) + '（' + planText(S.auth.plan) + '，体验授权，' + authLeftText() + '）' : S.auth.expire + '（' + planText(S.auth.plan) + '，' + authLeftText() + '）') : '—'
    $('meVer').textContent = (b && b.meta && b.meta.version) || '—'
    var isKySubj = subjectGroup(s) === 'kaoyan'
    if (ky || (isKySubj && on)) $('contactLine').textContent = CONFIG.CONTACT + '（考研 703：中药学、药理、分析化学均已上线）'
    else if (isKySubj) $('contactLine').textContent = CONFIG.CONTACT + '（考研 703 三科打包，开通码联系客服获取）'
    else $('contactLine').textContent = CONFIG.CONTACT + '（在线开通：单科 9.9 元，药理 / 炮制 / 鉴定 / 植物 / 解剖生理 / 中药化学任选；全科 29.9 元）'
    $('logoutBtn').hidden = !isActive()
    if (CONFIG.BUY_URL && !ky && subjectGroup(s) !== 'kaoyan') { $('buyLink').hidden = false; $('buyLink').href = CONFIG.BUY_URL }
    else { $('buyLink').hidden = true }
    $('cTotal').textContent = totalQ()
    $('cCards').textContent = totalC()
    if (isActive() && S.auth.expireAt) {
      $('topBanner').hidden = false
      $('topBanner').textContent = '考研 703 中药学体验授权至 ' + fmtDateTime(S.auth.expireAt) + '（' + authLeftText() + '），到期后可用长久开通码继续。'
    } else if (isActive() && daysLeft() <= 7 && daysLeft() >= 0) {
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
    if ($('subjSwitch')) $('subjSwitch').onclick = openSheet
    if ($('ssClose')) $('ssClose').onclick = closeSheet
    if ($('ssMask')) {
      $('ssMask').onclick = function (e) { if (e.target === $('ssMask')) closeSheet() }
    }
    if ($('ssTabs')) {
      $('ssTabs').onclick = function (e) {
        var b = e.target.closest('[data-dir]'); if (!b) return
        sheet.dir = b.dataset.dir; renderSheet()
      }
    }
    if ($('ssBody')) {
      $('ssBody').onclick = function (e) {
        var r = e.target.closest('[data-subj]'); if (!r) return
        if (r.classList.contains('pending')) { $('ssNote').textContent = '这一科资料还在整理，录入后自动开放。'; return }
        pickSubject(r.dataset.subj); closeSheet()
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
      var rt = e.target.closest('[data-retry-subj]')
      if (rt) { e.preventDefault(); retryCurrentSubject(); return }
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
      if (e.key === 'Escape' && $('ssMask') && !$('ssMask').hidden) { closeSheet(); return }
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
        S.qmode = b.dataset.mode
        lsSet(LS.mode, S.qmode)
        syncModeUI()
        renderUnits()
      }
    }
    if ($('qaAllBtn')) {
      $('qaAllBtn').onclick = function () {
        var items = qaAllItems()
        if (!items.length) { toast('本科目暂无简答/论述题，后续补充中'); return }
        openQueue(items, '全部简答 · ' + (subj() ? subj().name : ''), 'qa')
        window.scrollTo(0, 0)
      }
    }
    $('unitList').onclick = function (e) {
      var rt = e.target.closest('[data-retry-subj]')
      if (rt) { e.preventDefault(); retryCurrentSubject(); return }
      var u = e.target.closest('.unit'); if (!u) return
      var id = u.dataset.unit
      if (!subjectActive(subjId()) && freeUnits().indexOf(id) < 0) { go('me'); toast('这一科还没开通，下方可选单科或全科'); return }
      var items = modeItems(id)
      if (!items.length && !subjReady(subjId())) {
        toast('资料加载中，马上进入…')
        decryptFull().then(function (ok) {
          refreshAll()
          var again = modeItems(id)
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
    $('showAns').onclick = function () {
      var ans = $('qAns')
      ans.hidden = !ans.hidden
      if (S.qmode === 'qa') {
        var ev = $('qaEval')
        if (ev) ev.hidden = ans.hidden
        this.textContent = ans.hidden ? '查看参考答案' : '收起参考答案'
      }
    }
    if ($('qaEval')) {
      $('qaEval').onclick = function (e) {
        var b = e.target.closest('[data-eval]'); if (!b) return
        var q = S.queue[S.qi]; if (!q) return
        var m = evalMap(), sid = subjId()
        m[sid] = m[sid] || {}
        m[sid][q.id] = b.dataset.eval
        lsSet(LS.qa, m)
        paintEval(b.dataset.eval)
        toast(b.dataset.eval === 'know' ? '已记为「会了」' : '已记为「再练一遍」，稍后可回来重做')
      }
    }
    if ($('qaDraft')) {
      $('qaDraft').oninput = function () {
        var q = S.queue[S.qi]; if (!q) return
        var m = draftMap(), sid = subjId()
        m[sid] = m[sid] || {}
        m[sid][q.id] = this.value
        lsSet(LS.qaDraft, m)
      }
    }
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
        var isTrial = !!(r.auth && r.auth.expireAt)
        if (isTrial && isActive() && S.auth && !S.auth.expireAt) {
          toast('当前已是长久授权，无需使用体验码')
          return
        }
        var oldPlan = isActive() ? planOf(S.auth) : []
        var newPlan = planOf(r.auth)
        var merged = 'all'
        var allIds = ['yaoli', 'paozhi', 'jianding', 'zhiwu', 'jiepou', 'zhx', 'fangji']
        if (isTrial) {
          merged = newPlan
          S.auth = r.auth
        } else {
          if (!(r.auth.plan === 'all' || (S.auth && S.auth.plan === 'all'))) {
            var both = oldPlan.concat(newPlan)
            var uniq = []
            both.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x) })
            merged = allIds.every(function (x) { return uniq.indexOf(x) >= 0 }) ? 'all' : uniq
          }
          var exp = (S.auth && S.auth.expire > r.auth.expire) ? S.auth.expire : r.auth.expire
          S.auth = { code: r.auth.code, expire: exp, plan: merged }
        }
        lsSet(LS.auth, S.auth)
        if (merged !== 'all' && merged.indexOf(subjId()) < 0) pickSubject(merged[0])
        var kyPlan = merged !== 'all' && planIsKy(merged)
        toast(isTrial ? '体验已开通：考研 703 中药学 2 小时' : '已开通：' + planText(merged) + '，正在加载资料…')
        renderSubjChips(); refreshAll()
        if (kyPlan && !isTrial) { openSheet(); sheet.dir = 'kaoyan'; renderSheet() }
        if (kyPlan && !hasKyData()) {
          toast(planText(merged) + '已开通，资料录入后自动出现在选择面板')
          return
        }
        decryptFull().then(function (ok) {
          if (!ok) toast('资料解密失败，请刷新页面重试')
          else if (kyPlan) toast(isTrial ? '考研 703 中药学 2 小时体验已开启' : '考研 703 已开通：中药学、药理、分析化学')
          else toast('已解锁' + planText(merged) + '：' + totalQ() + ' 题、' + totalC() + ' 张卡')
          renderSubjChips(); refreshAll()
        })
      })
    }
    $('logoutBtn').onclick = function () {
      if (!confirm('清除本机授权？清除后回到试看版，需要重新输入开通码。')) return
      S.auth = null; localStorage.removeItem(LS.auth); S.full = null; S.partial = {}; S.fullKeys = null; S.loadingSubj = {}; S.fullLoading = null
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
    renderSubjChips(); renderGroups(); renderKb(); renderUnits(); renderMe()
  }

  /* ---------- 启动 ---------- */
  function showBootError() {
    S.bootError = true
    if ($('ssMeta')) $('ssMeta').textContent = '科目清单加载失败'
    $('chapList').innerHTML = '<div class="mock">科目清单没有加载成功。<br><button class="ghost" id="retryBoot" type="button">重新加载</button>' +
      '<p class="hint">已自动尝试 3 次；可检查网络后重试，不用一直刷新。</p></div>'
    $('kbGate').hidden = true
    var b = $('retryBoot')
    if (b) b.onclick = function () {
      S.bootError = false
      delete S.loadProgress.manifest
      refreshAll()
      loadManifest().then(function () { initData(S.data) }).catch(showBootError)
    }
  }
  function initData(d) {
    S.data = normalize(d)
    S.subj = ls(LS.subj, S.data.default || '') || ''
    if (!findSubject(S.subj)) S.subj = S.data.default || ''
    if (!subj()) S.subj = S.data.default || ''
    if (S.subj !== subjId()) S.subj = subjId()
    S.auth = ls(LS.auth, null)
    var savedMode = ls(LS.mode, 'quiz')
    S.qmode = (savedMode === 'recite' || savedMode === 'qa') ? savedMode : 'quiz'
    S.shuffle = !!ls(LS.shuffle, false)
    if (isActive()) {
      var plan = planOf(S.auth)
      if (plan.length && !subjectActive(S.subj)) { S.subj = plan[0]; lsSet(LS.subj, S.subj) }
    }
    if (!S.bound) { bind(); S.bound = true }
    var s0 = subj()
    if ($('upd')) $('upd').textContent = (s0 && s0.updatedAt) ? '资料更新 ' + s0.updatedAt : ''
    renderSubjChips()
    refreshAll()
    setTimeout(function () { renderSubjChips() }, 400)
    if (kyOnlyPlan() && !hasKyData()) setTimeout(function () { openSheet(); sheet.dir = 'kaoyan'; renderSheet() }, 700)
    if (isActive()) {
      decryptFull().then(function (ok) {
        if (!ok) S.subjError[subjId()] = true
        refreshAll()
      })
    } else {
      loadTrialSubject(subjId()).then(function () { refreshAll() })
    }
  }
  function boot() {
    $('ver').textContent = window.__BHJ_EMBED ? '1.0·离线版' : '1.0'
    if (window.__BHJ_EMBED && window.__BHJ_EMBED.trial) {
      var embedded = normalize(window.__BHJ_EMBED.trial)
      embedded.subjects.forEach(function (s) { S.trialLoaded[s.id] = true })
      initData(embedded)
      return
    }
    loadManifest().then(function () { initData(S.data) }).catch(showBootError)
  }

  document.addEventListener('DOMContentLoaded', boot)
})()
