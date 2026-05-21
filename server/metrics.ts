let serverErrors24h = 0;
let errorsWindowStart = Date.now();

export function recordServerError() {
  if (Date.now() - errorsWindowStart > 86_400_000) {
    serverErrors24h = 0;
    errorsWindowStart = Date.now();
  }
  serverErrors24h++;
}

export function getServerErrors24h() {
  if (Date.now() - errorsWindowStart > 86_400_000) {
    serverErrors24h = 0;
    errorsWindowStart = Date.now();
  }
  return serverErrors24h;
}
