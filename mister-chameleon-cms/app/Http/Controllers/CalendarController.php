<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Statamic\Facades\Collection;
use Statamic\Facades\Entry;

/**
 * CalendarController
 *
 * Powers the Content Calendar page in the Statamic CP.
 *
 * ─── Routes ──────────────────────────────────────────────────────────────────
 *
 *   GET  /cp/calendar                           → index()       CP calendar page
 *   GET  /cp/calendar/events?start=…&end=…      → events()      FullCalendar event feed
 *   POST /cp/calendar/entry                     → createEntry() New entry on a date
 *   PATCH /cp/calendar/entry/{col}/{id}         → updateDate()  Drag-and-drop reschedule
 *   DELETE /cp/calendar/entry/{col}/{id}/date   → clearDate()   Remove from calendar
 *
 * ─── Collections config ───────────────────────────────────────────────────────
 *
 *   Each entry in CALENDAR_COLLECTIONS defines:
 *     label      — human-readable name shown in the legend
 *     dateField  — which Statamic entry field drives the calendar position
 *     color      — hex colour used for event chips
 *
 *   Collections that don't exist in this Statamic instance are silently skipped,
 *   so the same config works across all tenant deployments regardless of which
 *   collections have been created.
 */
class CalendarController extends Controller
{
    /**
     * Supported collections and their calendar configuration.
     * Add more entries here as new dated collections are created.
     */
    private const CALENDAR_COLLECTIONS = [
        'pages'     => ['label' => 'Pagina\'s',  'dateField' => 'date',         'color' => '#3B82F6'],
        'blog'      => ['label' => 'Blog',        'dateField' => 'date',         'color' => '#10B981'],
        'events'    => ['label' => 'Evenementen', 'dateField' => 'event_date',   'color' => '#F59E0B'],
        'vacancies' => ['label' => 'Vacatures',   'dateField' => 'date',         'color' => '#EF4444'],
    ];

    // ── CP page ───────────────────────────────────────────────────────────────

    /**
     * Render the calendar CP page.
     */
    public function index(Request $request): mixed
    {
        // Statamic's CP is a Vue + Inertia SPA. Clicking "Contentkalender" in
        // the sidebar triggers an Inertia XHR (X-Inertia: true), but our page
        // is a plain Blade view — not an Inertia component.
        //
        // Inertia::location() responds with 409 + X-Inertia-Location header,
        // which tells the Inertia client to do a full-page window.location
        // redirect. The resulting GET request has no X-Inertia header, so the
        // Blade view renders and the Statamic layout loads normally.
        if ($request->inertia()) {
            return Inertia::location('/cp/calendar');
        }

        $config = collect(self::CALENDAR_COLLECTIONS)
            ->filter(fn ($cfg, $handle) => Collection::find($handle) !== null)
            ->all();

        return view('cp.calendar', ['config' => $config]);
    }

    // ── Entry list (for schedule modal) ──────────────────────────────────────

    /**
     * Return all entries for a collection so the schedule modal can show a picker.
     * Drafts are sorted first, then published, alphabetically within each group.
     * GET /cp/calendar/entries/{collection}
     */
    public function listEntries(string $collection): JsonResponse
    {
        $cfg = self::CALENDAR_COLLECTIONS[$collection] ?? null;
        if (! $cfg) {
            return response()->json(['error' => 'Onbekende collectie'], 400);
        }

        if (! Collection::find($collection)) {
            return response()->json(['error' => 'Collectie bestaat niet'], 404);
        }

        $entries = Entry::query()
            ->where('collection', $collection)
            ->get()
            ->sortBy(fn ($e) => [
                (int) $e->published(),                                      // drafts first (0 < 1)
                strtolower((string) ($e->get('title') ?? $e->slug())),      // then alphabetically
            ])
            ->map(fn ($entry) => [
                'id'        => $entry->id(),
                'title'     => (string) ($entry->get('title') ?? $entry->slug()),
                'slug'      => $entry->slug(),
                'published' => (bool) $entry->published(),
                'editUrl'   => cp_route('collections.entries.edit', [$collection, $entry->id()]),
            ])
            ->values()
            ->all();

        return response()->json($entries);
    }

    // ── Event feed ────────────────────────────────────────────────────────────

    /**
     * Return FullCalendar-compatible event objects for a date range.
     * GET /cp/calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD
     */
    public function events(Request $request): JsonResponse
    {
        $rangeStart = $request->get('start');
        $rangeEnd   = $request->get('end');

        $events = [];

        foreach (self::CALENDAR_COLLECTIONS as $handle => $cfg) {
            if (! Collection::find($handle)) {
                continue;
            }

            $entries = Entry::query()->where('collection', $handle)->get();

            foreach ($entries as $entry) {
                $rawDate = $entry->get($cfg['dateField']);
                if (! $rawDate) {
                    continue;
                }

                // Normalise to Carbon, then to ISO-8601.
                try {
                    $date = $rawDate instanceof Carbon
                        ? $rawDate
                        : Carbon::parse((string) $rawDate);
                    $isoDate = $date->toIso8601String();
                } catch (\Exception) {
                    continue;
                }

                // Filter to the requested range (FullCalendar sends YYYY-MM-DD).
                if ($rangeStart && $isoDate < $rangeStart) {
                    continue;
                }
                if ($rangeEnd && $isoDate > $rangeEnd) {
                    continue;
                }

                $events[] = [
                    'id'              => $entry->id(),
                    'title'           => (string) ($entry->get('title') ?? $entry->slug()),
                    'start'           => $isoDate,
                    'backgroundColor' => $cfg['color'],
                    'borderColor'     => $cfg['color'],
                    'textColor'       => '#ffffff',
                    'extendedProps'   => [
                        'collection'      => $handle,
                        'collectionLabel' => $cfg['label'],
                        'dateField'       => $cfg['dateField'],
                        'slug'            => $entry->slug(),
                        'published'       => (bool) $entry->published(),
                        'editUrl'         => cp_route('collections.entries.edit', [$handle, $entry->id()]),
                    ],
                ];
            }
        }

        return response()->json($events);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Update an entry's calendar date (drag-and-drop reschedule).
     * PATCH /cp/calendar/entry/{collection}/{id}
     * Body: { date: "YYYY-MM-DD" | "YYYY-MM-DDTHH:MM:SS" }
     */
    public function updateDate(Request $request, string $collection, string $id): JsonResponse
    {
        $entry = Entry::find($id);
        if (! $entry) {
            return response()->json(['error' => 'Entry niet gevonden'], 404);
        }

        $cfg = self::CALENDAR_COLLECTIONS[$collection] ?? null;
        if (! $cfg) {
            return response()->json(['error' => 'Onbekende collectie'], 400);
        }

        $newDate = $request->input('date');
        if (! $newDate) {
            return response()->json(['error' => 'Datum vereist'], 422);
        }

        try {
            // Store as a Carbon-compatible string so Statamic's augmentation
            // can parse it back. Date-only (YYYY-MM-DD) works for all date fieldtypes.
            $entry->set($cfg['dateField'], Carbon::parse($newDate)->toDateTimeString())->save();
        } catch (\Exception $e) {
            return response()->json(['error' => 'Ongeldige datum: ' . $e->getMessage()], 422);
        }

        return response()->json(['success' => true, 'date' => $newDate]);
    }

    /**
     * Remove an entry from the calendar by clearing its date field.
     * DELETE /cp/calendar/entry/{collection}/{id}/date
     */
    public function clearDate(string $collection, string $id): JsonResponse
    {
        $entry = Entry::find($id);
        if (! $entry) {
            return response()->json(['error' => 'Entry niet gevonden'], 404);
        }

        $cfg = self::CALENDAR_COLLECTIONS[$collection] ?? null;
        if (! $cfg) {
            return response()->json(['error' => 'Onbekende collectie'], 400);
        }

        // Setting the field to null removes it from the entry YAML.
        $entry->set($cfg['dateField'], null)->save();

        return response()->json(['success' => true]);
    }

    /**
     * Create a new draft entry on the given date.
     * POST /cp/calendar/entry
     * Body: { collection, title, date }
     */
    public function createEntry(Request $request): JsonResponse
    {
        $collection = $request->input('collection', '');
        $title      = trim((string) $request->input('title', ''));
        $date       = $request->input('date', '');

        if (! $collection || ! $title || ! $date) {
            return response()->json(['error' => 'collection, title en date zijn verplicht'], 422);
        }

        $cfg = self::CALENDAR_COLLECTIONS[$collection] ?? null;
        if (! $cfg) {
            return response()->json(['error' => 'Onbekende collectie'], 400);
        }

        if (! Collection::find($collection)) {
            return response()->json(['error' => 'Collectie bestaat niet in dit CMS'], 404);
        }

        // Generate a unique slug from title + timestamp to avoid collisions.
        $slug = Str::slug($title) . '-' . time();

        $entry = Entry::make()
            ->collection($collection)
            ->slug($slug)
            ->data([
                'title'          => $title,
                $cfg['dateField'] => Carbon::parse($date)->toDateTimeString(),
            ])
            ->published(false); // Always start as draft; editor publishes via CP.

        $entry->save();

        return response()->json([
            'success' => true,
            'id'      => $entry->id(),
            'title'   => $title,
            'editUrl' => cp_route('collections.entries.edit', [$collection, $entry->id()]),
        ], 201);
    }
}
