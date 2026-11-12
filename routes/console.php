<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled DBA maintenance
|--------------------------------------------------------------------------
|
| Run with a system cron ("* * * * * php artisan schedule:run") or, on
| serverless hosts, by calling GET /api/cron/schedule with the CRON_SECRET
| bearer token (see VERCEL_DEPLOY.md). Times are in the app timezone.
|
*/

// Daily full logical backup, verified and pruned to BACKUP_KEEP_DAYS.
Schedule::command('db:backup')
    ->dailyAt('02:00')
    ->withoutOverlapping()
    ->onOneServer()
    ->runInBackground();

// Weekly semantic/referential integrity audit (exit code 1 = problems found).
Schedule::command('db:integrity-check')
    ->weeklyOn(1, '03:00')
    ->withoutOverlapping()
    ->onOneServer();

// Housekeeping: expired API tokens and stale password reset tokens.
Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::command('auth:clear-resets')->daily();

// Keep denormalized party balances aligned with open document remainings.
Schedule::command('customers:sync-receivables')->dailyAt('03:30')->withoutOverlapping();
Schedule::command('suppliers:sync-payables')->dailyAt('03:40')->withoutOverlapping();
