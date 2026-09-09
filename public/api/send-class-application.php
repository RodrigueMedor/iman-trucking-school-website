<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') respond(204, []);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['error' => 'Method not allowed.']);

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 25000) respond(413, ['error' => 'Request is too large.']);

$payload = json_decode($raw, true);
if (!is_array($payload)) respond(400, ['error' => 'Invalid request.']);

function value(array $payload, string $key, int $limit = 300): string
{
    return substr(trim((string)($payload[$key] ?? '')), 0, $limit);
}

function html(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

$firstName = value($payload, 'firstName', 100);
$lastName = value($payload, 'lastName', 100);
$email = filter_var(value($payload, 'email', 254), FILTER_VALIDATE_EMAIL);
if ($firstName === '' || $lastName === '' || !$email) {
    respond(400, ['error' => 'Applicant name and a valid email are required.']);
}

$apiKey = getenv('RESEND_API_KEY');
if (!$apiKey) respond(503, ['error' => 'Email delivery is not configured.']);
if (!function_exists('curl_init')) respond(503, ['error' => 'The server PHP cURL extension is not enabled.']);

$phone = value($payload, 'phone', 50);
$course = value($payload, 'courseName', 200);
$session = value($payload, 'sessionName', 200);
$statement = value($payload, 'statement', 1500);
$recipient = getenv('APPLICATION_EMAIL_TO') ?: 'info@imantruckingschool.com';
$from = getenv('APPLICATION_EMAIL_FROM') ?: (getenv('RESULT_EMAIL_FROM') ?: 'Iman Trucking School <noreply@imanlogistics.com>');

$body = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto">'
    . '<h2 style="color:#08085f">New training class application</h2>'
    . '<p><strong>Applicant:</strong> ' . html($firstName . ' ' . $lastName) . '</p>'
    . '<p><strong>Email:</strong> ' . html((string)$email) . '</p>'
    . '<p><strong>Phone:</strong> ' . html($phone ?: 'Not provided') . '</p>'
    . '<p><strong>Program:</strong> ' . html($course ?: 'Not specified') . '</p>'
    . '<p><strong>Academic session:</strong> ' . html($session ?: 'Not specified') . '</p>'
    . '<p><strong>Why they are applying:</strong></p><p>' . nl2br(html($statement ?: 'Not provided')) . '</p>'
    . '<p>The complete application is retained in the CDL Applications admin portal.</p></div>';

$request = [
    'from' => $from,
    'to' => [$recipient],
    'reply_to' => (string)$email,
    'subject' => 'New CDL class application — ' . $firstName . ' ' . $lastName,
    'html' => $body,
];

$curl = curl_init('https://api.resend.com/emails');
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_SLASHES),
]);
$response = curl_exec($curl);
$status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_error($curl);
curl_close($curl);

if ($response === false || $curlError !== '') respond(502, ['error' => 'The email provider could not be reached.']);
if ($status < 200 || $status >= 300) {
    error_log('Resend class application email error: HTTP ' . $status);
    respond(502, ['error' => 'Email delivery failed.']);
}

$providerResponse = json_decode($response, true);
respond(200, ['ok' => true, 'messageId' => $providerResponse['id'] ?? null]);
