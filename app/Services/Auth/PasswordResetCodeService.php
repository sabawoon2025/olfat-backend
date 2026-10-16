<?php

namespace App\Services\Auth;

use App\Mail\PasswordResetCodeMail;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class PasswordResetCodeService
{
    public const CODE_TTL_MINUTES = 15;

    public const GENERIC_MESSAGE = 'If that email is registered, a confirmation code has been sent.';

    /**
     * Issue a 6-digit code when the email belongs to an active user.
     * The code is emailed only — it is never returned to the client.
     */
    public function sendCode(string $email): void
    {
        $email = strtolower(trim($email));
        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('is_active', true)
            ->first();

        if (! $user) {
            return;
        }

        $code = (string) random_int(100000, 999999);

        $this->ensureTable();

        DB::table('password_reset_codes')->where('email', $email)->delete();

        DB::table('password_reset_codes')->insert([
            'email' => $email,
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(self::CODE_TTL_MINUTES),
            'consumed_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            Mail::to($user->email)->send(new PasswordResetCodeMail($user->name, $code));
        } catch (Throwable $exception) {
            Log::warning('Password reset email failed', [
                'email' => $email,
                'error' => $exception->getMessage(),
            ]);

            throw new HttpException(
                503,
                'The confirmation email could not be sent. '.$this->mailFailureHint($exception),
                $exception
            );
        }
    }

    /**
     * Production hosts that cannot run Artisan during deploy still need this table.
     */
    private function ensureTable(): void
    {
        if (Schema::hasTable('password_reset_codes')) {
            return;
        }

        Schema::create('password_reset_codes', function (Blueprint $table) {
            $table->id();
            $table->string('email')->index();
            $table->string('code_hash');
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->timestamps();
        });
    }

    private function mailFailureHint(Throwable $exception): string
    {
        $message = $exception->getMessage();
        $previous = $exception->getPrevious();
        while ($previous instanceof Throwable) {
            $message .= ' '.$previous->getMessage();
            $previous = $previous->getPrevious();
        }

        $lower = strtolower($message);

        if (str_contains($lower, 'only send testing emails to your own') || str_contains($lower, 'verify a domain')) {
            return 'Resend test mode can only send to the email used for your Resend account. Either use that same email on the MBMS user, or verify a domain at resend.com/domains and set MAIL_FROM_ADDRESS to an address on that domain.';
        }

        if (str_contains($lower, 'api key') || str_contains($lower, 'unauthorized') || str_contains($lower, 'invalid_api_key') || str_contains($lower, '401')) {
            return 'Resend rejected the API key. Check RESEND_API_KEY in Vercel (starts with re_), and that MAIL_MAILER=resend, then redeploy.';
        }

        if (str_contains($lower, 'authenticate') || str_contains($lower, 'username and password') || str_contains($lower, '535')) {
            return 'Gmail rejected the login. Check MAIL_USERNAME and the 16-character app password (no spaces) in Vercel, then redeploy.';
        }

        if (str_contains($lower, 'unreachable') || str_contains($lower, 'timed out') || str_contains($lower, 'connection could not be established')) {
            return 'The server could not reach the mail host. On Vercel, Gmail SMTP is often blocked — use Resend (MAIL_MAILER=resend + RESEND_API_KEY) instead.';
        }

        if (str_contains($lower, 'scheme is not supported')) {
            return 'Invalid MAIL_SCHEME. Use MAIL_SCHEME=smtps and MAIL_PORT=465 for Gmail.';
        }

        $short = trim(preg_replace('/\s+/', ' ', $message) ?? '');
        if (strlen($short) > 180) {
            $short = substr($short, 0, 177).'...';
        }

        return $short !== ''
            ? 'Mail error: '.$short
            : 'Check MAIL_* / RESEND_API_KEY environment variables on the host, then redeploy.';
    }

    /**
     * @throws ValidationException
     */
    public function resetPassword(string $email, string $code, string $password): User
    {
        $email = strtolower(trim($email));
        $code = trim($code);

        $this->ensureTable();

        $row = DB::table('password_reset_codes')
            ->where('email', $email)
            ->whereNull('consumed_at')
            ->orderByDesc('id')
            ->first();

        if (! $row || now()->greaterThan($row->expires_at) || ! Hash::check($code, $row->code_hash)) {
            throw ValidationException::withMessages([
                'code' => ['The confirmation code is invalid or has expired.'],
            ]);
        }

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('is_active', true)
            ->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => ['Unable to reset password for this account.'],
            ]);
        }

        $user->password = $password;
        $user->save();

        DB::table('password_reset_codes')
            ->where('id', $row->id)
            ->update([
                'consumed_at' => now(),
                'updated_at' => now(),
            ]);

        DB::table('password_reset_codes')
            ->where('email', $email)
            ->where('id', '!=', $row->id)
            ->delete();

        $user->tokens()->delete();

        return $user->fresh();
    }
}
