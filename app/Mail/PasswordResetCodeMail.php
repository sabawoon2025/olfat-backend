<?php

namespace App\Mail;

use App\Services\Auth\PasswordResetCodeService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $userName,
        public string $code,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your MBMS password reset code',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.password-reset-code',
            with: [
                'userName' => $this->userName,
                'code' => $this->code,
                'expiresMinutes' => PasswordResetCodeService::CODE_TTL_MINUTES,
            ],
        );
    }
}
