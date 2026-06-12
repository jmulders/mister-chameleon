<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Statamic\Facades\CP\Nav;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->registerContentCalendarNav();
    }

    /**
     * Add a "Contentkalender" item to the Statamic CP sidebar under "Inhoud".
     *
     * The icon is an inline SVG calendar glyph (Heroicons outline style) so no
     * separate asset is needed and it renders correctly in both light and dark CP themes.
     */
    private function registerContentCalendarNav(): void
    {
        Nav::extend(function ($nav) {
            $calendarIcon = <<<SVG
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8"  y1="2" x2="8"  y2="6"/>
                  <line x1="3"  y1="10" x2="21" y2="10"/>
                </svg>
            SVG;

            $nav->create('Contentkalender')
                ->section('Inhoud')
                ->url('/cp/calendar')
                ->icon($calendarIcon);
        });
    }
}
