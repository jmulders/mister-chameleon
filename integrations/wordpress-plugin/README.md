# Mister Chameleon Connect — WordPress plugin

De WordPress-plugin die de Chameleon-snippet inpakt: siteKey-instelling, laden via
`wp_enqueue_script` (geen Wordfence-blokkade), slot-markering (Adaptive Slot-block +
`[mc_slot]`-shortcode), anti-flikker (FOOC) en zelf-update via het platform.

Zie `mister-chameleon-connect/` voor de broncode en `readme.txt` voor het
gebruikers-changelog. Ontwerp en fasering: [`docs/design/snippet-wordpress-plugin.md`](../../docs/design/snippet-wordpress-plugin.md).

## Distributie

- **Bouwen:** zip de map `mister-chameleon-connect/` (met daarin `mister-chameleon-connect.php`
  en `readme.txt`) tot `mister-chameleon-connect.zip`.
- **Installeren:** WordPress → Plugins → Nieuwe plugin → Plugin uploaden → de zip.
- **Updaten:** de plugin checkt `/{platform}/api/wp-plugin/update` en toont updates in
  het normale WordPress-plugin-scherm. Zie hieronder.

## Zelf-update (platform-kant)

- `app/api/wp-plugin/update` serveert het update-manifest.
- `lib/wp-plugin/manifest.ts` is de bron voor versie + download-URL.

Bij een nieuwe release: bump de versie in **zowel** de plugin-header als
`LATEST_VERSION` in `manifest.ts`, host de nieuwe zip op de `download_url`, en zet
`WP_PLUGIN_DOWNLOAD_URL` (env) naar die locatie. Zolang de `download_url` nog niet
naar een echte zip van die versie wijst, ziet WordPress de update wel maar mislukt
de installatie — hosting van de zip hoort dus bij de release.

## Losse repo

Conceptueel is dit een aparte PHP-repo (`mister-chameleon-wordpress`). Hij leeft
hier voorlopig in de monorepo zodat hij versioned is; later te extraheren.
