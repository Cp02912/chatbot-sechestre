const THIN = " "; // spațiu subțire, fără rupere de rând

export function fmtTok(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
}

export function fmtUsd(n: number): string {
  return "$" + n.toFixed(n < 1 ? 4 : 2);
}
