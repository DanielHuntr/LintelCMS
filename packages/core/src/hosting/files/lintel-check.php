<?php
/*
 * Can this hosting run Lintel, or host a site published from Lintel?
 *
 * Upload this one file to your website's folder (public_html in cPanel) with File Manager,
 * then open https://your-site/lintel-check.php in your browser. It changes nothing except a
 * test file it removes again. Delete it when you have read the report.
 *
 * It is written for old versions of PHP too, so it can tell you when yours is too old.
 */

$guides = 'https://github.com/DanielHuntr/lintelcms/blob/main/packages/docs/src/content/docs/hosting/';
$minimumNodeMajor = 22;
// What lintel-bridge.php (forms and checkout for published sites) needs.
$bridgeMinimumPhp = '7.4.0';

/** True when PHP may look at this path (open_basedir can hide the rest of the server). */
function lintel_exists($path)
{
    return @file_exists($path);
}

/** Node.js versions the CloudLinux Node.js Selector ("Setup Node.js App") has installed. */
function lintel_selector_node_versions()
{
    $versions = array();
    $folders = @glob('/opt/alt/alt-nodejs*', GLOB_ONLYDIR);
    if (is_array($folders)) {
        foreach ($folders as $folder) {
            if (preg_match('/alt-nodejs(\d+)$/', $folder, $match)) {
                $versions[] = (int) $match[1];
            }
        }
    }
    sort($versions);
    return $versions;
}

function lintel_node_selector_seems_available()
{
    $signs = array(
        '/usr/bin/cloudlinux-selector',
        '/usr/sbin/cloudlinux-selector',
        '/usr/share/l.v.e-manager/utils/cloudlinux-selector.py',
    );
    foreach ($signs as $sign) {
        if (lintel_exists($sign)) {
            return true;
        }
    }
    return count(lintel_selector_node_versions()) > 0;
}

function lintel_folder_is_writable($folder)
{
    $probe = $folder . DIRECTORY_SEPARATOR . '.lintel-check-' . getmypid();
    if (@file_put_contents($probe, 'ok') === false) {
        return false;
    }
    @unlink($probe);
    return true;
}

$facts = array(
    'php' => PHP_VERSION,
    'cpanel' => lintel_exists('/usr/local/cpanel') || isset($_SERVER['cPanel']) || lintel_exists(dirname(__FILE__) . '/../.cpanel'),
    'selector' => lintel_node_selector_seems_available(),
    'nodeVersions' => lintel_selector_node_versions(),
    'writable' => lintel_folder_is_writable(dirname(__FILE__)),
    'curl' => function_exists('curl_init'),
    'openssl' => extension_loaded('openssl'),
    'https' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && $_SERVER['HTTPS'] !== 'off',
);

$newestNode = count($facts['nodeVersions']) > 0 ? max($facts['nodeVersions']) : 0;
$checks = array();
$askHost = array();

$checks[] = array('PHP version', 'PHP ' . $facts['php']);
if ($facts['selector']) {
    $versionWords = $newestNode > 0 ? 'Node.js versions available: ' . implode(', ', $facts['nodeVersions']) : 'the list of versions isn\'t visible from PHP';
    $checks[] = array('Setup Node.js App', 'Seems to be available (' . $versionWords . ')');
} else {
    $checks[] = array('Setup Node.js App', 'Not found on this hosting');
}
$checks[] = array('Saving files', $facts['writable'] ? 'PHP can save files in this folder' : 'PHP can\'t save files in this folder');
$checks[] = array('HTTPS', $facts['https'] ? 'This page was opened over HTTPS' : 'This page was opened without HTTPS. Turn on AutoSSL (SSL/TLS Status in cPanel).');

if ($facts['selector'] && ($newestNode === 0 || $newestNode >= $minimumNodeMajor)) {
    $path = 'run';
    $headline = 'Run Lintel here';
    $advice = 'This hosting offers Setup Node.js App, so the whole of Lintel can run here: the admin, the website and the shop. '
        . 'Next, upload lintel-check.js and open it as a Node.js app to confirm the details, then follow the cPanel guide.';
    $link = array($guides . 'cpanel.md', 'Install Lintel on cPanel hosting');
} elseif ($facts['selector']) {
    $path = 'ask';
    $headline = 'Ask your host for Node.js ' . $minimumNodeMajor;
    $advice = 'This hosting offers Setup Node.js App, but its newest Node.js is ' . $newestNode . '. Lintel needs ' . $minimumNodeMajor . ' or newer. '
        . 'Until your host adds it, you can publish your site here from a Lintel installed somewhere else.';
    $askHost[] = 'Please add Node.js ' . $minimumNodeMajor . ' (or newer) to the Node.js Selector.';
    $link = array($guides . 'cpanel.md', 'Install Lintel on cPanel hosting');
} else {
    $path = 'publish';
    $headline = 'Publish your site here from Lintel';
    $advice = 'This hosting runs PHP but not Node.js, so Lintel itself can\'t run here. '
        . 'Run Lintel somewhere else (your own computer, or a small server) and publish your website to this hosting as files. '
        . 'Forms and checkout keep working through lintel-bridge.php.';
    $link = array($guides . 'choose.md', 'Choose where to host Lintel');
}

if ($path !== 'run') {
    if (version_compare($facts['php'], $bridgeMinimumPhp, '<')) {
        $checks[] = array('Forms and checkout', 'lintel-bridge.php needs PHP ' . $bridgeMinimumPhp . ' or newer');
        $askHost[] = 'Please switch my site to PHP ' . substr($bridgeMinimumPhp, 0, 3) . ' or newer (MultiPHP Manager in cPanel).';
    } elseif (!$facts['curl'] || !$facts['openssl']) {
        $checks[] = array('Forms and checkout', 'lintel-bridge.php needs the curl and openssl PHP extensions');
        $askHost[] = 'Please turn on the curl and openssl PHP extensions for my site.';
    } else {
        $checks[] = array('Forms and checkout', 'lintel-bridge.php can run here');
    }
}
if (!$facts['writable']) {
    $askHost[] = 'Please let my account write to its website folder.';
}

function lintel_html($text)
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

if (PHP_SAPI === 'cli' || (isset($_GET['format']) && $_GET['format'] === 'json')) {
    if (PHP_SAPI !== 'cli') {
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(array('path' => $path, 'headline' => $headline, 'facts' => $facts, 'askHost' => $askHost));
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Can this hosting run Lintel?</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: .4rem 1rem; }
    dt { font-weight: 600; }
    a { color: #7539fd; }
    @media (prefers-color-scheme: dark) { a { color: #a98bff; } }
  </style>
</head>
<body>
  <main>
    <p>Recommended:</p>
    <h1><?php echo lintel_html($headline); ?></h1>
    <p><?php echo lintel_html($advice); ?></p>
    <p><a href="<?php echo lintel_html($link[0]); ?>"><?php echo lintel_html($link[1]); ?></a></p>
    <h2>What this hosting has</h2>
    <dl>
      <?php foreach ($checks as $check) { ?>
        <dt><?php echo lintel_html($check[0]); ?></dt>
        <dd><?php echo lintel_html($check[1]); ?></dd>
      <?php } ?>
    </dl>
    <?php if (count($askHost) > 0) { ?>
      <h2>What to ask your hosting company</h2>
      <ul>
        <?php foreach ($askHost as $question) { ?>
          <li><?php echo lintel_html($question); ?></li>
        <?php } ?>
      </ul>
    <?php } ?>
    <p>When you have read this, delete lintel-check.php from your hosting.</p>
  </main>
</body>
</html>
