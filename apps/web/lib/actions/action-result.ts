export interface ActionResult<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  warning?: string;
}

export function actionSuccess<TData>(data: TData, warning?: string): ActionResult<TData> {
  return { success: true, data, warning };
}

export function actionFailure(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { success: false, error, fieldErrors };
}
