<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Password reset code</title>
</head>
<body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a;">
  <p>Hello {{ $userName !== '' ? $userName : 'there' }},</p>
  <p>Use this confirmation code to set a new MBMS password:</p>
  <p style="font-size:28px;font-weight:700;letter-spacing:0.2em;margin:1.25rem 0;">{{ $code }}</p>
  <p>This code expires in {{ $expiresMinutes }} minutes. If you did not request a reset, you can ignore this email.</p>
  <p style="color:#64748b;font-size:13px;">MBMS · Shared business ledger</p>
</body>
</html>
