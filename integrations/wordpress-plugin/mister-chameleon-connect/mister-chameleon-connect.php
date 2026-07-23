<?php
/**
 * Plugin Name:       Mister Chameleon Connect
 * Plugin URI:        https://www.misterchameleon.nl
 * Update URI:        https://www.misterchameleon.nl/mister-chameleon-connect
 * Description:       Real-time contentpersonalisatie via de Mister Chameleon-snippet. Vul je siteKey in en markeer slots — geen thema-code, geen losse header-plugin, geen Wordfence-gedoe.
 * Version:           0.5.6
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Mister Chameleon
 * Author URI:        https://www.misterchameleon.nl
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       mister-chameleon-connect
 *
 * ─── Wat deze plugin doet ────────────────────────────────────────────────────
 *
 *   1. Instellingen-pagina met alleen een siteKey-veld (+ aan/uit + endpoint).
 *   2. Laadt de snippet via wp_enqueue_script — de nette WordPress-weg, die
 *      Wordfence niet als "unsafe operation" blokkeert (anders dan een ruwe
 *      <script> in een header-plugin).
 *   3. Slot-markeren zonder thema-code:
 *        - Gutenberg-block "Adaptive Slot"
 *        - shortcode [mc_slot key="hero-title"]Standaardtekst[/mc_slot]
 *      Beide renderen een gewone inline <span data-mc-slot="…"> — dus géén
 *      iframe/sandbox waar de snippet niet bij kan.
 *   4. Consent-hook: filter `mcc_should_enqueue` om het laden achter toestemming
 *      te zetten (haakpunt voor Complianz/Cookiebot/CookieYes).
 *
 *   De snippet zelf regelt FOOC-preventie, de 1500 ms fail-safe en CORS.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Directe toegang blokkeren.
}

define( 'MCC_VERSION', '0.5.6' );
define( 'MCC_DEFAULT_ENDPOINT', 'https://www.misterchameleon.nl' );

/**
 * Effectieve endpoint-basis (zonder trailing slash).
 */
function mcc_endpoint() {
	$ep = get_option( 'mcc_endpoint', MCC_DEFAULT_ENDPOINT );
	$ep = is_string( $ep ) && $ep !== '' ? $ep : MCC_DEFAULT_ENDPOINT;
	return untrailingslashit( esc_url_raw( $ep ) );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. Instellingen
 * ────────────────────────────────────────────────────────────────────────── */

add_action( 'admin_init', function () {
	register_setting( 'mcc_settings', 'mcc_site_key', array(
		'type'              => 'string',
		'sanitize_callback' => 'sanitize_text_field',
		'default'           => '',
	) );
	register_setting( 'mcc_settings', 'mcc_enabled', array(
		'type'              => 'boolean',
		'sanitize_callback' => function ( $v ) { return $v ? 1 : 0; },
		'default'           => 0,
	) );
	register_setting( 'mcc_settings', 'mcc_endpoint', array(
		'type'              => 'string',
		'sanitize_callback' => 'esc_url_raw',
		'default'           => MCC_DEFAULT_ENDPOINT,
	) );
} );

add_action( 'admin_menu', function () {
	add_options_page(
		'Mister Chameleon',
		'Mister Chameleon',
		'manage_options',
		'mister-chameleon-connect',
		'mcc_render_settings_page'
	);
} );

function mcc_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$site_key = get_option( 'mcc_site_key', '' );
	$enabled  = (bool) get_option( 'mcc_enabled', 0 );
	$endpoint = get_option( 'mcc_endpoint', MCC_DEFAULT_ENDPOINT );
	$active   = $enabled && $site_key !== '';
	?>
	<div class="wrap">
		<h1>Mister Chameleon Connect</h1>
		<p style="max-width:640px">
			Personaliseer je bestaande pagina's real-time. Vul hieronder je
			<strong>siteKey</strong> in (uit het Mister Chameleon-platform → tenant →
			Snippet) en zet de integratie aan. Markeer daarna wat gepersonaliseerd
			mag worden met het <em>Adaptive Slot</em>-block of de shortcode
			<code>[mc_slot key="hero-title"]…[/mc_slot]</code>.
		</p>

		<p>
			<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:<?php echo $active ? '#22c55e' : '#cbd5e1'; ?>"></span>
			<strong><?php echo $active ? 'Actief' : ( $site_key === '' ? 'Geen siteKey' : 'Uitgeschakeld' ); ?></strong>
		</p>

		<form method="post" action="options.php">
			<?php settings_fields( 'mcc_settings' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="mcc_site_key">Site key</label></th>
					<td>
						<input name="mcc_site_key" id="mcc_site_key" type="text"
							value="<?php echo esc_attr( $site_key ); ?>"
							class="regular-text" placeholder="sk_live_…" />
						<p class="description">Publieke identifier — veilig om in de pagina te zetten.</p>
					</td>
				</tr>
				<tr>
					<th scope="row">Integratie</th>
					<td>
						<label>
							<input name="mcc_enabled" type="checkbox" value="1" <?php checked( $enabled ); ?> />
							Snippet laden op de site
						</label>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="mcc_endpoint">Platform-endpoint</label></th>
					<td>
						<input name="mcc_endpoint" id="mcc_endpoint" type="url"
							value="<?php echo esc_attr( $endpoint ); ?>"
							class="regular-text" />
						<p class="description">Alleen wijzigen als je platform op een ander domein draait. Standaard: <?php echo esc_html( MCC_DEFAULT_ENDPOINT ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button( 'Opslaan' ); ?>
		</form>

		<hr />
		<h2>Slots markeren</h2>
		<p>Twee manieren, ze werken naast elkaar:</p>
		<ul style="list-style:disc;padding-left:20px;max-width:640px">
			<li><strong>Adaptive Slot-block</strong> — voeg toe in de blok-editor, kies een slot-key in de zijbalk, typ de standaardtekst.</li>
			<li><strong>Shortcode</strong> — <code>[mc_slot key="hero-title"]Standaard kop[/mc_slot]</code>. Voor links: <code>[mc_slot key="hero-cta-label" href="hero-cta-href"]Meld je aan[/mc_slot]</code>.</li>
		</ul>
		<p class="description">Werk je met een page builder waar je de HTML niet in handen hebt? Gebruik dan de selector-mapping in het platform (Snippet → Selectors); daar heb je deze plugin niet voor nodig.</p>

		<?php
		// ── Update-diagnose (verborgen) ──────────────────────────────────────────
		// Standaard verborgen om de instellingenpagina schoon te houden. Roep 'm op
		// door ?mcc_diag=1 aan de URL te hangen, dus:
		//   /wp-admin/options-general.php?page=mister-chameleon-connect&mcc_diag=1
		// Doet een live-check vanaf de WordPress-server en toont status, versie,
		// de antwoord-body en de headers (server/x-vercel-id/cf-ray) zodat de bron
		// van een eventuele blokkade (app-limiter / Cloudflare / Vercel) zichtbaar is.
		if ( isset( $_GET['mcc_diag'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- alleen-lezen weergaveschakelaar
		?>
		<hr />
		<h2>Update-diagnose</h2>
		<?php
		$mcc_diag_url  = mcc_endpoint() . '/api/wp-plugin/update';
		$mcc_diag_resp = wp_remote_get( $mcc_diag_url, array( 'timeout' => 8 ) );
		$mcc_diag_body_raw = '';
		$mcc_diag_headers  = array();
		if ( is_wp_error( $mcc_diag_resp ) ) {
			$mcc_diag_status = 'FOUT';
			$mcc_diag_err    = $mcc_diag_resp->get_error_message();
			$mcc_diag_remote = '';
		} else {
			$mcc_diag_status   = (string) (int) wp_remote_retrieve_response_code( $mcc_diag_resp );
			$mcc_diag_err      = '';
			$mcc_diag_body_raw = (string) wp_remote_retrieve_body( $mcc_diag_resp );
			$mcc_diag_body     = json_decode( $mcc_diag_body_raw, true );
			$mcc_diag_remote   = ( is_array( $mcc_diag_body ) && isset( $mcc_diag_body['version'] ) ) ? (string) $mcc_diag_body['version'] : '';
			// Capture the headers that reveal WHO answered (our app vs Vercel vs a
			// CDN like Cloudflare) so a non-200 can be attributed without guessing.
			foreach ( array( 'server', 'x-vercel-id', 'x-vercel-cache', 'cf-ray', 'cf-cache-status', 'retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining' ) as $mcc_h ) {
				$mcc_v = wp_remote_retrieve_header( $mcc_diag_resp, $mcc_h );
				if ( '' !== $mcc_v && array() !== $mcc_v ) {
					$mcc_diag_headers[ $mcc_h ] = is_array( $mcc_v ) ? implode( ', ', $mcc_v ) : (string) $mcc_v;
				}
			}
		}
		$mcc_diag_installed = MCC_VERSION;
		if ( '' === $mcc_diag_remote ) {
			$mcc_diag_verdict = 'Geen versie ontvangen — antwoord kwam niet van de update-manifest.';
		} elseif ( version_compare( $mcc_diag_installed, $mcc_diag_remote, '<' ) ) {
			$mcc_diag_verdict = 'Update beschikbaar → ' . $mcc_diag_remote;
		} else {
			$mcc_diag_verdict = 'Up-to-date (geen nieuwere versie op het platform).';
		}
		?>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row">Endpoint (server → platform)</th>
				<td><code><?php echo esc_html( $mcc_diag_url ); ?></code></td>
			</tr>
			<tr>
				<th scope="row">HTTP-status</th>
				<td><code><?php echo esc_html( $mcc_diag_status ); ?></code><?php if ( $mcc_diag_err ) { echo ' — ' . esc_html( $mcc_diag_err ); } ?></td>
			</tr>
			<tr>
				<th scope="row">Versie op platform</th>
				<td><code><?php echo esc_html( '' !== $mcc_diag_remote ? $mcc_diag_remote : '—' ); ?></code></td>
			</tr>
			<tr>
				<th scope="row">Geïnstalleerde versie</th>
				<td><code><?php echo esc_html( $mcc_diag_installed ); ?></code></td>
			</tr>
			<tr>
				<th scope="row">Verdict</th>
				<td><strong><?php echo esc_html( $mcc_diag_verdict ); ?></strong></td>
			</tr>
			<tr>
				<th scope="row">Antwoord-body</th>
				<td><code style="white-space:pre-wrap;word-break:break-all"><?php echo esc_html( '' !== $mcc_diag_body_raw ? substr( $mcc_diag_body_raw, 0, 300 ) : '(leeg)' ); ?></code></td>
			</tr>
			<tr>
				<th scope="row">Wie antwoordde (headers)</th>
				<td>
					<?php if ( empty( $mcc_diag_headers ) ) { echo '<code>(geen)</code>'; } else { ?>
						<code style="white-space:pre-wrap;word-break:break-all"><?php
						$mcc_lines = array();
						foreach ( $mcc_diag_headers as $mcc_k => $mcc_val ) {
							$mcc_lines[] = $mcc_k . ': ' . $mcc_val;
						}
						echo esc_html( implode( "\n", $mcc_lines ) );
						?></code>
					<?php } ?>
				</td>
			</tr>
		</table>
		<p class="description">
			Live-check vanaf je WordPress-server. Bij een 429 verraden de body en de headers de bron:
			een JSON-body <code>{"error":"Too Many Requests"}</code> = de app-limiter; een <code>cf-ray</code>/
			<code>server: cloudflare</code> = Cloudflare; een <code>x-vercel-id</code> zonder app-JSON = Vercel's
			edge. HTTP 200 + juiste versie maar geen update-melding? Ga naar Dashboard → Updates en klik
			"Opnieuw controleren".
		</p>
		<?php endif; // mcc_diag ?>
	</div>
	<?php
}

// Snelle link naar de instellingen vanaf de plugin-lijst.
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
	$url = admin_url( 'options-general.php?page=mister-chameleon-connect' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">Instellingen</a>' );
	return $links;
} );

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. Snippet laden (de nette WordPress-weg → geen Wordfence-blokkade)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Moet de snippet op deze request geladen worden? Gedeeld door de enqueue en de
 * anti-flikker-inline hieronder.
 *
 * De `mcc_should_enqueue`-filter is het consent-haakpunt — retourneer false om het
 * laden uit te stellen tot toestemming. Voorbeeld (in een mu-plugin of thema):
 *   add_filter( 'mcc_should_enqueue', function () {
 *       return function_exists( 'wp_has_consent' ) ? wp_has_consent( 'marketing' ) : true;
 *   } );
 */
function mcc_is_active() {
	if ( is_admin() ) {
		return false;
	}
	$enabled  = (bool) get_option( 'mcc_enabled', 0 );
	$site_key = get_option( 'mcc_site_key', '' );
	if ( ! $enabled || $site_key === '' ) {
		return false;
	}
	return (bool) apply_filters( 'mcc_should_enqueue', true );
}

/**
 * Anti-flikker (FOOC). De snippet laadt async en draait dus ná de eerste paint —
 * daardoor zie je heel even de standaardtekst vóór de swap. Deze kleine synchrone
 * inline-regel in de <head> verbergt de pagina vóór de paint en onthult 'm zodra
 * de swap klaar is (de snippet zet de documentElement-opacity terug), of na een
 * veilige timeout — óók als de snippet nooit laadt, zodat de pagina nooit
 * verborgen blijft hangen.
 */
add_action( 'wp_head', function () {
	if ( ! mcc_is_active() ) {
		return;
	}
	// Whole-page reveal for element-level (data-mc-slot) swaps.
	echo "<script id=\"mcc-antiflicker\">document.documentElement.style.opacity='0';setTimeout(function(){document.documentElement.style.opacity='';},1500);</script>\n";

	// Block-scoped anti-flicker (Optimizely / VWO style). Adaptive BLOCKS
	// (data-mc-block) are hidden until the snippet swaps their content in the
	// platform-decided variant — so the editor's default/fallback never flashes.
	// Reveal happens per block the moment its content changes (MutationObserver),
	// with a safety timeout so a block is never left hidden if the snippet is slow
	// or never loads (then the default is shown, as intended).
	echo "<style id=\"mcc-block-antiflicker\">[data-mc-block]{visibility:hidden}</style>\n";
	echo "<script id=\"mcc-block-reveal\">(function(){function show(b){b.style.visibility='visible';}function showAll(){var n=document.querySelectorAll('[data-mc-block]');for(var i=0;i<n.length;i++)show(n[i]);}function wire(){var b=document.querySelectorAll('[data-mc-block]');for(var i=0;i<b.length;i++){(function(x){if(typeof MutationObserver!=='undefined'){var mo=new MutationObserver(function(){show(x);mo.disconnect();});mo.observe(x,{childList:true,subtree:true});}})(b[i]);}}if(document.readyState!=='loading'){wire();}else{document.addEventListener('DOMContentLoaded',wire);}setTimeout(showAll,1500);})();</script>\n";
}, 1 );

add_action( 'wp_enqueue_scripts', function () {
	if ( ! mcc_is_active() ) {
		return;
	}

	wp_enqueue_script(
		'mister-chameleon-snippet',
		mcc_endpoint() . '/api/snippet.js',
		array(),
		null,   // Geen versie-query: de snippet is altijd vers van het platform.
		array( 'strategy' => 'async', 'in_footer' => false )
	);
}, 5 );

/**
 * Voeg de data-site-key toe aan de scripttag (en async als fallback voor oudere
 * WP-versies die de 'strategy'-arg negeren). wp_enqueue_script kent geen
 * willekeurige attributen, dus dat doen we hier.
 */
add_filter( 'script_loader_tag', function ( $tag, $handle ) {
	if ( 'mister-chameleon-snippet' !== $handle ) {
		return $tag;
	}
	$key  = esc_attr( get_option( 'mcc_site_key', '' ) );
	$attr = ' data-site-key="' . $key . '"';
	if ( false === strpos( $tag, ' async' ) ) {
		$attr .= ' async';
	}
	// Attributen net vóór ' src=' injecteren.
	return preg_replace( '/\s+src=/', $attr . ' src=', $tag, 1 );
}, 10, 2 );

/* ─────────────────────────────────────────────────────────────────────────────
 * 3a. Shortcode  [mc_slot key="hero-title" href="hero-cta-href" html="false"]…[/mc_slot]
 * ────────────────────────────────────────────────────────────────────────── */

add_shortcode( 'mc_slot', function ( $atts, $content = '' ) {
	$atts = shortcode_atts( array(
		'key'  => '',
		'href' => '',   // optionele slot-key voor het href-attribuut (op links)
		'html' => 'false',
		'tag'  => 'span',
	), $atts, 'mc_slot' );

	$key = sanitize_text_field( $atts['key'] );
	if ( $key === '' ) {
		return do_shortcode( $content );
	}

	$tag        = preg_replace( '/[^a-z0-9]/', '', strtolower( $atts['tag'] ) );
	$tag        = $tag !== '' ? $tag : 'span';
	$use_html   = filter_var( $atts['html'], FILTER_VALIDATE_BOOLEAN );
	$inner      = $use_html ? do_shortcode( $content ) : esc_html( wp_strip_all_tags( $content ) );

	$attrs  = ' data-mc-slot="' . esc_attr( $key ) . '"';
	if ( $use_html ) {
		$attrs .= ' data-mc-html="true"';
	}
	if ( $atts['href'] !== '' ) {
		$attrs .= ' data-mc-slot-href="' . esc_attr( sanitize_text_field( $atts['href'] ) ) . '"';
	}

	return '<' . $tag . $attrs . '>' . $inner . '</' . $tag . '>';
} );

/* ─────────────────────────────────────────────────────────────────────────────
 * 3a-bis. Shortcode  [mc_block key="hero"]…standaardinhoud…[/mc_block]
 *
 *   Whole-block variant: renders a <div data-mc-block="hero"> container that the
 *   snippet swaps to the platform-decided variant. The shortcode content is the
 *   default/fallback, shown until the swap (and if the snippet never loads).
 * ────────────────────────────────────────────────────────────────────────── */

add_shortcode( 'mc_block', function ( $atts, $content = '' ) {
	$atts = shortcode_atts( array( 'key' => '' ), $atts, 'mc_block' );
	$key  = sanitize_text_field( $atts['key'] );
	$inner = do_shortcode( $content );
	if ( $key === '' ) {
		return $inner;
	}
	return '<div data-mc-block="' . esc_attr( $key ) . '">' . $inner . '</div>';
} );

/* ─────────────────────────────────────────────────────────────────────────────
 * 3b. Gutenberg-block "Adaptive Block" (heel blok; InnerBlocks als standaard,
 *     PHP wrapt in een data-mc-block container die de snippet vervangt)
 * ────────────────────────────────────────────────────────────────────────── */

add_action( 'init', function () {
	// Editor-script inline registreren (geen build-stap nodig).
	wp_register_script(
		'mcc-slot-block',
		'',
		array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ),
		MCC_VERSION,
		true
	);

	$js = <<<'JS'
( function ( wp ) {
	var el = wp.element.createElement;
	var registerBlockType = wp.blocks.registerBlockType;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var InnerBlocks = wp.blockEditor.InnerBlocks;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var PanelBody = wp.components.PanelBody;
	var SelectControl = wp.components.SelectControl;

	// The five adaptive block slots the platform can render as a whole block.
	// The platform decides WHICH variant of the slot each visitor sees (rules/AI);
	// the block here just marks WHERE the slot goes and holds the default content.
	var MCC_BLOCK_SLOTS = [
		{ label: 'Hero',         value: 'hero' },
		{ label: 'Features',     value: 'feature' },
		{ label: 'Social proof', value: 'proof' },
		{ label: 'CTA',          value: 'cta' },
		{ label: 'Conversion',   value: 'conversion' },
		{ label: 'Notification', value: 'notification' }
	];

	registerBlockType( 'mister-chameleon/slot', {
		apiVersion: 2,
		title: 'Adaptive Block (Mister Chameleon)',
		description: 'Voeg een volledig adaptief blok in. Mister Chameleon toont per bezoeker de juiste variant; de inhoud die je hieronder opmaakt is de standaard/fallback.',
		icon: 'randomize',
		category: 'design',
		supports: { html: false },
		attributes: {
			slotKey: { type: 'string', default: 'hero' },
			content: { type: 'string', default: '' } // legacy: pre-0.5 text blocks
		},
		edit: function ( props ) {
			var a = props.attributes;
			var blockProps = useBlockProps( { style: { outline: '1px dashed #6366f1', padding: '8px' } } );
			return el( 'div', blockProps,
				el( InspectorControls, {},
					el( PanelBody, { title: 'Adaptief blok', initialOpen: true },
						el( SelectControl, {
							label: 'Welk adaptief slot?',
							value: a.slotKey,
							options: MCC_BLOCK_SLOTS,
							onChange: function ( v ) { props.setAttributes( { slotKey: v } ); },
							help: 'Het platform bepaalt met regels of AI welke variant hier verschijnt.'
						} )
					)
				),
				el( 'small', { style: { color: '#6366f1', display: 'block', marginBottom: '6px' } },
					'Adaptief blok: ' + ( a.slotKey || '(kies een slot)' ) + ' — standaardinhoud:' ),
				el( InnerBlocks, { templateLock: false } )
			);
		},
		// Dynamic block, but the InnerBlocks default content IS persisted so PHP can
		// wrap it in the data-mc-block container and use it as the fallback.
		save: function () { return el( InnerBlocks.Content ); }
	} );
} )( window.wp );
JS;
	wp_add_inline_script( 'mcc-slot-block', $js );

	register_block_type( 'mister-chameleon/slot', array(
		'api_version'     => 2,
		'editor_script'   => 'mcc-slot-block',
		'attributes'      => array(
			'slotKey' => array( 'type' => 'string', 'default' => 'hero' ),
			'content' => array( 'type' => 'string', 'default' => '' ),
		),
		'render_callback' => 'mcc_render_slot_block',
	) );
} );

/**
 * Render the Adaptive Block on the front end as a whole-block container:
 *
 *   <div data-mc-block="hero"> …editor default content… </div>
 *
 * The snippet replaces the container's innerHTML with the platform-decided
 * variant (and applies scoped design tokens). Until then the block is hidden by
 * the block-scoped anti-flicker, so the default never flashes; if the snippet
 * never runs, the default content is what the visitor sees.
 *
 * $content holds the persisted InnerBlocks HTML (0.5+). The legacy `content`
 * string attribute is used as a fallback for blocks inserted before 0.5.
 */
function mcc_render_slot_block( $attrs, $content = '' ) {
	$key = isset( $attrs['slotKey'] ) ? sanitize_text_field( $attrs['slotKey'] ) : '';

	$inner = trim( (string) $content );
	if ( $inner === '' && isset( $attrs['content'] ) && $attrs['content'] !== '' ) {
		$inner = wp_kses_post( $attrs['content'] );
	}

	if ( $key === '' ) {
		return $inner;
	}
	return '<div data-mc-block="' . esc_attr( $key ) . '">' . $inner . '</div>';
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. Zelf-update via het platform
 * ──────────────────────────────────────────────────────────────────────────
 *
 *   Deze plugin distribueren we zelf (niet via de WordPress.org-directory), dus
 *   WordPress ziet standaard geen updates. Hieronder haken we in op WP's eigen
 *   update-mechanisme: we vragen `{endpoint}/api/wp-plugin/update` (gecachet) om
 *   de laatste versie + download-URL, en als die nieuwer is dan MCC_VERSION toont
 *   WordPress de update gewoon in het plugin-scherm ("nu updaten").
 *
 *   Kip-en-ei: de eerste versie mét deze updater installeer je één keer handmatig;
 *   vanaf dan gaan updates automatisch.
 */

define( 'MCC_UPDATE_SLUG', 'mister-chameleon-connect' );

/**
 * Haal (gecachet) de update-info op van het platform. Faalt stil: bij welke fout
 * dan ook cachen we een lege array zodat het plugin-scherm nooit breekt.
 */
function mcc_update_info() {
	// On a manual "Check again" (update-core.php?force-check=1) always fetch fresh,
	// so a just-released version is never hidden behind a still-warm cache. This
	// bypasses the transient inline — no separate hook whose timing could lose the
	// race with WordPress' own update check.
	$force = isset( $_GET['force-check'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	if ( ! $force ) {
		$cached = get_transient( 'mcc_update_info' );
		if ( false !== $cached ) {
			return $cached;
		}
	}
	$resp = wp_remote_get( mcc_endpoint() . '/api/wp-plugin/update', array( 'timeout' => 8 ) );
	$data = array();
	if ( ! is_wp_error( $resp ) && 200 === (int) wp_remote_retrieve_response_code( $resp ) ) {
		$decoded = json_decode( wp_remote_retrieve_body( $resp ), true );
		if ( is_array( $decoded ) ) {
			$data = $decoded;
		}
	}
	set_transient( 'mcc_update_info', $data, HOUR_IN_SECONDS );
	return $data;
}

// Meld een beschikbare update aan WordPress' update-transient.
add_filter( 'pre_set_site_transient_update_plugins', function ( $transient ) {
	if ( ! is_object( $transient ) ) {
		return $transient;
	}
	$info = mcc_update_info();
	if ( empty( $info['version'] ) || empty( $info['download_url'] ) ) {
		return $transient;
	}
	if ( version_compare( MCC_VERSION, $info['version'], '>=' ) ) {
		return $transient; // al up-to-date
	}
	$basename = plugin_basename( __FILE__ );
	$transient->response[ $basename ] = (object) array(
		'slug'         => MCC_UPDATE_SLUG,
		'plugin'       => $basename,
		'new_version'  => $info['version'],
		'package'      => $info['download_url'],
		'url'          => isset( $info['homepage'] ) ? $info['homepage'] : '',
		'tested'       => isset( $info['tested'] ) ? $info['tested'] : '',
		'requires'     => isset( $info['requires'] ) ? $info['requires'] : '',
		'requires_php' => isset( $info['requires_php'] ) ? $info['requires_php'] : '',
	);
	return $transient;
} );

// Vul het "Details bekijken"-venster.
add_filter( 'plugins_api', function ( $result, $action, $args ) {
	if ( 'plugin_information' !== $action || ! isset( $args->slug ) || MCC_UPDATE_SLUG !== $args->slug ) {
		return $result;
	}
	$info = mcc_update_info();
	if ( empty( $info['version'] ) ) {
		return $result;
	}
	return (object) array(
		'name'          => isset( $info['name'] ) ? $info['name'] : 'Mister Chameleon Connect',
		'slug'          => MCC_UPDATE_SLUG,
		'version'       => $info['version'],
		'requires'      => isset( $info['requires'] ) ? $info['requires'] : '',
		'tested'        => isset( $info['tested'] ) ? $info['tested'] : '',
		'requires_php'  => isset( $info['requires_php'] ) ? $info['requires_php'] : '',
		'homepage'      => isset( $info['homepage'] ) ? $info['homepage'] : '',
		'download_link' => isset( $info['download_url'] ) ? $info['download_url'] : '',
		'sections'      => isset( $info['sections'] ) ? (array) $info['sections'] : array(),
	);
}, 20, 3 );

// Verse check afdwingen na een (de)installatie of update.
add_action( 'upgrader_process_complete', function () {
	delete_transient( 'mcc_update_info' );
} );

// Een handmatige "Opnieuw controleren" op het Updates-scherm
// (update-core.php?force-check=1) moet óók ONZE cache verversen — niet alleen
// WordPress' eigen update-transient. Zonder dit blijft een net uitgebrachte
// versie verborgen tot de plugin-transient vanzelf verloopt.
add_action( 'load-update-core.php', function () {
	if ( isset( $_GET['force-check'] ) ) {
		delete_transient( 'mcc_update_info' );
	}
} );

// ── WordPress 5.8+ self-hosted update path ──────────────────────────────────
//
//   Because this plugin declares an `Update URI:` header (host
//   www.misterchameleon.nl), WordPress routes the update check for THIS plugin
//   to the filter below — and NEVER to WordPress.org. This is the official,
//   reliable mechanism: it does not depend on injecting into the update
//   transient (which only runs on WP's periodic / forced checks and was the
//   flaky part). The transient filter above stays as a fallback for older
//   WordPress and for tenants on a custom endpoint host.
add_filter( 'update_plugins_www.misterchameleon.nl', function ( $update, $plugin_data, $plugin_file ) {
	if ( plugin_basename( __FILE__ ) !== $plugin_file ) {
		return $update;
	}
	$info = mcc_update_info();
	if ( empty( $info['version'] ) || empty( $info['download_url'] ) ) {
		return $update;
	}
	if ( version_compare( MCC_VERSION, $info['version'], '>=' ) ) {
		return $update; // al up-to-date
	}
	return array(
		'id'           => 'https://www.misterchameleon.nl/mister-chameleon-connect',
		'slug'         => MCC_UPDATE_SLUG,
		'plugin'       => plugin_basename( __FILE__ ),
		// WordPress core's Update-URI path (wp_update_plugins) REQUIRES `version`;
		// it derives `new_version` from it. Omitting `version` makes core drop the
		// update at `if ( ! isset( $update->version ) ) { continue; }`. We send both.
		'version'      => $info['version'],
		'new_version'  => $info['version'],
		'url'          => isset( $info['homepage'] ) ? $info['homepage'] : '',
		'package'      => $info['download_url'],
		'requires'     => isset( $info['requires'] ) ? $info['requires'] : '',
		'requires_php' => isset( $info['requires_php'] ) ? $info['requires_php'] : '',
		'tested'       => isset( $info['tested'] ) ? $info['tested'] : '',
	);
}, 10, 3 );

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. Opruimen bij verwijderen
 * ────────────────────────────────────────────────────────────────────────── */

register_uninstall_hook( __FILE__, 'mcc_uninstall' );
function mcc_uninstall() {
	delete_option( 'mcc_site_key' );
	delete_option( 'mcc_enabled' );
	delete_option( 'mcc_endpoint' );
	delete_transient( 'mcc_update_info' );
}
