// Fixture: ten tiny business-logic functions; the tests next to it cover some of them.
export const net = (gross: number) => gross / 1.2;
export const gross = (net: number) => net * 1.2;
export const discount = (price: number) => price * 0.9;
export const rounded = (price: number) => Math.round(price * 100) / 100;
export const doubled = (price: number) => price * 2;
export const halved = (price: number) => price / 2;
export const plusShipping = (price: number) => price + 5;
export const minusVoucher = (price: number) => price - 10;
export const perMonth = (price: number) => price / 12;
export const perYear = (price: number) => price * 12;
