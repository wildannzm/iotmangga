import type { Handle } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma';
import { getSession, setSession } from '$lib/server/sessionCache';

export const handle: Handle = async ({ event, resolve }) => {
  const sessionId = event.cookies.get('session');

  if (!sessionId) {
    event.locals.user = null;
    return checkProtectedRoutes(event, resolve);
  }

  const cached = getSession(sessionId);

  if (cached) {
    event.locals.user = cached;
  } else {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (session) {
      if (session.expiresAt < new Date()) {
        await prisma.session.delete({ where: { id: sessionId } });
        event.cookies.delete('session', { path: '/' });
        event.locals.user = null;
      } else {
        const user = {
          id: session.user.id,
          username: session.user.username,
          name: session.user.name
        };
        setSession(sessionId, user, session.expiresAt.getTime());
        event.locals.user = user;
      }
    } else {
      event.cookies.delete('session', { path: '/' });
      event.locals.user = null;
    }
  }

  return checkProtectedRoutes(event, resolve);
};

async function checkProtectedRoutes(event: any, resolve: any) {
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
