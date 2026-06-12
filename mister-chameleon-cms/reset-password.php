<?php
/**
 * One-time password reset script for local Statamic development.
 * Run from the mister-chameleon-cms directory:
 *   php reset-password.php
 *
 * DELETE this file after use.
 */

$email    = 'jmulders@misterchameleon.nl';
$password = 'Chameleon2026!';
$file     = __DIR__ . '/users/' . $email . '.yaml';

if (!file_exists($file)) {
    echo "ERROR: User file not found at: $file\n";
    exit(1);
}

$hash    = password_hash($password, PASSWORD_BCRYPT);
$content = file_get_contents($file);

// Replace (or add) the password_hash line
if (preg_match('/^password_hash:/m', $content)) {
    $content = preg_replace('/^password_hash:.*$/m', 'password_hash: ' . $hash, $content);
} else {
    // Field not present – add it after the first line
    $content = preg_replace('/^(---\n)/m', "$1password_hash: $hash\n", $content, 1);
}

file_put_contents($file, $content);

// Verify the hash works
$ok = password_verify($password, $hash);
echo "Password updated successfully.\n";
echo "Hash  : $hash\n";
echo "Verify: " . ($ok ? "OK ✓" : "FAILED ✗") . "\n\n";
echo "Login with:\n";
echo "  Email   : $email\n";
echo "  Password: $password\n\n";
echo "You can delete this file after logging in.\n";
