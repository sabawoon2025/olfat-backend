<?php

namespace App\Http\Requests\Location;

use App\Support\InvoiceProfile;
use Illuminate\Foundation\Http\FormRequest;

class StoreLocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120', 'unique:locations,name'],
            'code' => ['required', 'string', 'max:50', 'unique:locations,code'],
            'is_active' => ['sometimes', 'boolean'],
            'invoice_profile' => ['sometimes', 'nullable', 'array'],
            ...$this->invoiceProfileFieldRules(),
        ];
    }

    /**
     * @return array<string, list<string>>
     */
    private function invoiceProfileFieldRules(): array
    {
        $rules = [];

        foreach (InvoiceProfile::keys() as $key) {
            $rules['invoice_profile.'.$key] = ['sometimes', 'nullable', 'string', 'max:2000'];
        }

        return $rules;
    }

    protected function prepareForValidation(): void
    {
        if ($this->exists('invoice_profile') && is_array($this->input('invoice_profile'))) {
            $this->merge([
                'invoice_profile' => InvoiceProfile::sanitize($this->input('invoice_profile')),
            ]);
        }
    }
}
