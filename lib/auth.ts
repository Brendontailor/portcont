export const AUTH_COOKIE_NAME = 'portcont_session';
export const AUTH_SESSION_HOURS = 12;
export const AUTH_SESSION_SECONDS = AUTH_SESSION_HOURS * 60 * 60;

export function getLoginRedirectPath(requestedPath: string | null | undefined): string {
  return requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/';
}
