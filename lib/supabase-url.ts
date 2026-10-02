export function supabaseProjectUrl(value: string): string {
  return value.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');
}