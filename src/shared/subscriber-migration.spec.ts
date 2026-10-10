import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
const sendMock = vi.hoisted(() => vi.fn());
vi.mock("./s3", () => ({ s3: { send: sendMock } }));
import { migrateSubscribers } from "./subscriber-migration";

const key = "subscribers/audit@example.com.json";
const body = Buffer.from(
  JSON.stringify({ email: "audit@example.com", createdAt: "2026-10-09" }),
);
const response = (value: Buffer) => ({
  Body: { transformToByteArray: async () => value },
});

describe("migración privada de suscriptores", () => {
  beforeEach(() => sendMock.mockReset());

  it("el modo por defecto solo lista, sin leer datos ni escribir", async () => {
    sendMock.mockResolvedValue({ Contents: [{ Key: key }] });
    expect(await migrateSubscribers("public", "private", "plan")).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(ListObjectsV2Command);
  });

  it("copia y verifica el contenido sin borrar la fuente", async () => {
    sendMock
      .mockResolvedValueOnce({ Contents: [{ Key: key }] })
      .mockResolvedValueOnce(response(body))
      .mockRejectedValueOnce(
        Object.assign(new Error("missing"), { name: "NoSuchKey" }),
      )
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(response(body));
    expect(await migrateSubscribers("public", "private", "copy")).toBe(1);
    const put = sendMock.mock.calls
      .map(([command]) => command)
      .find(
        (command) => command instanceof PutObjectCommand,
      ) as PutObjectCommand;
    expect(put.input).toMatchObject({
      Bucket: "private",
      Key: key,
      IfNoneMatch: "*",
      Body: body,
    });
    expect(
      sendMock.mock.calls.some(
        ([command]) => command instanceof DeleteObjectCommand,
      ),
    ).toBe(false);
  });

  it("no borra ni sobrescribe una copia diferente", async () => {
    sendMock
      .mockResolvedValueOnce({ Contents: [{ Key: key }] })
      .mockResolvedValueOnce(response(body))
      .mockResolvedValueOnce(response(Buffer.from("different")));
    await expect(
      migrateSubscribers("public", "private", "remove-public"),
    ).rejects.toThrow("differs");
    expect(
      sendMock.mock.calls.every(
        ([command]) =>
          command instanceof GetObjectCommand ||
          command instanceof ListObjectsV2Command,
      ),
    ).toBe(true);
  });

  it("retira la copia pública únicamente después de verificar el destino y releer la fuente", async () => {
    sendMock
      .mockResolvedValueOnce({ Contents: [{ Key: key }] })
      .mockResolvedValueOnce(response(body))
      .mockResolvedValueOnce(response(body))
      .mockResolvedValueOnce(response(body))
      .mockResolvedValueOnce({});
    expect(await migrateSubscribers("public", "private", "remove-public")).toBe(
      1,
    );
    const last = sendMock.mock.calls.at(-1)?.[0] as DeleteObjectCommand;
    expect(last).toBeInstanceOf(DeleteObjectCommand);
    expect(last.input).toEqual({ Bucket: "public", Key: key });
  });

  it("detiene el borrado cuando cambia la fuente", async () => {
    sendMock
      .mockResolvedValueOnce({ Contents: [{ Key: key }] })
      .mockResolvedValueOnce(response(body))
      .mockResolvedValueOnce(response(body))
      .mockResolvedValueOnce(response(Buffer.from("changed")));
    await expect(
      migrateSubscribers("public", "private", "remove-public"),
    ).rejects.toThrow("changed");
    expect(
      sendMock.mock.calls.some(
        ([command]) => command instanceof DeleteObjectCommand,
      ),
    ).toBe(false);
  });

  it("rechaza un destino igual al bucket público", async () => {
    await expect(
      migrateSubscribers("public", "public", "copy"),
    ).rejects.toThrow("Distinct");
    expect(sendMock).not.toHaveBeenCalled();
  });
});
