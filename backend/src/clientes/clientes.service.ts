import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AvisosAppService } from '../integracion/avisos-app.service';
import type { Prisma } from '@prisma/client';
import { EmailService } from '../auth/email.service';
import {
  generarCodigo,
  hashDeCodigo,
  VIGENCIA_CODIGO_DIAS,
} from '../integracion/integracion.service';
import { PrismaService } from '../prisma/prisma.service';
import { MembresiasService } from '../membresias/membresias.service';
import { filtroSucursalCliente, puedeVerTodasSucursales } from '../common/utils/sucursal-scope';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

const INCLUDE_CITA = {
  tipoCita: true,
  recurso: { select: { id: true, nombre: true } },
} satisfies Prisma.CitaInclude;

const INCLUDE_ORDEN = {
  items: {
    include: { producto: { select: { id: true, nombre: true } } },
  },
} satisfies Prisma.OrdenInclude;

const INCLUDE_MOVIMIENTO_CUENTA = {
  categoria: true,
} satisfies Prisma.MovimientoCuentaInclude;

const INCLUDE_ASIGNACION_ACTIVO = {
  activo: { select: { id: true, nombre: true } },
} satisfies Prisma.AsignacionActivoInclude;

const INCLUDE_SUCURSAL = {
  sucursal: { select: { id: true, nombre: true } },
} satisfies Prisma.ClienteInclude;

type CitaConDetalle = Prisma.CitaGetPayload<{ include: typeof INCLUDE_CITA }>;
type OrdenConItems = Prisma.OrdenGetPayload<{ include: typeof INCLUDE_ORDEN }>;
type MovimientoConCategoria = Prisma.MovimientoCuentaGetPayload<{
  include: typeof INCLUDE_MOVIMIENTO_CUENTA;
}>;
type AsignacionConActivo = Prisma.AsignacionActivoGetPayload<{
  include: typeof INCLUDE_ASIGNACION_ACTIVO;
}>;

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membresiasService: MembresiasService,
    private readonly emailService: EmailService,
    @Optional() private readonly avisos?: AvisosAppService,
  ) {}

  /** Si el socio ya tiene la app, está invitado o aún no: lo que muestra la ficha. */
  async estadoApp(empresaId: string, id: string, permisosVisor: string[], sucursalIdVisor: string | null) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, empresaId, ...filtroSucursalCliente(permisosVisor, sucursalIdVisor) },
      select: { email: true, appInvitadoEn: true, appActivadoEn: true, appCodigoExpiraEn: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    const integracion = await this.prisma.integracionApp.findUnique({ where: { empresaId }, select: { activa: true } });
    const estado = cliente.appActivadoEn
      ? 'activada'
      : cliente.appCodigoExpiraEn && cliente.appCodigoExpiraEn > new Date()
        ? 'invitado'
        : cliente.appInvitadoEn
          ? 'invitacion_vencida'
          : 'sin_invitar';
    return {
      estado,
      integracionConfigurada: !!integracion?.activa,
      tieneCorreo: !!cliente.email,
      invitadoEn: cliente.appInvitadoEn,
      activadoEn: cliente.appActivadoEn,
      codigoVenceEn: cliente.appCodigoExpiraEn,
    };
  }

  /**
   * Invita al socio a la app: genera un código de activación de 6 dígitos, lo guarda cifrado (hash) y lo envía
   * a su correo. También se devuelve al administrador, por si el correo no sale o prefiere mandarlo por
   * WhatsApp. Cada invitación anula la anterior.
   */
  async invitarApp(empresaId: string, id: string, permisosVisor: string[], sucursalIdVisor: string | null) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, empresaId, ...filtroSucursalCliente(permisosVisor, sucursalIdVisor) },
      include: { empresa: { select: { nombre: true } } },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    if (!cliente.activo) throw new BadRequestException('El socio está inactivo');
    if (!cliente.email) throw new BadRequestException('El socio necesita un correo para invitarlo a la app');
    if (cliente.appActivadoEn) throw new ConflictException('Este socio ya activó su cuenta en la app');

    const integracion = await this.prisma.integracionApp.findUnique({ where: { empresaId } });
    if (!integracion?.activa) {
      throw new BadRequestException('La conexión con la app todavía no está configurada para esta empresa');
    }

    // En la app, el correo identifica al socio: dos socios con el mismo correo no pueden tener cuenta a la vez.
    const otro = await this.prisma.cliente.findFirst({
      where: {
        empresaId,
        id: { not: id },
        email: { equals: cliente.email, mode: 'insensitive' },
        OR: [{ appActivadoEn: { not: null } }, { appCodigoHash: { not: null } }],
      },
      select: { nombre: true },
    });
    if (otro) throw new ConflictException(`El correo ya está en uso por otro socio (${otro.nombre})`);

    const codigo = generarCodigo();
    const expira = new Date(Date.now() + VIGENCIA_CODIGO_DIAS * 86_400_000);
    await this.prisma.cliente.update({
      where: { id },
      data: {
        appCodigoHash: hashDeCodigo(id, codigo),
        appCodigoExpiraEn: expira,
        appInvitadoEn: new Date(),
        appIntentosFallidos: 0,
      },
    });

    const enviado = await this.emailService.enviarInvitacionApp(
      cliente.email,
      cliente.nombres,
      codigo,
      cliente.empresa.nombre,
      integracion.codigoGimnasio,
      VIGENCIA_CODIGO_DIAS,
    );
    return { enviado, codigo, codigoGimnasio: integracion.codigoGimnasio, expiraEn: expira };
  }

  async findAll(empresaId: string, permisosVisor: string[], sucursalIdVisor: string | null) {
    const clientes = await this.prisma.cliente.findMany({
      where: {
        empresaId,
        activo: true,
        ...filtroSucursalCliente(permisosVisor, sucursalIdVisor),
      },
      include: INCLUDE_SUCURSAL,
    });

    if (!permisosVisor.includes('membresias.leer')) {
      return clientes.map((cliente) => ({ ...cliente, estadoMembresia: null }));
    }

    const estados = await this.membresiasService.findEstadoPorEmpresa(
      empresaId,
      permisosVisor,
      sucursalIdVisor,
    );
    const estadoPorCliente = new Map(estados.map((e) => [e.cliente.id, e]));

    return clientes.map((cliente) => {
      const fila = estadoPorCliente.get(cliente.id);
      return {
        ...cliente,
        estadoMembresia: fila
          ? { estado: fila.estado, diasRestantes: fila.diasRestantes, plan: fila.membresia?.plan ?? null }
          : null,
      };
    });
  }

  async findOne(
    empresaId: string,
    id: string,
    permisosVisor: string[],
    sucursalIdVisor: string | null,
  ) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, empresaId, ...filtroSucursalCliente(permisosVisor, sucursalIdVisor) },
      include: INCLUDE_SUCURSAL,
    });

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  private async validarSucursal(empresaId: string, sucursalId: string) {
    const sucursal = await this.prisma.sucursal.findFirst({ where: { id: sucursalId, empresaId } });
    if (!sucursal) {
      throw new BadRequestException('La sucursal indicada no existe');
    }
  }

  /**
   * Un mismo teléfono o email no puede repetirse entre dos clientes de la misma empresa —
   * a propósito se revisa en TODA la empresa (no solo la sucursal del visor), para atrapar
   * también el caso de alguien registrado por error en dos sucursales distintas.
   * `ignorarId` se usa al editar, para no chocar contra el propio registro que se guarda.
   */
  private async validarNoDuplicado(
    empresaId: string,
    datos: { telefono?: string; email?: string },
    ignorarId?: string,
  ) {
    if (!datos.telefono && !datos.email) return;

    const condiciones: Prisma.ClienteWhereInput[] = [];
    if (datos.telefono) condiciones.push({ telefono: datos.telefono });
    if (datos.email) condiciones.push({ email: { equals: datos.email, mode: 'insensitive' } });

    const duplicado = await this.prisma.cliente.findFirst({
      where: {
        empresaId,
        id: ignorarId ? { not: ignorarId } : undefined,
        OR: condiciones,
      },
    });

    if (duplicado) {
      const campo =
        datos.telefono && duplicado.telefono === datos.telefono ? 'teléfono' : 'email';
      throw new ConflictException(
        `Ya existe un cliente (${duplicado.nombre}) registrado con ese ${campo}`,
      );
    }
  }

  async create(
    empresaId: string,
    actorId: string,
    dto: CreateClienteDto,
    permisosVisor: string[],
    sucursalIdVisor: string | null,
  ) {
    let sucursalId = dto.sucursalId;
    if (!puedeVerTodasSucursales(permisosVisor)) {
      if (!sucursalIdVisor) {
        throw new ForbiddenException(
          'Tu cuenta no tiene una sucursal asignada — pide a un administrador que te asigne una antes de crear clientes',
        );
      }
      sucursalId = sucursalIdVisor;
    }

    await this.validarSucursal(empresaId, sucursalId);
    await this.validarNoDuplicado(empresaId, { telefono: dto.telefono, email: dto.email });

    const nombres = dto.nombres.trim();
    const apellidos = dto.apellidos.trim();

    const cliente = await this.prisma.cliente.create({
      data: {
        empresaId,
        sucursalId,
        nombres,
        apellidos,
        nombre: `${nombres} ${apellidos}`.trim(),
        email: dto.email?.toLowerCase(),
        telefono: dto.telefono,
        notas: dto.notas,
        etiqueta: dto.etiqueta,
        fotoUrl: dto.fotoUrl,
        sexo: dto.sexo,
        atributosExtra: dto.atributosExtra as Prisma.InputJsonValue | undefined,
      },
      include: INCLUDE_SUCURSAL,
    });

    return cliente;
  }

  /**
   * `permisosVisor` son los permisos de quien hace la petición (no reglas sobre el cliente):
   * cada sección del perfil viene de un módulo distinto (Citas, Ventas, Cuentas, Activos),
   * así que solo se incluye si el visor tiene el `.leer` de ese módulo — de lo contrario
   * alguien con solo `clientes.leer` (ej. recepción) vería ventas y movimientos financieros
   * de cualquier cliente sin tener permiso sobre esos módulos.
   */
  async findPerfil(
    empresaId: string,
    id: string,
    permisosVisor: string[],
    sucursalIdVisor: string | null,
  ) {
    const cliente = await this.findOne(empresaId, id, permisosVisor, sucursalIdVisor);

    const puedeVerCitas = permisosVisor.includes('citas.leer');
    const puedeVerVentas = permisosVisor.includes('ventas.leer');
    const puedeVerCuentas = permisosVisor.includes('cuentas.leer');
    const puedeVerActivos = permisosVisor.includes('activos.leer');
    const puedeVerMembresias = permisosVisor.includes('membresias.leer');

    const [
      totalCitas,
      citas,
      ordenes,
      movimientosCuenta,
      activosAsignados,
      estadoMembresia,
      sumaVentas,
      sumaOtrosIngresos,
    ] = await Promise.all([
      puedeVerCitas
        ? this.prisma.cita.count({ where: { empresaId, clienteId: id } })
        : Promise.resolve(0),
      puedeVerCitas
        ? this.prisma.cita.findMany({
            where: { empresaId, clienteId: id },
            include: INCLUDE_CITA,
            orderBy: { fechaInicio: 'desc' },
            take: 10,
          })
        : Promise.resolve<CitaConDetalle[]>([]),
      puedeVerVentas
        ? this.prisma.orden.findMany({
            where: { empresaId, clienteId: id },
            include: INCLUDE_ORDEN,
            orderBy: { creadoEn: 'desc' },
            take: 10,
          })
        : Promise.resolve<OrdenConItems[]>([]),
      puedeVerCuentas
        ? this.prisma.movimientoCuenta.findMany({
            where: { empresaId, clienteId: id },
            include: INCLUDE_MOVIMIENTO_CUENTA,
            orderBy: { fecha: 'desc' },
            take: 10,
          })
        : Promise.resolve<MovimientoConCategoria[]>([]),
      puedeVerActivos
        ? this.prisma.asignacionActivo.findMany({
            where: { empresaId, clienteId: id, fechaDevolucion: null },
            include: INCLUDE_ASIGNACION_ACTIVO,
          })
        : Promise.resolve<AsignacionConActivo[]>([]),
      puedeVerMembresias
        ? this.membresiasService.estadoDeCliente(empresaId, id, permisosVisor, sucursalIdVisor)
        : Promise.resolve(null),
      // Suma de TODAS las ventas completadas (no solo las 10 más recientes que se muestran).
      puedeVerVentas
        ? this.prisma.orden.aggregate({
            where: { empresaId, clienteId: id, estado: 'completada' },
            _sum: { total: true },
          })
        : Promise.resolve({ _sum: { total: null } }),
      // Ingresos en Cuentas que NO vienen de una venta (membresías, cobros manuales, etc.) —
      // se excluye `ordenId` para no contar dos veces el mismo dinero de una venta.
      puedeVerCuentas
        ? this.prisma.movimientoCuenta.aggregate({
            where: { empresaId, clienteId: id, tipo: 'ingreso', ordenId: null },
            _sum: { monto: true },
          })
        : Promise.resolve({ _sum: { monto: null } }),
    ]);

    const totalGastado =
      Number(sumaVentas._sum.total ?? 0) + Number(sumaOtrosIngresos._sum.monto ?? 0);

    return {
      cliente,
      citas,
      ordenes,
      movimientosCuenta,
      activosAsignados,
      estadoMembresia,
      resumen: {
        totalCitas,
        totalGastado,
        activosEnPosesion: activosAsignados.length,
      },
    };
  }

  async update(
    empresaId: string,
    actorId: string,
    id: string,
    dto: UpdateClienteDto,
    permisosVisor: string[],
    sucursalIdVisor: string | null,
  ) {
    // findOne ya aplica el filtro de sucursal: un empleado sin permiso de "ver todas" ni
    // siquiera encuentra (404) un cliente de otra sucursal para editarlo.
    const actual = await this.findOne(empresaId, id, permisosVisor, sucursalIdVisor);

    if (dto.sucursalId !== undefined) {
      if (!puedeVerTodasSucursales(permisosVisor)) {
        throw new ForbiddenException('No tienes permiso para cambiar la sucursal de un cliente');
      }
      await this.validarSucursal(empresaId, dto.sucursalId);
    }

    if (dto.telefono !== undefined || dto.email !== undefined) {
      await this.validarNoDuplicado(empresaId, { telefono: dto.telefono, email: dto.email }, id);
    }

    // "nombre" (usado en el resto de la app) se recalcula si cambia cualquiera de los dos,
    // completando con el valor ya guardado para el que no vino en este PATCH.
    const nombres = dto.nombres?.trim() ?? actual.nombres;
    const apellidos = dto.apellidos?.trim() ?? actual.apellidos;
    const nombreCambio = dto.nombres !== undefined || dto.apellidos !== undefined;

    const cliente = await this.prisma.cliente.update({
      where: { id },
      data: {
        ...dto,
        nombres,
        apellidos,
        nombre: nombreCambio ? `${nombres} ${apellidos}`.trim() : undefined,
        email: dto.email?.toLowerCase(),
        atributosExtra: dto.atributosExtra as Prisma.InputJsonValue | undefined,
      },
      include: INCLUDE_SUCURSAL,
    });

    // Si es un socio con la app, ve enseguida su nombre, teléfono, sucursal o baja.
    void this.avisos?.avisarSocio(id);
    return cliente;
  }

  /**
   * Borrado real (no archivar) — solo permitido si el cliente no tiene NADA de historial
   * enganchado (ventas, citas, membresías, mediciones físicas, cuentas, activos asignados).
   * Pensado para corregir un alta hecha por error, no para "limpiar" clientes reales.
   */
  async remove(
    empresaId: string,
    id: string,
    permisosVisor: string[],
    sucursalIdVisor: string | null,
  ) {
    await this.findOne(empresaId, id, permisosVisor, sucursalIdVisor);

    const [ordenes, citas, activos, movimientosCuenta, membresias, mediciones] = await Promise.all([
      this.prisma.orden.count({ where: { clienteId: id } }),
      this.prisma.cita.count({ where: { clienteId: id } }),
      this.prisma.asignacionActivo.count({ where: { clienteId: id } }),
      this.prisma.movimientoCuenta.count({ where: { clienteId: id } }),
      this.prisma.membresia.count({ where: { clienteId: id } }),
      this.prisma.medicionCorporal.count({ where: { clienteId: id } }),
    ]);

    const enUso = ordenes + citas + activos + movimientosCuenta + membresias + mediciones > 0;
    if (enUso) {
      throw new ConflictException(
        'Este cliente ya tiene historial (ventas, citas, membresías, cuentas, mediciones o activos) y no se puede eliminar — archívalo en su lugar.',
      );
    }

    await this.prisma.cliente.delete({ where: { id } });
  }
}
