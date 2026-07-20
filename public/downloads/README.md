# public/downloads

Statisch gehoste downloads, geserveerd op `/{downloads}/…`.

## mister-chameleon-connect.zip

De gebouwde WordPress-plugin waarnaar de zelf-updater wijst
(`download_url` in `lib/wp-plugin/manifest.ts`, default
`https://www.misterchameleon.nl/downloads/mister-chameleon-connect.zip`).

**Deze zip moet altijd de versie bevatten die in `manifest.ts` (`LATEST_VERSION`)
staat.** Bij een nieuwe plugin-release opnieuw genereren uit de broncode:

```bash
cd integrations/wordpress-plugin
zip -r ../../public/downloads/mister-chameleon-connect.zip mister-chameleon-connect
```

(De map in de zip moet `mister-chameleon-connect/` heten, met daarin
`mister-chameleon-connect.php` en `readme.txt`.)
