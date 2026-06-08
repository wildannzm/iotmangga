import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

  // Cache the database response for 60 seconds in the user's browser to reduce database load.
  // Private ensures it's only cached for this specific user, not on a public CDN.
  // The WebSocket on the client will still inject new real-time data seamlessly.
  setHeaders({
    'Cache-Control': 'private, max-age=60'
  });

  // Fetch all devices for this user
  // We include the single most recent SensorData record for the global overview
  const devices = await prisma.device.findMany({
    where: { userId: locals.user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      sensorData: {
        orderBy: { createdAt: 'desc' },
        take: 25
      }
    }
  });

  return {
    devices
  };
};
