/** Erros de dominio da aplicacao + normalizacao de mensagens para o usuario. */

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    message: string,
    options: { code?: string; status?: number; details?: unknown } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = options.code ?? "app_error";
    this.status = options.status ?? 400;
    this.details = options.details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Dados invalidos.", details?: unknown) {
    super(message, { code: "validation_error", status: 422, details });
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Registro nao encontrado.") {
    super(message, { code: "not_found", status: 404 });
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Acesso nao autorizado.") {
    super(message, { code: "unauthorized", status: 401 });
    this.name = "UnauthorizedError";
  }
}

export class StoreClosedError extends AppError {
  constructor(message = "A loja esta fechada no momento.") {
    super(message, { code: "store_closed", status: 409 });
    this.name = "StoreClosedError";
  }
}

/** Resultado padronizado usado por Server Actions. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function actionOk(): ActionResult<undefined>;
export function actionOk<T>(data: T): ActionResult<T>;
export function actionOk<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function actionError(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Converte qualquer excecao em mensagem segura para exibir ao usuario. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  if (isPostgresError(error)) return translatePostgresError(error);
  if (error instanceof Error) {
    if (process.env.NODE_ENV !== "production") return error.message;
    return "Ocorreu um erro inesperado. Tente novamente.";
  }
  return "Ocorreu um erro inesperado. Tente novamente.";
}

type PostgresError = { code: string; message: string; details?: string | null };

function isPostgresError(error: unknown): error is PostgresError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

/** Codigos SQLSTATE mais comuns nas operacoes do painel. */
const POSTGRES_MESSAGES: Record<string, string> = {
  "23502": "Preencha todos os campos obrigatorios.",
  "23503": "Registro vinculado a outros dados. Remova os vinculos primeiro.",
  "23505": "Ja existe um registro com estes dados.",
  "23514": "Valor invalido para este campo.",
  "23P01": "Registro vinculado a outros dados.",
  "42501": "Voce nao tem permissao para esta operacao.",
  PGRST116: "Registro nao encontrado.",
  PGRST301: "Sessao expirada. Faca login novamente.",
};

function translatePostgresError(error: PostgresError): string {
  const known = POSTGRES_MESSAGES[error.code];
  if (known) return known;
  if (process.env.NODE_ENV !== "production") {
    return `${error.code}: ${error.message}`;
  }
  return "Nao foi possivel concluir a operacao. Tente novamente.";
}

/** Log de erro com contexto — em producao, plugar aqui um servico externo. */
export function logError(context: string, error: unknown) {
  console.error(`[${context}]`, error);
}
