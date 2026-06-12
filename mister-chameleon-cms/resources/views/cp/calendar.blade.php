@extends('statamic::layout')

@section('title', 'Contentkalender')

@section('content')

<div class="px-6 py-8">

{{-- ─── Page header ─────────────────────────────────────────────────────── --}}
<div class="flex items-center justify-between mb-8">

    {{-- Left: icon + title --}}
    <div class="flex items-center gap-3">
        <div class="h-8 w-8 flex items-center justify-center text-gray-500 dark:text-dark-200">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                 stroke-linejoin="round" class="w-8 h-8">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8"  y1="2" x2="8"  y2="6"/>
                <line x1="3"  y1="10" x2="21" y2="10"/>
            </svg>
        </div>
        <h1 class="text-3xl font-semibold text-gray-900 dark:text-white">
            Contentkalender
        </h1>
    </div>

    {{-- Right: collection legend --}}
    <div class="flex flex-wrap items-center gap-4 text-sm">
        @foreach($config as $handle => $cfg)
            <span class="flex items-center gap-1.5">
                <span class="inline-block w-3 h-3 rounded-full" style="background:{{ $cfg['color'] }}"></span>
                <span class="text-gray-600 dark:text-dark-150">{{ $cfg['label'] }}</span>
            </span>
        @endforeach
    </div>
</div>

{{--
    ─── Calendar container ───────────────────────────────────────────────────
    #cal-wrap is intentionally EMPTY in this Blade template (no children).
    Vue's virtual-DOM patcher skips children-patching when both the old and
    new vnode have zero children, so it will never touch the real DOM
    children of this element — meaning FullCalendar's injected DOM persists
    across every Vue reactive re-render without the need for v-pre.
    The <div id="calendar"> element is created dynamically in JS below.
--}}
<div id="cal-wrap" class="card p-4" style="min-height:632px;"></div>

{{-- ─── Schedule modal ────────────────────────────────────────────────────── --}}
{{--
    Allows picking an existing entry from any collection and scheduling it
    for publication by setting a date + time.  The entry stays as draft
    (unpublished) until the editor publishes it on that day.
--}}
<div id="sched-modal" class="fixed inset-0 z-50 hidden" role="dialog" aria-modal="true" aria-labelledby="sched-title">
    {{-- Backdrop --}}
    <div id="sched-backdrop" class="absolute inset-0 bg-black/50"></div>

    {{-- Panel --}}
    <div class="relative z-10 flex items-center justify-center min-h-full p-4">
        <div class="bg-white dark:bg-dark-800 rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 id="sched-title" class="text-lg font-semibold text-gray-800 dark:text-dark-100 mb-5">
                Entry inplannen
            </h2>

            <form id="sched-form" novalidate>

                {{-- 1. Collection selector --}}
                <div class="mb-4">
                    <label for="sched-collection" class="block text-sm font-medium text-gray-700 dark:text-dark-150 mb-1">
                        Collectie
                    </label>
                    <select id="sched-collection" name="collection"
                        class="w-full rounded border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-800 dark:text-dark-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        @foreach($config as $handle => $cfg)
                            <option value="{{ $handle }}">{{ $cfg['label'] }}</option>
                        @endforeach
                    </select>
                </div>

                {{-- 2. Entry picker --}}
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 dark:text-dark-150 mb-1">
                        Item kiezen
                    </label>
                    <div id="sched-entry-list"
                         class="border border-gray-300 dark:border-dark-600 rounded overflow-y-auto"
                         style="min-height:72px;max-height:196px;">
                        {{-- Populated dynamically by JS --}}
                    </div>
                    <p id="sched-entry-error" class="hidden mt-1 text-xs text-red-600">
                        Selecteer een entry om in te plannen.
                    </p>
                </div>

                {{-- 3. Date + time --}}
                <div class="mb-5 grid grid-cols-2 gap-3">
                    <div>
                        <label for="sched-date" class="block text-sm font-medium text-gray-700 dark:text-dark-150 mb-1">
                            Datum
                        </label>
                        <input type="date" id="sched-date" name="date" required
                            class="w-full rounded border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-800 dark:text-dark-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="sched-time" class="block text-sm font-medium text-gray-700 dark:text-dark-150 mb-1">
                            Tijd
                        </label>
                        <input type="time" id="sched-time" name="time"
                            class="w-full rounded border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-800 dark:text-dark-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                </div>

                {{-- Actions --}}
                <div class="flex justify-end gap-3">
                    <button type="button" id="sched-cancel" class="btn btn-flat">
                        Annuleren
                    </button>
                    <button type="submit" id="sched-submit" class="btn btn-primary">
                        Inplannen
                    </button>
                </div>
            </form>

            <div id="sched-feedback" class="hidden mt-3 text-sm"></div>
        </div>
    </div>
</div>

{{-- ─── Event detail popover ────────────────────────────────────────────── --}}
<div id="event-popover" class="fixed z-50 hidden bg-white dark:bg-dark-800 rounded-lg shadow-xl border border-gray-200 dark:border-dark-600 p-4 w-72">
    <p id="popover-title" class="font-semibold text-gray-800 dark:text-dark-100 mb-1 truncate"></p>
    <p id="popover-meta"  class="text-xs text-gray-500 dark:text-dark-300 mb-3"></p>
    <div class="flex gap-2">
        <a id="popover-edit" href="#" target="_blank"
            class="btn btn-sm btn-primary flex-1 text-center">
            Bewerken
        </a>
        <button id="popover-remove" type="button"
            class="btn btn-sm btn-flat text-red-600 hover:text-red-700 flex-1">
            Verwijderen
        </button>
    </div>
    <button id="popover-close" type="button"
        class="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
    </button>
</div>

</div>{{-- /px-6 py-8 wrapper --}}
@endsection

@push('head')
<style>
    /* FullCalendar custom variables mapped to Statamic CP palette */
    :root {
        --fc-border-color:          #e5e7eb;
        --fc-today-bg-color:        #eff6ff;
        --fc-event-border-color:    transparent;
        --fc-button-bg-color:       #6c7280;
        --fc-button-border-color:   #6c7280;
        --fc-button-hover-bg-color: #4b5563;
        --fc-button-active-bg-color:#374151;
    }
    .dark {
        --fc-border-color:          #374151;
        --fc-today-bg-color:        #1e3a5f;
        --fc-page-bg-color:         transparent;
        --fc-neutral-bg-color:      #1f2937;
        --fc-list-event-hover-bg-color: #374151;
    }

    #calendar { font-size: 0.875rem; }

    .fc-event {
        cursor: pointer;
        border-radius: 4px;
        font-size: 0.75rem;
        padding: 1px 4px;
    }
    .fc-event-title { font-weight: 500; }

    .fc-event.is-draft {
        opacity: 0.75;
        border: 1.5px dashed rgba(255,255,255,0.6) !important;
    }

    .fc-daygrid-day:hover { background: rgba(59,130,246,0.04); }

    .fc-daygrid-day-frame { position: relative; }
    .cal-add-btn {
        display: none;
        position: absolute;
        bottom: 4px; right: 4px;
        width: 20px; height: 20px;
        background: #3b82f6;
        color: #fff;
        border-radius: 50%;
        font-size: 14px;
        line-height: 20px;
        text-align: center;
        cursor: pointer;
        z-index: 10;
    }
    .fc-daygrid-day:hover .cal-add-btn { display: block; }

    /* Schedule modal — entry list rows */
    .entry-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f3f4f6;
        font-size: 0.875rem;
        color: #1f2937;
        transition: background 0.1s;
    }
    .entry-row:last-child { border-bottom: none; }
    .entry-row:hover      { background: #eff6ff; }
    .entry-row.selected   { background: #dbeafe; font-weight: 600; }

    .dark .entry-row       { color: #e5e7eb; border-bottom-color: #374151; }
    .dark .entry-row:hover { background: rgba(59,130,246,0.1); }
    .dark .entry-row.selected { background: rgba(59,130,246,0.18); }
</style>
@endpush

@section('scripts')
{{-- FullCalendar 6 (core + daygrid + timegrid + interaction) from jsDelivr --}}
<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>

<script>
(function () {
    'use strict';

    // ── Config passed from PHP ────────────────────────────────────────────────
    var COLLECTIONS = @json($config);

    // ── State ─────────────────────────────────────────────────────────────────
    var openPopoverEvent   = null;
    var calendar           = null;
    var reinitPending      = false;
    var selectedEntryId    = null;   // entry ID chosen in the schedule modal
    var selectedCollection = null;   // matching collection handle

    // ── Helpers ───────────────────────────────────────────────────────────────
    function $id(id) { return document.getElementById(id); }

    function csrf() {
        return (window.StatamicConfig && window.StatamicConfig.csrfToken)
            || (document.querySelector('meta[name="csrf-token"]') || {}).content
            || '';
    }

    function apiFetch(url, opts) {
        opts = opts || {};
        return fetch(url, {
            headers: Object.assign({
                'Content-Type': 'application/json',
                'Accept':       'application/json',
                'X-CSRF-TOKEN': csrf(),
            }, opts.headers || {}),
            method: opts.method || 'GET',
            body:   opts.body   || undefined,
        }).then(function (r) {
            if (!r.ok) {
                return r.json().catch(function () { return {}; }).then(function (body) {
                    throw new Error(body.error || ('HTTP ' + r.status));
                });
            }
            return r.json();
        });
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDateNL(isoStr) {
        var d = new Date(isoStr + (isoStr.length === 10 ? 'T00:00:00' : ''));
        return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // ── Popover ───────────────────────────────────────────────────────────────
    function showPopover(jsEvent, fcEvent) {
        openPopoverEvent = fcEvent;
        var p       = fcEvent.extendedProps;
        var popover = $id('event-popover');
        if (!popover) return;

        $id('popover-title').textContent = fcEvent.title;
        $id('popover-meta').textContent  = p.collectionLabel + ' · ' + formatDateNL(fcEvent.startStr)
                                           + ' · ' + (p.published ? 'Gepubliceerd' : 'Concept');
        $id('popover-edit').href         = p.editUrl;

        var x = Math.min(jsEvent.clientX + 8, window.innerWidth  - 300);
        var y = Math.min(jsEvent.clientY + 8, window.innerHeight - 160);
        popover.style.left = x + 'px';
        popover.style.top  = y + 'px';
        popover.classList.remove('hidden');
    }

    function hidePopover() {
        var popover = $id('event-popover');
        if (popover) popover.classList.add('hidden');
        openPopoverEvent = null;
    }

    // ── Schedule modal ─────────────────────────────────────────────────────────

    /** Render the entry list in its various states. */
    function renderEntryList(entries, state) {
        var list = $id('sched-entry-list');
        if (!list) return;

        if (state === 'loading') {
            list.innerHTML = '<div style="padding:16px;text-align:center;font-size:0.875rem;color:#9ca3af;font-style:italic;">Laden…</div>';
            return;
        }
        if (state === 'error') {
            list.innerHTML = '<div style="padding:16px;text-align:center;font-size:0.875rem;color:#ef4444;">Kon entries niet laden.</div>';
            return;
        }
        if (!entries || entries.length === 0) {
            list.innerHTML = '<div style="padding:16px;text-align:center;font-size:0.875rem;color:#9ca3af;font-style:italic;">Geen entries gevonden in deze collectie.</div>';
            return;
        }

        list.innerHTML = entries.map(function (entry) {
            var badge = entry.published
                ? '<span style="flex-shrink:0;font-size:0.7rem;padding:2px 6px;border-radius:4px;background:#d1fae5;color:#065f46;">Gepubliceerd</span>'
                : '<span style="flex-shrink:0;font-size:0.7rem;padding:2px 6px;border-radius:4px;background:#fef3c7;color:#92400e;">Concept</span>';
            return '<div class="entry-row" data-id="' + escHtml(entry.id) + '">'
                + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(entry.title) + '</span>'
                + badge
                + '</div>';
        }).join('');
    }

    /** Highlight the chosen entry row. */
    function selectEntry(id, collection) {
        selectedEntryId    = id;
        selectedCollection = collection;

        var list = $id('sched-entry-list');
        if (list) {
            var rows = list.querySelectorAll('.entry-row');
            for (var i = 0; i < rows.length; i++) {
                rows[i].classList.toggle('selected', rows[i].getAttribute('data-id') === id);
            }
        }

        var err = $id('sched-entry-error');
        if (err) err.classList.add('hidden');
    }

    /** Fetch entries for the given collection and populate the list. */
    function loadEntries(collection) {
        renderEntryList(null, 'loading');
        selectedEntryId    = null;
        selectedCollection = collection;
        apiFetch('/cp/calendar/entries/' + encodeURIComponent(collection))
            .then(function (data) { renderEntryList(data, 'list'); })
            .catch(function ()    { renderEntryList(null, 'error'); });
    }

    /** Open the schedule modal, pre-filled with the clicked date. */
    function openModal(dateStr) {
        var modal = $id('sched-modal');
        if (!modal) return;

        selectedEntryId    = null;
        selectedCollection = null;

        // Pre-fill date from the calendar cell that was clicked
        var dateInput = $id('sched-date');
        if (dateInput) dateInput.value = dateStr;

        // Default publish time = 09:00
        var timeInput = $id('sched-time');
        if (timeInput) timeInput.value = '09:00';

        // Clear validation / feedback
        var entryErr = $id('sched-entry-error');
        if (entryErr) entryErr.classList.add('hidden');
        var feedback = $id('sched-feedback');
        if (feedback) { feedback.textContent = ''; feedback.classList.add('hidden'); }

        // Reset entry list — user must first pick a collection
        renderEntryList(null, 'idle');

        modal.classList.remove('hidden');
    }

    function closeModal() {
        var modal = $id('sched-modal');
        if (modal) modal.classList.add('hidden');
    }

    // ── Event delegation on document (survives Vue remounts) ─────────────────
    //
    // Direct addEventListener on individual elements breaks when Vue remounts
    // the NonInertiaPage component (async API response → reactive state change →
    // component unmount + remount → fresh DOM, old listeners orphaned).
    // Delegating to document means listeners are registered once and always work.

    document.addEventListener('click', function (e) {
        if (!e.target) return;

        // Popover: close button
        if (e.target.closest && e.target.closest('#popover-close')) {
            hidePopover(); return;
        }

        // Popover: remove/clear date button
        if (e.target.closest && e.target.closest('#popover-remove') && openPopoverEvent) {
            var p   = openPopoverEvent.extendedProps;
            var eid = openPopoverEvent.id;
            var col = p.collection;
            hidePopover();
            apiFetch('/cp/calendar/entry/' + col + '/' + eid + '/date', { method: 'DELETE' })
                .then(function () { if (calendar) calendar.refetchEvents(); })
                .catch(function (err) { alert('Kon datum niet verwijderen: ' + err.message); });
            return;
        }

        // Schedule modal: cancel button or backdrop
        if ((e.target.closest && e.target.closest('#sched-cancel')) || e.target.id === 'sched-backdrop') {
            closeModal(); return;
        }

        // Schedule modal: entry row selection
        var entryRow = e.target.closest && e.target.closest('.entry-row');
        var entryList = $id('sched-entry-list');
        if (entryRow && entryList && entryList.contains(entryRow)) {
            var colSel = $id('sched-collection');
            selectEntry(entryRow.getAttribute('data-id'), colSel ? colSel.value : selectedCollection);
            return;
        }

        // Outside-popover click closes popover
        var popover = $id('event-popover');
        if (popover && !popover.classList.contains('hidden') && !popover.contains(e.target)) {
            hidePopover();
        }
    });

    // Collection dropdown change → reload entry list
    document.addEventListener('change', function (e) {
        if (e.target && e.target.id === 'sched-collection') {
            loadEntries(e.target.value);
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { hidePopover(); closeModal(); }
    });

    // Schedule form submit
    document.addEventListener('submit', function (e) {
        if (!e.target || e.target.id !== 'sched-form') return;
        e.preventDefault();

        // Validate: an entry must be selected
        if (!selectedEntryId || !selectedCollection) {
            var entryErr = $id('sched-entry-error');
            if (entryErr) entryErr.classList.remove('hidden');
            return;
        }

        var date     = ($id('sched-date') || {}).value || '';
        var time     = ($id('sched-time') || {}).value || '09:00';
        var datetime = date + 'T' + time + ':00';

        var feedback  = $id('sched-feedback');
        var submitBtn = $id('sched-submit');

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Inplannen…'; }
        if (feedback)  { feedback.classList.add('hidden'); }

        apiFetch('/cp/calendar/entry/' + selectedCollection + '/' + selectedEntryId, {
            method: 'PATCH',
            body:   JSON.stringify({ date: datetime }),
        }).then(function () {
            closeModal();
            if (calendar) calendar.refetchEvents();
        }).catch(function (err) {
            if (feedback) {
                feedback.textContent = 'Fout: ' + err.message;
                feedback.className   = 'mt-3 text-sm text-red-600';
                feedback.classList.remove('hidden');
            }
        }).finally(function () {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Inplannen'; }
        });
    });

    // ── FullCalendar init (idempotent — safe to call multiple times) ──────────
    //
    // ensureCalendar() creates #calendar inside #cal-wrap and initialises FC.
    // It is called:
    //   1. At DOMContentLoaded (initial boot).
    //   2. By the MutationObserver whenever #calendar disappears from the DOM
    //      (Vue remounts the NonInertiaPage component after async state updates,
    //      creating fresh empty DOM — ensureCalendar re-builds the calendar).

    function ensureCalendar() {
        var calWrap = $id('cal-wrap');
        if (!calWrap)      return;   // container not in DOM yet
        if ($id('calendar')) return; // already initialised

        var calEl    = document.createElement('div');
        calEl.id     = 'calendar';
        calEl.style.minHeight = '600px';
        calWrap.appendChild(calEl);

        // Destroy stale FC instance before creating a new one
        if (calendar) { try { calendar.destroy(); } catch (e) {} calendar = null; }

        calendar = new FullCalendar.Calendar(calEl, {
            locale:    'nl',
            firstDay:  1,
            buttonText: { today: 'Vandaag', month: 'Maand', week: 'Week', day: 'Dag', list: 'Lijst' },

            initialView: 'dayGridMonth',
            headerToolbar: {
                left:   'prev,next today',
                center: 'title',
                right:  'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
            },

            editable:     true,
            droppable:    false,
            dayMaxEvents: true,
            navLinks:     true,

            events: {
                url:         '/cp/calendar/events',
                method:      'GET',
                extraParams: { _token: csrf() },
                failure: function () { console.error('[Contentkalender] Kon events niet laden.'); },
            },

            eventDidMount: function (info) {
                if (!info.event.extendedProps.published) info.el.classList.add('is-draft');
                info.el.title = info.event.title + (info.event.extendedProps.published ? '' : ' (concept)');
            },

            eventClick: function (info) {
                info.jsEvent.preventDefault();
                showPopover(info.jsEvent, info.event);
            },

            dayCellDidMount: function (info) {
                var frame = info.el.querySelector('.fc-daygrid-day-frame');
                if (!frame) return;
                var btn = document.createElement('div');
                btn.className   = 'cal-add-btn';
                btn.textContent = '+';
                btn.setAttribute('aria-label', 'Entry inplannen op deze dag');
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    openModal(info.date.toISOString().slice(0, 10));
                });
                frame.appendChild(btn);
            },

            eventDrop: function (info) {
                var col = info.event.extendedProps.collection;
                var eid = info.event.id;
                apiFetch('/cp/calendar/entry/' + col + '/' + eid, {
                    method: 'PATCH',
                    body:   JSON.stringify({ date: info.event.startStr.slice(0, 10) }),
                }).catch(function (err) {
                    alert('Kon datum niet opslaan: ' + err.message);
                    info.revert();
                });
            },
        });

        calendar.render();
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {

        // Initial calendar init
        ensureCalendar();

        // Watch for Vue remounting the NonInertiaPage component.
        // When Vue remounts, all DOM inside #statamic is replaced with fresh nodes —
        // #calendar disappears.  The observer detects this and schedules a re-init.
        var watchTarget = $id('statamic') || document.body;
        var observer = new MutationObserver(function () {
            if ($id('calendar')) return;   // still there — FC DOM changes, skip
            if (reinitPending)   return;   // already scheduled
            reinitPending = true;
            requestAnimationFrame(function () {
                reinitPending = false;
                ensureCalendar();
            });
        });
        observer.observe(watchTarget, { childList: true, subtree: true });
    });

})();
</script>
@endsection
