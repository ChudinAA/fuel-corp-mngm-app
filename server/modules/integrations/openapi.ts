const uuid = { type: "string", format: "uuid" };
const status = {
  type: "string",
  enum: ["active", "enabled", "активен", "действующий", "deleted", "delete", "deletion_marked", "пометка удаления", "удален", "удалён"],
  description: "Необязательный статус. Пустое значение не меняет локальный статус.",
};
const batchResponse = {
  type: "object",
  properties: {
    request_id: uuid,
    count: { type: "integer" },
    counts: { type: "object", additionalProperties: { type: "integer" } },
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id_1c: uuid,
          type: { type: "string" },
          outcome: { type: "string", enum: ["created", "updated", "deleted", "skipped", "error"] },
          code: { type: "string" },
          entity_id: uuid,
        },
      },
    },
  },
};
const syncRequest = (item: Record<string, unknown>) => ({
  required: ["items"],
  type: "object",
  properties: { items: { type: "array", minItems: 1, maxItems: 500, items: item } },
});
const syncOperation = (summary: string, item: Record<string, unknown>) => ({
  post: {
    summary,
    description: "Пакет до 500 элементов. Результат и аудит возвращаются отдельно по каждому Id_1c; повторный Id_1c в одном пакете считается ошибкой.",
    security: [{ bearerAuth: [] }],
    requestBody: { required: true, content: { "application/json": { schema: syncRequest(item) } } },
    responses: {
      "200": { description: "Обработка пакета завершена", content: { "application/json": { schema: batchResponse } } },
      "400": { description: "Некорректная структура запроса" },
      "401": { description: "Ключ отсутствует, неверен или отозван" },
    },
  },
});
const readOperation = (summary: string) => ({
  get: {
    summary,
    description: "Возвращает только активные записи, уже связанные с Id_1c.",
    security: [{ bearerAuth: [] }],
    responses: { "200": { description: "Справочник получен" }, "401": { description: "Неверный API-ключ" } },
  },
});

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Авиасервис — API интеграции с 1С",
    version: "1.1.0",
    description: [
      "API предназначен для серверного обмена справочниками между 1С и приложением.",
      "Все `/v1` методы требуют `Authorization: Bearer <key>`. Ключ выпускается администратором и показывается только один раз.",
      "Сначала синхронизируйте контрагентов, затем договоры; перед номенклатурой передайте виды и единицы измерения.",
      "Id_1c должен быть UUID. Удаление в 1С выполняется мягко, история и связанные операции в приложении сохраняются.",
    ].join("\n\n"),
  },
  servers: [{ url: "/api/integrations/1c/v1", description: "Текущий сервер приложения" }],
  tags: [
    { name: "Служебные" },
    { name: "Контрагенты" },
    { name: "Договоры" },
    { name: "Номенклатура" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key" },
    },
    schemas: {
      Id1c: uuid,
      Status: status,
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Проверить доступность API",
        tags: ["Служебные"],
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "API доступен" }, "401": { description: "Неверный API-ключ" } },
      },
    },
    "/counterparties": readOperation("Получить контрагентов"),
    "/counterparties/sync": syncOperation("Синхронизировать контрагентов", {
      type: "object",
      required: ["type", "id_1c", "name"],
      properties: {
        type: { type: "string", enum: ["supplier", "customer", "carrier"] },
        id_1c: uuid,
        inn: { type: "string", nullable: true, maxLength: 32 },
        name: { type: "string", maxLength: 255 },
        full_name: { type: "string", nullable: true, maxLength: 500 },
        status,
      },
    }),
    "/contracts": readOperation("Получить договоры контрагентов"),
    "/contracts/sync": syncOperation("Синхронизировать договоры", {
      type: "object",
      required: ["id_1c", "contract_name", "contract_number", "contract_date", "counterparty_type", "counterparty_id_1c"],
      properties: {
        id_1c: uuid,
        contract_name: { type: "string", maxLength: 500 },
        contract_number: { type: "string", maxLength: 120 },
        contract_date: { type: "string", format: "date" },
        counterparty_type: { type: "string", enum: ["supplier", "customer", "carrier"] },
        counterparty_id_1c: uuid,
        parent_contract_id_1c: { ...uuid, nullable: true },
        status,
      },
    }),
    "/nomenclature-types": readOperation("Получить виды номенклатуры"),
    "/nomenclature-types/sync": syncOperation("Синхронизировать виды номенклатуры", {
      type: "object",
      required: ["id_1c", "code", "name"],
      properties: { id_1c: uuid, code: { type: "string", maxLength: 100 }, name: { type: "string", maxLength: 255 }, status },
    }),
    "/units-of-measure": readOperation("Получить единицы измерения"),
    "/units-of-measure/sync": syncOperation("Синхронизировать единицы измерения", {
      type: "object",
      required: ["id_1c", "short_name", "full_name"],
      properties: {
        id_1c: uuid,
        short_name: { type: "string", maxLength: 80 },
        full_name: { type: "string", maxLength: 255 },
        conversion_factor: { type: "number", exclusiveMinimum: 0, nullable: true },
        reference_unit_id_1c: { ...uuid, nullable: true },
        status,
      },
    }),
    "/nomenclature": readOperation("Получить номенклатуру"),
    "/nomenclature/sync": syncOperation("Синхронизировать номенклатуру", {
      type: "object",
      required: ["id_1c", "product_type", "name", "unit_id_1c"],
      properties: {
        id_1c: uuid,
        product_type: { type: "string", enum: ["kerosene", "pvkj", "service"] },
        nomenclature_type_id_1c: { ...uuid, nullable: true },
        name: { type: "string", maxLength: 255 },
        unit_id_1c: uuid,
        is_default: { type: "boolean" },
        status,
      },
    }),
  },
} as const;
