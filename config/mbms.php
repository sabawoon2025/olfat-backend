<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Show password-reset code in the API response
    |--------------------------------------------------------------------------
    |
    | When true, forgot-password returns the 6-digit code in the JSON body so
    | the sign-in screen can display it. Use this for closed deployments where
    | SMTP from the host (e.g. Vercel → Gmail) is blocked. Turn off once email
    | delivery works reliably.
    |
    */

    'password_reset_show_code' => (bool) env('PASSWORD_RESET_SHOW_CODE', false),

];
