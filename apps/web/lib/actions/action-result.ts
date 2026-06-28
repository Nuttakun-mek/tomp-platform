export interface ActionResult<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export function actionSuccess<TData>(data: TData): ActionResult<TData> {
  return { success: true, data };
}

export function actionFailure(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { success: false, error, fieldErrors };
}
