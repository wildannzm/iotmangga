import type { Handle } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';

export const handle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get('session');

  if (!sessionId) {
    event.locals.user = null;
    return checkProtectedRoutes(event, resolve);
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true }
  });

  if (session) {
    // Check if session is expired
    if (session.expiresAt < new Date()) {
      // Session expired, delete from DB and delete cookie
      await prisma.session.delete({ where: { id: sessionId } });
      event.cookies.delete('session', { path: '/' });
      event.locals.user = null;
    } else {
      // Session is valid
      event.locals.user = {
        id: session.user.id,
        username: session.user.username,
        name: session.user.name
      };
    }
  } else {
    // Invalid session ID, clear cookie
    event.cookies.delete('session', { path: '/' });
    event.locals.user = null;
  }

  return checkProtectedRoutes(event, resolve);
};

async function checkProtectedRoutes(event: any, resolve: any) {
  // Protect /dashboard routes (and any other protected routes)
  if (event.url.pathname.startsWith('/dashboard')) {
    if (!event.locals.user) {
      return new Response('Redirect', {
        status: 303,
        headers: { Location: '/login' }
      });
    }
  }

  return resolve(event);
}
