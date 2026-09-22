import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/prisma';

export const load: PageServerLoad = async () => {
  // Fetch all Kebuns that have at least one published product
  // Only expose safe public fields — no apiKey, passwordHash, macAddress, userId
  const kebuns = await prisma.kebun.findMany({
    where: {
      devices: {
        some: {
          products: {
            some: { isPublished: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      location: true,
      waNumber: true,
      devices: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          // 20 latest sensor readings for average calculation & telemetry graph
          sensorData: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              moisture: true,
              ph: true,
              tds: true,
              createdAt: true
            }
          },
          products: {
            where: { isPublished: true },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
              price: true,
              stock: true,
              unit: true,
              harvestDate: true
            }
          }
        }
      }
    }
  });

  // Pre-compute sensor averages & history server-side for each device
  const storefrontData = kebuns.map((kebun) => ({
    id: kebun.id,
    name: kebun.name,
    location: kebun.location ?? 'Sidamukti',
    waNumber: kebun.waNumber ?? '6281234567890',
    devices: kebun.devices.map((device) => {
      const count = device.sensorData.length;
      const sensorAvg =
        count > 0
          ? {
              moisture: device.sensorData.reduce((sum, s) => sum + s.moisture, 0) / count,
              ph: device.sensorData.reduce((sum, s) => sum + s.ph, 0) / count,
              tds: device.sensorData.reduce((sum, s) => sum + s.tds, 0) / count,
              hasData: true
            }
          : { moisture: 0, ph: 0, tds: 0, hasData: false };

      // Chronological history (oldest to newest) for line charts
      const historyRaw = [...device.sensorData].reverse();
      const history = {
        dates: historyRaw.map(s => s.createdAt),
        moisture: historyRaw.map(s => Math.round(s.moisture)),
        ph: historyRaw.map(s => Number(s.ph.toFixed(1))),
        tds: historyRaw.map(s => Math.round(s.tds))
      };

      return {
        id: device.id,
        name: device.name,
        sensorAvg,
        history,
        products: device.products
      };
    })
  }));

  return { storefrontData };
};
