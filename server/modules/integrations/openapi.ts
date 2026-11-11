const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const uuid = { type: "string", format: "uuid" };
const nullableUuid = { type: "string", format: "uuid", nullable: true };

const batchResponse = {
  type: "object",
  properties: {
    request_id: schemaRef("Id1c"),
    count: { type: "integer" },
    counts: { type: "object", additionalProperties: { type: "integer" } },
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id_1c: schemaRef("Id1c"),
          type: schemaRef("IntegrationEntityType"),
          outcome: { type: "string", enum: ["created", "updated", "deleted", "skipped", "error", "conflict"] },
          code: { type: "string" },
          entity_id: schemaRef("Id1c"),
        },
      },
    },
  },
};
const syncRequest = (schemaName: string) => ({
  required: ["items"],
  type: "object",
  properties: { items: { type: "array", minItems: 1, maxItems: 500, items: schemaRef(schemaName) } },
});
const syncOperation = (summary: string, tag: string, schemaName: string) => ({
  post: {
    tags: [tag],
    summary,
    description: "Пакет до 500 элементов. Результат и аудит возвращаются отдельно по каждому Id_1c; повторный Id_1c в одном пакете считается ошибкой.",
    security: [{ bearerAuth: [] }],
    requestBody: { required: true, content: { "application/json": { schema: syncRequest(schemaName) } } },
    responses: {
      "200": { description: "Обработка пакета завершена", content: { "application/json": { schema: batchResponse } } },
      "400": { description: "Некорректная структура запроса" },
      "401": { description: "Ключ отсутствует, неверен или отозван" },
    },
  },
});
const readOperation = (summary: string, tag: string) => ({
  get: {
    tags: [tag],
    summary,
    description: "Возвращает только активные записи, уже связанные с Id_1c.",
    security: [{ bearerAuth: [] }],
    responses: { "200": { description: "Справочник получен" }, "401": { description: "Неверный API-ключ" } },
  },
});
const pagedReadOperation = (summary: string, tag: string, description = "Постраничная выгрузка записей. Параметры limit и offset; максимальный limit — 500.") => ({
  get: {
    tags: [tag],
    summary,
    description,
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } },
      { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0, default: 0 } },
    ],
    responses: { "200": { description: "Страница справочника получена" }, "400": { description: "Некорректные параметры страницы" }, "401": { description: "Неверный API-ключ" } },
  },
});

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Авиасервис — API интеграции с 1С",
    version: "1.2.0",
    description: [
      "API предназначен для серверного обмена справочниками между 1С и приложением.",
      "Все `/v1` методы требуют `Authorization: Bearer <key>`. Ключ выпускается администратором и показывается только один раз.",
      "Сначала синхронизируйте валюты до курсов, контрагентов до договоров, а виды номенклатуры и единицы измерения до номенклатуры.",
      "Id_1c должен быть UUID. Удаление в 1С выполняется мягко, история и связанные операции в приложении сохраняются.",
      "Базисы и цены принадлежат приложению и доступны 1С только для чтения. Символ валюты и флаг номенклатуры по умолчанию являются локальными настройками приложения.",
    ].join("\n\n"),
  },
  servers: [{ url: "/api/integrations/1c/v1", description: "Текущий сервер приложения" }],
  tags: [
    { name: "Служебные" },
    { name: "Контрагенты" },
    { name: "Договоры" },
    { name: "Номенклатура" },
    { name: "Валюты и курсы" },
    { name: "Справочники приложения" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key" },
    },
    schemas: {
      Id1c: uuid,
      CounterpartyType: {
        type: "string",
        description: "Вид контрагента. Используется в поле type и в паре с counterparty_id_1c.",
        enum: ["supplier", "customer", "carrier"],
      },
      ProductType: {
        type: "string",
        description: "Тип продукта приложения: kerosene — керосин, pvkj — ПВКЖ, service — услуга.",
        enum: ["kerosene", "pvkj", "service"],
      },
      Status: {
        type: "string",
        nullable: true,
        description: "Состояние записи: active/updated обрабатываются как действующая запись; deleted выполняет мягкое удаление.",
        enum: ["active", "updated", "deleted"],
      },
      IntegrationEntityType: {
        type: "string",
        description: "Тип сущности в результате обработки пакета.",
        enum: ["supplier", "customer", "carrier", "counterparty_contracts", "nomenclature_types", "units_of_measure", "nomenclature", "currencies", "exchange_rates"],
      },
      CounterpartySyncItem: {
        type: "object",
        required: ["type", "id_1c", "name"],
        properties: {
          type: schemaRef("CounterpartyType"),
          id_1c: schemaRef("Id1c"),
          inn: { type: "string", nullable: true, maxLength: 32 },
          name: { type: "string", maxLength: 255 },
          full_name: { type: "string", nullable: true, maxLength: 500 },
          status: schemaRef("Status"),
        },
      },
      ContractSyncItem: {
        type: "object",
        required: ["id_1c", "contract_name", "contract_number", "contract_date", "counterparty_type", "counterparty_id_1c"],
        properties: {
          id_1c: schemaRef("Id1c"),
          contract_name: { type: "string", maxLength: 500 },
          contract_number: { type: "string", maxLength: 120 },
          contract_date: { type: "string", format: "date" },
          counterparty_type: schemaRef("CounterpartyType"),
          counterparty_id_1c: schemaRef("Id1c"),
          parent_contract_id_1c: nullableUuid,
          status: schemaRef("Status"),
        },
      },
      NomenclatureTypeSyncItem: {
        type: "object",
        required: ["id_1c", "code", "name"],
        properties: {
          id_1c: schemaRef("Id1c"),
          code: { type: "string", maxLength: 100 },
          name: { type: "string", maxLength: 255 },
          status: schemaRef("Status"),
        },
      },
      UnitSyncItem: {
        type: "object",
        required: ["id_1c", "short_name", "full_name"],
        properties: {
          id_1c: schemaRef("Id1c"),
          short_name: { type: "string", maxLength: 80 },
          full_name: { type: "string", maxLength: 255 },
          conversion_factor: { type: "number", exclusiveMinimum: 0, nullable: true },
          reference_unit_id_1c: nullableUuid,
          status: schemaRef("Status"),
        },
      },
      NomenclatureSyncItem: {
        type: "object",
        required: ["id_1c", "product_type", "name", "unit_id_1c"],
        properties: {
          id_1c: schemaRef("Id1c"),
          product_type: schemaRef("ProductType"),
          nomenclature_type_id_1c: nullableUuid,
          name: { type: "string", maxLength: 255 },
          unit_id_1c: schemaRef("Id1c"),
          status: schemaRef("Status"),
        },
      },
      CurrencySyncItem: {
        type: "object",
        required: ["id_1c", "code", "name"],
        properties: {
          id_1c: schemaRef("Id1c"),
          code: { type: "string", maxLength: 10 },
          name: { type: "string", maxLength: 255 },
          status: schemaRef("Status"),
        },
      },
      ExchangeRateSyncItem: {
        type: "object",
        required: ["id_1c", "currency_code", "target_currency_code", "rate", "rate_date"],
        properties: {
          id_1c: schemaRef("Id1c"),
          currency_code: { type: "string", maxLength: 10 },
          target_currency_code: { type: "string", maxLength: 10 },
          rate: { type: "number", exclusiveMinimum: 0 },
          rate_date: { type: "string", format: "date" },
          status: schemaRef("Status"),
        },
      },
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
    "/counterparties": readOperation("Получить контрагентов", "Контрагенты"),
    "/counterparties/sync": syncOperation("Синхронизировать контрагентов", "Контрагенты", "CounterpartySyncItem"),
    "/contracts": readOperation("Получить договоры контрагентов", "Договоры"),
    "/contracts/sync": syncOperation("Синхронизировать договоры", "Договоры", "ContractSyncItem"),
    "/nomenclature-types": readOperation("Получить виды номенклатуры", "Номенклатура"),
    "/nomenclature-types/sync": syncOperation("Синхронизировать виды номенклатуры", "Номенклатура", "NomenclatureTypeSyncItem"),
    "/units-of-measure": readOperation("Получить единицы измерения", "Номенклатура"),
    "/units-of-measure/sync": syncOperation("Синхронизировать единицы измерения", "Номенклатура", "UnitSyncItem"),
    "/nomenclature": readOperation("Получить номенклатуру", "Номенклатура"),
    "/nomenclature/sync": syncOperation("Синхронизировать номенклатуру", "Номенклатура", "NomenclatureSyncItem"),
    "/currencies": readOperation("Получить валюты", "Валюты и курсы"),
    "/currencies/sync": syncOperation("Синхронизировать валюты", "Валюты и курсы", "CurrencySyncItem"),
    "/exchange-rates": pagedReadOperation("Получить курсы валют", "Валюты и курсы"),
    "/exchange-rates/sync": syncOperation("Синхронизировать курсы валют", "Валюты и курсы", "ExchangeRateSyncItem"),
    "/bases": {
      get: {
        tags: ["Справочники приложения"],
        summary: "Получить базисы приложения",
        description: "Возвращает базисы, не удалённые в приложении. Идентификатор id — UUID приложения.",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Базисы получены" }, "401": { description: "Неверный API-ключ" } },
      },
    },
    "/prices": pagedReadOperation(
      "Получить цены приложения",
      "Справочники приложения",
      "Постраничная выгрузка цен, не удалённых в приложении. Идентификатор id — UUID приложения; limit от 1 до 500, offset от 0.",
    ),
  },
} as const;
