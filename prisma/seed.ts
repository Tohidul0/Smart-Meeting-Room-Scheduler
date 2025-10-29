import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Users
  await prisma.user.createMany({
    data: [
      { name: 'CEO', email: 'ceo@company.com', role: 'ceo' },
      { name: 'Alice', email: 'alice@company.com', role: 'employee' },
      { name: 'Bob', email: 'bob@company.com', role: 'employee' },
    ],
    skipDuplicates: true
  });

  // Rooms
  const rooms = [
    { name: 'Room A', capacity: 4, equipment: ['projector'], hourlyRate: 20, location: '1F' },
    { name: 'Room B', capacity: 6, equipment: ['whiteboard'], hourlyRate: 25, location: '2F' },
    { name: 'Room C', capacity: 10, equipment: ['projector', 'video-conf'], hourlyRate: 35, location: '3F' },
    { name: 'Room D', capacity: 8, equipment: ['projector', 'whiteboard'], hourlyRate: 30, location: '3F' },
    { name: 'Room E', capacity: 12, equipment: ['video-conf', 'whiteboard'], hourlyRate: 40, location: '4F' },
    { name: 'Room F', capacity: 5, equipment: ['whiteboard'], hourlyRate: 18, location: '1F' },
    { name: 'Room G', capacity: 20, equipment: ['projector', 'video-conf'], hourlyRate: 60, location: '5F' },
    { name: 'Room H', capacity: 3, equipment: ['whiteboard'], hourlyRate: 15, location: '2F' },
    { name: 'Room I', capacity: 7, equipment: ['projector', 'whiteboard'], hourlyRate: 28, location: '3F' },
    { name: 'Room J', capacity: 15, equipment: ['video-conf', 'projector'], hourlyRate: 50, location: '4F' },
  ];

  for (const room of rooms) {
    const existing = await prisma.meetingRoom.findFirst({
      where: { name: room.name },
    });
    if (!existing) {
      await prisma.meetingRoom.create({
        data: room,
      });
    }
  }

  console.log('Seeded users and rooms successfully.');
}

main().finally(() => prisma.$disconnect());
