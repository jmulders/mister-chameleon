<?php

use Statamic\Facades\Entry;
use Illuminate\Http\Request;

// NOTE: Parameter is named {col} instead of {collection} to avoid Statamic's
// RouteServiceProvider model binding, which intercepts any {collection} param
// on routes starting with api/ and causes a 404.
Route::get('/collections/{col}/entries', function (Request $request, string $col) {
    $collection = $col;
    $limit = (int) $request->input('limit', 50);

    // Haal alle entries op voor deze collection.
    // Statamic's flat-file Stache driver ondersteunt niet alle ->where() queries
    // op custom velden, dus we filteren achteraf in PHP.
    $entries = Entry::query()
        ->where('collection', $collection)
        ->get();

    // Pas filter[field:is]=waarde toe in PHP.
    // Voor de speciale velden 'slug' en 'id' gebruiken we de Statamic meta-accessors
    // ($e->slug() / $e->id()), niet $e->get() — die zoekt alleen in data().
    foreach ($request->input('filter', []) as $filterKey => $value) {
        if (str_ends_with($filterKey, ':is')) {
            $field   = substr($filterKey, 0, -3);
            $entries = $entries->filter(function ($e) use ($field, $value) {
                if ($field === 'slug') return (string) $e->slug() === (string) $value;
                if ($field === 'id')   return (string) $e->id()   === (string) $value;
                return (string) $e->get($field) === (string) $value;
            });
        }
    }

    $entries = $entries->take($limit);

    $data = $entries->map(function ($e) {
        // data()->all() geeft ruwe scalaire waarden terug (geen Value-objecten)
        $raw = $e->data()->all();

        // Zorg dat is_active altijd aanwezig is als boolean
        if (!array_key_exists('is_active', $raw)) {
            $raw['is_active'] = true;
        }

        return array_merge($raw, [
            'id'   => $e->id(),
            'slug' => $e->slug(),
        ]);
    })->values()->all();

    return response()->json([
        'data' => $data,
        'meta' => [
            'total'        => count($data),
            'per_page'     => $limit,
            'current_page' => 1,
            'last_page'    => 1,
        ],
    ]);
});

// NOTE: The POST /api/collections/{collection}/entries route lives in
// routes/web.php (with full /api/ prefix) so Laravel's own bootstrap
// registers it reliably. Do not add it back here.
