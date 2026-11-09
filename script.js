/* QRPoint: local-first QR generator. Only anonymous event names are ever eligible for future analytics. */

/* ============================================================
   ANALYTICS TRACKING
   Sends anonymous usage events to the same Google Apps Script
   Web App that powers analysis.html/analysis.js. This is the
   only analytics logic in the file — QR generation itself is
   never altered by it, and every call below is fire-and-forget
   so it can never block or slow down the generator UI.

   Backend contract (see Code.gs "action":"track"):
     { action:"track", event:"visitor", ts }               -> Visitors+1, PageViews+1 on today's row
     { action:"track", event:"pageview", ts }               -> PageViews+1
     { action:"track", event:"generate", qrType, count, ts }-> QRGenerated+count, <qrType>+count
     { action:"track", event:"download", downloadType, ts } -> <downloadType>Downloads+1
   ============================================================ */
const QP_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby8WjKxINGFwrURBmbtNkpE6R6W_rMpkoLPQ42rdg61jkZQOTHEE4mKu_Zex-QRbIprDg/exec";

/* Maps script.js's internal lowercase type keys to the exact DailyStats column names. */
const QP_TYPE_TO_COLUMN = {
    url: 'URL', text: 'Text', wifi: 'WiFi', vcard: 'vCard', email: 'Email',
    phone: 'Phone', sms: 'SMS', whatsapp: 'WhatsApp', map: 'Location',
    social: 'SocialMedia', event: 'Event', youtube: 'YouTube',
    instagram: 'Instagram', app: 'AppLinks'
};

function qpTrack(payload) {
    if (!QP_APPS_SCRIPT_URL) return;
    try {
        fetch(QP_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight against Apps Script
            body: JSON.stringify(Object.assign({ action: 'track', ts: Date.now() }, payload)),
            keepalive: true
        }).catch(() => {});
    } catch (e) {}
}

/* One "visitor" event per browser session (sessionStorage-scoped), every subsequent
   page load in the same session is a "pageview" only. Never fires for analysis.html,
   since that page does not load this script. */
function qpTrackPageview() {
    let sid = null;
    try { sid = sessionStorage.getItem('qp_session_id'); } catch (e) {}
    const isNewSession = !sid;
    if (isNewSession) {
        sid = Date.now().toString(36) + Math.random().toString(36).slice(2);
        try { sessionStorage.setItem('qp_session_id', sid); } catch (e) {}
    }
    qpTrack({ event: isNewSession ? 'visitor' : 'pageview' });
}

function qpTrackGeneration(qrType, count) {
    const column = QP_TYPE_TO_COLUMN[qrType];
    if (!column) return;
    qpTrack({ event: 'generate', qrType: column, count: count || 1 });
}

const qpRecentDownloads = {};
function qpTrackDownload(kind, name) {
    const downloadType = { png: 'png', svg: 'svg', pdf: 'pdf' }[kind];
    if (!downloadType) return;
    // Guard against a single click firing twice (double-click, fast repeat taps)
    // without disabling the button or delaying the actual download.
    const key = kind + '::' + name;
    const now = Date.now();
    if (qpRecentDownloads[key] && now - qpRecentDownloads[key] < 1200) return;
    qpRecentDownloads[key] = now;
    qpTrack({ event: 'download', downloadType });
}

document.addEventListener('DOMContentLoaded', qpTrackPageview);

const qpTypes = [
    ['url', '&#8599;', 'URL / Link', 'Create a QR code for any website or link.', 'link website url'],
    ['text', 'T', 'Text', 'Share a note, message or multiple values.', 'message note batch'],
    ['wifi', 'Wi', 'Wi-Fi', 'Share Wi-Fi access instantly.', 'wifi network'],
    ['vcard', 'ID', 'vCard', 'Share contact information.', 'contact card person'],
    ['email', '@', 'Email', 'Open a pre-filled email message.', 'mail'],
    ['phone', 'TEL', 'Phone', 'Start a call with one scan.', 'call'],
    ['sms', 'SMS', 'SMS', 'Start a text message.', 'message text'],
    ['whatsapp', 'WA', 'WhatsApp', 'Start a WhatsApp chat.', 'chat'],
    ['map', 'LOC', 'Location / Map', 'Share a place or map location.', 'location maps address'],
    ['social', 'SOC', 'Social media', 'Link to a social profile.', 'social profile'],
    ['event', 'EVT', 'Event', 'Share an event with calendar details.', 'calendar meeting'],
    ['youtube', 'YT', 'YouTube', 'Link straight to a video or channel.', 'video'],
    ['instagram', 'IG', 'Instagram', 'Link to an Instagram profile.', 'social insta'],
    ['app', 'APP', 'App links', 'Send people to an app store listing.', 'google play app store']
];
const templates = {
    classic: {
        dots: 'square',
        corners: 'square',
        eyes: 'square'
    },
    minimal: {
        dots: 'dots',
        corners: 'dot',
        eyes: 'dot'
    },
    modern: {
        dots: 'rounded',
        corners: 'extra-rounded',
        eyes: 'dot'
    },
    business: {
        dots: 'classy',
        corners: 'classy',
        eyes: 'square'
    },
    social: {
        dots: 'dots',
        corners: 'extra-rounded',
        eyes: 'dot'
    },
    event: {
        dots: 'rounded',
        corners: 'square',
        eyes: 'dot'
    },
    elegant: {
        dots: 'classy-rounded',
        corners: 'extra-rounded',
        eyes: 'dot'
    },
    bold: {
        dots: 'classy',
        corners: 'classy',
        eyes: 'square'
    }
};
const formFields = {
    url: '<label class="label" for="q-url">Website link</label><textarea id="q-url" placeholder="https://example.com"></textarea><p class="helper">Enter one link per line to generate a batch.</p>',
    text: '<label class="label" for="q-text">Text to encode</label><textarea id="q-text" placeholder="Write a message..."></textarea><p class="helper">Enter one value per line to generate a batch.</p>',
    wifi: '<div class="input-grid"><div><label class="label" for="q-ssid">Network name (SSID)</label><input id="q-ssid" autocomplete="off" placeholder="Home_WiFi"></div><div><label class="label" for="q-pass">Password</label><input id="q-pass" type="password" autocomplete="new-password" placeholder="Password"></div></div><label class="label" for="q-security">Security type</label><select id="q-security"><option value="WPA">WPA / WPA2</option><option value="WEP">WEP</option><option value="nopass">No password</option></select>',
    vcard: '<div class="input-grid"><div><label class="label" for="q-name">Full name</label><input id="q-name" autocomplete="name" placeholder="Alex Morgan"></div><div><label class="label" for="q-phone">Phone</label><input id="q-phone" type="tel" autocomplete="tel" placeholder="+1 555 0100"></div><div><label class="label" for="q-email">Email</label><input id="q-email" type="email" autocomplete="email" placeholder="alex@example.com"></div><div><label class="label" for="q-company">Company</label><input id="q-company" autocomplete="organization" placeholder="Company name"></div></div><label class="label" for="q-site">Website</label><input id="q-site" type="url" placeholder="https://example.com">',
    email: '<label class="label" for="q-email">Email address</label><input id="q-email" type="email" autocomplete="email" placeholder="hello@example.com"><div class="input-grid"><div><label class="label" for="q-subject">Subject</label><input id="q-subject" placeholder="Hello"></div><div><label class="label" for="q-body">Message</label><input id="q-body" placeholder="Your message"></div></div>',
    phone: '<label class="label" for="q-phone">Phone number</label><input id="q-phone" type="tel" autocomplete="tel" placeholder="+1 555 0100">',
    sms: '<div class="input-grid"><div><label class="label" for="q-phone">Phone number</label><input id="q-phone" type="tel" autocomplete="tel" placeholder="+1 555 0100"></div><div><label class="label" for="q-body">Message</label><input id="q-body" placeholder="Hello"></div></div>',
    whatsapp: '<div class="input-grid"><div><label class="label" for="q-phone">WhatsApp number</label><input id="q-phone" type="tel" autocomplete="tel" placeholder="15550100"></div><div><label class="label" for="q-body">Pre-filled message</label><input id="q-body" placeholder="Hello"></div></div>',
    map: '<label class="label" for="q-map">Place, address, or map URL</label><input id="q-map" placeholder="Eiffel Tower, Paris">',
    social: '<label class="label" for="q-social">Profile URL</label><input id="q-social" type="url" placeholder="https://social.example/your-name">',
    event: '<div class="input-grid"><div><label class="label" for="q-event">Event title</label><input id="q-event" placeholder="Team meetup"></div><div><label class="label" for="q-location">Location</label><input id="q-location" placeholder="Main hall"></div><div><label class="label" for="q-start">Starts</label><input id="q-start" type="datetime-local"></div><div><label class="label" for="q-end">Ends</label><input id="q-end" type="datetime-local"></div></div><label class="label" for="q-desc">Description</label><input id="q-desc" placeholder="Optional details">',
    youtube: '<label class="label" for="q-youtube">YouTube video or channel URL</label><input id="q-youtube" type="url" placeholder="https://youtube.com/...">',
    instagram: '<label class="label" for="q-instagram">Instagram profile URL or handle</label><input id="q-instagram" placeholder="https://instagram.com/yourname">',
    app: '<label class="label" for="q-app">App Store or Google Play URL</label><input id="q-app" type="url" placeholder="https://play.google.com/...">'
};
const $ = id => document.getElementById(id),
    val = id => ($(id)?.value || '').trim(),
    esc = s => s.replace(/([\\;,:])/g, '\\$1');
document.addEventListener('DOMContentLoaded', () => location.pathname.includes('generate.html') ? initResult() : initHome());

function initHome() {
    /* Customization (color/background/logo/template) always starts from the
       same hard defaults on every visit to index.html — including the return
       trip from generate.html via Back or "Generate another QR". Nothing here
       is read from storage, so there is no channel for a previous customized
       generation to leak into a later normal "Generate QR" or into the
       customizer's starting appearance. The QR type and its entered field
       values are a separate, intentional convenience and are unaffected. */
    let type = sessionStorage.getItem('qp_type') || 'url',
        logo = '',
        qrColor = '#172033',
        bgColor = '#ffffff',
        template = 'classic';
    const grid = $('typeGrid'),
        form = $('formArea');

    function drawTypes(query = '') {
        const q = query.toLowerCase();
        grid.innerHTML = '';
        qpTypes.filter(t => t.join(' ').toLowerCase().includes(q)).forEach(t => {
            let c = document.createElement('button');
            c.type = 'button';
            c.className = 'type-card ' + (t[0] === type ? 'active' : '');
            c.setAttribute('aria-pressed', String(t[0] === type));
            c.setAttribute('aria-label', t[2]);
            c.dataset.type = t[0];
            c.innerHTML = `<b>${t[1]}</b><span class="type-card-title">${t[2]}</span>`;
            c.title = t[2] + ' — ' + t[3];
            c.onclick = () => {
                type = t[0];
                drawTypes($('typeSearch').value);
                drawForm()
            };
            grid.append(c)
        });
        $('emptyTypes').classList.toggle('hidden', grid.children.length > 0)
    }

    function drawForm() {
        let t = qpTypes.find(x => x[0] === type);
        form.innerHTML = `<div class="form-title"><span class="form-icon">${t[1]}</span><div><h2>${t[2]} QR</h2><p>${t[3]}</p></div></div><div class="type-form">${formFields[type]}</div><p id="formError" class="field-error" role="alert"></p>`;
        let saved = sessionStorage.getItem('qp_fields');
        if (saved) {
            try {
                Object.entries(JSON.parse(saved)).forEach(([id, v]) => {
                    if ($(id)) $(id).value = v
                })
            } catch (e) {}
        }
    }

    function drawTemplates() {
        let row = $('templateRow');
        row.innerHTML = '';
        Object.keys(templates).forEach(k => {
            let b = document.createElement('button');
            b.type = 'button';
            b.className = 'template-card ' + (k === template ? 'active' : '');
            b.setAttribute('aria-pressed', String(k === template));
            b.innerHTML = `<i class="template-preview ${k}" aria-hidden="true">&#9638;</i><span>${k}</span>`;
            b.onclick = () => {
                template = k;
                drawTemplates()
            };
            row.append(b)
        })
    }
    drawTypes();
    drawForm();
    drawTemplates();
    if (window.QRCodeStyling && $('heroQr')) {
        new QRCodeStyling({
            width: 280,
            height: 280,
            type: 'svg',
            data: 'https://qrmade.vercel.app/',
            margin: 12,
            qrOptions: { errorCorrectionLevel: 'M' },
            dotsOptions: { color: '#111111', type: 'square' },
            cornersSquareOptions: { color: '#111111', type: 'square' },
            cornersDotOptions: { color: '#111111', type: 'square' },
            backgroundOptions: { color: '#ffffff' }
        }).append($('heroQr'));
    }
    $('typeSearch').oninput = e => drawTypes(e.target.value);
    $('menuButton').onclick = () => {
        let open = $('navLinks').classList.toggle('open');
        $('menuButton').setAttribute('aria-expanded', open)
    };

    function swatches(container, set) {
        $(container).querySelectorAll('.swatch').forEach(b => b.onclick = () => {
            set(b.dataset.color);
            $(container).querySelectorAll('.swatch').forEach(x => {
                x.classList.toggle('active', x === b);
                x.setAttribute('aria-pressed', String(x === b));
            });
            contrast()
        })
    }
    swatches('qrColorContainer', v => qrColor = v);
    swatches('bgColorContainer', v => bgColor = v);
    $('customQrColor').value = qrColor;
    $('customBgColor').value = bgColor;
    $('customQrColor').oninput = e => {
        qrColor = e.target.value;
        $('qrColorContainer').querySelectorAll('.swatch').forEach(b => {
            const selected = b.dataset.color === qrColor;
            b.classList.toggle('active', selected);
            b.setAttribute('aria-pressed', String(selected));
        });
        contrast()
    };
    $('customBgColor').oninput = e => {
        bgColor = e.target.value;
        $('bgColorContainer').querySelectorAll('.swatch').forEach(b => {
            const selected = b.dataset.color === bgColor;
            b.classList.toggle('active', selected);
            b.setAttribute('aria-pressed', String(selected));
        });
        contrast()
    };

    function contrast() {
        let bad = bgColor === 'transparent' || Math.abs(parseInt(qrColor.slice(1), 16) - parseInt(bgColor.slice(1), 16)) < 2500000;
        $('contrastNote').textContent = bad ? 'Tip: use a strong contrast between the QR and background for easy scanning.' : ''
    }
    contrast();
    $('logoDropzone').onclick = () => $('input-logo').click();
    $('input-logo').onchange = e => {
        let f = e.target.files[0];
        if (!f) return;
        if (f.size > 3 * 1024 * 1024) {
            alert('Please use a logo under 3 MB.');
            return
        }
        let r = new FileReader;
        r.onload = () => {
            logo = r.result;
            $('logoPreviewImg').src = logo;
            $('logoPreviewName').textContent = f.name;
            $('logoPreviewWrapper').style.display = 'flex';
            $('logoDropzone').style.display = 'none';
            $('errorCorrection').value = 'H'
        };
        r.readAsDataURL(f)
    };
    $('removeLogoBtn').onclick = () => {
        logo = '';
        $('input-logo').value = '';
        $('logoPreviewWrapper').style.display = 'none';
        $('logoDropzone').style.display = 'block'
    };
    /* Default (plain) settings used by the primary "Generate QR" path — a normal
       black-on-white QR, regardless of anything chosen in the (hidden) customizer. */
    const QP_DEFAULT_QR = {
        color: '#172033',
        bg: '#ffffff',
        logo: '',
        template: 'classic',
        size: '1000',
        ec: 'H',
        margin: '10',
        caption: '',
        logoSize: '24'
    };

    function goGenerate(useCustom, button) {
        let data = buildData(type);
        if (!data) {
            $('formError').textContent = 'Please complete the required field to generate your QR.';
            return
        }
        let fields = {};
        form.querySelectorAll('input,textarea,select').forEach(i => fields[i.id] = i.value);
        let settings = Object.assign({ type, data, fields }, useCustom ? {
            color: qrColor,
            bg: bgColor,
            logo,
            template,
            size: val('qrSize'),
            ec: val('errorCorrection'),
            margin: val('qrMargin'),
            caption: val('qrBranding'),
            logoSize: val('logoSize')
        } : QP_DEFAULT_QR, { genId: Date.now().toString(36) + Math.random().toString(36).slice(2) });
        sessionStorage.setItem('qp_settings', JSON.stringify(settings));
        sessionStorage.setItem('qp_type', type);
        sessionStorage.setItem('qp_fields', JSON.stringify(fields));
        saveHistory(settings);
        let label = button.querySelector('span');
        button.disabled = true;
        button.classList.add('is-generating');
        label.textContent = 'Generating…';
        document.body.classList.add('page-leaving');
        setTimeout(() => location.href = 'generate.html', 360)
    }
    $('continueBtn').onclick = () => goGenerate(false, $('continueBtn'));
    $('generateCustomBtn').onclick = () => goGenerate(true, $('generateCustomBtn'));

    $('customizeToggleBtn').onclick = () => {
        let btn = $('customizeToggleBtn'),
            wrap = $('customizerWrap'),
            open = !wrap.classList.contains('open');
        wrap.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open);
        btn.classList.toggle('is-open', open);
        if (open) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    };

    function buildData(t) {
        let d = '';
        if (t === 'url' || t === 'text') d = val(t === 'url' ? 'q-url' : 'q-text');
        else if (t === 'wifi') {
            let s = val('q-ssid');
            d = s ? `WIFI:S:${esc(s)};T:${val('q-security')};P:${val('q-security')==='nopass'?'':esc(val('q-pass'))};;` : ''
        } else if (t === 'vcard') {
            let n = val('q-name');
            d = n ? `BEGIN:VCARD\nVERSION:3.0\nFN:${n}\nTEL:${val('q-phone')}\nEMAIL:${val('q-email')}\nORG:${val('q-company')}\nURL:${val('q-site')}\nEND:VCARD` : ''
        } else if (t === 'email') d = val('q-email') && `mailto:${val('q-email')}?subject=${encodeURIComponent(val('q-subject'))}&body=${encodeURIComponent(val('q-body'))}`;
        else if (t === 'phone') d = val('q-phone') && `tel:${val('q-phone')}`;
        else if (t === 'sms') d = val('q-phone') && `sms:${val('q-phone')}?body=${encodeURIComponent(val('q-body'))}`;
        else if (t === 'whatsapp') d = val('q-phone') && `https://wa.me/${val('q-phone').replace(/\D/g,'')}?text=${encodeURIComponent(val('q-body'))}`;
        else if (t === 'map') {
            let m = val('q-map');
            d = m && (m.startsWith('http') ? m : `https://maps.google.com/?q=${encodeURIComponent(m)}`)
        } else if (t === 'event') {
            let n = val('q-event');
            d = n ? `BEGIN:VEVENT\nSUMMARY:${n}\nLOCATION:${val('q-location')}\nDTSTART:${val('q-start').replace(/[-:]/g,'').replace('T','T')}\nDTEND:${val('q-end').replace(/[-:]/g,'').replace('T','T')}\nDESCRIPTION:${val('q-desc')}\nEND:VEVENT` : ''
        } else {
            let id = {
                social: 'q-social',
                youtube: 'q-youtube',
                instagram: 'q-instagram',
                app: 'q-app'
            } [t];
            d = val(id);
            if (t === 'instagram' && d && !d.startsWith('http')) d = 'https://instagram.com/' + d.replace('@', '')
        }
        return d
    }
    renderHistory();
    $('clearHistoryBtn').onclick = () => {
        localStorage.removeItem('qrpoint_history');
        renderHistory()
    };

    function saveHistory(s) {
        let h = JSON.parse(localStorage.getItem('qrpoint_history') || '[]');
        h.unshift({
            type: s.type,
            data: s.data.slice(0, 120),
            date: new Date().toLocaleDateString(),
            settings: s
        });
        localStorage.setItem('qrpoint_history', JSON.stringify(h.slice(0, 8)))
    }

    function renderHistory() {
        let h = JSON.parse(localStorage.getItem('qrpoint_history') || '[]');
        $('historyList').innerHTML = h.length ? h.map((x, i) => `<button type="button" data-i="${i}"><b>${qpTypes.find(t=>t[0]===x.type)[2]}</b><span>${x.data}</span><small>${x.date}</small></button>`).join('') : '<p class="empty-state">No saved QR codes yet.</p>';
        $('historyList').querySelectorAll('button').forEach(b => b.onclick = () => {
            let x = h[b.dataset.i];
            sessionStorage.setItem('qp_settings', JSON.stringify(x.settings));
            location.href = 'generate.html'
        })
    }
}

function initResult() {
    let s;
    try {
        s = JSON.parse(sessionStorage.getItem('qp_settings'))
    } catch (e) {}
    if (!s?.data) {
        location.href = 'index.html';
        return
    }
    if (!window.QRCodeStyling) {
        $('status').textContent = 'QR code could not be loaded';
        $('resultSubtitle').textContent = 'Check your connection, then return to the editor and try again.';
        $('singleResult').classList.add('hidden');
        return
    }
    $('resultType').textContent = qpTypes.find(t => t[0] === s.type)[2];
    $('resultData').textContent = s.data;
    let items = (s.type === 'url' || s.type === 'text') ? s.data.split('\n').map(x => x.trim()).filter(Boolean) : [s.data],
        batch = items.length > 1;
    let instances = [];

    /* Track the generation event exactly once per genId, so a page refresh
       or browser back/forward on generate.html never double-counts. */
    (function trackGenerationOnce() {
        let lastId = null;
        try { lastId = sessionStorage.getItem('qp_last_tracked_gen'); } catch (e) {}
        if (s.genId && s.genId !== lastId) {
            qpTrackGeneration(s.type, items.length);
            try { sessionStorage.setItem('qp_last_tracked_gen', s.genId); } catch (e) {}
        }
    })();

    function opt(data) {
        let t = templates[s.template] || templates.classic,
            bg = s.bg === 'transparent' ? 'rgba(255,255,255,0)' : s.bg;
        return {
            width: +s.size || 1000,
            height: +s.size || 1000,
            type: 'svg',
            data,
            image: s.logo || '',
            margin: +s.margin || 10,
            qrOptions: {
                errorCorrectionLevel: s.ec || 'H'
            },
            imageOptions: {
                hideBackgroundDots: true,
                imageSize: Math.min(.32, (+s.logoSize || 24) / 100),
                margin: 8,
                crossOrigin: 'anonymous'
            },
            dotsOptions: {
                color: s.color,
                type: t.dots
            },
            backgroundOptions: {
                color: bg
            },
            cornersSquareOptions: {
                color: s.color,
                type: t.corners
            },
            cornersDotOptions: {
                color: s.color,
                type: t.eyes
            }
        }
    }

    function make(data, box) {
        let q = new QRCodeStyling(opt(data));
        q.append(box);
        let svg = box.querySelector('svg');
        if (svg) {
            let w = svg.getAttribute('width');
            svg.setAttribute('viewBox', `0 0 ${w} ${w}`);
            svg.removeAttribute('width');
            svg.removeAttribute('height')
        }
        return q
    }
    if (batch) {
        $('singleResult').classList.add('hidden');
        $('batchResult').classList.remove('hidden');
        items.forEach((x, i) => {
            let card = document.createElement('article');
            card.className = 'batch-card';
            card.innerHTML = `<div class="batch-qr" role="img" aria-label="QR code ${i + 1}"></div><p>${x}</p><div class="batch-actions"><button type="button" aria-label="Download QR ${i + 1} as PNG">PNG</button><button type="button" aria-label="Download QR ${i + 1} as SVG">SVG</button><button type="button" aria-label="Download QR ${i + 1} as PDF">PDF</button></div>`;
            $('batchGrid').append(card);
            let q = make(x, card.querySelector('.batch-qr'));
            instances.push(q);
            card.querySelectorAll('button').forEach((b, n) => b.onclick = () => download(q, ['png', 'svg', 'pdf'][n], `qrpoint-${i+1}`))
        });
        $('downloadAll').onclick = () => alert('Download All needs an optional ZIP library. Individual PNG, SVG and PDF downloads are available below.')
    } else {
        let q = make(s.data, $('qrContainer'));
        instances = [q];
        $('caption').textContent = s.caption || '';
        $('caption').classList.toggle('has-text', !!s.caption);
        ['png', 'svg', 'pdf'].forEach(x => $('download' + x.toUpperCase()).onclick = () => download(q, x, 'qrpoint-code'));
        $('shareQR').onclick = async () => {
            try {
                if (navigator.share) {
                    const blob = await q.getRawData('png');
                    const file = new File([blob], 'qrmade-qr.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'QRMade QR code' });
                        toast('QR code shared');
                    } else {
                        await navigator.share({ title: 'QR code', text: s.data });
                    }
                } else if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(s.data);
                    toast('QR content copied');
                } else {
                    toast('Sharing is not supported in this browser');
                }
            } catch (error) {
                if (error.name !== 'AbortError') toast('Could not share this QR code');
            }
        };
    }
    $('status').textContent = batch ? `${items.length} QR codes ready` : 'Your QR is ready';
    requestAnimationFrame(() => document.body.classList.add('result-ready'));

    function download(q, kind, name) {
        if (kind !== 'pdf') {
            try {
                q.download({ name, extension: kind });
                qpTrackDownload(kind, name);
                toast('Download started');
            } catch (error) {
                toast('Could not start the download');
            }
            return
        }
        if (!window.jspdf) {
            toast('PDF export is unavailable. Try PNG or SVG.');
            return
        }
        q.getRawData('png').then(blob => {
            let url = URL.createObjectURL(blob),
                im = new Image;
            im.onload = () => {
                let doc = new window.jspdf.jsPDF();
                doc.addImage(im, 'PNG', 55, 50, 100, 100);
                doc.save(name + '.pdf');
                URL.revokeObjectURL(url);
                qpTrackDownload(kind, name);
                toast('PDF downloaded')
            };
            im.src = url
        }).catch(() => toast('Could not create the PDF. Try PNG or SVG.'))
    }

    function toast(m) {
        $('toast').textContent = m;
        $('toast').classList.add('show');
        setTimeout(() => $('toast').classList.remove('show'), 2000)
    }
}
