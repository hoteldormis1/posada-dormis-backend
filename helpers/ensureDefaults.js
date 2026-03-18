import { EstadoReserva } from "../models/estadoReserva.js";
import { TipoUsuario } from "../models/tipoUsuario.js";
import { sequelize } from "../db.js";

const all = { create: true, read: true, update: true, delete: true };

const sysadminPerms = {
    usuario: all,
    tipoHabitacion: all,
    habitacion: all,
    reserva: all,
    huesped: all,
    estadoReserva: all,
    auditoria: all,
    huespedNoDeseado: all,
};

const adminPerms = {
    usuario: { read: true, create: false, delete: false, update: false },
    tipoHabitacion: all,
    habitacion: all,
    reserva: all,
    huesped: all,
    estadoReserva: all,
    auditoria: { read: true, create: false, delete: false, update: false },
    huespedNoDeseado: all,
};

/*const readerPerms = {
    usuario: { read: true, create: false, delete: false, update: false },
    tipoHabitacion: { read: true, create: false, delete: false, update: false },
    habitacion: { read: true, create: false, delete: false, update: false },
    reserva: { read: true, create: false, delete: false, update: false },
    huesped: { read: true, create: false, delete: false, update: false },
    estadoReserva: { read: true, create: false, delete: false, update: false },
    auditoria: { read: true, create: false, delete: false, update: false },
    huespedNoDeseado: { read: true, create: false, delete: false, update: false },
};*/

export async function ensureDefaultRoles() {
    const defaults = [
        {
            nombre: "sysadmin",
            descripcion: "Superusuario del sistema",
            permisos: sysadminPerms,
            esSistema: true,
            prioridad: 1,
        },
        {
            nombre: "admin",
            descripcion: "Administrador",
            permisos: adminPerms,
            esSistema: true,
            prioridad: 10,
        },
        /*{
            nombre: "reader",
            descripcion: "Reader sólo de pruebas",
            permisos: readerPerms,
            esSistema: true,
            prioridad: 100,
        },*/
    ];

    for (const role of defaults) {
        const [record, created] = await TipoUsuario.findOrCreate({
            where: { nombre: role.nombre },
            defaults: role,
        });
        if (!created) {
            await record.update({ permisos: role.permisos });
        }
    }
}

export async function ensureUsuariosTipoAsignado() {
    const [admin] = await TipoUsuario.findAll({ where: { nombre: "admin" }, limit: 1 });
    if (admin) {
        // Asigna rol "admin" a usuarios que no tengan idTipoUsuario (cuentas pre-migración)
        await sequelize.query(
            `UPDATE "Usuario" SET "idTipoUsuario" = :id WHERE "idTipoUsuario" IS NULL`,
            { replacements: { id: admin.idTipoUsuario } }
        );
    }
    // Los usuarios pre-existentes ya estaban operativos: marcarlos como verificados
    await sequelize.query(`UPDATE "Usuario" SET "verificado" = TRUE WHERE "verificado" = FALSE`);
}

export async function ensureDefaultReservaStates() {
    const estados = [
        { nombre: "pendiente", descripcion: "Reserva creada, esperando confirmación/garantía", prioridad: 100, esDefault: true },
        { nombre: "confirmada", descripcion: "Reserva garantizada (tarjeta/depósito)", prioridad: 90 },
        { nombre: "checkin", descripcion: "Huésped ingresó (estancia en curso)", prioridad: 80 },
        { nombre: "checkout", descripcion: "Estadía finalizada (salida realizada)", prioridad: 70 },
        { nombre: "cancelada", descripcion: "Reserva anulada antes del inicio", prioridad: 60 },
        { nombre: "rechazada", descripcion: "Reserva rechazada por administración desde estado pendiente", prioridad: 55 },
        //{ nombre: "no_show", descripcion: "Huésped no se presentó", prioridad: 50 },
    ];

    // Crear los estados si no existen
    for (const e of estados) {
        await EstadoReserva.findOrCreate({
            where: { nombre: e.nombre },
            defaults: e,
        });
    }

    // Asegurar que solo "pendiente" sea el default (único true)
    // Primero, apaga todos
    await EstadoReserva.update({ esDefault: false }, { where: {} });
    // Luego, enciende el deseado
    await EstadoReserva.update({ esDefault: true }, { where: { nombre: "pendiente" } });
}

export async function ensureHabitacionSchema() {
    // Columnas de timestamps presentes en todos los modelos con timestamps+paranoid
    const addTs = [
        `ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`,
        `ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()`,
        `ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE`,
    ].join(', ');

    await sequelize.query(`ALTER TABLE "TipoUsuario"
        ADD COLUMN IF NOT EXISTS "descripcion" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "permisos"    JSONB,
        ADD COLUMN IF NOT EXISTS "esSistema"   BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "activo"      BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS "prioridad"   INTEGER NOT NULL DEFAULT 100,
        ${addTs};`);

    await sequelize.query(`ALTER TABLE "Usuario"
        ADD COLUMN IF NOT EXISTS "verificado"         BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "verifyToken"        VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "verifyTokenExpires" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "resetToken"         VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "resetTokenExpires"  TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "idTipoUsuario"      INTEGER,
        ${addTs};`);

    await sequelize.query(`ALTER TABLE "Habitacion"
        ADD COLUMN IF NOT EXISTS "fueraDeServicio" BOOLEAN NOT NULL DEFAULT FALSE,
        ${addTs};`);

    await sequelize.query(`ALTER TABLE "TipoHabitacion" ${addTs};`);

    await sequelize.query(`ALTER TABLE "EstadoReserva" ${addTs};`);

    await sequelize.query(`ALTER TABLE "Reserva" ${addTs};`);

    await sequelize.query(`ALTER TABLE "Huesped" ${addTs};`);

    await sequelize.query(`ALTER TABLE "HuespedNoDeseado" ${addTs};`);

    await sequelize.query(`ALTER TABLE "Auditoria"
        ${addTs};`);
}