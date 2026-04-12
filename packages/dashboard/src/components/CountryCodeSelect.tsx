// ============================================================
// SUPER RESERVATION PLATFORM — Country Code Selector
// Reusable dropdown for MENA region country codes.
// ============================================================

'use client';

import React from 'react';

export interface CountryCode {
  label: string; // e.g. "EG +20"
  code: string;  // e.g. "20"
}

export const COUNTRY_CODES: CountryCode[] = [
  { label: 'EG +20',  code: '20'  },
  { label: 'SA +966', code: '966' },
  { label: 'AE +971', code: '971' },
  { label: 'KW +965', code: '965' },
  { label: 'BH +973', code: '973' },
  { label: 'QA +974', code: '974' },
  { label: 'OM +968', code: '968' },
  { label: 'JO +962', code: '962' },
  { label: 'LB +961', code: '961' },
  { label: 'US +1',   code: '1'   },
  { label: 'GB +44',  code: '44'  },
];

interface Props {
  value: string;
  onChange: (code: string) => void;
  style?: React.CSSProperties;
}

/**
 * Strips leading zero from local phone numbers.
 * Egyptian numbers: 01112086154 → 1112086154
 */
export function stripLeadingZero(phone: string): string {
  const trimmed = phone.trim().replace(/\s+/g, '');
  return trimmed.startsWith('0') ? trimmed.slice(1) : trimmed;
}

/**
 * Builds full international phone from country code + local number.
 * e.g. code="20", phone="01112086154" → "+201112086154"
 */
export function buildFullPhone(countryCode: string, localPhone: string): string {
  return `+${countryCode}${stripLeadingZero(localPhone)}`;
}

export default function CountryCodeSelect({ value, onChange, style }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      dir="ltr"
      style={{
        padding: '13px 8px',
        border: '1.5px solid #E5E7EB',
        borderRadius: '10px',
        fontFamily: 'Cairo, sans-serif',
        fontSize: '15px',
        color: '#0F2044',
        background: '#F9FAFB',
        outline: 'none',
        cursor: 'pointer',
        minWidth: '110px',
        ...style,
      }}
    >
      {COUNTRY_CODES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
