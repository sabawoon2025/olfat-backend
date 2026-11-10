<?php

namespace App\Http\Requests\Payment;

use App\Enums\Currency;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSupplierPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'location_id' => ['required', 'exists:locations,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'purchase_id' => ['required', 'exists:purchases,id'],
            'currency' => ['nullable', 'string', Rule::in(Currency::values())],
            'paid_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
