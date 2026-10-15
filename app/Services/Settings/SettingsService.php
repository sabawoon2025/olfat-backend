<?php

namespace App\Services\Settings;

use App\Models\Setting;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class SettingsService
{
    private const CACHE_KEY = 'mbms.settings.map';

    public function all(?string $group = null): Collection
    {
        return Setting::query()
            ->when($group, fn ($q) => $q->where('group', $group))
            ->orderBy('group')
            ->orderBy('key')
            ->get()
            ->map(fn (Setting $setting) => $this->present($setting));
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $map = $this->cachedMap();

        if (array_key_exists($key, $map)) {
            return $map[$key];
        }

        return $default;
    }

    public function update(string $key, mixed $value): array
    {
        $setting = Setting::query()->where('key', $key)->firstOrFail();
        $setting->setTypedValue($value);
        $setting->save();
        $this->forgetCache();

        return $this->present($setting->fresh());
    }

    /**
     * Append a unique string to a JSON-array setting (case-insensitive).
     *
     * @param  array{group?:string,label?:string,description?:string}  $attributes
     * @return list<string>
     */
    public function appendUniqueString(string $key, string $value, array $attributes = []): array
    {
        $value = trim($value);
        if ($value === '') {
            return [];
        }

        $setting = Setting::query()->firstOrCreate(
            ['key' => $key],
            [
                'value' => '[]',
                'type' => 'json',
                'group' => $attributes['group'] ?? 'general',
                'label' => $attributes['label'] ?? $key,
                'description' => $attributes['description'] ?? null,
            ]
        );

        $list = $setting->typedValue();
        if (! is_array($list)) {
            $list = [];
        }

        $normalized = array_values(array_filter(array_map(
            static fn ($item): string => trim((string) $item),
            $list
        )));

        foreach ($normalized as $existing) {
            if (strcasecmp($existing, $value) === 0) {
                return $normalized;
            }
        }

        $normalized[] = $value;
        $setting->type = 'json';
        $setting->setTypedValue($normalized);
        $setting->save();
        $this->forgetCache();

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $values  key => value
     */
    public function updateMany(array $values): Collection
    {
        return DB::transaction(function () use ($values) {
            $updated = collect();

            foreach ($values as $key => $value) {
                if (! is_string($key)) {
                    throw new InvalidArgumentException('Setting keys must be strings.');
                }
                $updated->push($this->update($key, $value));
            }

            return $updated;
        });
    }

    public function present(Setting $setting): array
    {
        return [
            'id' => $setting->id,
            'key' => $setting->key,
            'value' => $setting->typedValue(),
            'raw_value' => $setting->value,
            'type' => $setting->type,
            'group' => $setting->group,
            'label' => $setting->label,
            'description' => $setting->description,
            'updated_at' => $setting->updated_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function cachedMap(): array
    {
        return Cache::remember(self::CACHE_KEY, 300, function () {
            return Setting::query()
                ->get()
                ->mapWithKeys(fn (Setting $setting) => [$setting->key => $setting->typedValue()])
                ->all();
        });
    }

    private function forgetCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
