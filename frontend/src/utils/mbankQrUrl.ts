/** Тот же URL, что на сервере (`MBANK_<сумма>`). */
export function mbankOrderQrImageUrl(orderTotal: number): string {
  const data = `MBANK_${orderTotal}`;
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}`;
}
