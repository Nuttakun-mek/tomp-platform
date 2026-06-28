export type ProjectId = string;
export type MissionId = string;
export type AssignmentId = string;

export type OperatingStage = "plan" | "prepare" | "publish" | "operate" | "recover" | "review";

export * from "./domain";
export * from "./schemas";
export * from "./timeline";
