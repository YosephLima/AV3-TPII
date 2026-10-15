import 'dotenv/config';
import { criarPrisma } from '../src/repositorio/prisma';
import { semear } from '../src/repositorio/semear';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Defina DATABASE_URL para semear o banco');

const prisma = criarPrisma(url);
await semear(prisma);
await prisma.$disconnect();
console.log('Profissionais cadastrados.');
