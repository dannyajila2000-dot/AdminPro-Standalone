// Crea (o rota) la clave con la que la app del socio (gymProApp) consulta a este sistema.
//
//   node scripts/integracion-clave.mjs --codigo-gimnasio=ABC123 --env=../../gymProApp/backend/.env --url=http://localhost:3001
//
// - En la base solo se guarda el hash de la clave: no se puede recuperar. Si se pierde, se rota con --rotar.
// - Con --env, la clave se escribe en ese archivo (ADMINPRO_API_KEY, y ADMINPRO_URL si se da --url) y NO se
//   imprime. Sin --env, se imprime una sola vez.
// - Con una sola empresa se usa esa; si hay varias, hay que indicar --empresa=<id>.
import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function escribirEnv(ruta, pares) {
  let texto = fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : '';
  if (texto && !texto.endsWith('\n')) texto += '\n';
  for (const [clave, valor] of Object.entries(pares)) {
    const linea = `${clave}=${valor}`;
    const re = new RegExp(`^${clave}=.*$`, 'm');
    texto = re.test(texto) ? texto.replace(re, linea) : texto + linea + '\n';
  }
  fs.writeFileSync(ruta, texto);
}

try {
  if (!args['codigo-gimnasio'] || args['codigo-gimnasio'] === true) {
    throw new Error('Falta --codigo-gimnasio=<el código que el socio escribe en la app>');
  }
  const empresas = await prisma.empresa.findMany({ select: { id: true, nombre: true } });
  const empresa = args.empresa ? empresas.find((e) => e.id === args.empresa) : empresas.length === 1 ? empresas[0] : null;
  if (!empresa) throw new Error(`Indica la empresa con --empresa=<id>. Disponibles: ${empresas.map((e) => `${e.nombre} (${e.id})`).join(', ')}`);

  const existente = await prisma.integracionApp.findUnique({ where: { empresaId: empresa.id } });
  if (existente && !args.rotar) throw new Error('Ya existe una clave para esta empresa. Usa --rotar para reemplazarla (la anterior dejará de funcionar).');

  const clave = 'gp_' + randomBytes(32).toString('base64url');
  const datos = { apiKeyHash: createHash('sha256').update(clave).digest('hex'), codigoGimnasio: String(args['codigo-gimnasio']), activa: true };
  await prisma.integracionApp.upsert({ where: { empresaId: empresa.id }, create: { empresaId: empresa.id, ...datos }, update: datos });

  if (args.env) {
    escribirEnv(String(args.env), { ADMINPRO_API_KEY: clave, ...(args.url ? { ADMINPRO_URL: String(args.url) } : {}) });
    console.log(`Clave de integración de "${empresa.nombre}" guardada en ${args.env}`);
  } else {
    console.log(`Clave de integración de "${empresa.nombre}" (guárdala ahora, no se vuelve a mostrar):\n${clave}`);
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
