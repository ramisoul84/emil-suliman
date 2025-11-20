<?php
// contact.php - Improved version
header('Access-Control-Allow-Origin: https://emilsuliman.com');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get JSON input from Angular
    $input = json_decode(file_get_contents('php://input'), true);
    
    $name = $input['name'] ?? '';
    $email = $input['email'] ?? '';
    $message = $input['message'] ?? '';
    
    // Validate required fields
    if (empty($name) || empty($email) || empty($message)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'All fields are required']);
        exit;
    }
    
    // Validate email
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid email address']);
        exit;
    }
    
    $to = "rami.suliman@mail.ru";
    $subject = "New Contact Form Message from " . $name;
    $body = "
    Name: $name
    Email: $email
    Message: $message
    
    Sent from: https://emilsuliman.com
    ";
    
    $headers = "From: $email\r\n";
    $headers .= "Reply-To: $email\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();
    
    // Try to send email
    if (mail($to, $subject, $body, $headers)) {
        error_log("Email sent successfully to: $to");
        echo json_encode(['success' => true, 'message' => 'Email sent successfully']);
    } else {
        error_log("Email failed to send to: $to");
        echo json_encode(['success' => false, 'error' => 'Server failed to send email']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
}
?>