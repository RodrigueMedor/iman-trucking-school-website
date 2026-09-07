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

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    respond(204, []);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'Method not allowed.']);
}

$raw = file_get_contents('php://input');
if ($raw === false || strlen($raw) > 100000) {
    respond(413, ['error' => 'Request is too large.']);
}

$payload = json_decode($raw, true);
$recipient = filter_var(trim((string)($payload['recipient'] ?? '')), FILTER_VALIDATE_EMAIL);
$result = is_array($payload['result'] ?? null) ? $payload['result'] : null;
if (!$recipient || !$result || empty($result['id'])) {
    respond(400, ['error' => 'A valid recipient and assessment result are required.']);
}

$apiKey = getenv('RESEND_API_KEY');
if (!$apiKey) {
    respond(503, ['error' => 'Email delivery is not configured. Download the report instead.']);
}
if (!function_exists('curl_init')) {
    respond(503, ['error' => 'The server PHP cURL extension is not enabled.']);
}

function text_value(mixed $value, int $limit = 200): string
{
    return substr(trim((string)$value), 0, $limit);
}

function csv_cell(mixed $value): string
{
    return '"' . str_replace('"', '""', (string)$value) . '"';
}

$evaluation = is_array($result['evaluation'] ?? null) ? $result['evaluation'] : null;
$applicant = is_array($result['applicant'] ?? null) ? $result['applicant'] : [];
$score = $evaluation ? (float)($evaluation['score'] ?? 0) : null;
$decision = $evaluation ? text_value($evaluation['decision'] ?? 'NOT YET QUALIFIED') : 'PENDING EVALUATOR REVIEW';
$rows = [
    ['Assessment ID', text_value($result['id'])],
    ['Applicant', text_value($applicant['fullName'] ?? '')],
    ['Submitted', text_value($result['submittedAt'] ?? '')],
    ['Email', $recipient],
    ['Status', $decision],
    ['Overall score', $score === null ? 'Pending' : $score . '/100'],
    ['Duration', text_value($result['duration'] ?? '')],
    [],
    ['Section', 'Score', 'Maximum', 'Minimum', 'Passed'],
];

$sections = $evaluation && is_array($evaluation['sections'] ?? null) ? array_slice($evaluation['sections'], 0, 10) : [];
foreach ($sections as $section) {
    if (!is_array($section)) continue;
    $sectionScore = (float)($section['score'] ?? 0);
    $maximum = (float)($section['max'] ?? 0);
    $rows[] = [
        text_value($section['section'] ?? ''),
        $sectionScore,
        $maximum,
        (float)($section['minimum'] ?? 0),
        !empty($section['passed']) ? 'Yes' : 'No',
    ];
}

$report = implode("\n", array_map(
    fn(array $row): string => implode(',', array_map('csv_cell', $row)),
    $rows
));

$resultId = preg_replace('/[^A-Za-z0-9_-]/', '-', text_value($result['id'], 80));
$safeDecision = htmlspecialchars($decision, ENT_QUOTES, 'UTF-8');
$from = getenv('RESULT_EMAIL_FROM') ?: 'Iman Trucking School <noreply@imanlogistics.com>';
$request = [
    'from' => $from,
    'to' => [$recipient],
    'subject' => 'Your ELP Admission Assessment — ' . text_value($result['id']),
    'html' => '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">'
        . '<h2 style="color:#08085f">ELP Admission Assessment</h2>'
        . '<p><strong>Status:</strong> ' . $safeDecision . '</p>'
        . ($score === null ? '<p>Your submission is awaiting trained-evaluator review.</p>' : '<p>Your final score is <strong>' . $score . '/100</strong>.</p>')
        . '<p>Your complete assessment report is attached.</p>'
        . '<p>Iman Trucking School</p></div>',
    'attachments' => [[
        'filename' => 'iman-elp-assessment-' . $resultId . '.csv',
        'content' => base64_encode($report),
    ]],
];

$curl = curl_init('https://api.resend.com/emails');
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_SLASHES),
]);
$response = curl_exec($curl);
$status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_error($curl);
curl_close($curl);

if ($response === false || $curlError !== '') {
    respond(502, ['error' => 'The email provider could not be reached.']);
}
$providerResponse = json_decode($response, true);
if ($status < 200 || $status >= 300) {
    error_log('Resend assessment email error: HTTP ' . $status);
    respond(502, ['error' => 'Email delivery failed. Please download the report instead.']);
}

respond(200, ['ok' => true, 'messageId' => $providerResponse['id'] ?? null]);
