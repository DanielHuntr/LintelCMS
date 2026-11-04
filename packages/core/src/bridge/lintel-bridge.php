<?php
/**
 * Lintel bridge: the small companion Lintel uploads beside a website it publishes as files,
 * so forms and the shop work on hosting that only runs PHP. It needs nothing but PHP 7.4 or
 * newer, which every cPanel host has.
 *
 * Lintel replaces this file on every publish; change things in Lintel, not here.
 *
 * Its settings (shared secret, payment keys) and everything it stores (form submissions,
 * paid orders, stock held for baskets) live in a private folder, outside the website when
 * the host allows it. Lintel collects submissions and orders from here with signed
 * requests, so they appear in Forms and Orders as usual.
 *
 *   GET  ?action=token&form=contact     a signed "form opened at" token
 *   POST ?action=form&form=contact      a form's answers
 *   POST ?action=quote                  basket totals, worked out here from the signed catalogue
 *   POST ?action=checkout               holds the stock and starts Stripe Checkout or Mollie
 *   POST ?action=stripe-webhook         Stripe's signed "paid" message
 *   POST ?action=mollie-webhook         Mollie's "something changed", checked with Mollie
 *   GET  ?action=status|pull, POST ?action=ack    Lintel only, signed with the shared secret
 */

declare(strict_types=1);

const LINTEL_BRIDGE_VERSION = 1;
/** The oldest PHP this file is written for: no PHP 8 syntax or functions are used. */
const LINTEL_BRIDGE_MINIMUM_PHP = '7.4.0';
/** Where the private folder may be, relative to this file: outside the website first. */
const LINTEL_PRIVATE_FOLDERS = ['../lintel-private', 'lintel-private'];
/**
 * The first line of every private file. A private file is PHP, so a browser that reaches it
 * gets nothing on any server, whether or not the server reads .htaccess; PHP stops reading at
 * __halt_compiler, so nothing a visitor typed below it can ever run.
 */
const LINTEL_FILE_GUARD = "<?php exit; __halt_compiler();\n";
const LINTEL_FASTEST_HUMAN_SECONDS = 3;
const LINTEL_TOKEN_LIFETIME_SECONDS = 86400;
const LINTEL_SIGNED_REQUEST_WINDOW_SECONDS = 300;
const LINTEL_HOLD_SECONDS = 2100;
/** How long a hold's details stay after it ends, because a bank payment can take weeks. */
const LINTEL_HOLD_KEPT_SECONDS = 2592000;
const LINTEL_SUBMISSIONS_PER_MINUTE = 10;
const LINTEL_MAX_FIELD_LENGTH = 10000;
/** Currencies without minor units, as Mollie writes amounts. */
const LINTEL_ZERO_DECIMAL_CURRENCIES = ['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'];

ini_set('display_errors', '0');

if (version_compare(PHP_VERSION, LINTEL_BRIDGE_MINIMUM_PHP, '<')) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'This website needs PHP ' . LINTEL_BRIDGE_MINIMUM_PHP . ' or newer for its forms and shop. Choose a newer PHP in your hosting control panel.';
} elseif (!defined('LINTEL_BRIDGE_LIBRARY')) {
    lintel_handle_request();
}

function lintel_handle_request(): void
{
    $action = isset($_GET['action']) ? (string) $_GET['action'] : '';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    try {
        if ($method === 'OPTIONS') {
            lintel_cors();
            http_response_code(204);
            return;
        }
        if (lintel_config_or_empty() !== []) {
            lintel_move_old_private_files();
        }
        switch ($action) {
            case 'token':
                lintel_cors();
                lintel_json(200, ['token' => lintel_issue_token((string) ($_GET['form'] ?? ''))]);
                return;
            case 'form':
                lintel_require_post($method);
                lintel_receive_form((string) ($_GET['form'] ?? ''));
                return;
            case 'quote':
                lintel_require_post($method);
                lintel_cors();
                lintel_json(200, lintel_quote(lintel_read_json_body()));
                return;
            case 'checkout':
                lintel_require_post($method);
                lintel_cors();
                lintel_json(200, lintel_start_checkout(lintel_read_json_body()));
                return;
            case 'stripe-webhook':
                lintel_require_post($method);
                lintel_json(200, lintel_stripe_webhook((string) file_get_contents('php://input'), (string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '')));
                return;
            case 'mollie-webhook':
                lintel_require_post($method);
                lintel_json(200, lintel_mollie_webhook((string) ($_POST['id'] ?? '')));
                return;
            case 'status':
            case 'pull':
            case 'ack':
                $body = (string) file_get_contents('php://input');
                lintel_check_signed_request($action, $body);
                if ($action === 'status') {
                    lintel_json(200, lintel_status());
                } elseif ($action === 'pull') {
                    lintel_json(200, lintel_pull());
                } else {
                    lintel_json(200, lintel_ack(json_decode($body, true) ?: []));
                }
                return;
            default:
                lintel_json(404, ['error' => 'There is nothing at this address.']);
        }
    } catch (LintelProblem $problem) {
        if ($action === 'form' && lintel_wants_page()) {
            lintel_page($problem->status, 'Please check your answers', $problem->getMessage());
            return;
        }
        // `message` is what forms on the page show; `error` is what the basket reads.
        lintel_json($problem->status, ['error' => $problem->getMessage(), 'message' => $problem->getMessage(), 'fields' => $problem->fields]);
    } catch (Throwable $error) {
        error_log('Lintel bridge: ' . $error->getMessage());
        lintel_json(500, ['error' => 'Something went wrong on the website. Please try again in a moment.']);
    }
}

/** A problem the visitor (or Lintel) is told about, in plain English. */
class LintelProblem extends Exception
{
    /** @var int */
    public $status;
    /** @var array<string,string> */
    public $fields;

    /** @param array<string,string> $fields */
    public function __construct(int $status, string $message, array $fields = [])
    {
        parent::__construct($message);
        $this->status = $status;
        $this->fields = $fields;
    }
}

// ---------------------------------------------------------------------------------------
// Settings, storage and locking
// ---------------------------------------------------------------------------------------

function lintel_private_folder(): string
{
    static $folder = null;
    if ($folder !== null) {
        return $folder;
    }
    foreach (LINTEL_PRIVATE_FOLDERS as $candidate) {
        $path = __DIR__ . '/' . $candidate;
        if (is_file($path . '/config.php')) {
            return $folder = $path;
        }
    }
    throw new LintelProblem(503, 'This website is still being set up. Please try again in a few minutes.');
}

/** @return array<string,mixed> */
function lintel_config(): array
{
    static $config = null;
    if ($config === null) {
        $config = require lintel_private_folder() . '/config.php';
    }
    return $config;
}

function lintel_secret(): string
{
    return (string) lintel_config()['secret'];
}

function lintel_data_path(string $name): string
{
    $folder = lintel_private_folder() . '/data';
    $path = $folder . '/' . $name;
    $parent = dirname($path);
    if (!is_dir($parent) && !mkdir($parent, 0700, true) && !is_dir($parent)) {
        throw new RuntimeException('The private folder can\'t be written to: ' . $parent);
    }
    return $path;
}

/** A private file's contents without the guard at its top. */
function lintel_read_private(string $path): string
{
    $contents = (string) file_get_contents($path);
    return strpos($contents, LINTEL_FILE_GUARD) === 0 ? substr($contents, strlen(LINTEL_FILE_GUARD)) : $contents;
}

/** Writes whole files only: a temporary file, guarded like the rest, renamed into place. */
function lintel_write_json(string $path, $value): void
{
    $temporary = dirname($path) . '/.tmp-' . bin2hex(random_bytes(8)) . '.php';
    file_put_contents($temporary, LINTEL_FILE_GUARD . json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    rename($temporary, $path);
}

/** What an older companion left as plain .json files, moved behind the guard. */
function lintel_move_old_private_files(): void
{
    $folder = lintel_private_folder();
    $old = array_merge(
        glob($folder . '/*.json') ?: [],
        glob($folder . '/data/*.json') ?: [],
        glob($folder . '/data/queue/*/*.json') ?: []
    );
    if ($old === []) {
        return;
    }
    lintel_with_lock(function () use ($old) {
        foreach ($old as $file) {
            $guarded = substr($file, 0, -strlen('.json')) . '.php';
            if (is_file($file) && !is_file($guarded)) {
                file_put_contents($guarded, LINTEL_FILE_GUARD . (string) file_get_contents($file));
            }
            @unlink($file);
        }
    });
}

/** @return mixed */
function lintel_read_json(string $path, $fallback)
{
    if (!is_file($path)) {
        return $fallback;
    }
    $decoded = json_decode(lintel_read_private($path), true);
    return $decoded === null ? $fallback : $decoded;
}

/** Runs $work while holding the one lock every stock change takes, so nothing oversells. */
function lintel_with_lock(callable $work)
{
    $handle = fopen(lintel_data_path('stock.lock'), 'c');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        throw new RuntimeException('The stock lock could not be taken.');
    }
    try {
        return $work();
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

/**
 * A file Lintel published with its signature, checked before anything in it is believed,
 * so editing it on the host can't change a price.
 *
 * @return array<string,mixed>
 */
function lintel_signed_file(string $name): array
{
    static $cache = [];
    if (isset($cache[$name])) {
        return $cache[$name];
    }
    $path = lintel_private_folder() . '/' . $name;
    if (!is_file($path)) {
        throw new LintelProblem(503, 'This website is still being set up. Please try again in a few minutes.');
    }
    $envelope = json_decode(lintel_read_private($path), true);
    $payload = is_array($envelope) ? (string) ($envelope['payload'] ?? '') : '';
    $signature = is_array($envelope) ? (string) ($envelope['signature'] ?? '') : '';
    if (!hash_equals(hash_hmac('sha256', $payload, lintel_secret()), $signature)) {
        throw new LintelProblem(503, 'This website\'s settings don\'t match what Lintel published. Publish the site again from Lintel.');
    }
    return $cache[$name] = json_decode($payload, true);
}

// ---------------------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------------------

function lintel_json(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function lintel_page(int $status, string $title, string $message, string $back = ''): void
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'");
    $link = $back !== '' ? '<p><a href="' . htmlspecialchars($back, ENT_QUOTES) . '">Go back</a></p>' : '';
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . htmlspecialchars($title, ENT_QUOTES) . '</title>'
        . '<style>body{font:1.1rem/1.6 system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1.5rem}</style></head>'
        . '<body><h1>' . htmlspecialchars($title, ENT_QUOTES) . '</h1><p>' . nl2br(htmlspecialchars($message, ENT_QUOTES)) . '</p>' . $link . '</body></html>';
}

function lintel_require_post(string $method): void
{
    if ($method !== 'POST') {
        throw new LintelProblem(405, 'Send this with POST.');
    }
}

function lintel_wants_page(): bool
{
    $accept = (string) ($_SERVER['HTTP_ACCEPT'] ?? '');
    return strpos($accept, 'text/html') !== false && strpos($accept, 'application/json') === false;
}

/** Baskets on the site's own pages call this file; nobody else's pages may. */
function lintel_cors(): void
{
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    $allowed = (string) (lintel_config_or_empty()['siteAddress'] ?? '');
    if ($origin !== '' && $allowed !== '' && rtrim($origin, '/') === rtrim($allowed, '/')) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Headers: content-type');
        header('Vary: Origin');
    }
}

function lintel_config_or_empty(): array
{
    try {
        return lintel_config();
    } catch (LintelProblem $problem) {
        return [];
    }
}

/** @return array<string,mixed> */
function lintel_read_json_body(): array
{
    $decoded = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($decoded)) {
        throw new LintelProblem(400, 'The basket couldn\'t be read. Reload the page and try again.');
    }
    return $decoded;
}

/** Sends a request to a payment service, with cURL when the host has it. */
function lintel_http(string $method, string $url, array $headers, ?string $body): array
{
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30,
        ]);
        if ($body !== null) {
            curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
        }
        $response = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if ($response === false) {
            throw new LintelProblem(502, 'The payment service couldn\'t be reached. Please try again.');
        }
        return [$status, json_decode((string) $response, true) ?: []];
    }
    $context = stream_context_create(['http' => [
        'method' => $method,
        'header' => implode("\r\n", $headers),
        'content' => $body ?? '',
        'ignore_errors' => true,
        'timeout' => 30,
    ]]);
    $response = @file_get_contents($url, false, $context);
    if ($response === false) {
        throw new LintelProblem(502, 'The payment service couldn\'t be reached. Please try again.');
    }
    $status = 0;
    foreach ($http_response_header ?? [] as $line) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $match)) {
            $status = (int) $match[1];
        }
    }
    return [$status, json_decode($response, true) ?: []];
}

function lintel_new_id(): string
{
    return bin2hex(random_bytes(12));
}

// ---------------------------------------------------------------------------------------
// Signed requests from Lintel: HMAC over time, a one-off nonce, the action and the body.
// ---------------------------------------------------------------------------------------

function lintel_check_signed_request(string $action, string $body): void
{
    $timestamp = (string) ($_SERVER['HTTP_X_LINTEL_TIMESTAMP'] ?? '');
    $nonce = (string) ($_SERVER['HTTP_X_LINTEL_NONCE'] ?? '');
    $signature = (string) ($_SERVER['HTTP_X_LINTEL_SIGNATURE'] ?? '');
    if (!preg_match('/^\d{1,12}$/', $timestamp) || !preg_match('/^[a-f0-9]{16,64}$/', $nonce)) {
        throw new LintelProblem(401, 'This request isn\'t signed by Lintel.');
    }
    if (abs(time() - (int) $timestamp) > LINTEL_SIGNED_REQUEST_WINDOW_SECONDS) {
        throw new LintelProblem(401, 'This request is too old, or the clocks disagree by more than five minutes.');
    }
    $expected = hash_hmac('sha256', $timestamp . "\n" . $nonce . "\n" . $action . "\n" . $body, lintel_secret());
    if (!hash_equals($expected, $signature)) {
        throw new LintelProblem(401, 'This request isn\'t signed by Lintel.');
    }
    lintel_with_lock(function () use ($nonce) {
        $path = lintel_data_path('nonces.php');
        $seen = lintel_read_json($path, []);
        $now = time();
        $seen = array_filter($seen, function ($at) use ($now) {
            return $at > $now - 2 * LINTEL_SIGNED_REQUEST_WINDOW_SECONDS;
        });
        if (isset($seen[$nonce])) {
            throw new LintelProblem(401, 'This request was already used once.');
        }
        $seen[$nonce] = $now;
        lintel_write_json($path, $seen);
    });
}

function lintel_status(): array
{
    return [
        'bridgeVersion' => LINTEL_BRIDGE_VERSION,
        'phpVersion' => PHP_VERSION,
        'minimumPhpVersion' => LINTEL_BRIDGE_MINIMUM_PHP,
        'canEmail' => function_exists('mail'),
        'hasCurl' => function_exists('curl_init'),
        'privateFolderOutsideWebsite' => strpos(realpath(lintel_private_folder()) ?: '', realpath(__DIR__) ?: '') !== 0,
    ];
}

function lintel_pull(): array
{
    $submissions = [];
    foreach (glob(lintel_data_path('queue/submissions') . '/*.php') ?: [] as $file) {
        $submissions[] = lintel_read_json($file, null);
    }
    $orders = [];
    foreach (glob(lintel_data_path('queue/orders') . '/*.php') ?: [] as $file) {
        $order = lintel_read_json($file, null);
        if (is_array($order) && empty($order['ackedAt'])) {
            $orders[] = $order;
        }
    }
    return ['submissions' => array_values(array_filter($submissions)), 'orders' => $orders];
}

/** Lintel has taken these in. Submissions go; orders stay counted until the next catalogue. */
function lintel_ack(array $body): array
{
    $forgotten = 0;
    foreach ((array) ($body['submissions'] ?? []) as $id) {
        $path = lintel_data_path('queue/submissions/' . preg_replace('/[^a-f0-9]/', '', (string) $id) . '.php');
        if (is_file($path) && unlink($path)) {
            $forgotten++;
        }
    }
    lintel_with_lock(function () use ($body, &$forgotten) {
        foreach ((array) ($body['orders'] ?? []) as $id) {
            $path = lintel_data_path('queue/orders/' . preg_replace('/[^a-f0-9]/', '', (string) $id) . '.php');
            $order = lintel_read_json($path, null);
            if (is_array($order) && empty($order['ackedAt'])) {
                $order['ackedAt'] = time();
                lintel_write_json($path, $order);
                $forgotten++;
            }
        }
    });
    return ['acknowledged' => $forgotten];
}

// ---------------------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------------------

function lintel_issue_token(string $handle): string
{
    $forms = lintel_signed_file('forms.php');
    if (!isset($forms['forms'][$handle])) {
        throw new LintelProblem(404, 'There is no such form.');
    }
    $openedAt = (string) time();
    return $openedAt . '.' . hash_hmac('sha256', 'form:' . $handle . '.' . $openedAt, lintel_secret());
}

/** "fine", "tooFast", "expired" or "invalid". */
function lintel_check_token(string $handle, string $token, int $now): string
{
    $parts = explode('.', $token);
    if (count($parts) !== 2 || !preg_match('/^\d{1,12}$/', $parts[0])) {
        return 'invalid';
    }
    $expected = hash_hmac('sha256', 'form:' . $handle . '.' . $parts[0], lintel_secret());
    if (!hash_equals($expected, $parts[1])) {
        return 'invalid';
    }
    $age = $now - (int) $parts[0];
    if ($age < LINTEL_FASTEST_HUMAN_SECONDS) {
        return 'tooFast';
    }
    return $age > LINTEL_TOKEN_LIFETIME_SECONDS ? 'expired' : 'fine';
}

function lintel_receive_form(string $handle): void
{
    $forms = lintel_signed_file('forms.php');
    $form = $forms['forms'][$handle] ?? null;
    if (!is_array($form)) {
        throw new LintelProblem(404, 'There is no such form.');
    }
    if (empty($form['acceptingSubmissions'])) {
        throw new LintelProblem(403, 'This form isn\'t taking submissions at the moment.');
    }
    $answers = lintel_form_answers();
    $pretendReceived = false;
    if (trim(implode('', array_map('strval', (array) ($answers['_website'] ?? '')))) !== '') {
        $pretendReceived = true;
    } else {
        $check = lintel_check_token($handle, (string) ($answers['_token'] ?? ''), time());
        if ($check === 'invalid' || $check === 'expired') {
            throw new LintelProblem(400, 'This form was open too long or couldn\'t be checked. Reload the page and send it again.');
        }
        $pretendReceived = $check === 'tooFast';
    }
    if (!$pretendReceived) {
        lintel_limit_rate();
        $values = lintel_check_answers($form, $answers);
        $submission = [
            'id' => lintel_new_id(),
            'form' => $handle,
            'values' => $values,
            'receivedAt' => gmdate('c'),
            'sourceUrl' => substr((string) ($_SERVER['HTTP_REFERER'] ?? ''), 0, 2000),
            'notifiedByHost' => lintel_email_owner($form, $values),
        ];
        lintel_write_json(lintel_data_path('queue/submissions/' . $submission['id'] . '.php'), $submission);
    }
    $confirmation = $form['confirmation'] ?? ['type' => 'message', 'message' => 'Thank you.'];
    if (lintel_wants_page()) {
        if (($confirmation['type'] ?? '') === 'redirect') {
            header('Location: ' . (string) $confirmation['url'], true, 303);
            return;
        }
        lintel_page(201, (string) $form['name'], (string) ($confirmation['message'] ?? 'Thank you.'), (string) ($_SERVER['HTTP_REFERER'] ?? ''));
        return;
    }
    lintel_json(201, ['received' => true, 'confirmation' => $confirmation]);
}

/**
 * The answers as sent. Read from the body by hand, because a plain HTML form sends
 * several ticked checkboxes under one name, which $_POST would cut down to the last.
 */
function lintel_form_answers(): array
{
    $type = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
    if (stripos($type, 'application/x-www-form-urlencoded') === false) {
        return $_POST;
    }
    $answers = [];
    foreach (explode('&', (string) file_get_contents('php://input')) as $pair) {
        if ($pair === '') {
            continue;
        }
        $parts = explode('=', $pair, 2);
        $name = urldecode($parts[0]);
        $value = urldecode($parts[1] ?? '');
        if (isset($answers[$name])) {
            $answers[$name] = array_merge((array) $answers[$name], [$value]);
        } else {
            $answers[$name] = $value;
        }
    }
    return $answers;
}

/** Ten submissions a minute from one address is plenty for people. */
function lintel_limit_rate(): void
{
    $key = hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? '') . lintel_secret());
    lintel_with_lock(function () use ($key) {
        $path = lintel_data_path('rate.php');
        $minute = (int) floor(time() / 60);
        $counts = lintel_read_json($path, []);
        if (($counts['minute'] ?? 0) !== $minute) {
            $counts = ['minute' => $minute, 'by' => []];
        }
        $counts['by'][$key] = ($counts['by'][$key] ?? 0) + 1;
        lintel_write_json($path, $counts);
        if ($counts['by'][$key] > LINTEL_SUBMISSIONS_PER_MINUTE) {
            throw new LintelProblem(429, 'Too many forms sent from here in the last minute. Please wait a moment.');
        }
    });
}

/** Required answers, email addresses and choices, as Lintel checks them again on arrival. */
function lintel_check_answers(array $form, array $answers): array
{
    $values = [];
    $problems = [];
    foreach ((array) $form['fields'] as $field) {
        $handle = (string) $field['handle'];
        $raw = $answers[$handle] ?? null;
        $value = is_array($raw) ? array_values(array_map('strval', $raw)) : trim((string) ($raw ?? ''));
        $isEmpty = $value === '' || $value === [];
        if ($isEmpty) {
            if (!empty($field['required'])) {
                $problems[$handle] = 'Please fill in “' . $field['label'] . '”.';
            }
            continue;
        }
        if (is_string($value) && strlen($value) > LINTEL_MAX_FIELD_LENGTH) {
            $problems[$handle] = '“' . $field['label'] . '” is too long.';
            continue;
        }
        if ($field['type'] === 'email' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $problems[$handle] = 'Please enter an email address in “' . $field['label'] . '”.';
            continue;
        }
        $choices = (array) ($field['choices'] ?? []);
        if ($choices !== []) {
            foreach ((array) $value as $picked) {
                if (!in_array($picked, $choices, true)) {
                    $problems[$handle] = 'Please choose one of the answers offered for “' . $field['label'] . '”.';
                }
            }
        }
        $values[$handle] = $value;
    }
    if ($problems !== []) {
        throw new LintelProblem(422, implode("\n", $problems), $problems);
    }
    return $values;
}

/** Tells the site owner straight away, when Lintel was asked to send email from the host. */
function lintel_email_owner(array $form, array $values): bool
{
    $recipients = (array) ($form['notify'] ?? []);
    if ($recipients === [] || empty(lintel_config()['emailFromHost']) || !function_exists('mail')) {
        return false;
    }
    $lines = [];
    foreach ($values as $handle => $value) {
        $lines[] = $handle . ': ' . (is_array($value) ? implode(', ', $value) : $value);
    }
    $subject = 'New ' . preg_replace('/[\r\n]+/', ' ', (string) $form['name']) . ' submission';
    $from = (string) (lintel_config()['emailFrom'] ?? '');
    $headers = ['Content-Type: text/plain; charset=utf-8'];
    if ($from !== '' && filter_var($from, FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'From: ' . $from;
    }
    $sent = false;
    foreach ($recipients as $recipient) {
        if (filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            $sent = mail((string) $recipient, $subject, implode("\n", $lines) . "\n\nSee it in Lintel's Forms after the next sync.", implode("\r\n", $headers)) || $sent;
        }
    }
    return $sent;
}

// ---------------------------------------------------------------------------------------
// Shop: totals, stock and payments, from the signed catalogue only
// ---------------------------------------------------------------------------------------

/** @return array<string,mixed> */
function lintel_catalogue(): array
{
    return lintel_signed_file('catalogue.php');
}

function lintel_market_for(array $catalogue, string $country): array
{
    $primary = null;
    foreach ($catalogue['markets'] as $market) {
        if (in_array($country, (array) $market['countries'], true)) {
            return $market;
        }
        if (!empty($market['isPrimary'])) {
            $primary = $market;
        }
    }
    if ($primary === null) {
        throw new LintelProblem(400, 'This shop isn\'t selling yet.');
    }
    return $primary;
}

/**
 * Works out a basket's totals from the catalogue alone. Whatever the browser says a thing
 * costs is ignored; only variant ids, quantities, the country and a code are read.
 */
function lintel_quote(array $basket): array
{
    $catalogue = lintel_catalogue();
    $country = strtoupper(preg_replace('/[^A-Za-z]/', '', (string) ($basket['country'] ?? '')));
    if (strlen($country) !== 2) {
        throw new LintelProblem(400, 'Please choose the country to deliver to.');
    }
    $market = lintel_market_for($catalogue, $country);
    $currency = (string) $market['currency'];
    $lines = [];
    foreach ((array) ($basket['lines'] ?? []) as $requested) {
        $variantId = (string) ($requested['variantId'] ?? '');
        $quantity = (int) ($requested['quantity'] ?? 0);
        $variant = $catalogue['variants'][$variantId] ?? null;
        if (!is_array($variant) || !isset($variant['prices'][$market['id']])) {
            throw new LintelProblem(400, 'Something in your basket is no longer for sale. Remove it and try again.');
        }
        if ($quantity < 1 || $quantity > 100) {
            throw new LintelProblem(400, 'Quantities should be between 1 and 100.');
        }
        $unit = (int) $variant['prices'][$market['id']];
        $lines[] = [
            'variantId' => $variantId,
            'productId' => (string) $variant['productId'],
            'productTitle' => (string) $variant['productTitle'],
            'variantTitle' => (string) $variant['variantTitle'],
            'sku' => $variant['sku'],
            'imageId' => $variant['imageId'] ?? null,
            'quantity' => $quantity,
            'unitAmount' => $unit,
            'subtotalAmount' => $unit * $quantity,
            'discountAmount' => 0,
            'taxAmount' => 0,
            'weightGrams' => (int) $variant['weightGrams'],
        ];
    }
    if ($lines === []) {
        throw new LintelProblem(400, 'Your basket is empty.');
    }
    $subtotal = array_sum(array_column($lines, 'subtotalAmount'));
    $discounts = [];
    $freeShipping = false;
    $code = trim((string) ($basket['discountCode'] ?? ''));
    if ($code !== '') {
        [$lines, $discount, $freeShipping] = lintel_apply_code($catalogue, $code, $lines, $currency, $subtotal);
        $discounts[] = $discount;
    }
    $discountAmount = array_sum(array_column($lines, 'discountAmount'));
    $weight = 0;
    foreach ($lines as $line) {
        $weight += $line['weightGrams'] * $line['quantity'];
    }
    $shipping = lintel_shipping($catalogue, $market, $country, $weight, $subtotal - $discountAmount, (string) ($basket['shippingRateId'] ?? ''));
    if ($freeShipping && $shipping['amount'] > 0) {
        $discounts[0]['amount'] = $shipping['amount'];
        $shipping['amount'] = 0;
    }
    $rate = (float) ($catalogue['taxes']['rates'][$country] ?? 0);
    $included = !empty($market['taxesIncluded']);
    $tax = function (int $amount) use ($rate, $included): int {
        return $included ? (int) round($amount - $amount / (1 + $rate / 100)) : (int) round($amount * $rate / 100);
    };
    foreach ($lines as $index => $line) {
        $lines[$index]['taxAmount'] = $tax($line['subtotalAmount'] - $line['discountAmount']);
    }
    $shipping['taxAmount'] = !empty($catalogue['taxes']['taxShipping']) ? $tax($shipping['amount']) : 0;
    $taxAmount = array_sum(array_column($lines, 'taxAmount')) + $shipping['taxAmount'];
    $total = $subtotal - $discountAmount + $shipping['amount'] + ($included ? 0 : $taxAmount);
    return [
        'marketId' => $market['id'],
        'currency' => $currency,
        'paymentProvider' => $market['paymentProvider'],
        'lines' => $lines,
        'shippingLine' => $shipping,
        'shippingOptions' => $shipping['options'],
        'discounts' => $discounts,
        'subtotalAmount' => $subtotal,
        'discountAmount' => $discountAmount,
        'shippingAmount' => $shipping['amount'],
        'taxAmount' => $taxAmount,
        'totalAmount' => $total,
        'taxesIncluded' => $included,
    ];
}

/** @return array{0: array, 1: array, 2: bool} */
function lintel_apply_code(array $catalogue, string $code, array $lines, string $currency, int $subtotal): array
{
    $found = null;
    foreach ((array) $catalogue['discounts'] as $discount) {
        if (strcasecmp((string) $discount['code'], $code) === 0) {
            $found = $discount;
        }
    }
    $now = time();
    if ($found === null
        || strtotime((string) $found['startsAt']) > $now
        || ($found['endsAt'] !== null && strtotime((string) $found['endsAt']) <= $now)) {
        throw new LintelProblem(400, 'That discount code isn\'t valid right now.', ['discountCode' => 'That discount code isn\'t valid right now.']);
    }
    if ($found['usageLimit'] !== null && $found['usedCount'] + lintel_local_code_uses((string) $found['code'], $catalogue) >= $found['usageLimit']) {
        throw new LintelProblem(400, 'That discount code has been used up.', ['discountCode' => 'That discount code has been used up.']);
    }
    $minimum = $found['minimumSpend'][$currency] ?? 0;
    if ($subtotal < $minimum) {
        throw new LintelProblem(400, 'Spend a little more to use that code.', ['discountCode' => 'Spend a little more to use that code.']);
    }
    $eligible = [];
    foreach ($lines as $index => $line) {
        if ($found['scope'] === 'order' || in_array($line['productId'], (array) $found['productIds'], true)) {
            $eligible[] = $index;
        }
    }
    $eligibleTotal = 0;
    foreach ($eligible as $index) {
        $eligibleTotal += $lines[$index]['subtotalAmount'];
    }
    $amount = 0;
    if ($found['kind'] === 'percentage') {
        $amount = (int) round($eligibleTotal * $found['percentOff'] / 100);
    } elseif ($found['kind'] === 'fixed_amount') {
        $amount = min($eligibleTotal, (int) ($found['amounts'][$currency] ?? 0));
    } elseif ($found['kind'] !== 'free_shipping') {
        throw new LintelProblem(400, 'That code only works in Lintel\'s own shop.', ['discountCode' => 'That code only works in Lintel\'s own shop.']);
    }
    // Spread over the eligible lines in proportion, the remainder on the last one.
    $left = $amount;
    foreach ($eligible as $position => $index) {
        $share = $position === count($eligible) - 1 ? $left : (int) floor($amount * $lines[$index]['subtotalAmount'] / max(1, $eligibleTotal));
        $lines[$index]['discountAmount'] = $share;
        $left -= $share;
    }
    $applied = ['code' => (string) $found['code'], 'title' => (string) $found['title'], 'amount' => $amount, 'discountId' => (string) $found['id']];
    if ($found['kind'] === 'free_shipping') {
        $applied['freeShipping'] = true;
    }
    return [$lines, $applied, $found['kind'] === 'free_shipping'];
}

/** Uses of a code here since the catalogue was made (Lintel's count covers the rest). */
function lintel_local_code_uses(string $code, array $catalogue): int
{
    $uses = 0;
    foreach (lintel_counted_orders($catalogue) as $order) {
        foreach ((array) $order['discounts'] as $discount) {
            if (strcasecmp((string) $discount['code'], $code) === 0) {
                $uses++;
            }
        }
    }
    return $uses;
}

function lintel_shipping(array $catalogue, array $market, string $country, int $weight, int $subtotal, string $chosen): array
{
    foreach ((array) $catalogue['shipping'] as $zone) {
        if (!in_array($country, (array) $zone['countries'], true)) {
            continue;
        }
        $options = [];
        foreach ((array) $zone['rates'] as $rate) {
            $price = $rate['byMarket'][$market['id']] ?? null;
            if (!is_array($price)) {
                continue;
            }
            $amount = null;
            if ($rate['kind'] === 'flat') {
                $amount = $price['amount'];
            } else {
                foreach ((array) $price['brackets'] as $bracket) {
                    if ($bracket['upToGrams'] === null || $weight <= $bracket['upToGrams']) {
                        $amount = $bracket['amount'];
                        break;
                    }
                }
            }
            if ($amount === null) {
                continue;
            }
            if ($price['freeOver'] !== null && $subtotal >= $price['freeOver']) {
                $amount = 0;
            }
            $options[] = ['rateId' => (string) $rate['id'], 'name' => (string) $rate['name'], 'amount' => (int) $amount, 'deliveryEstimate' => (string) $rate['deliveryEstimate']];
        }
        if ($options === []) {
            break;
        }
        $picked = $options[0];
        foreach ($options as $option) {
            if ($option['rateId'] === $chosen) {
                $picked = $option;
            }
        }
        return ['rateId' => $picked['rateId'], 'name' => $picked['name'], 'amount' => $picked['amount'], 'taxAmount' => 0, 'options' => $options];
    }
    throw new LintelProblem(400, 'Sorry, this shop doesn\'t deliver to that country.', ['country' => 'Sorry, this shop doesn\'t deliver to that country.']);
}

/**
 * Orders this bridge took that the current catalogue doesn't know about yet: not yet
 * collected by Lintel, or collected after the catalogue was made.
 */
function lintel_counted_orders(array $catalogue): array
{
    $made = strtotime((string) $catalogue['generatedAt']);
    $orders = [];
    foreach (glob(lintel_data_path('queue/orders') . '/*.php') ?: [] as $file) {
        $order = lintel_read_json($file, null);
        if (!is_array($order)) {
            continue;
        }
        if (!empty($order['ackedAt']) && $order['ackedAt'] < $made) {
            // Lintel's catalogue already counts it; forget it for good.
            @unlink($file);
            continue;
        }
        $orders[] = $order;
    }
    return $orders;
}

/** How many of a variant can still be sold here: catalogue stock less orders and holds. */
function lintel_available(array $catalogue, string $variantId, array $holds, int $now, string $exceptHold = ''): ?int
{
    $stock = $catalogue['variants'][$variantId]['stock'] ?? null;
    if ($stock === null) {
        return null;
    }
    $taken = 0;
    foreach (lintel_counted_orders($catalogue) as $order) {
        foreach ((array) $order['lines'] as $line) {
            if ($line['variantId'] === $variantId) {
                $taken += (int) $line['quantity'];
            }
        }
    }
    foreach ($holds as $holdId => $hold) {
        if ($holdId === $exceptHold || $hold['expiresAt'] < $now || !empty($hold['ordered'])) {
            continue;
        }
        foreach ((array) $hold['quote']['lines'] as $line) {
            if ($line['variantId'] === $variantId) {
                $taken += (int) $line['quantity'];
            }
        }
    }
    return max(0, (int) $stock - $taken);
}

function lintel_read_address(array $basket, string $country): array
{
    $address = (array) ($basket['address'] ?? []);
    $text = function (string $key, int $max) use ($address): string {
        return substr(trim(preg_replace('/[\x00-\x1F]/', ' ', (string) ($address[$key] ?? ''))), 0, $max);
    };
    $result = [
        'name' => $text('name', 200),
        'company' => $text('company', 200),
        'line1' => $text('line1', 200),
        'line2' => $text('line2', 200),
        'city' => $text('city', 200),
        'region' => $text('region', 200),
        'postalCode' => $text('postalCode', 20),
        'country' => $country,
        'phone' => $text('phone', 40),
    ];
    $problems = [];
    foreach (['name' => 'your name', 'line1' => 'the street address', 'city' => 'the town or city'] as $key => $label) {
        if ($result[$key] === '') {
            $problems[$key] = 'Please enter ' . $label . '.';
        }
    }
    if ($problems !== []) {
        throw new LintelProblem(422, implode("\n", $problems), $problems);
    }
    return $result;
}

/** Holds the stock for half an hour and sends the shopper to pay. */
function lintel_start_checkout(array $basket): array
{
    $email = trim((string) ($basket['email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new LintelProblem(422, 'Please enter your email address.', ['email' => 'Please enter your email address.']);
    }
    $quote = lintel_quote($basket);
    $address = lintel_read_address($basket, strtoupper((string) $basket['country']));
    $catalogue = lintel_catalogue();
    $holdId = lintel_new_id();
    lintel_with_lock(function () use ($catalogue, $quote, $email, $address, $holdId) {
        $path = lintel_data_path('holds.php');
        $now = time();
        $holds = array_filter(lintel_read_json($path, []), function ($hold) use ($now) {
            return $hold['expiresAt'] > $now - LINTEL_HOLD_KEPT_SECONDS;
        });
        $wanted = [];
        foreach ($quote['lines'] as $line) {
            $wanted[$line['variantId']] = ($wanted[$line['variantId']] ?? 0) + $line['quantity'];
        }
        foreach ($wanted as $variantId => $quantity) {
            $available = lintel_available($catalogue, $variantId, $holds, $now);
            if ($available !== null && $available < $quantity) {
                throw new LintelProblem(409, $available === 0
                    ? 'Sorry, ' . $catalogue['variants'][$variantId]['productTitle'] . ' has just sold out.'
                    : 'Sorry, only ' . $available . ' of ' . $catalogue['variants'][$variantId]['productTitle'] . ' left.');
            }
        }
        $holds[$holdId] = ['quote' => $quote, 'email' => $email, 'address' => $address, 'createdAt' => $now, 'expiresAt' => $now + LINTEL_HOLD_SECONDS];
        lintel_write_json($path, $holds);
    });
    $url = $quote['paymentProvider'] === 'mollie'
        ? lintel_create_mollie_payment($holdId, $quote)
        : lintel_create_stripe_session($holdId, $quote, $email);
    return ['url' => $url, 'holdId' => $holdId, 'totalAmount' => $quote['totalAmount'], 'currency' => $quote['currency']];
}

function lintel_site_address(): string
{
    return rtrim((string) (lintel_config()['siteAddress'] ?? ''), '/');
}

function lintel_create_stripe_session(string $holdId, array $quote, string $email): string
{
    $key = (string) (lintel_config()['stripeSecretKey'] ?? '');
    if ($key === '') {
        throw new LintelProblem(503, 'Payments aren\'t set up for this shop yet.');
    }
    $fields = [
        'mode' => 'payment',
        'customer_email' => $email,
        'success_url' => lintel_site_address() . '/shop/thank-you/?order=' . $holdId,
        'cancel_url' => lintel_site_address() . '/shop/basket/',
        'line_items[0][quantity]' => 1,
        'line_items[0][price_data][currency]' => strtolower($quote['currency']),
        'line_items[0][price_data][unit_amount]' => $quote['totalAmount'],
        'line_items[0][price_data][product_data][name]' => 'Your order (' . count($quote['lines']) . ' item' . (count($quote['lines']) === 1 ? '' : 's') . ')',
        'metadata[lintel_hold]' => $holdId,
        'payment_intent_data[metadata][lintel_hold]' => $holdId,
        'expires_at' => time() + 1800,
    ];
    [$status, $session] = lintel_http('POST', lintel_payment_api('stripeApiBase', 'https://api.stripe.com') . '/v1/checkout/sessions', [
        'Authorization: Bearer ' . $key,
        'Content-Type: application/x-www-form-urlencoded',
    ], http_build_query($fields));
    if ($status !== 200 || empty($session['url'])) {
        throw new LintelProblem(502, 'Stripe couldn\'t start the payment: ' . (string) ($session['error']['message'] ?? 'no reason given'));
    }
    return (string) $session['url'];
}

function lintel_create_mollie_payment(string $holdId, array $quote): string
{
    $key = (string) (lintel_config()['mollieApiKey'] ?? '');
    if ($key === '') {
        throw new LintelProblem(503, 'Payments aren\'t set up for this shop yet.');
    }
    $body = json_encode([
        'amount' => ['currency' => $quote['currency'], 'value' => lintel_decimal($quote['totalAmount'], $quote['currency'])],
        'description' => 'Your order',
        'redirectUrl' => lintel_site_address() . '/shop/thank-you/?order=' . $holdId,
        'webhookUrl' => lintel_site_address() . '/lintel-bridge.php?action=mollie-webhook',
        'metadata' => ['lintel_hold' => $holdId],
    ]);
    [$status, $payment] = lintel_http('POST', lintel_payment_api('mollieApiBase', 'https://api.mollie.com') . '/v2/payments', [
        'Authorization: Bearer ' . $key,
        'Content-Type: application/json',
    ], (string) $body);
    if ($status >= 300 || empty($payment['_links']['checkout']['href'])) {
        throw new LintelProblem(502, 'Mollie couldn\'t start the payment: ' . (string) ($payment['detail'] ?? 'no reason given'));
    }
    return (string) $payment['_links']['checkout']['href'];
}

function lintel_payment_api(string $setting, string $fallback): string
{
    return rtrim((string) (lintel_config()[$setting] ?? $fallback), '/');
}

function lintel_decimal(int $amount, string $currency): string
{
    return in_array($currency, LINTEL_ZERO_DECIMAL_CURRENCIES, true) ? (string) $amount : number_format($amount / 100, 2, '.', '');
}

/** Checks Stripe's signature (HMAC-SHA256 of "time.body"), then records a paid order once. */
function lintel_stripe_webhook(string $payload, string $header): array
{
    $secret = (string) (lintel_config()['stripeWebhookSecret'] ?? '');
    if ($secret === '') {
        throw new LintelProblem(503, 'The Stripe signing secret isn\'t set in Lintel yet.');
    }
    $timestamp = 0;
    $signatures = [];
    foreach (explode(',', $header) as $part) {
        $pair = explode('=', trim($part), 2);
        if (count($pair) !== 2) {
            continue;
        }
        if ($pair[0] === 't') {
            $timestamp = (int) $pair[1];
        } elseif ($pair[0] === 'v1') {
            $signatures[] = $pair[1];
        }
    }
    $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
    $valid = false;
    foreach ($signatures as $signature) {
        $valid = $valid || hash_equals($expected, $signature);
    }
    if (!$valid || abs(time() - $timestamp) > LINTEL_SIGNED_REQUEST_WINDOW_SECONDS) {
        throw new LintelProblem(400, 'This request isn\'t signed by Stripe with this shop\'s signing secret.');
    }
    $event = json_decode($payload, true);
    // A bank debit or transfer is unpaid when the session completes, and paid days later.
    $paidEvents = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
    if (!is_array($event) || !in_array($event['type'] ?? '', $paidEvents, true)) {
        return ['received' => true];
    }
    $session = (array) ($event['data']['object'] ?? []);
    if (($session['payment_status'] ?? '') !== 'paid') {
        return ['received' => true];
    }
    $order = lintel_record_paid_order(
        (string) ($session['metadata']['lintel_hold'] ?? ''),
        'stripe',
        (string) ($session['payment_intent'] ?? $session['id'] ?? ''),
        (int) ($session['amount_total'] ?? -1),
        strtoupper((string) ($session['currency'] ?? '')),
        'stripe:' . (string) ($event['id'] ?? ''),
        $event['livemode'] ?? $session['livemode'] ?? null
    );
    return ['received' => true, 'order' => $order];
}

/** Mollie only says "look at payment tr_…"; the payment is fetched back from Mollie itself. */
function lintel_mollie_webhook(string $paymentId): array
{
    if (!preg_match('/^tr_[A-Za-z0-9]+$/', $paymentId)) {
        return ['received' => true];
    }
    [$status, $payment] = lintel_http('GET', lintel_payment_api('mollieApiBase', 'https://api.mollie.com') . '/v2/payments/' . $paymentId, [
        'Authorization: Bearer ' . (string) (lintel_config()['mollieApiKey'] ?? ''),
    ], null);
    if ($status !== 200 || ($payment['status'] ?? '') !== 'paid') {
        return ['received' => true];
    }
    $currency = strtoupper((string) ($payment['amount']['currency'] ?? ''));
    $value = (string) ($payment['amount']['value'] ?? '');
    $amount = in_array($currency, LINTEL_ZERO_DECIMAL_CURRENCIES, true) ? (int) $value : (int) round(((float) $value) * 100);
    $mode = $payment['mode'] ?? null;
    $livemode = $mode === 'test' ? false : ($mode === 'live' ? true : null);
    $order = lintel_record_paid_order((string) ($payment['metadata']['lintel_hold'] ?? ''), 'mollie', $paymentId, $amount, $currency, 'mollie:' . $paymentId, $livemode);
    return ['received' => true, 'order' => $order];
}

/**
 * Turns a hold into an order for Lintel to collect, once per payment. A payment that
 * doesn't match the hold's total is kept aside for a person to look at. $livemode is what the
 * provider said, or null when it said nothing, which Lintel takes as a real sale.
 */
function lintel_record_paid_order(string $holdId, string $provider, string $paymentId, int $amount, string $currency, string $eventKey, ?bool $livemode = null): ?string
{
    return lintel_with_lock(function () use ($holdId, $provider, $paymentId, $amount, $currency, $eventKey, $livemode) {
        $eventsPath = lintel_data_path('payment-events.php');
        $events = lintel_read_json($eventsPath, []);
        if (isset($events[$eventKey])) {
            return $events[$eventKey];
        }
        $holdsPath = lintel_data_path('holds.php');
        $holds = lintel_read_json($holdsPath, []);
        $hold = $holds[$holdId] ?? null;
        if (!is_array($hold)) {
            return null;
        }
        $quote = $hold['quote'];
        $order = [
            'id' => $holdId,
            'provider' => $provider,
            'providerPaymentId' => $paymentId,
            'paidAt' => gmdate('c'),
            'paidAmount' => $amount,
            'paidCurrency' => $currency,
            'livemode' => $livemode,
            'matches' => $amount === $quote['totalAmount'] && $currency === $quote['currency'],
            'email' => $hold['email'],
            'shippingAddress' => $hold['address'],
        ] + $quote;
        unset($order['shippingOptions']);
        lintel_write_json(lintel_data_path('queue/orders/' . $holdId . '.php'), $order);
        $holds[$holdId]['ordered'] = true;
        lintel_write_json($holdsPath, $holds);
        $events[$eventKey] = $holdId;
        lintel_write_json($eventsPath, $events);
        return $holdId;
    });
}
