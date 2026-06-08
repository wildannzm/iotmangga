import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';
import bcrypt from 'bcryptjs';

export const load: PageServerLoad = async ({ locals }) => {
  // Redirect to dashboard if already logged in
  if (locals.user) {
    throw redirect(302, '/dashboard');
  }
};

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get('username');
    const password = data.get('password');

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return fail(400, { error: 'Nama pengguna dan kata sandi harus diisi.' });
    }

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return fail(400, { error: 'Nama pengguna atau kata sandi salah.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return fail(400, { error: 'Nama pengguna atau kata sandi salah.' });
    }

    // Create a new session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days session

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        expiresAt
      }
    });

    cookies.set('session', sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt
    });

    throw redirect(302, '/dashboard');
  },

  logout: async ({ cookies }) => {
    const sessionId = cookies.get('session');
    if (sessionId) {
      try {
        await prisma.session.delete({ where: { id: sessionId } });
      } catch (e) {
        // Ignored if session doesn't exist
      }
    }
    cookies.delete('session', { path: '/' });
    throw redirect(302, '/login');
  }
};
