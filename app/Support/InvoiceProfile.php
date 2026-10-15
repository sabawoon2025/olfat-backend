<?php

namespace App\Support;

final class InvoiceProfile
{
    /**
     * Keys that may appear on a location invoice_profile JSON document.
     *
     * @return list<string>
     */
    public static function keys(): array
    {
        return [
            'legal_name',
            'tagline',
            'logo_url',
            'address_line1',
            'address_line2',
            'phone',
            'whatsapp',
            'email',
            'website',
            'tax_id',
            'header_note',
            'footer_note',
            'terms',
            'bank_details',
            'signature_customer_label',
            'signature_authorized_label',
        ];
    }

    /**
     * Normalize and whitelist invoice profile input.
     *
     * @param  array<string, mixed>|null  $input
     * @return array<string, string>
     */
    public static function sanitize(?array $input): array
    {
        if ($input === null) {
            return [];
        }

        $profile = [];

        foreach (self::keys() as $key) {
            if (! array_key_exists($key, $input)) {
                continue;
            }

            $value = $input[$key];
            if ($value === null) {
                $profile[$key] = '';

                continue;
            }

            $profile[$key] = trim((string) $value);
        }

        return $profile;
    }

    /**
     * Drop empty strings so the bill page can fall back to global settings.
     *
     * @param  array<string, mixed>|null  $profile
     * @return array<string, string>
     */
    public static function compact(?array $profile): array
    {
        $sanitized = self::sanitize($profile);

        return array_filter(
            $sanitized,
            static fn (string $value): bool => $value !== ''
        );
    }
}
