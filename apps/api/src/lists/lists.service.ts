import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  create(name: string) {
    return this.prisma.songList.create({ data: { name } });
  }

  async findAll() {
    const lists = await this.prisma.songList.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    });
    return lists.map((list) => ({
      id: list.id,
      name: list.name,
      createdAt: list.createdAt,
      itemCount: list._count.items,
    }));
  }

  async findOne(id: string) {
    const list = await this.prisma.songList.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { track: { include: { artist: true } } },
        },
      },
    });
    if (!list) throw new NotFoundException('List not found');
    return list;
  }

  async remove(id: string) {
    const list = await this.prisma.songList.findUnique({ where: { id } });
    if (!list) throw new NotFoundException('List not found');
    await this.prisma.songList.delete({ where: { id } });
  }

  async removeItem(listId: string, itemId: string) {
    const item = await this.prisma.songListItem.findUnique({ where: { id: itemId } });
    if (!item || item.listId !== listId) throw new NotFoundException('List item not found');
    await this.prisma.songListItem.delete({ where: { id: itemId } });
  }
}
