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
     *
     * @return array{code:?string,mailed:bool}|null Null when the email is unknown (no enumeration).
     */
    public function sendCode(string $email): ?array
    {
        $email = strtolower(trim($email));
        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('is_active', true)
            ->first();

        if (! $user) {
            return null;
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

        $mailed = false;

        try {
            Mail::to($user->email)->send(new PasswordResetCodeMail($user->name, $code));
            $mailed = true;
        } catch (Throwable $exception) {
            Log::warning('Password reset email failed', [
                'email' => $email,
                'error' => $exception->getMessage(),
            ]);

            if (! (bool) config('mbms.password_reset_show_code')) {
                throw new HttpException(
                    503,
                    'The confirmation email could not be sent. '.$this->mailFailureHint($exception),
                    $exception
                );
            }
        }

        $showCode = (bool) config('mbms.password_reset_show_code');

        return [
            'code' => $showCode ? $code : null,
            'mailed' => $mailed,
        ];
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

        if (str_contains($lower, 'authenticate') || str_contains($lower, 'username and password') || str_contains($lower, '535')) {
            return 'Gmail rejected the login. Check MAIL_USERNAME and the 16-character app password (no spaces) in Vercel, then redeploy.';
        }

        if (str_contains($lower, 'unreachable') || str_contains($lower, 'timed out') || str_contains($lower, 'connection could not be established')) {
            return 'The server could not reach Gmail SMTP. On Vercel, set PASSWORD_RESET_SHOW_CODE=true to show the code on screen, or use a web mail API such as Resend.';
        }

        if (str_contains($lower, 'scheme is not supported')) {
            return 'Invalid MAIL_SCHEME. Use MAIL_SCHEME=smtps and MAIL_PORT=465 for Gmail.';
        }

        return 'Check MAIL_* environment variables on the host, then redeploy.';
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
